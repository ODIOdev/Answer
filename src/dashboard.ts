export function renderDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Voice Platform</title>
  <style>
    :root {
      --navy: #07111f;
      --navy-2: #0c1a2e;
      --panel: #122038;
      --panel-2: #172844;
      --line: rgba(147, 176, 214, 0.16);
      --text: #eef4ff;
      --muted: #93a7c4;
      --blue: #3b82f6;
      --blue-2: #60a5fa;
      --ok: #34d399;
      --warn: #fbbf24;
      --bad: #f87171;
      --shadow: 0 18px 50px rgba(2, 8, 20, 0.35);
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    html, body { margin: 0; min-height: 100%; overflow-x: hidden; }
    body {
      font-family: "Segoe UI", "Avenir Next", Inter, ui-sans-serif, system-ui, sans-serif;
      background:
        radial-gradient(1200px 500px at 10% -10%, rgba(59, 130, 246, 0.16), transparent 50%),
        radial-gradient(900px 400px at 100% 0%, rgba(14, 165, 233, 0.08), transparent 45%),
        var(--navy);
      color: var(--text);
      padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    }
    body.menu-open { overflow: hidden; }
    .app {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      min-height: 100vh;
      min-height: 100dvh;
    }
    .sidebar {
      background: linear-gradient(180deg, #0a172b 0%, #081322 100%);
      border-right: 1px solid var(--line);
      padding: 28px 18px;
      position: sticky;
      top: 0;
      height: 100vh;
      height: 100dvh;
      overflow-y: auto;
    }
    .nav-mask {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(2, 8, 20, 0.55);
      z-index: 15;
    }
    .nav-mask.show { display: block; }
    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 0 10px 28px;
    }
    .mark {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: linear-gradient(180deg, #60a5fa, #2563eb);
      font-weight: 800;
      letter-spacing: 0.04em;
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
    }
    .brand h1 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0.01em;
    }
    .brand p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 12px;
    }
    nav { display: grid; gap: 6px; }
    .nav-btn {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted);
      text-align: left;
      padding: 12px 14px;
      border-radius: 12px;
      cursor: pointer;
      font-size: 14px;
      width: 100%;
      min-height: 44px;
    }
    .nav-btn:hover, .nav-btn.active {
      background: rgba(59, 130, 246, 0.12);
      color: var(--text);
    }
    .nav-btn.active {
      box-shadow: inset 3px 0 0 var(--blue);
    }
    .content { padding: 28px; min-width: 0; }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 22px;
    }
    .topbar-head {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .topbar-copy { min-width: 0; }
    .topbar h2 { margin: 0 0 6px; font-size: clamp(22px, 4vw, 28px); overflow-wrap: anywhere; }
    .topbar p { margin: 0; color: var(--muted); }
    .menu {
      display: none;
      flex: 0 0 auto;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      border-radius: 10px;
      padding: 8px 12px;
      min-height: 44px;
    }
    .grid-3, .grid-2, .lanes { display: grid; gap: 16px; }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-2 { grid-template-columns: 1.15fr 0.85fr; }
    .lanes { grid-template-columns: repeat(3, 1fr); margin-top: 12px; }
    .card {
      background: linear-gradient(180deg, var(--panel), var(--panel-2));
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 20px;
    }
    .stat .label { color: var(--muted); font-size: 13px; }
    .stat .value { font-size: 34px; margin-top: 8px; font-weight: 700; }
    .flow {
      display: grid;
      justify-items: center;
      gap: 0;
      margin-top: 8px;
    }
    .flow-step, .flow-join {
      text-align: center;
    }
    .flow-step {
      min-width: 0;
      width: min(100%, 240px);
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(96, 165, 250, 0.25);
      font-size: 13px;
    }
    .flow-join { color: var(--blue-2); height: 18px; }
    label { display: block; font-size: 13px; color: var(--muted); margin: 14px 0 6px; }
    input, select, textarea, button {
      font: inherit;
    }
    input, select, textarea {
      width: 100%;
      max-width: 100%;
      background: #0b1730;
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px 12px;
      font-size: 16px;
      min-height: 44px;
    }
    textarea { min-height: 120px; resize: vertical; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; }
    .row > * { flex: 1 1 140px; min-width: 0; }
    .row-actions { display: flex; gap: 10px; flex: 1 1 220px; flex-wrap: wrap; }
    .row-actions button { white-space: nowrap; flex: 1 1 auto; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    .actions button { min-height: 44px; }
    button.primary, button.secondary, button.danger {
      border: 0;
      border-radius: 12px;
      padding: 11px 16px;
      cursor: pointer;
      font-weight: 650;
      min-height: 44px;
    }
    button.primary { background: var(--blue); color: white; }
    button.secondary { background: #223552; color: var(--text); }
    button.ghost {
      background: transparent;
      color: var(--blue-2);
      border: 0;
      cursor: pointer;
    }
    .table-wrap { overflow: auto; -webkit-overflow-scrolling: touch; margin-top: 16px; max-width: 100%; }
    table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
    th { color: var(--muted); font-weight: 600; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 12px;
      background: #1d3354;
    }
    .badge.ok { background: rgba(52, 211, 153, 0.15); color: var(--ok); }
    .badge.warn { background: rgba(251, 191, 36, 0.15); color: var(--warn); }
    .badge.bad { background: rgba(248, 113, 113, 0.15); color: var(--bad); }
    .notice, .error, .okmsg {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 12px;
      display: none;
    }
    .notice { background: rgba(59, 130, 246, 0.12); }
    .error { background: rgba(248, 113, 113, 0.12); }
    .okmsg { background: rgba(52, 211, 153, 0.12); }
    .page { display: none; }
    .page.active { display: block; }
    .help { color: var(--muted); font-size: 13px; line-height: 1.55; }
    .setup-list {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .setup-list li {
      display: grid;
      grid-template-columns: 32px 1fr;
      gap: 12px;
      align-items: center;
    }
    .setup-list .n {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: rgba(59, 130, 246, 0.16);
      border: 1px solid rgba(96, 165, 250, 0.28);
      font-size: 12px;
      font-weight: 700;
    }
    .setup-list .t { font-size: 13px; }
    .kv { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; overflow-wrap: anywhere; word-break: break-word; }
    .webhook {
      display: grid;
      grid-template-columns: minmax(110px, 160px) minmax(0, 1fr);
      gap: 8px 16px;
      align-items: start;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
    }
    .fold {
      margin: 0;
    }
    .fold > summary {
      list-style: none;
    }
    .fold > summary::-webkit-details-marker { display: none; }
    .fold > summary h3 { margin: 0; }
    @media (min-width: 981px) {
      .fold > summary { pointer-events: none; cursor: default; }
    }
    @media (max-width: 1200px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    @media (max-width: 980px) {
      .app { grid-template-columns: 1fr; }
      .sidebar {
        position: fixed;
        z-index: 20;
        transform: translateX(-110%);
        transition: transform 0.2s ease;
        width: min(280px, 86vw);
        padding-top: max(20px, env(safe-area-inset-top));
      }
      .sidebar.open { transform: none; }
      .menu { display: inline-flex; align-items: center; }
      .lanes { grid-template-columns: 1fr; }
      .content { padding: 18px; }
      .stat .value { font-size: 30px; }
      .fold > summary {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 44px;
      }
      .fold > summary::after {
        content: "";
        width: 8px;
        height: 8px;
        border-right: 2px solid var(--blue-2);
        border-bottom: 2px solid var(--blue-2);
        transform: rotate(45deg);
        transition: transform 0.15s ease;
        flex: 0 0 auto;
      }
      .fold[open] > summary::after {
        transform: rotate(-135deg);
        margin-top: 4px;
      }
    }
    @media (max-width: 720px) {
      .grid-3, .grid-2, .lanes { grid-template-columns: 1fr; }
      .content { padding: 14px; }
      .card { padding: 16px; }
      .topbar { margin-bottom: 16px; }
      .row-actions { flex: 1 1 100%; }
      .row-actions button { flex: 1 1 140px; }
      .webhook { grid-template-columns: 1fr; }
      .setup-list .t { font-size: 12px; }
      textarea { min-height: 96px; }
    }
    @media (max-width: 480px) {
      .content { padding: 12px; }
      .card { padding: 14px; border-radius: 14px; }
      .brand { padding: 0 4px 18px; }
      .stat .value { font-size: 26px; }
      table { min-width: 520px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="mark">AV</div>
        <div>
          <h1>AI Voice Platform</h1>
          <p>Authorized assistant</p>
        </div>
      </div>
      <nav>
        <button class="nav-btn active" data-page="dashboard">Dashboard</button>
        <button class="nav-btn" data-page="numbers">Phone Numbers</button>
        <button class="nav-btn" data-page="agents">Agent Profiles</button>
        <button class="nav-btn" data-page="calls">Calls</button>
        <button class="nav-btn" data-page="setup">API Setup</button>
      </nav>
    </aside>
    <div class="nav-mask" id="navMask"></div>
    <main class="content">
      <div class="topbar">
        <div class="topbar-head">
          <button class="menu" id="menuBtn" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">Menu</button>
          <div class="topbar-copy">
            <h2 id="pageTitle">Dashboard</h2>
            <p id="pageSubtitle">Operations overview for disclosed automated voice lines.</p>
          </div>
        </div>
      </div>

      <section class="page active" id="page-dashboard">
        <div class="grid-3">
          <div class="card stat"><div class="label">Agent Profiles</div><div class="value" id="statProfiles">0</div></div>
          <div class="card stat"><div class="label">Total Calls</div><div class="value" id="statCalls">0</div></div>
          <div class="card stat"><div class="label">Active Calls</div><div class="value" id="statActive">0</div></div>
        </div>
        <div class="error" id="dashboardError"></div>
        <div class="grid-2" style="margin-top:16px">
          <div class="card">
            <h3>System architecture</h3>
            <div class="flow">
              <div class="flow-step">Phone call</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">POST /voice</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">&lt;Connect&gt;</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">&lt;ConversationRelay&gt;</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">WSS connection</div>
            </div>
          </div>
          <div class="card">
            <h3>Operating rules</h3>
            <p class="help">This system is a disclosed automated authorized assistant. It does not claim to be human, impersonate a person, or invent verification data. If a caller needs identity, signature, consent, credentials, or a fact that is not in authorized_facts, the call is transferred to the configured human number.</p>
            <p class="help">Voice pool entries only change synthetic TTS presentation. Every call remains the same automated assistant.</p>
          </div>
        </div>
        <div class="card" style="margin-top:16px">
          <details class="fold" id="isolationFold" open>
            <summary><h3>Number isolation</h3></summary>
            <p class="help">Inbound To selects one enabled profile. That call can speak only that profile's authorized facts. Number 1 never sees Number 2's facts.</p>
            <div class="lanes">
              <div class="flow">
                <div class="flow-step">PHONE NUMBER #1</div>
                <div class="flow-join">↓</div>
                <div class="flow-step">PROFILE #1</div>
                <div class="flow-join">↓</div>
                <div class="flow-step">AUTHORIZED FACTS #1</div>
              </div>
              <div class="flow">
                <div class="flow-step">PHONE NUMBER #2</div>
                <div class="flow-join">↓</div>
                <div class="flow-step">PROFILE #2</div>
                <div class="flow-join">↓</div>
                <div class="flow-step">AUTHORIZED FACTS #2</div>
              </div>
              <div class="flow">
                <div class="flow-step">PHONE NUMBER #3</div>
                <div class="flow-join">↓</div>
                <div class="flow-step">PROFILE #3</div>
                <div class="flow-join">↓</div>
                <div class="flow-step">AUTHORIZED FACTS #3</div>
              </div>
            </div>
          </details>
        </div>
      </section>

      <section class="page" id="page-numbers">
        <div class="card">
          <h3>Search and generate US local numbers</h3>
          <p class="help">Twilio is the connected number provider. Search to pick a specific line, or generate a batch. Each generated number gets its own disabled profile. Repeat batches to scale toward thousands; one click buys at most 50 real PSTN numbers.</p>
          <div class="row">
            <div>
              <label for="areaCode">Area code</label>
              <input id="areaCode" maxlength="3" placeholder="201" />
            </div>
            <div>
              <label for="numberQuantity">Quantity</label>
              <input id="numberQuantity" type="number" min="1" max="50" value="1" />
            </div>
            <div class="row-actions">
              <button class="primary" id="searchNumbers" type="button">Search numbers</button>
              <button class="secondary" id="generateNumbers" type="button">Generate numbers</button>
            </div>
          </div>
          <div class="notice" id="numbersNotice"></div>
          <div class="error" id="numbersError"></div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Phone Number</th><th>City</th><th>Region</th><th></th></tr>
              </thead>
              <tbody id="numbersBody">
                <tr><td colspan="4" class="muted">Search an area code to see available numbers.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="page" id="page-agents">
        <div class="card">
          <h3>Agent profile</h3>
          <label for="profileSelect">Existing profiles</label>
          <select id="profileSelect"></select>
          <label for="profileLabel">Label</label>
          <input id="profileLabel" />
          <label for="profilePhone">Phone Number</label>
          <input id="profilePhone" readonly />
          <label for="profileEnabled">Enabled</label>
          <select id="profileEnabled">
            <option value="false">NO</option>
            <option value="true">YES</option>
          </select>
          <label for="profileDisclosure">Disclosure</label>
          <textarea id="profileDisclosure"></textarea>
          <label for="profileTts">TTS Provider</label>
          <select id="profileTts">
            <option value="google">google</option>
            <option value="amazon">amazon</option>
            <option value="ElevenLabs">ElevenLabs</option>
          </select>
          <label for="profileTransfer">Human Transfer Number</label>
          <input id="profileTransfer" placeholder="+15551234567" />
          <label for="profileVoices">Voice Pool</label>
          <textarea id="profileVoices" placeholder="en-US-Journey-O"></textarea>
          <p class="help">One exact supported ConversationRelay voice identifier per line. Voices are presentation only and must match the selected TTS provider.</p>
          <label for="profileFacts">Authorized Facts</label>
          <textarea id="profileFacts"></textarea>
          <p class="help">JSON object only for this phone number's profile. Include disclosable business facts such as company_name or contract_id. Do not store passwords, PINs, full SSNs, card numbers, or security answers. Facts on this profile are never used by other numbers.</p>
          <div class="actions">
            <button class="primary" id="saveProfile" type="button">Save</button>
          </div>
          <div class="okmsg" id="agentsOk"></div>
          <div class="error" id="agentsError"></div>
        </div>
      </section>

      <section class="page" id="page-calls">
        <div class="card">
          <div class="actions" style="margin-top:0">
            <button class="secondary" id="refreshCalls" type="button">Refresh</button>
          </div>
          <div class="error" id="callsError"></div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Voice</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody id="callsBody"></tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="page" id="page-setup">
        <div class="card" style="margin-bottom:16px">
          <h3>Setup sequence</h3>
          <p class="help">Follow these steps in order. Do not enable a number until authorized facts and a human transfer number are saved.</p>
          <ol class="setup-list">
            <li><span class="n">1</span><span class="t">Paste MASTER PROMPT into Cursor</span></li>
            <li><span class="n">2</span><span class="t">Let Cursor build project</span></li>
            <li><span class="n">3</span><span class="t">Create Twilio account</span></li>
            <li><span class="n">4</span><span class="t">Create OpenAI API account</span></li>
            <li><span class="n">5</span><span class="t">Create Supabase account</span></li>
            <li><span class="n">6</span><span class="t">Run SUPABASE SQL</span></li>
            <li><span class="n">7</span><span class="t">Put API keys into .env</span></li>
            <li><span class="n">8</span><span class="t">npm install</span></li>
            <li><span class="n">9</span><span class="t">npm run dev</span></li>
            <li><span class="n">10</span><span class="t">Deploy server</span></li>
            <li><span class="n">11</span><span class="t">Put deployed HTTPS/WSS URLs in .env</span></li>
            <li><span class="n">12</span><span class="t">Open dashboard</span></li>
            <li><span class="n">13</span><span class="t">Phone Numbers</span></li>
            <li><span class="n">14</span><span class="t">Search area code</span></li>
            <li><span class="n">15</span><span class="t">Purchase number</span></li>
            <li><span class="n">16</span><span class="t">Agent Profiles</span></li>
            <li><span class="n">17</span><span class="t">Enter authorized information</span></li>
            <li><span class="n">18</span><span class="t">Enter human transfer number</span></li>
            <li><span class="n">19</span><span class="t">Enable agent</span></li>
            <li><span class="n">20</span><span class="t">Call the number</span></li>
          </ol>
        </div>
        <div class="grid-2">
          <div class="card">
            <h3>Provider configuration</h3>
            <p class="help"><strong>TWILIO</strong><br>Used for phone numbers, PSTN, ConversationRelay, STT, and TTS.<br>Variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN</p>
            <p class="help"><strong>OPENAI</strong><br>Used for question understanding, approved responses, and escalation logic.<br>Variables: OPENAI_API_KEY, OPENAI_MODEL</p>
            <p class="help"><strong>SUPABASE</strong><br>Used for profiles, contracts, approved facts, calls, and transcripts.<br>Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY</p>
            <p class="help"><strong>VOICE SERVER</strong><br>PUBLIC_BASE_URL example: https://voice.company.com<br>WS_BASE_URL example: wss://voice.company.com</p>
            <p class="help">Secrets stay on the server. They are never sent to this dashboard.</p>
            <div class="actions">
              <button class="secondary" id="syncWebhooks" type="button">Sync Twilio webhooks</button>
            </div>
            <div class="okmsg" id="setupOk"></div>
            <div class="error" id="setupError"></div>
          </div>
          <div class="card">
            <h3>Webhook map</h3>
            <div class="webhook"><div>Twilio Incoming Voice</div><div class="kv">POST<br><span id="urlVoice"></span></div></div>
            <div class="webhook"><div>ConversationRelay</div><div class="kv">GET / WebSocket<br><span id="urlRelay"></span></div></div>
            <div class="webhook"><div>Connect / Handoff</div><div class="kv">POST<br><span id="urlConnect"></span></div></div>
            <div class="webhook"><div>Call Status</div><div class="kv">POST<br><span id="urlStatus"></span></div></div>
            <p class="help" id="providerStatus"></p>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script>
    const pages = {
      dashboard: ["Dashboard", "Operations overview for disclosed automated voice lines."],
      numbers: ["Phone Numbers", "Search Twilio inventory or generate a batch of numbers. Each line gets its own profile."],
      agents: ["Agent Profiles", "Approved facts, transfer number, disclosure, and voice pool for each line."],
      calls: ["Calls", "Newest sessions first. Refresh after placing a test call."],
      setup: ["API Setup", "Twenty-step stand-up: providers, SQL, env, deploy, then purchase and enable a number."]
    };
    const titles = {
      dashboard: pages.dashboard,
      numbers: pages.numbers,
      agents: pages.agents,
      calls: pages.calls,
      setup: pages.setup
    };

    function $(id) { return document.getElementById(id); }
    function show(el, text) { el.style.display = "block"; el.textContent = text; }
    function hide(el) { el.style.display = "none"; el.textContent = ""; }
    function escapeHtml(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }
    function statusClass(status) {
      if (status === "completed" || status === "in-progress") return "ok";
      if (status === "human-handoff" || status === "no-answer" || status === "busy") return "warn";
      if (status === "failed" || status === "canceled") return "bad";
      return "";
    }
    async function api(path, options) {
      const response = await fetch(path, Object.assign({ credentials: "same-origin" }, options || {}));
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (err) { data = { error: text }; }
      if (!response.ok) {
        throw new Error((data && data.error) || ("Request failed (" + response.status + ")"));
      }
      return data;
    }

    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const page = btn.getAttribute("data-page");
        document.querySelectorAll(".nav-btn").forEach(function (item) { item.classList.remove("active"); });
        btn.classList.add("active");
        document.querySelectorAll(".page").forEach(function (section) { section.classList.remove("active"); });
        $("page-" + page).classList.add("active");
        $("pageTitle").textContent = titles[page][0];
        $("pageSubtitle").textContent = titles[page][1];
        setMenu(false);
        if (page === "dashboard") loadDashboard();
        if (page === "agents") loadProfiles();
        if (page === "calls") loadCalls();
        if (page === "setup") loadDashboard();
      });
    });
    function setMenu(open) {
      $("sidebar").classList.toggle("open", open);
      $("navMask").classList.toggle("show", open);
      document.body.classList.toggle("menu-open", open);
      $("menuBtn").setAttribute("aria-expanded", open ? "true" : "false");
    }
    $("menuBtn").addEventListener("click", function () {
      setMenu(!$("sidebar").classList.contains("open"));
    });
    $("navMask").addEventListener("click", function () { setMenu(false); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setMenu(false);
    });

    async function loadDashboard() {
      hide($("dashboardError"));
      try {
        const data = await api("/api/dashboard");
        $("statProfiles").textContent = data.stats.agentProfiles;
        $("statCalls").textContent = data.stats.totalCalls;
        $("statActive").textContent = data.stats.activeCalls;
        $("urlVoice").textContent = data.urls.voiceWebhook;
        $("urlRelay").textContent = data.urls.conversationRelay;
        $("urlConnect").textContent = data.urls.connectAction;
        $("urlStatus").textContent = data.urls.statusCallback;
        $("providerStatus").textContent =
          "Configured on this server — Twilio: " + (data.providers.twilio ? "yes" : "no") +
          ", OpenAI: " + (data.providers.openai ? "yes" : "no") +
          ", Supabase: " + (data.providers.supabase ? "yes" : "no") + ".";
      } catch (err) {
        show($("dashboardError"), err.message);
      }
    }

    $("areaCode").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        $("searchNumbers").click();
      }
    });
    $("searchNumbers").addEventListener("click", async function () {
      hide($("numbersError"));
      hide($("numbersNotice"));
      const areaCode = $("areaCode").value.trim();
      try {
        const data = await api("/api/numbers/search?areaCode=" + encodeURIComponent(areaCode));
        const body = $("numbersBody");
        body.innerHTML = "";
        if (!data.numbers || !data.numbers.length) {
          body.innerHTML = '<tr><td colspan="4" class="muted">No voice-enabled US local numbers found.</td></tr>';
          return;
        }
        data.numbers.forEach(function (item) {
          const tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(item.phoneNumber) + "</td>" +
            "<td>" + escapeHtml(item.locality || "") + "</td>" +
            "<td>" + escapeHtml(item.region || "") + "</td>" +
            '<td><button class="primary" type="button">Purchase</button></td>';
          tr.querySelector("button").addEventListener("click", function () {
            purchaseNumber(item.phoneNumber);
          });
          body.appendChild(tr);
        });
      } catch (err) {
        show($("numbersError"), err.message);
      }
    });

    $("generateNumbers").addEventListener("click", async function () {
      hide($("numbersError"));
      hide($("numbersNotice"));
      const areaCode = $("areaCode").value.trim();
      const quantity = Number($("numberQuantity").value || "1");
      if (!/^[0-9]{3}$/.test(areaCode)) {
        show($("numbersError"), "Enter a 3-digit US area code.");
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
        show($("numbersError"), "Quantity must be between 1 and 50 per batch.");
        return;
      }
      $("generateNumbers").disabled = true;
      $("searchNumbers").disabled = true;
      show($("numbersNotice"), "Generating " + quantity + " number(s) from Twilio in " + areaCode + "…");
      try {
        const data = await api("/api/numbers/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ areaCode: areaCode, quantity: quantity })
        });
        const body = $("numbersBody");
        body.innerHTML = "";
        if (!data.numbers || !data.numbers.length) {
          body.innerHTML = '<tr><td colspan="4" class="muted">No numbers were generated.</td></tr>';
        } else {
          data.numbers.forEach(function (item) {
            const tr = document.createElement("tr");
            tr.innerHTML =
              "<td>" + escapeHtml(item.phoneNumber) + "</td>" +
              '<td colspan="2">' + escapeHtml(item.label || "") + "</td>" +
              '<td><span class="badge ok">Generated</span></td>';
            body.appendChild(tr);
          });
        }
        show($("numbersNotice"), data.message || ("Generated " + data.purchased + " number(s)."));
        if (data.failed && data.failed.length) {
          show($("numbersError"), data.failed.length + " number(s) failed. Check Twilio inventory and try again.");
        }
        loadProfiles();
        loadDashboard();
      } catch (err) {
        hide($("numbersNotice"));
        show($("numbersError"), err.message);
      } finally {
        $("generateNumbers").disabled = false;
        $("searchNumbers").disabled = false;
      }
    });

    async function purchaseNumber(phoneNumber) {
      const label = window.prompt("Agent/Profile Label", "Contract A");
      if (!label) return;
      hide($("numbersError"));
      try {
        await api("/api/numbers/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber: phoneNumber, label: label })
        });
        show($("numbersNotice"), "Purchased successfully. Configure approved facts and human transfer number, then enable the profile.");
        loadProfiles();
        loadDashboard();
      } catch (err) {
        show($("numbersError"), err.message);
      }
    }

    let profiles = [];
    function selectedProfile() {
      return profiles.find(function (item) { return item.id === $("profileSelect").value; });
    }
    function fillProfile(profile) {
      $("profileLabel").value = profile ? profile.label : "";
      $("profilePhone").value = profile ? (profile.phone_number || "") : "";
      $("profileEnabled").value = profile && profile.enabled ? "true" : "false";
      $("profileDisclosure").value = profile ? profile.disclosure : "Hello. I am an automated authorized assistant.";
      $("profileTts").value = profile ? profile.tts_provider : "google";
      $("profileTransfer").value = profile && profile.human_transfer_number ? profile.human_transfer_number : "";
      $("profileVoices").value = profile && profile.voice_pool ? profile.voice_pool.join("\\n") : "en-US-Journey-O";
      $("profileFacts").value = JSON.stringify(profile && profile.authorized_facts ? profile.authorized_facts : {
        company_name: "ABC Contracting LLC",
        contract_id: "JOB-48291",
        service_type: "Warehouse Maintenance",
        authorized_contact: "Operations Department",
        job_location: "Jersey City, NJ",
        approved_start_date: "2026-08-31"
      }, null, 2);
    }
    async function loadProfiles() {
      hide($("agentsError"));
      try {
        profiles = await api("/api/agents");
        const select = $("profileSelect");
        const current = select.value;
        select.innerHTML = "";
        if (!profiles.length) {
          select.innerHTML = '<option value="">No profiles yet</option>';
          fillProfile(null);
          return;
        }
        profiles.forEach(function (profile) {
          const option = document.createElement("option");
          option.value = profile.id;
          option.textContent = profile.label + " (" + (profile.phone_number || "no number") + ")";
          select.appendChild(option);
        });
        select.value = current && profiles.some(function (item) { return item.id === current; }) ? current : profiles[0].id;
        fillProfile(selectedProfile());
      } catch (err) {
        show($("agentsError"), err.message);
      }
    }
    $("profileSelect").addEventListener("change", function () {
      fillProfile(selectedProfile());
    });
    $("saveProfile").addEventListener("click", async function () {
      hide($("agentsError"));
      hide($("agentsOk"));
      const profile = selectedProfile();
      if (!profile) {
        show($("agentsError"), "Purchase a number first to create a profile.");
        return;
      }
      var facts;
      try {
        facts = JSON.parse($("profileFacts").value);
        if (!facts || typeof facts !== "object" || Array.isArray(facts)) {
          throw new Error("Authorized facts must be a JSON object.");
        }
      } catch (err) {
        show($("agentsError"), "Authorized facts must be valid JSON.");
        return;
      }
      const transfer = $("profileTransfer").value.replace(/\\s+/g, "");
      const enabled = $("profileEnabled").value === "true";
      if (enabled && Object.keys(facts).length === 0) {
        show($("agentsError"), "Add authorized facts before enabling this agent.");
        return;
      }
      if (enabled && !transfer) {
        show($("agentsError"), "Set a human transfer number before enabling this agent.");
        return;
      }
      const voicePool = $("profileVoices").value.split(/\\r?\\n/).map(function (item) { return item.trim(); }).filter(Boolean);
      if (!voicePool.length) {
        show($("agentsError"), "Add at least one ConversationRelay voice identifier.");
        return;
      }
      try {
        const result = await api("/api/agents/" + encodeURIComponent(profile.id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: $("profileLabel").value,
            enabled: enabled,
            disclosure: $("profileDisclosure").value,
            tts_provider: $("profileTts").value,
            human_transfer_number: transfer || null,
            voice_pool: voicePool,
            authorized_facts: facts
          })
        });
        show($("agentsOk"), result && result.warnings && result.warnings.length
          ? result.warnings.join(" ")
          : "Profile saved. Enable the profile only after facts and the human transfer number are approved.");
        loadProfiles();
        loadDashboard();
      } catch (err) {
        show($("agentsError"), err.message);
      }
    });

    async function loadCalls() {
      hide($("callsError"));
      try {
        const calls = await api("/api/calls");
        const body = $("callsBody");
        body.innerHTML = "";
        if (!calls.length) {
          body.innerHTML = '<tr><td colspan="7" class="muted">No calls yet.</td></tr>';
          return;
        }
        calls.forEach(function (call) {
          const tr = document.createElement("tr");
          const started = call.started_at ? new Date(call.started_at).toLocaleString() : "";
          tr.innerHTML =
            "<td>" + escapeHtml(call.agent_label || "Unknown") + "</td>" +
            "<td>" + escapeHtml(call.from_number || "") + "</td>" +
            "<td>" + escapeHtml(call.to_number || "") + "</td>" +
            "<td>" + escapeHtml(call.voice_name || "") + "</td>" +
            '<td><span class="badge ' + statusClass(call.status) + '">' + escapeHtml(call.status || "") + "</span></td>" +
            "<td>" + escapeHtml(started) + "</td>" +
            "<td>" + escapeHtml(call.result || "") + "</td>";
          body.appendChild(tr);
        });
      } catch (err) {
        show($("callsError"), err.message);
      }
    }
    $("refreshCalls").addEventListener("click", loadCalls);

    $("syncWebhooks").addEventListener("click", async function () {
      hide($("setupError"));
      hide($("setupOk"));
      try {
        const result = await api("/api/numbers/sync-webhooks", { method: "POST" });
        show($("setupOk"), "Updated " + result.updated + " Twilio number webhook(s) to this server.");
      } catch (err) {
        show($("setupError"), err.message);
      }
    });

    loadDashboard().catch(function (err) {
      console.error(err);
    });
    (function () {
      var fold = $("isolationFold");
      if (!fold) return;
      var mobile = window.matchMedia("(max-width: 980px)");
      function syncFold() {
        if (mobile.matches) fold.removeAttribute("open");
        else fold.setAttribute("open", "");
      }
      syncFold();
      if (mobile.addEventListener) mobile.addEventListener("change", syncFold);
      else mobile.addListener(syncFold);
    })();
  </script>
</body>
</html>`;
}

export function renderLogin(error = ""): string {
  const errorHtml = error
    ? `<div class="error">${error.replace(/</g, "&lt;")}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sign in — AI Voice Platform</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; overflow-x: hidden; }
    body {
      font-family: "Segoe UI", "Avenir Next", Inter, ui-sans-serif, system-ui, sans-serif;
      background: #07111f;
      color: #eef4ff;
      display: grid;
      place-items: center;
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }
    .card {
      width: min(420px, 100%);
      background: #122038;
      border: 1px solid rgba(147, 176, 214, 0.16);
      border-radius: 18px;
      padding: clamp(20px, 5vw, 28px);
    }
    h1 { margin: 0 0 6px; font-size: clamp(20px, 5vw, 22px); }
    p { margin: 0 0 20px; color: #93a7c4; font-size: 14px; }
    label { display: block; font-size: 13px; color: #93a7c4; margin: 12px 0 6px; }
    input {
      width: 100%;
      background: #0b1730;
      color: #eef4ff;
      border: 1px solid rgba(147, 176, 214, 0.16);
      border-radius: 12px;
      padding: 11px 12px;
      font: inherit;
      font-size: 16px;
      min-height: 44px;
    }
    button {
      margin-top: 18px;
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 12px 16px;
      background: #3b82f6;
      color: white;
      font: inherit;
      font-weight: 650;
      cursor: pointer;
      min-height: 44px;
    }
    .error {
      margin: 0 0 16px;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(248, 113, 113, 0.12);
      color: #f87171;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <form class="card" method="post" action="/login">
    <h1>AI Voice Platform</h1>
    <p>Sign in to open the dashboard. The server is running.</p>
    ${errorHtml}
    <label for="username">Username</label>
    <input id="username" name="username" autocomplete="username" autofocus />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" />
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}
