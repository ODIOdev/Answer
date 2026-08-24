import OpenAI from "openai";
import {
  ESCALATE_CALLER_TEXT,
  type AgentDecision,
  type AgentProfile,
  type TranscriptTurn,
} from "./types.js";

const DEFAULT_MODEL = "gpt-5.4";
const MAX_TRANSCRIPT_TURNS = 12;

type ResponsesClient = {
  responses: {
    create: (body: {
      model: string;
      instructions: string;
      input: string;
      max_output_tokens: number;
    }) => Promise<{
      output_text?: string | null;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string }>;
      }>;
    }>;
  };
};

let openai: ResponsesClient | null = null;

function getOpenAI(): ResponsesClient {
  if (openai) return openai;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const OpenAIClient = OpenAI as unknown as new (opts: {
    apiKey: string;
    timeout: number;
    maxRetries: number;
  }) => ResponsesClient;
  openai = new OpenAIClient({
    apiKey,
    timeout: 20_000,
    maxRetries: 1,
  });
  return openai;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function buildInstructions(profile: AgentProfile): string {
  const facts = JSON.stringify(profile.authorized_facts ?? {}, null, 2);
  return `You are a disclosed automated authorized phone assistant.

Identity rules:
- Never claim or imply you are human.
- Never impersonate a worker, customer, signer, account holder, verifier, employee, or other person.
- Do not generate fake human identities or vary names per call.
- TTS voice may change between calls. That is synthetic presentation only. You remain the same disclosed automated assistant.
- If asked whether you are automated, answer yes.
- You may state an authorized_contact label from AUTHORIZED_FACTS as the organization's designated contact, but you must not claim to be that person.

Never fabricate:
identity, names, dates, employment facts, authorization, consent, signatures, SSNs, DOBs, PINs, passwords, security answers, financial credentials, addresses, or contract details.

Only answer facts explicitly contained in AUTHORIZED_FACTS.
Keep answers short and phone-friendly.
Never infer new facts.
If the question asks for identity verification, personal consent, signature, sworn attestation, security credentials, or something requiring the actual human, return ESCALATE.
If requested information does not exist inside AUTHORIZED_FACTS, return ESCALATE.

Output EXACTLY one of these two formats and nothing else:
ANSWER: <short spoken answer>
ESCALATE: <short internal reason>

AUTHORIZED_FACTS:
${facts}

Profile label (not a personal identity): ${profile.label}
Disclosure already played to the caller: ${profile.disclosure}`;
}

function buildInput(transcript: TranscriptTurn[], question: string): string {
  const recent = transcript.slice(-MAX_TRANSCRIPT_TURNS);
  const lines = recent.map((turn) => `[${turn.role}] ${turn.text}`);
  return `Recent transcript:
${lines.length ? lines.join("\n") : "(empty)"}

Current caller question:
${question}`;
}

function extractOutputText(response: {
  output_text?: string | null;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

export function parseAgentOutput(raw: string): AgentDecision {
  const text = raw.replace(/^\uFEFF/, "").trim();
  const answerMatch = text.match(/^ANSWER:\s*([\s\S]+)$/i);
  if (answerMatch) {
    const answer = answerMatch[1].trim();
    if (!answer) {
      return {
        action: "escalate",
        reason: "empty_answer",
        text: ESCALATE_CALLER_TEXT,
      };
    }
    return { action: "answer", text: answer };
  }
  const escalateMatch = text.match(/^ESCALATE:\s*([\s\S]+)$/i);
  if (escalateMatch) {
    const reason = escalateMatch[1].trim() || "unspecified";
    return { action: "escalate", reason, text: ESCALATE_CALLER_TEXT };
  }
  return {
    action: "escalate",
    reason: "unparseable_model_output",
    text: ESCALATE_CALLER_TEXT,
  };
}

export function escalateDecision(reason: string): AgentDecision {
  return { action: "escalate", reason, text: ESCALATE_CALLER_TEXT };
}

export async function decideAgentResponse(input: {
  profile: AgentProfile;
  transcript: TranscriptTurn[];
  question: string;
  logger?: { error: (obj: unknown, msg?: string) => void };
}): Promise<AgentDecision> {
  if (!isOpenAIConfigured()) {
    return escalateDecision("openai_not_configured");
  }

  try {
    const client = getOpenAI();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      instructions: buildInstructions(input.profile),
      input: buildInput(input.transcript, input.question),
      max_output_tokens: 120,
    });

    const raw = extractOutputText(response);
    if (!raw) {
      return escalateDecision("empty_model_output");
    }
    return parseAgentOutput(raw);
  } catch (error) {
    input.logger?.error(
      { err: error instanceof Error ? error.message : "unknown" },
      "OpenAI Responses API failed"
    );
    return escalateDecision("openai_error");
  }
}
