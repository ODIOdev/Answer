import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import formbody from "@fastify/formbody";
import websocket from "@fastify/websocket";
import twilio from "twilio";
import { z } from "zod";
import { decideAgentResponse, isOpenAIConfigured } from "./agent.js";
import { renderDashboard } from "./dashboard.js";
import {
  attachSession,
  createCall,
  createProfile,
  finishCall,
  getDashboardStats,
  getProfileByPhone,
  isSupabaseConfigured,
  listCalls,
  listProfiles,
  saveTranscript,
  updateProfile,
} from "./db.js";
import {
  hasPublicVoiceUrls,
  isTwilioConfigured,
  resolvedHttpBase,
  resolvedWsBase,
  shouldValidateTwilioHttp,
  validateTwilioHttpRequest,
  validateTwilioWebSocketHandshake,
} from "./twilio-security.js";
import {
  assertSafeAuthorizedFacts,
  DEFAULT_DISCLOSURE,
  purchaseNumberSchema,
  updateProfileSchema,
  type AgentProfile,
  type ConversationRelayMessage,
  type LiveCallState,
  type TranscriptTurn,
} from "./types.js";

const app = Fastify({
  logger: true,
  trustProxy: true,
});

function publicUrls() {
  const http = resolvedHttpBase();
  const ws = resolvedWsBase();
  return {
    publicBaseUrl: http,
    wsBaseUrl: ws,
    voiceWebhook: `${http}/voice`,
    conversationRelay: `${ws}/conversation-relay`,
    connectAction: `${http}/connect-action`,
    statusCallback: `${http}/status`,
  };
}

function pathOf(url: string): string {
  return url.split("?")[0] ?? url;
}

function needsAdmin(path: string): boolean {
  return (
    path === "/" ||
    path === "/api/dashboard" ||
    path.startsWith("/api/agents") ||
    path.startsWith("/api/calls") ||
    path.startsWith("/api/numbers")
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  const size = Math.max(left.length, right.length, 1);
  const paddedLeft = Buffer.alloc(size);
  const paddedRight = Buffer.alloc(size);
  left.copy(paddedLeft);
  right.copy(paddedRight);
  return timingSafeEqual(paddedLeft, paddedRight) && left.length === right.length;
}

function checkBasicAuth(header: string | string[] | undefined): boolean {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const username = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);
  return (
    safeEqual(username, process.env.ADMIN_USERNAME || "admin") &&
    safeEqual(password, process.env.ADMIN_PASSWORD || "change-this-immediately")
  );
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio is not configured");
  }
  return twilio(sid, token);
}

function mapTtsProvider(provider: string): "Google" | "Amazon" | "ElevenLabs" {
  const value = provider.toLowerCase();
  if (value === "amazon") return "Amazon";
  if (value === "elevenlabs") return "ElevenLabs";
  return "Google";
}

function pickVoice(voicePool: string[]): string {
  const voices = voicePool.map((item) => item.trim()).filter(Boolean);
  if (voices.length === 0) return "en-US-Journey-O";
  return voices[Math.floor(Math.random() * voices.length)] ?? "en-US-Journey-O";
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateSpeechMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(12_000, Math.max(2_500, Math.round(words * 380) + 700));
}

function sendTwiml(reply: { type: (value: string) => unknown; send: (value: string) => unknown }, xml: string) {
  reply.type("text/xml");
  return reply.send(xml);
}

function twimlSayHangup(message: string): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(message);
  response.hangup();
  return response.toString();
}

function twimlSayDial(message: string, number: string): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(message);
  response.dial(number);
  return response.toString();
}

function twimlHangup(): string {
  const response = new twilio.twiml.VoiceResponse();
  response.hangup();
  return response.toString();
}

function buildConversationRelayTwiml(input: {
  disclosure: string;
  ttsProvider: string;
  voice: string;
  profileId: string;
}): string {
  const urls = publicUrls();
  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect({
    action: urls.connectAction,
    method: "POST",
  });
  const relay = connect.conversationRelay({
    url: urls.conversationRelay,
    welcomeGreeting: input.disclosure,
    welcomeGreetingInterruptible: "any",
    language: "en-US",
    ttsProvider: mapTtsProvider(input.ttsProvider),
    voice: input.voice,
    transcriptionProvider: "Google",
    speechModel: "telephony",
  });
  relay.parameter({ name: "selectedVoice", value: input.voice });
  relay.parameter({ name: "profileId", value: input.profileId });
  return response.toString();
}

function formValue(
  body: unknown,
  key: string
): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>)[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function parseHandoffData(raw: string | undefined): {
  reasonCode?: string;
  reason?: string;
  transferNumber?: string;
} {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const data = parsed as Record<string, unknown>;
      return {
        reasonCode: data.reasonCode ? String(data.reasonCode) : undefined,
        reason: data.reason ? String(data.reason) : undefined,
        transferNumber: data.transferNumber
          ? String(data.transferNumber)
          : undefined,
      };
    }
  } catch {
    return {};
  }
  return {};
}

function transferNumberFor(profile?: AgentProfile | null, override?: string): string | null {
  return (
    override ||
    profile?.human_transfer_number ||
    process.env.DEFAULT_HUMAN_TRANSFER_NUMBER ||
    null
  );
}

function logTranscript(callSid: string, turn: TranscriptTurn): void {
  if (process.env.LOG_FULL_TRANSCRIPTS === "true") {
    app.log.info({ callSid, role: turn.role, text: turn.text }, "call transcript");
  } else {
    app.log.info(
      { callSid, role: turn.role, chars: turn.text.length },
      "call transcript"
    );
  }
}

function sendRelay(
  socket: { readyState: number; send: (data: string) => void },
  payload: unknown
): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
}

async function persistTranscript(state: LiveCallState): Promise<void> {
  await saveTranscript(state.callSid, state.transcript);
}

await app.register(formbody);
await app.register(websocket);

async function escalateAndHandoff(
  socket: { readyState: number; send: (data: string) => void },
  state: LiveCallState | null,
  reason: string,
  spoken?: string
): Promise<void> {
  const text =
    spoken ||
    "I cannot personally attest to that. I am an automated authorized assistant. I will route this to the approved human contact.";
  if (state) {
    const turn: TranscriptTurn = { role: "assistant", text, at: nowIso() };
    state.transcript.push(turn);
    logTranscript(state.callSid, turn);
    try {
      await persistTranscript(state);
      await finishCall(state.callSid, {
        status: "human-handoff",
        result: reason,
      });
    } catch (error) {
      app.log.error(
        { err: error instanceof Error ? error.message : "unknown", callSid: state.callSid },
        "Supabase failed during escalation; continuing with human transfer"
      );
    }
  }
  sendRelay(socket, {
    type: "text",
    token: text,
    last: true,
    interruptible: true,
  });
  await sleep(estimateSpeechMs(text));
  sendRelay(socket, {
    type: "end",
    handoffData: JSON.stringify({
      reasonCode: "live-agent-handoff",
      reason,
      transferNumber: transferNumberFor(state?.profile),
    }),
  });
}

app.addHook("onRequest", async (request, reply) => {
  const path = pathOf(request.url);
  if (!needsAdmin(path)) return;
  if (checkBasicAuth(request.headers.authorization)) return;
  reply.header("WWW-Authenticate", 'Basic realm="AI Voice Platform"');
  return reply.code(401).send("Authentication required");
});

app.addHook("preHandler", async (request, reply) => {
  if (request.method !== "POST") return;
  if (!shouldValidateTwilioHttp(request.url)) return;
  if (!validateTwilioHttpRequest(request)) {
    return reply.code(403).send("Forbidden");
  }
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, "unhandled error");
  const raw = error instanceof Error ? error.message : "Internal error";
  const message = /api[_-]?key|auth token|service.role|password|secret/i.test(raw)
    ? "Internal error"
    : raw;
  if (!reply.sent) {
    const code = /is not configured/i.test(raw) ? 503 : 500;
    void reply.code(code).send({ error: message });
  }
});

app.get("/health", async () => ({
  ok: true,
  service: "ai-voice-platform",
}));

app.get("/", async (_request, reply) => {
  reply.type("text/html; charset=utf-8");
  return renderDashboard();
});

app.get("/api/dashboard", async (request) => {
  const urls = publicUrls();
  const providers = {
    twilio: isTwilioConfigured(),
    openai: isOpenAIConfigured(),
    supabase: isSupabaseConfigured(),
  };
  let stats = { agentProfiles: 0, totalCalls: 0, activeCalls: 0 };
  if (providers.supabase) {
    try {
      stats = await getDashboardStats();
    } catch (error) {
      request.log.error(
        { err: error instanceof Error ? error.message : "unknown" },
        "Unable to read dashboard stats from Supabase"
      );
    }
  }
  return { stats, urls, providers };
});

app.get("/api/agents", async () => {
  return listProfiles();
});

app.put("/api/agents/:id", async (request, reply) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const parsed = updateProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || "Invalid profile" });
  }
  if (parsed.data.authorized_facts) {
    try {
      assertSafeAuthorizedFacts(parsed.data.authorized_facts);
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid authorized_facts",
      });
    }
  }
  const patch = {
    ...parsed.data,
    human_transfer_number:
      parsed.data.human_transfer_number === ""
        ? null
        : parsed.data.human_transfer_number,
  };
  const profile = await updateProfile(params.id, patch);
  const warnings: string[] = [];
  if (profile.enabled && !transferNumberFor(profile)) {
    warnings.push(
      "Enabled without a human transfer number. Escalations will end the call until a number is configured."
    );
  }
  return { profile, warnings };
});

app.get("/api/calls", async () => {
  return listCalls();
});

app.get("/api/numbers/search", async (request, reply) => {
  const query = z
    .object({ areaCode: z.string().regex(/^[0-9]{3}$/, "Enter a 3-digit US area code") })
    .safeParse(request.query);
  if (!query.success) {
    return reply.code(400).send({ error: query.error.issues[0]?.message || "Invalid area code" });
  }
  const client = getTwilioClient();
  const numbers = await client.availablePhoneNumbers("US").local.list({
    areaCode: Number(query.data.areaCode),
    voiceEnabled: true,
    limit: 10,
  });
  return {
    numbers: numbers.map((item) => ({
      phoneNumber: item.phoneNumber,
      locality: item.locality,
      region: item.region,
    })),
  };
});

app.post("/api/numbers/purchase", async (request, reply) => {
  const parsed = purchaseNumberSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || "Invalid purchase request" });
  }
  if (!hasPublicVoiceUrls()) {
    return reply.code(400).send({
      error: "Set PUBLIC_BASE_URL before purchasing a number so Twilio can reach /voice.",
    });
  }
  const urls = publicUrls();
  const client = getTwilioClient();
  const incoming = await client.incomingPhoneNumbers.create({
    phoneNumber: parsed.data.phoneNumber,
    voiceUrl: urls.voiceWebhook,
    voiceMethod: "POST",
    statusCallback: urls.statusCallback,
    statusCallbackMethod: "POST",
  });
  const profile = await createProfile({
    label: parsed.data.label,
    phone_number: incoming.phoneNumber,
    twilio_phone_sid: incoming.sid,
    enabled: false,
  });
  return {
    ok: true,
    message:
      "Purchased successfully. Configure approved facts and human transfer number, then enable the profile.",
    profile,
  };
});

app.post("/voice", async (request, reply) => {
  const callSid = formValue(request.body, "CallSid") || "";
  const from = formValue(request.body, "From") || "";
  const to = formValue(request.body, "To") || "";

  if (!hasPublicVoiceUrls()) {
    return sendTwiml(
      reply,
      twimlSayHangup(
        "This automated line has a configuration error. Please contact the company directly."
      )
    );
  }

  let profile: AgentProfile | null = null;
  try {
    profile = to ? await getProfileByPhone(to, { enabledOnly: true }) : null;
  } catch (error) {
    request.log.error(
      { err: error instanceof Error ? error.message : "unknown", to },
      "Supabase failed while loading profile"
    );
    const fallback = process.env.DEFAULT_HUMAN_TRANSFER_NUMBER;
    if (fallback) {
      return sendTwiml(
        reply,
        twimlSayDial(
          "I am an automated authorized assistant. Please hold while I connect you to the authorized human contact.",
          fallback
        )
      );
    }
    return sendTwiml(
      reply,
      twimlSayHangup(
        "This automated line has a configuration error. Please contact the company directly."
      )
    );
  }

  if (!profile) {
    return sendTwiml(
      reply,
      twimlSayHangup(
        "This automated line is not configured. Please contact the company directly."
      )
    );
  }

  const voice = pickVoice(profile.voice_pool);
  try {
    await createCall({
      callSid,
      profileId: profile.id,
      fromNumber: from,
      toNumber: to,
      voiceName: voice,
      status: "in-progress",
    });
  } catch (error) {
    request.log.error(
      { err: error instanceof Error ? error.message : "unknown", callSid },
      "Supabase failed while creating call session"
    );
    const fallback = transferNumberFor(profile);
    if (fallback) {
      return sendTwiml(
        reply,
        twimlSayDial(
          "Please hold while I connect you to the authorized human contact.",
          fallback
        )
      );
    }
    return sendTwiml(
      reply,
      twimlSayHangup(
        "This automated line has a configuration error. Please contact the company directly."
      )
    );
  }

  return sendTwiml(
    reply,
    buildConversationRelayTwiml({
      disclosure: profile.disclosure || DEFAULT_DISCLOSURE,
      ttsProvider: String(profile.tts_provider || "google"),
      voice,
      profileId: profile.id,
    })
  );
});

app.post("/connect-action", async (request, reply) => {
  const callSid = formValue(request.body, "CallSid") || "";
  const handoff = parseHandoffData(
    formValue(request.body, "HandoffData") || formValue(request.body, "handoffData")
  );

  if (handoff.reasonCode === "live-agent-handoff") {
    const number = transferNumberFor(null, handoff.transferNumber);
    try {
      await finishCall(callSid, {
        status: "human-handoff",
        result: handoff.reason || "live-agent-handoff",
      });
    } catch (error) {
      request.log.error(
        { err: error instanceof Error ? error.message : "unknown", callSid },
        "Failed to update call after handoff"
      );
    }
    if (!number) {
      return sendTwiml(
        reply,
        twimlSayHangup(
          "An authorized human contact is currently required to complete this request."
        )
      );
    }
    return sendTwiml(
      reply,
      twimlSayDial(
        "Please hold while I connect you to the authorized human contact.",
        number
      )
    );
  }

  return sendTwiml(reply, twimlHangup());
});

app.post("/status", async (request, reply) => {
  const callSid = formValue(request.body, "CallSid");
  const callStatus = (formValue(request.body, "CallStatus") || "").toLowerCase();
  if (callSid && callStatus) {
    const terminal = new Set([
      "completed",
      "failed",
      "busy",
      "no-answer",
      "canceled",
    ]);
    try {
      if (terminal.has(callStatus)) {
        await finishCall(callSid, {
          status: callStatus,
          result: callStatus,
          endedAt: nowIso(),
        });
      } else {
        await finishCall(callSid, { status: callStatus });
      }
    } catch (error) {
      request.log.error(
        { err: error instanceof Error ? error.message : "unknown", callSid },
        "Failed to persist Twilio status callback"
      );
    }
  }
  return reply.code(204).send();
});

app.get("/conversation-relay", { websocket: true }, (socket, request) => {
  if (!validateTwilioWebSocketHandshake(request)) {
    request.log.warn("Closing ConversationRelay WebSocket with invalid signature");
    socket.close(1008, "Invalid Twilio signature");
    return;
  }

  // Per-connection call state only. Do not share transcripts across sockets.
  // Horizontal scale later: store LiveCallState in Redis keyed by CallSid/SessionId.
  let state: LiveCallState | null = null;
  let queue = Promise.resolve();

  const enqueue = (work: () => Promise<void>) => {
    queue = queue
      .then(work)
      .catch((error: unknown) => {
        request.log.error(
          { err: error instanceof Error ? error.message : "unknown" },
          "ConversationRelay handler error"
        );
      });
  };

  socket.on("message", (raw: Buffer | string) => {
    enqueue(async () => {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      let msg: ConversationRelayMessage;
      try {
        msg = JSON.parse(text) as ConversationRelayMessage;
      } catch {
        request.log.warn({ text }, "Ignoring malformed ConversationRelay message");
        return;
      }

      if (msg.type === "setup") {
        const callSid = String(msg.callSid || "");
        const sessionId = String(msg.sessionId || "");
        const from = String(msg.from || "");
        const to = String(msg.to || "");
        const selectedVoice =
          msg.customParameters?.selectedVoice || "en-US-Journey-O";

        let profile: AgentProfile | null = null;
        try {
          profile = to ? await getProfileByPhone(to, { enabledOnly: true }) : null;
        } catch (error) {
          request.log.error(
            { err: error instanceof Error ? error.message : "unknown", to },
            "Supabase failed during ConversationRelay setup"
          );
          await escalateAndHandoff(socket, null, "supabase_setup_error");
          return;
        }

        if (!profile) {
          sendRelay(socket, {
            type: "text",
            token:
              "This automated line is not configured. Please contact the company directly.",
            last: true,
            interruptible: true,
          });
          await sleep(3500);
          sendRelay(socket, {
            type: "end",
            handoffData: JSON.stringify({ reasonCode: "unconfigured" }),
          });
          return;
        }

        state = {
          sessionId,
          callSid,
          from,
          to,
          profile,
          voice: selectedVoice,
          transcript: [],
          generation: 0,
        };

        try {
          const attached = await attachSession(callSid, sessionId);
          if (!attached) {
            await createCall({
              callSid,
              profileId: profile.id,
              fromNumber: from,
              toNumber: to,
              voiceName: selectedVoice,
              status: "in-progress",
            });
            await attachSession(callSid, sessionId);
          }
        } catch (error) {
          request.log.error(
            { err: error instanceof Error ? error.message : "unknown", callSid },
            "Supabase failed while attaching ConversationRelay session"
          );
          await escalateAndHandoff(socket, state, "supabase_session_error");
        }
        return;
      }

      if (msg.type === "interrupt") {
        if (state) state.generation += 1;
        return;
      }

      if (msg.type === "error") {
        request.log.error(
          { description: msg.description, callSid: state?.callSid },
          "ConversationRelay error"
        );
        await escalateAndHandoff(
          socket,
          state,
          "conversationrelay_error",
          "I am having trouble completing that request. I will route this to the approved human contact."
        );
        return;
      }

      if (msg.type === "prompt" && msg.last === true) {
        const question = (msg.voicePrompt || "").trim();
        if (!question) return;
        if (!state) {
          await escalateAndHandoff(socket, null, "missing_session");
          return;
        }

        const generation = state.generation;
        const turn: TranscriptTurn = {
          role: "operator",
          text: question,
          at: nowIso(),
        };
        state.transcript.push(turn);
        logTranscript(state.callSid, turn);

        try {
          await persistTranscript(state);
        } catch (error) {
          request.log.error(
            { err: error instanceof Error ? error.message : "unknown", callSid: state.callSid },
            "Supabase failed while saving caller prompt"
          );
          await escalateAndHandoff(socket, state, "supabase_transcript_error");
          return;
        }

        const decision = await decideAgentResponse({
          profile: state.profile,
          transcript: state.transcript,
          question,
          logger: request.log,
        });

        if (!state || generation !== state.generation) {
          return;
        }

        if (decision.action === "escalate") {
          await escalateAndHandoff(socket, state, decision.reason, decision.text);
          return;
        }

        const answerTurn: TranscriptTurn = {
          role: "assistant",
          text: decision.text,
          at: nowIso(),
        };
        state.transcript.push(answerTurn);
        logTranscript(state.callSid, answerTurn);
        try {
          await persistTranscript(state);
        } catch (error) {
          request.log.error(
            { err: error instanceof Error ? error.message : "unknown", callSid: state.callSid },
            "Supabase failed while saving assistant answer"
          );
          await escalateAndHandoff(socket, state, "supabase_transcript_error");
          return;
        }

        sendRelay(socket, {
          type: "text",
          token: decision.text,
          last: true,
          interruptible: true,
          preemptible: true,
        });
      }
    });
  });

  socket.on("close", () => {
    state = null;
  });

  socket.on("error", (error: Error) => {
    request.log.error({ err: error.message }, "ConversationRelay WebSocket error");
  });
});

export default app;

if (!process.env.VERCEL) {
  const shutdown = async () => {
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
  void (async () => {
    if ((process.env.ADMIN_PASSWORD || "change-this-immediately") === "change-this-immediately") {
      app.log.warn("ADMIN_PASSWORD is still the example value. Change it before production.");
    }
    const port = Number(process.env.PORT || 3001);
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`AI Voice Platform listening on 0.0.0.0:${port}`);
  })().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
