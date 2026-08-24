import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import twilio from "twilio";

export function isSignatureValidationEnabled(): boolean {
  return process.env.TWILIO_VALIDATE_SIGNATURES === "true";
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  );
}

function headerValue(
  request: FastifyRequest,
  name: string
): string | undefined {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function trimBase(value: string | undefined): string {
  return (value ?? "").replace(/\/$/, "");
}

function vercelHttpOrigin(): string | undefined {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (!host) return undefined;
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return trimBase(host);
  }
  return `https://${host}`;
}

export function resolvedHttpBase(): string {
  if (process.env.PUBLIC_BASE_URL) return trimBase(process.env.PUBLIC_BASE_URL);
  return vercelHttpOrigin() || "https://YOURDOMAIN.com";
}

export function resolvedWsBase(): string {
  if (process.env.WS_BASE_URL) return trimBase(process.env.WS_BASE_URL);
  const http = resolvedHttpBase();
  if (http.startsWith("https://")) return `wss://${http.slice("https://".length)}`;
  if (http.startsWith("http://")) return `ws://${http.slice("http://".length)}`;
  return "wss://YOURDOMAIN.com";
}

export function hasPublicVoiceUrls(): boolean {
  const http = resolvedHttpBase();
  const ws = resolvedWsBase();
  return (
    Boolean(http) &&
    Boolean(ws) &&
    !http.includes("YOURDOMAIN.com") &&
    !ws.includes("YOURDOMAIN.com")
  );
}

function publicHttpUrl(pathname: string): string {
  return `${resolvedHttpBase()}${pathname}`;
}

function publicWsUrl(pathname: string): string {
  return `${resolvedWsBase()}${pathname}`;
}

function asParamRecord(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      params[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      params[key] = String(value);
    }
  }
  return params;
}

function signaturesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function validateUrl(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    return twilio.validateRequest(authToken, signature, url, params);
  } catch {
    return false;
  }
}

export function twilioHttpPath(urlPath: string): string {
  return urlPath.split("?")[0] ?? urlPath;
}

export function shouldValidateTwilioHttp(urlPath: string): boolean {
  const path = twilioHttpPath(urlPath);
  return (
    path === "/voice" || path === "/status" || path === "/connect-action"
  );
}

export function validateTwilioHttpRequest(request: FastifyRequest): boolean {
  if (!isSignatureValidationEnabled()) return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = headerValue(request, "x-twilio-signature");
  if (!authToken || !signature) {
    request.log.warn(
      { path: request.url, hasToken: Boolean(authToken), hasSignature: Boolean(signature) },
      "Twilio HTTP signature validation failed: missing token or signature"
    );
    return false;
  }

  const path = twilioHttpPath(request.url);
  const params = asParamRecord(request.body);
  const candidates = [
    publicHttpUrl(path),
    publicHttpUrl(request.url),
  ].filter((url, index, list) => url && list.indexOf(url) === index);

  const ok = candidates.some((url) =>
    validateUrl(authToken, signature, url, params)
  );
  if (!ok) {
    request.log.warn(
      { path: request.url, candidates },
      "Twilio HTTP signature validation failed"
    );
  }
  return ok;
}

export function validateTwilioWebSocketHandshake(
  request: FastifyRequest
): boolean {
  if (!isSignatureValidationEnabled()) return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = headerValue(request, "x-twilio-signature");
  if (!authToken || !signature) {
    request.log.warn(
      { path: request.url, hasToken: Boolean(authToken), hasSignature: Boolean(signature) },
      "Twilio WebSocket signature validation failed: missing token or signature"
    );
    return false;
  }

  const path = twilioHttpPath(request.url) || "/conversation-relay";
  const candidates = [
    publicWsUrl("/conversation-relay"),
    publicWsUrl(path),
    publicWsUrl(request.url),
  ].filter((url, index, list) => url && list.indexOf(url) === index);

  const ok = candidates.some((url) =>
    validateUrl(authToken, signature, url, {})
  );
  if (!ok) {
    request.log.warn(
      { path: request.url, candidates },
      "Twilio ConversationRelay WebSocket signature validation failed"
    );
  }
  return ok;
}

export function safeCompare(a: string, b: string): boolean {
  return signaturesEqual(a, b);
}
