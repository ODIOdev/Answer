import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_DISCLOSURE,
  DEFAULT_VOICE_POOL,
  type AgentProfile,
  type CallSession,
  type CallSessionWithAgent,
  type TranscriptTurn,
} from "./types.js";

let supabase: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabase(): SupabaseClient {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabase;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return asStringArray(parsed);
    } catch {
      return value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [...DEFAULT_VOICE_POOL];
}

function asFacts(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return asFacts(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

function asTranscript(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TranscriptTurn => {
    if (!item || typeof item !== "object") return false;
    const turn = item as TranscriptTurn;
    return (
      (turn.role === "operator" ||
        turn.role === "assistant" ||
        turn.role === "system") &&
      typeof turn.text === "string" &&
      typeof turn.at === "string"
    );
  });
}

function mapProfile(row: Record<string, unknown>): AgentProfile {
  return {
    id: String(row.id),
    label: String(row.label ?? ""),
    enabled: Boolean(row.enabled),
    phone_number: row.phone_number ? String(row.phone_number) : null,
    twilio_phone_sid: row.twilio_phone_sid
      ? String(row.twilio_phone_sid)
      : null,
    disclosure: String(row.disclosure ?? DEFAULT_DISCLOSURE),
    tts_provider: String(row.tts_provider ?? "google"),
    voice_pool: asStringArray(row.voice_pool),
    authorized_facts: asFacts(row.authorized_facts),
    human_transfer_number: row.human_transfer_number
      ? String(row.human_transfer_number)
      : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapCall(row: Record<string, unknown>): CallSession {
  return {
    id: String(row.id),
    call_sid: String(row.call_sid),
    session_id: row.session_id ? String(row.session_id) : null,
    profile_id: row.profile_id ? String(row.profile_id) : null,
    from_number: row.from_number ? String(row.from_number) : null,
    to_number: row.to_number ? String(row.to_number) : null,
    voice_name: row.voice_name ? String(row.voice_name) : null,
    status: String(row.status ?? "in-progress"),
    transcript: asTranscript(row.transcript),
    result: row.result ? String(row.result) : null,
    started_at: String(row.started_at ?? ""),
    ended_at: row.ended_at ? String(row.ended_at) : null,
    updated_at: String(row.updated_at ?? ""),
    agent_profiles: (row.agent_profiles as CallSession["agent_profiles"]) ?? null,
  };
}

function agentLabelFromJoin(row: CallSession): string | null {
  const joined = row.agent_profiles;
  if (Array.isArray(joined)) return joined[0]?.label ?? null;
  if (joined && typeof joined === "object") return joined.label ?? null;
  return null;
}

function requireData<T>(
  data: T | null,
  error: { message: string } | null,
  action: string
): T {
  if (error) {
    throw new Error(`${action} failed: ${error.message}`);
  }
  if (data === null) {
    throw new Error(`${action} returned no data`);
  }
  return data;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return phone.trim();
}

function isDuplicateCallSid(error: { code?: string; message: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|call_sid/i.test(error.message);
}

export async function getProfileById(id: string): Promise<AgentProfile | null> {
  const client = getSupabase();
  const { data, error } = await client
    .from("agent_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getProfileById failed: ${error.message}`);
  return data ? mapProfile(data as Record<string, unknown>) : null;
}

export async function getProfileByPhone(
  phone: string,
  options: { enabledOnly?: boolean } = {}
): Promise<AgentProfile | null> {
  const client = getSupabase();
  const enabledOnly = options.enabledOnly !== false;
  const candidates = [...new Set([phone.trim(), normalizePhone(phone)].filter(Boolean))];

  for (const candidate of candidates) {
    let query = client
      .from("agent_profiles")
      .select("*")
      .eq("phone_number", candidate);
    if (enabledOnly) query = query.eq("enabled", true);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`getProfileByPhone failed: ${error.message}`);
    if (data) return mapProfile(data as Record<string, unknown>);
  }

  let scan = client.from("agent_profiles").select("*");
  if (enabledOnly) scan = scan.eq("enabled", true);
  const { data: rows, error: scanError } = await scan;
  if (scanError) throw new Error(`getProfileByPhone failed: ${scanError.message}`);
  const wanted = normalizePhone(phone);
  const match = (rows || []).find((row) => {
    const stored = (row as Record<string, unknown>).phone_number;
    return stored ? normalizePhone(String(stored)) === wanted : false;
  });
  return match ? mapProfile(match as Record<string, unknown>) : null;
}

export async function listProfiles(): Promise<AgentProfile[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from("agent_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  const rows = requireData(data, error, "listProfiles");
  return rows.map((row) => mapProfile(row as Record<string, unknown>));
}

export async function createProfile(input: {
  label: string;
  phone_number: string;
  twilio_phone_sid: string;
  enabled?: boolean;
  disclosure?: string;
  tts_provider?: string;
  voice_pool?: string[];
  human_transfer_number?: string | null;
}): Promise<AgentProfile> {
  const client = getSupabase();
  const { data, error } = await client
    .from("agent_profiles")
    .insert({
      label: input.label,
      phone_number: input.phone_number,
      twilio_phone_sid: input.twilio_phone_sid,
      enabled: input.enabled ?? false,
      disclosure: input.disclosure ?? DEFAULT_DISCLOSURE,
      tts_provider: input.tts_provider ?? "google",
      voice_pool: input.voice_pool ?? DEFAULT_VOICE_POOL,
      authorized_facts: {},
      human_transfer_number: input.human_transfer_number ?? null,
    })
    .select("*")
    .single();
  const row = requireData(data, error, "createProfile");
  return mapProfile(row as Record<string, unknown>);
}

export async function updateProfile(
  id: string,
  patch: {
    label?: string;
    enabled?: boolean;
    disclosure?: string;
    tts_provider?: string;
    voice_pool?: string[];
    authorized_facts?: Record<string, unknown>;
    human_transfer_number?: string | null;
  }
): Promise<AgentProfile> {
  const client = getSupabase();
  const { data, error } = await client
    .from("agent_profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  const row = requireData(data, error, "updateProfile");
  return mapProfile(row as Record<string, unknown>);
}

export async function listCalls(limit = 100): Promise<CallSessionWithAgent[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from("call_sessions")
    .select("*, agent_profiles(label)")
    .order("started_at", { ascending: false })
    .limit(limit);
  const rows = requireData(data, error, "listCalls");
  return rows.map((row) => {
    const mapped = mapCall(row as Record<string, unknown>);
    return { ...mapped, agent_label: agentLabelFromJoin(mapped) };
  });
}

export async function createCall(input: {
  callSid: string;
  profileId: string;
  fromNumber: string;
  toNumber: string;
  voiceName: string;
  status?: string;
}): Promise<CallSession> {
  const client = getSupabase();
  const payload = {
    call_sid: input.callSid,
    profile_id: input.profileId,
    from_number: input.fromNumber,
    to_number: input.toNumber,
    voice_name: input.voiceName,
    status: input.status ?? "in-progress",
    transcript: [],
    started_at: new Date().toISOString(),
    ended_at: null,
    result: null,
  };
  const inserted = await client.from("call_sessions").insert(payload).select("*").single();
  if (inserted.data) {
    return mapCall(inserted.data as Record<string, unknown>);
  }
  if (!isDuplicateCallSid(inserted.error)) {
    throw new Error(`createCall failed: ${inserted.error?.message || "unknown"}`);
  }
  const existing = await client
    .from("call_sessions")
    .select("*")
    .eq("call_sid", input.callSid)
    .single();
  const row = requireData(existing.data, existing.error, "createCall");
  return mapCall(row as Record<string, unknown>);
}

export async function attachSession(
  callSid: string,
  sessionId: string
): Promise<CallSession | null> {
  const client = getSupabase();
  const { data, error } = await client
    .from("call_sessions")
    .update({ session_id: sessionId })
    .eq("call_sid", callSid)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`attachSession failed: ${error.message}`);
  return data ? mapCall(data as Record<string, unknown>) : null;
}

export async function saveTranscript(
  callSid: string,
  transcript: TranscriptTurn[]
): Promise<void> {
  const client = getSupabase();
  const { error } = await client
    .from("call_sessions")
    .update({ transcript })
    .eq("call_sid", callSid);
  if (error) throw new Error(`saveTranscript failed: ${error.message}`);
}

const TERMINAL_CALL_STATUSES = new Set([
  "completed",
  "failed",
  "busy",
  "no-answer",
  "canceled",
]);

export async function finishCall(
  callSid: string,
  input: {
    status?: string;
    result?: string | null;
    endedAt?: string | null;
  }
): Promise<void> {
  const client = getSupabase();
  const existing = await client
    .from("call_sessions")
    .select("status, result, ended_at")
    .eq("call_sid", callSid)
    .maybeSingle();
  if (existing.error) {
    throw new Error(`finishCall failed: ${existing.error.message}`);
  }

  const currentStatus = existing.data ? String(existing.data.status || "") : "";
  const handedOff = currentStatus === "human-handoff";
  const incomingTerminal = Boolean(
    input.status && TERMINAL_CALL_STATUSES.has(input.status)
  );
  const patch: Record<string, unknown> = {};

  if (handedOff) {
    if (input.status === "human-handoff" && input.result !== undefined) {
      patch.result = input.result;
    }
    if (input.endedAt !== undefined) {
      patch.ended_at = input.endedAt;
    } else if (incomingTerminal && !existing.data?.ended_at) {
      patch.ended_at = new Date().toISOString();
    }
  } else {
    if (input.status) patch.status = input.status;
    if (input.result !== undefined) patch.result = input.result;
    if (input.endedAt !== undefined) patch.ended_at = input.endedAt;
  }

  if (Object.keys(patch).length === 0) return;
  const { error } = await client
    .from("call_sessions")
    .update(patch)
    .eq("call_sid", callSid);
  if (error) throw new Error(`finishCall failed: ${error.message}`);
}

export async function getDashboardStats(): Promise<{
  agentProfiles: number;
  totalCalls: number;
  activeCalls: number;
}> {
  const client = getSupabase();
  const [profiles, calls, active] = await Promise.all([
    client.from("agent_profiles").select("id", { count: "exact", head: true }),
    client.from("call_sessions").select("id", { count: "exact", head: true }),
    client
      .from("call_sessions")
      .select("id", { count: "exact", head: true })
      .in("status", ["in-progress", "human-handoff"])
      .is("ended_at", null),
  ]);
  if (profiles.error) {
    throw new Error(`dashboard stats failed: ${profiles.error.message}`);
  }
  if (calls.error) {
    throw new Error(`dashboard stats failed: ${calls.error.message}`);
  }
  if (active.error) {
    throw new Error(`dashboard stats failed: ${active.error.message}`);
  }
  return {
    agentProfiles: profiles.count ?? 0,
    totalCalls: calls.count ?? 0,
    activeCalls: active.count ?? 0,
  };
}
