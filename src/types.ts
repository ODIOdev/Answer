import { z } from "zod";

export const DEFAULT_DISCLOSURE =
  "Hello. I am an automated authorized assistant.";

export const DEFAULT_VOICE_POOL = ["en-US-Journey-O"];

export const ESCALATE_CALLER_TEXT =
  "I cannot personally attest to that. I am an automated authorized assistant. I will route this to the approved human contact.";

export const ttsProviderSchema = z.enum(["google", "amazon", "ElevenLabs"]);
export type TtsProvider = z.infer<typeof ttsProviderSchema>;

export const transcriptTurnSchema = z.object({
  role: z.enum(["operator", "assistant", "system"]),
  text: z.string(),
  at: z.string(),
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

export const authorizedFactsSchema = z.record(z.unknown());

const forbiddenFactKey =
  /^(ssn|full_ssn|password|passwd|pin|cvv|cvc|card_number|pan|security_answer|secret)$/i;

export function assertSafeAuthorizedFacts(
  facts: Record<string, unknown>
): void {
  for (const key of Object.keys(facts)) {
    if (forbiddenFactKey.test(key)) {
      throw new Error(
        `authorized_facts must not include sensitive key "${key}". Store only disclosable business facts.`
      );
    }
  }
}

export const updateProfileSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  disclosure: z.string().trim().min(1).max(2000).optional(),
  tts_provider: ttsProviderSchema.optional(),
  human_transfer_number: z
    .string()
    .trim()
    .max(32)
    .nullable()
    .optional(),
  voice_pool: z.array(z.string().trim().min(1)).min(1).max(32).optional(),
  authorized_facts: authorizedFactsSchema.optional(),
});

export const purchaseNumberSchema = z.object({
  phoneNumber: z.string().trim().min(8).max(20),
  label: z.string().trim().min(1).max(200),
});

export type AgentProfile = {
  id: string;
  label: string;
  enabled: boolean;
  phone_number: string | null;
  twilio_phone_sid: string | null;
  disclosure: string;
  tts_provider: TtsProvider | string;
  voice_pool: string[];
  authorized_facts: Record<string, unknown>;
  human_transfer_number: string | null;
  created_at: string;
  updated_at: string;
};

export type CallSession = {
  id: string;
  call_sid: string;
  session_id: string | null;
  profile_id: string | null;
  from_number: string | null;
  to_number: string | null;
  voice_name: string | null;
  status: string;
  transcript: TranscriptTurn[];
  result: string | null;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
  agent_profiles?: { label: string } | { label: string }[] | null;
};

export type CallSessionWithAgent = CallSession & {
  agent_label: string | null;
};

export type AgentDecision =
  | { action: "answer"; text: string }
  | { action: "escalate"; reason: string; text: string };

export type LiveCallState = {
  sessionId: string;
  callSid: string;
  from: string;
  to: string;
  profile: AgentProfile;
  voice: string;
  transcript: TranscriptTurn[];
  generation: number;
};

export type ConversationRelaySetup = {
  type: "setup";
  sessionId?: string;
  callSid?: string;
  from?: string;
  to?: string;
  customParameters?: Record<string, string>;
};

export type ConversationRelayPrompt = {
  type: "prompt";
  voicePrompt?: string;
  lang?: string;
  last?: boolean;
};

export type ConversationRelayInterrupt = {
  type: "interrupt";
  utteranceUntilInterrupt?: string;
  durationUntilInterruptMs?: number;
};

export type ConversationRelayError = {
  type: "error";
  description?: string;
};

export type ConversationRelayMessage =
  | ConversationRelaySetup
  | ConversationRelayPrompt
  | ConversationRelayInterrupt
  | ConversationRelayError;

export type AvailableNumber = {
  phoneNumber: string;
  locality: string;
  region: string;
};

export type DashboardPayload = {
  stats: {
    agentProfiles: number;
    totalCalls: number;
    activeCalls: number;
  };
  urls: {
    publicBaseUrl: string;
    wsBaseUrl: string;
    voiceWebhook: string;
    conversationRelay: string;
    connectAction: string;
    statusCallback: string;
  };
  providers: {
    twilio: boolean;
    openai: boolean;
    supabase: boolean;
  };
};
