# AI Voice Platform

Multi-number AI telephone platform. One persistent Node.js server answers Twilio numbers with a **disclosed automated authorized assistant**, answers only facts stored in Supabase, and transfers the caller to a human when the request requires a real person.

The assistant must not claim to be human, impersonate a worker, customer, or account holder, fabricate verification data, or present TTS voices as different real people.

---

## 1. What the system does

- Purchase and assign US local Twilio numbers from the admin dashboard.
- Bind each number to an agent profile: disclosure, TTS provider, voice pool, authorized facts, and a human transfer number.
- Answer inbound calls with Twilio Programmable Voice and ConversationRelay.
- Transcribe the caller, send the question to the OpenAI Responses API, and speak only authorized facts.
- Escalate to a configured human number when the model cannot answer from `authorized_facts`, when identity/signature/consent/credentials are required, or when a provider fails.
- Log per-call transcripts and status in PostgreSQL (Supabase).

Every call is the same disclosed automated assistant. A voice may be chosen at random from the profile voice pool for presentation only.

---

## 2. Architecture

```
Phone call
     ↓
POST /voice
     ↓
<Connect>
     ↓
<ConversationRelay>
     ↓
WSS connection
     ↓
OpenAI Responses API  +  Supabase
     ↓
Twilio TTS
     ↓
Caller

Human handoff:
ConversationRelay `end` → POST /connect-action → <Dial>
Call progress: POST /status
```

Admin UI is served by the same Fastify process at `GET /`. There is no separate frontend application.

---

## 3. Setup sequence

```
1
Paste MASTER PROMPT into Cursor
        ↓

2
Let Cursor build project
        ↓

3
Create Twilio account
        ↓

4
Create OpenAI API account
        ↓

5
Create Supabase account
        ↓

6
Run SUPABASE SQL
        ↓

7
Put API keys into .env
        ↓

8
npm install
        ↓

9
npm run dev
        ↓

10
Deploy server
        ↓

11
Put deployed HTTPS/WSS URLs in .env
        ↓

12
Open dashboard
        ↓

13
Phone Numbers
        ↓

14
Search area code
        ↓

15
Purchase number
        ↓

16
Agent Profiles
        ↓

17
Enter authorized information
        ↓

18
Enter human transfer number
        ↓

19
Enable agent
        ↓

20
Call the number
```

Detailed provider, SQL, env, and deploy steps follow below. Do not enable a purchased number until authorized facts and a human transfer number are saved.

---

## 4. Required providers

| Provider | Role |
| --- | --- |
| **Twilio** | Phone numbers, PSTN, ConversationRelay, STT, TTS |
| **OpenAI** | Question understanding, approved answers, escalation |
| **Supabase** | Profiles, authorized facts, call sessions, transcripts |
| **Host with WebSockets** | Long-lived ConversationRelay connections |

Do not put `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, or `OPENAI_API_KEY` in browser JavaScript. The dashboard never receives them.

---

## 5. Twilio setup

1. Create a Twilio account.
2. Enable Programmable Voice.
3. Enable ConversationRelay.
4. Complete the required Twilio Predictive and Generative AI/ML Features Addendum / onboarding in Console → Voice → Settings → Privacy & Security.
5. Copy **Account SID** into `TWILIO_ACCOUNT_SID`.
6. Copy **Auth Token** into `TWILIO_AUTH_TOKEN`.
7. Deploy this server first so Twilio can reach it.
8. Set `PUBLIC_BASE_URL` (https) and `WS_BASE_URL` (wss) to that public hostname.
9. Use the dashboard **Phone Numbers** page to search and purchase a number.
10. Purchase automatically points the number at `POST {PUBLIC_BASE_URL}/voice` and `POST {PUBLIC_BASE_URL}/status`.

Webhook map after deploy:

| Purpose | Method | URL |
| --- | --- | --- |
| Incoming voice | POST | `https://YOURDOMAIN.com/voice` |
| ConversationRelay | WebSocket | `wss://YOURDOMAIN.com/conversation-relay` |
| Connect / handoff | POST | `https://YOURDOMAIN.com/connect-action` |
| Call status | POST | `https://YOURDOMAIN.com/status` |

Set `TWILIO_VALIDATE_SIGNATURES=true` in production.

---

## 6. OpenAI setup

1. Create an OpenAI API project.
2. Add billing.
3. Create an API key.
4. Put the key in `OPENAI_API_KEY`.
5. Set `OPENAI_MODEL` to a model that supports the Responses API (default in `.env.example` is `gpt-5.4`).

The agent requires exactly `ANSWER: ...` or `ESCALATE: ...`. Anything else fails safe to human transfer. Answers are capped with `max_output_tokens: 120` so they stay phone-short.

---

## 7. Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Paste the contents of `supabase/schema.sql`.
4. Run it.
5. Copy **Project URL** into `SUPABASE_URL`.
6. Copy the **service_role** key into `SUPABASE_SERVICE_ROLE_KEY`.
7. Keep that key server-side only.

Row Level Security is enabled. The voice server uses the service role, which bypasses RLS. Do not expose that key to the dashboard or a browser client.

`authorized_facts` must contain only information the assistant is allowed to disclose. Do **not** store passwords, PINs, full SSNs, payment card numbers, or security answers.

---

## 8. Environment setup

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP/WebSocket listen port (default `3001`) |
| `PUBLIC_BASE_URL` | Public https origin Twilio uses for webhooks |
| `WS_BASE_URL` | Public wss origin Twilio uses for ConversationRelay |
| `TWILIO_ACCOUNT_SID` | Twilio account |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (server only) |
| `TWILIO_VALIDATE_SIGNATURES` | `true` to require `X-Twilio-Signature` |
| `OPENAI_API_KEY` | OpenAI secret (server only) |
| `OPENAI_MODEL` | Responses API model |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | HTTP Basic Auth for `/` and `/api/*` admin routes |
| `DEFAULT_HUMAN_TRANSFER_NUMBER` | Fallback if a profile has no transfer number |
| `LOG_FULL_TRANSCRIPTS` | `true` logs spoken text; otherwise length only |

Twilio webhooks (`/voice`, `/status`, `/connect-action`, `/conversation-relay`) are **not** Basic-Auth protected.

---

## 9. Local development

Requires Node.js 22+.

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:3001/` and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

For live calls, expose the process with a TLS tunnel (ngrok, Cloudflare Tunnel, or similar) and set:

```env
PUBLIC_BASE_URL=https://your-tunnel.example
WS_BASE_URL=wss://your-tunnel.example
```

`npm start` runs the same server without file watching.

---

## 10. Deployment

Production hosting is **Vercel** (Fastify + Fluid Compute WebSockets) with GitHub as the source of truth.

1. Push to the public GitHub repo `ODIOdev/Answer`.
2. Vercel project **ANSWER** (`over-drive0s-projects`) deploys from `main`. Until the [Vercel GitHub App](https://github.com/settings/installations/147283185) includes this repo, `.github/workflows/deploy.yml` deploys on push.
3. Set environment variables in the Vercel project (never commit `.env`).
4. Point `PUBLIC_BASE_URL` (`https://…`) and `WS_BASE_URL` (`wss://…`) at the production hostname, or rely on Vercel URL fallbacks.

ConversationRelay stays open on one Fluid instance for the life of the call. Function `maxDuration` is 800 seconds on Pro; a longer call will drop when that ceiling is reached. After a new deploy, in-flight calls finish on the previous instance.

Docker remains available for a dedicated process:

```bash
docker build -t ai-voice-platform .
docker run --env-file .env -p 3001:3001 ai-voice-platform
```

After deploy, confirm `/health` returns provider flags and `voiceUrls: true`, then use **API Setup → Sync Twilio webhooks** so purchased numbers point at this hostname.

---

## 11. Buying the first number

1. Sign in to the dashboard.
2. Open **Phone Numbers**.
3. Enter an area code (for example `201`).
4. Click **Search numbers**.
5. Click **Purchase** and enter an agent/profile label.

The number is created in Twilio with `voiceUrl=/voice` and `statusCallback=/status`. A Supabase `agent_profiles` row is created with `enabled = false` so an unconfigured line does not answer.

---

## 12. Creating the first agent

1. Open **Agent Profiles**.
2. Select the purchased number.
3. Keep or edit the disclosure. Callers must hear that this is an automated authorized assistant.
4. Set TTS provider (`google`, `amazon`, or `ElevenLabs`) and a matching voice pool (one ConversationRelay voice id per line).
5. Paste authorized facts as JSON, for example:

```json
{
  "company_name": "ABC Contracting LLC",
  "contract_id": "JOB-48291",
  "service_type": "Warehouse Maintenance",
  "authorized_contact": "Operations Department",
  "job_location": "Jersey City, NJ",
  "approved_start_date": "2026-08-31"
}
```

6. Set **Human Transfer Number**.
7. Set **Enabled** to YES and save.

---

## 13. Testing the first call

1. Call the purchased number.
2. Hear the disclosure.
3. Ask a question that exists in `authorized_facts`.
4. Ask something that is not in the facts, or that requires a real person (signature, identity, PIN). The assistant should transfer.
5. Open **Calls** and refresh. Newest sessions appear first.

---

## 14. Human transfer

The model returns `ESCALATE` when:

- the fact is not in `authorized_facts`
- the caller needs identity, consent, signature, attestation, or credentials
- OpenAI or Supabase fails during the live call
- the model output cannot be parsed

The WebSocket then speaks a short explanation and sends:

```json
{
  "type": "end",
  "handoffData": "{\"reasonCode\":\"live-agent-handoff\",\"reason\":\"...\",\"transferNumber\":\"+1...\"}"
}
```

Twilio invokes `POST /connect-action`. If `reasonCode` is `live-agent-handoff`, the server returns `<Say>` ("Please hold while I connect you to the authorized human contact.") plus `<Dial>` to `handoff.transferNumber`, then `DEFAULT_HUMAN_TRANSFER_NUMBER` if needed. If the ConversationRelay socket drops while the call is still up, the same transfer path is used so the caller is not left in silence. Dial waits 25 seconds; if no number is configured, the caller hears that an authorized human contact is required and the call ends.

---

## 15. Multi-number architecture

Each Twilio number maps to one `agent_profiles` row (`phone_number` unique). Inbound `To` selects that enabled profile. The assistant for that call may speak only that profile's `authorized_facts`. Number 1 never receives Number 2's facts.

```
PHONE NUMBER #1
     ↓
PROFILE #1
     ↓
AUTHORIZED FACTS #1


PHONE NUMBER #2
     ↓
PROFILE #2
     ↓
AUTHORIZED FACTS #2


PHONE NUMBER #3
     ↓
PROFILE #3
     ↓
AUTHORIZED FACTS #3
```

Disclosure, TTS voice pool, and human transfer number are also per profile. One server can answer many contracts without sharing facts.

---

## 16. Multi-call architecture

Each ConversationRelay WebSocket keeps its own `LiveCallState` (CallSid, SessionId, profile, voice, transcript). Transcripts are not shared across connections. Persistent data is written to `call_sessions` in Supabase.

This process can handle multiple simultaneous calls in one Node instance. If you later run several instances behind a load balancer, add Redis (or similar) keyed by `CallSid` / `SessionId` so setup and prompts for one call land on shared state. Version 1 does not require that.

---

## 17. Production checklist

- [ ] Node 22+ host with persistent WebSockets and TLS
- [ ] `PUBLIC_BASE_URL` https and `WS_BASE_URL` wss on the same hostname (or Vercel production URL fallbacks)
- [ ] Supabase schema applied; service role key only on the server
- [ ] Twilio ConversationRelay onboarding / AI addendum complete
- [ ] `TWILIO_VALIDATE_SIGNATURES=true`
- [ ] Twilio Account SID/token, OpenAI API key, and Supabase URL + service role are set on the host
- [ ] `ADMIN_PASSWORD` is not `CHANGE-THIS-PASSWORD`
- [ ] Each enabled profile has approved `authorized_facts` and a human transfer number
- [ ] Profiles stay disabled until facts and transfer are reviewed
- [ ] No passwords, PINs, full SSNs, or card numbers in `authorized_facts`
- [ ] Disclosure clearly identifies an automated assistant
- [ ] Voice pool used only for TTS variety, never as multiple people
- [ ] After URL changes, **API Setup → Sync Twilio webhooks**
- [ ] `/health` shows `twilio`, `openai`, `supabase`, and `voiceUrls` true, then a test call succeeds

---

## Safety

- The assistant identifies itself as automated.
- It does not impersonate humans or invent identities.
- Names and identities do not change per call.
- Voice selection may change per call as synthetic presentation only.
- When actual-person verification is required, the call is transferred to a human.
