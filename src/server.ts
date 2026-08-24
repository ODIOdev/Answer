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
  getProfileById,
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
    safeEqual(password, process.env.ADMIN_PASSWORD || "CHANGE-THIS-PASSWORD")
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

function buildConversationRelayTwiml(
  profile: AgentProfile,
  selectedVoice: string
): string {
  const publicBase = (process.env.PUBLIC_BASE_URL || resolvedHttpBase()).replace(
    /\/$/,
    ""
  );
  const wsBase = (process.env.WS_BASE_URL || resolvedWsBase()).replace(/\/$/, "");
  const voiceResponse = new twilio.twiml.VoiceResponse();
  const connect = voiceResponse.connect({
    action: `${publicBase}/connect-action`,
    method: "POST",
  });
  const relay = connect.conversationRelay({
    url: `${wsBase}/conversation-relay`,
    welcomeGreeting: profile.disclosure || DEFAULT_DISCLOSURE,
    welcomeGreetingInterruptible: "any",
    interruptible: "any",
    preemptible: true,
  });
  relay.language({
    code: "en-US",
    ttsProvider: String(profile.tts_provider || "google"),
    voice: selectedVoice,
    transcriptionProvider: "google",
  });
  relay.parameter({ name: "selectedVoice", value: selectedVoice });
  relay.parameter({ name: "profileId", value: profile.id });
  return voiceResponse.toString();
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

async function decide(
  profile: AgentProfile,
  transcript: TranscriptTurn[],
  question: string,
  logger?: { error: (obj: unknown, msg?: string) => void }
) {
  return decideAgentResponse({ profile, transcript, question, logger });
}

void app.register(formbody);
void app.register(websocket);

function isFinalPrompt(message: ConversationRelayMessage): boolean {
  if (message.type !== "prompt") return false;
  return message.last === true || message.last === "true" || message.last === 1;
}

function socketText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Buffer.isBuffer(raw)) return raw.toString("utf8");
  if (Array.isArray(raw)) return Buffer.concat(raw.map((item) => Buffer.from(item))).toString("utf8");
  if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString("utf8");
  return String(raw ?? "");
}

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
    preemptible: true,
  });
  if (socket.readyState === 1) {
    await sleep(estimateSpeechMs(text));
  }
  sendRelay(socket, {
    type: "end",
    handoffData: JSON.stringify({
      reasonCode: "live-agent-handoff",
      reason: "Actual human verification required",
      transferNumber: transferNumberFor(state?.profile),
    }),
  });
}

app.addHook("onRequest", async (request, reply) => {
  const path = pathOf(request.url);
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
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
  providers: {
    twilio: isTwilioConfigured(),
    openai: isOpenAIConfigured(),
    supabase: isSupabaseConfigured(),
  },
  voiceUrls: hasPublicVoiceUrls(),
}));

app.get("/", async (_request, reply) => {
  reply.header("Cache-Control", "no-store");
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
  const existing = await getProfileById(params.id);
  if (!existing) {
    return reply.code(404).send({ error: "Profile not found" });
  }
  const nextFacts = patch.authorized_facts ?? existing.authorized_facts;
  const nextEnabled = patch.enabled ?? existing.enabled;
  const nextTransfer =
    patch.human_transfer_number === undefined
      ? existing.human_transfer_number
      : patch.human_transfer_number;
  if (nextEnabled) {
    if (!nextFacts || Object.keys(nextFacts).length === 0) {
      return reply.code(400).send({
        error: "Add authorized facts before enabling this agent.",
      });
    }
    if (!nextTransfer) {
      return reply.code(400).send({
        error: "Set a human transfer number on this profile before enabling.",
      });
    }
  }
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
  try {
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
  } catch (error) {
    request.log.error(
      {
        err: error instanceof Error ? error.message : "unknown",
        twilioPhoneSid: incoming.sid,
        phoneNumber: incoming.phoneNumber,
      },
      "Twilio number purchased but profile insert failed"
    );
    return reply.code(500).send({
      error:
        "Number was purchased in Twilio but the profile could not be saved. Do not purchase it again. Retry after Supabase is healthy.",
      twilioPhoneSid: incoming.sid,
      phoneNumber: incoming.phoneNumber,
    });
  }
});

app.post("/api/numbers/sync-webhooks", async (request, reply) => {
  if (!hasPublicVoiceUrls()) {
    return reply.code(400).send({
      error: "Set PUBLIC_BASE_URL and WS_BASE_URL before syncing Twilio webhooks.",
    });
  }
  const urls = publicUrls();
  const client = getTwilioClient();
  const profiles = await listProfiles();
  const updated: string[] = [];
  const failed: Array<{ phoneNumber: string | null; error: string }> = [];
  for (const profile of profiles) {
    if (!profile.twilio_phone_sid) continue;
    try {
      await client.incomingPhoneNumbers(profile.twilio_phone_sid).update({
        voiceUrl: urls.voiceWebhook,
        voiceMethod: "POST",
        statusCallback: urls.statusCallback,
        statusCallbackMethod: "POST",
      });
      if (profile.phone_number) updated.push(profile.phone_number);
    } catch (error) {
      failed.push({
        phoneNumber: profile.phone_number,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return {
    ok: failed.length === 0,
    updated: updated.length,
    numbers: updated,
    failed,
    urls,
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

  return reply.type("text/xml").send(buildConversationRelayTwiml(profile, voice));
});

app.post("/connect-action", async (request, reply) => {
  const data = request.body as Record<string, unknown>;
  let handoff: {
    reasonCode?: string;
    reason?: string;
    transferNumber?: string;
  } = {};
  const rawHandoff = data?.HandoffData ?? data?.handoffData;
  try {
    if (rawHandoff && typeof rawHandoff === "object") {
      handoff = rawHandoff as {
        reasonCode?: string;
        reason?: string;
        transferNumber?: string;
      };
    } else {
      handoff = JSON.parse(
        (typeof rawHandoff === "string" && rawHandoff) || "{}"
      );
    }
  } catch {
    handoff = {};
  }

  const callSid = typeof data?.CallSid === "string" ? data.CallSid : "";
  const callStatus = (
    typeof data?.CallStatus === "string" ? data.CallStatus : ""
  ).toLowerCase();
  const sessionStatus = (
    typeof data?.SessionStatus === "string" ? data.SessionStatus : ""
  ).toLowerCase();
  const to = typeof data?.To === "string" ? data.To : "";

  const isHandoff = handoff.reasonCode === "live-agent-handoff";
  const callStillUp =
    !callStatus || callStatus === "in-progress" || callStatus === "ringing";
  const unexpectedDrop =
    !isHandoff &&
    callStillUp &&
    (sessionStatus === "failed" ||
      sessionStatus === "error" ||
      !handoff.reasonCode);

  if (isHandoff && callSid) {
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
  }

  const response = new twilio.twiml.VoiceResponse();

  if (isHandoff || unexpectedDrop) {
    let number =
      (typeof handoff.transferNumber === "string" && handoff.transferNumber) ||
      process.env.DEFAULT_HUMAN_TRANSFER_NUMBER ||
      "";
    if (!number && to) {
      try {
        const profile = await getProfileByPhone(to, { enabledOnly: false });
        number = transferNumberFor(profile) || "";
      } catch (error) {
        request.log.error(
          { err: error instanceof Error ? error.message : "unknown", to },
          "Failed to load transfer number after ConversationRelay ended"
        );
      }
    }
    if (number) {
      response.say(
        "Please hold while I connect you to the authorized human contact."
      );
      response.dial({ timeout: 25 }, number);
    } else {
      response.say(
        "An authorized human contact is currently required to complete this request."
      );
      response.hangup();
    }
  }

  reply.type("text/xml").send(response.toString());
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
      const text = socketText(raw);
      let message: ConversationRelayMessage;
      try {
        message = JSON.parse(text) as ConversationRelayMessage;
      } catch {
        request.log.warn({ text }, "Ignoring malformed ConversationRelay message");
        return;
      }

      if (message.type === "setup") {
        const callSid = String(message.callSid || "");
        const sessionId = String(message.sessionId || "");
        const from = String(message.from || "");
        const to = String(message.to || "");
        const selectedVoice =
          message.customParameters?.selectedVoice || "en-US-Journey-O";

        let profile: AgentProfile | null = null;
        try {
          profile = to ? await getProfileByPhone(to, { enabledOnly: true }) : null;
          if (!profile) {
            const profileId = message.customParameters?.profileId;
            if (profileId) {
              profile = await getProfileById(profileId);
              if (profile && !profile.enabled) profile = null;
            }
          }
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

      if (message.type === "interrupt") {
        if (state) state.generation += 1;
        return;
      }

      if (message.type === "error") {
        request.log.error(
          { description: message.description, callSid: state?.callSid },
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

      if (message.type === "prompt" && isFinalPrompt(message)) {
        const question = (message.voicePrompt || "").trim();
        if (!question) return;
        if (!state) {
          await escalateAndHandoff(socket, null, "missing_session");
          return;
        }

        const { profile, transcript } = state;
        const generation = state.generation;
        const turn: TranscriptTurn = {
          role: "operator",
          text: question,
          at: nowIso(),
        };
        transcript.push(turn);
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

        const decision = await decide(profile, transcript, question, request.log);

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
        transcript.push(answerTurn);
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

const adminPassword = process.env.ADMIN_PASSWORD || "CHANGE-THIS-PASSWORD";
if (
  adminPassword === "CHANGE-THIS-PASSWORD" ||
  adminPassword === "change-this-immediately"
) {
  app.log.warn("ADMIN_PASSWORD is still the example value. Change it before production.");
}

if (process.env.VERCEL) {
  // Official Fastify-on-Vercel entry: intercept listen() and route through Fluid.
  app.listen({ port: 3000 });
} else {
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
  const port = Number(process.env.PORT || 3001);
  void app
    .listen({ port, host: "0.0.0.0" })
    .then(() => {
      app.log.info(`AI Voice Platform listening on 0.0.0.0:${port}`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
