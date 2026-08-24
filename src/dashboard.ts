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
    html, body { margin: 0; min-height: 100%; }
    body {
      font-family: "Segoe UI", "Avenir Next", Inter, ui-sans-serif, system-ui, sans-serif;
      background:
        radial-gradient(1200px 500px at 10% -10%, rgba(59, 130, 246, 0.16), transparent 50%),
        radial-gradient(900px 400px at 100% 0%, rgba(14, 165, 233, 0.08), transparent 45%),
        var(--navy);
      color: var(--text);
    }
    .app {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: 100vh;
    }
    .sidebar {
      background: linear-gradient(180deg, #0a172b 0%, #081322 100%);
      border-right: 1px solid var(--line);
      padding: 28px 18px;
      position: sticky;
      top: 0;
      height: 100vh;
    }
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
    }
    .nav-btn:hover, .nav-btn.active {
      background: rgba(59, 130, 246, 0.12);
      color: var(--text);
    }
    .nav-btn.active {
      box-shadow: inset 3px 0 0 var(--blue);
    }
    .content { padding: 28px; }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 22px;
    }
    .topbar h2 { margin: 0 0 6px; font-size: 28px; }
    .topbar p { margin: 0; color: var(--muted); }
    .menu {
      display: none;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      border-radius: 10px;
      padding: 8px 12px;
    }
    .grid-3, .grid-2 { display: grid; gap: 16px; }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-2 { grid-template-columns: 1.15fr 0.85fr; }
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
      min-width: 180px;
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
      background: #0b1730;
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 11px 12px;
    }
    textarea { min-height: 120px; resize: vertical; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; }
    .row > * { flex: 1; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    button.primary, button.secondary, button.danger {
      border: 0;
      border-radius: 12px;
      padding: 11px 16px;
      cursor: pointer;
      font-weight: 650;
    }
    button.primary { background: var(--blue); color: white; }
    button.secondary { background: #223552; color: var(--text); }
    button.ghost {
      background: transparent;
      color: var(--blue-2);
      border: 0;
      cursor: pointer;
    }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); }
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
    .kv { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .webhook {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px 16px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--line);
    }
    .muted { color: var(--muted); }
    @media (max-width: 980px) {
      .app { grid-template-columns: 1fr; }
      .sidebar {
        position: fixed;
        z-index: 20;
        transform: translateX(-110%);
        transition: transform 0.2s ease;
        width: 260px;
      }
      .sidebar.open { transform: none; }
      .menu { display: inline-flex; }
      .grid-3, .grid-2 { grid-template-columns: 1fr; }
      .content { padding: 18px; }
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
    <main class="content">
      <div class="topbar">
        <div>
          <button class="menu" id="menuBtn" type="button">Menu</button>
          <h2 id="pageTitle">Dashboard</h2>
          <p id="pageSubtitle">Operations overview for disclosed automated voice lines.</p>
        </div>
      </div>

      <section class="page active" id="page-dashboard">
        <div class="grid-3">
          <div class="card stat"><div class="label">Agent Profiles</div><div class="value" id="statProfiles">0</div></div>
          <div class="card stat"><div class="label">Total Calls</div><div class="value" id="statCalls">0</div></div>
          <div class="card stat"><div class="label">Active Calls</div><div class="value" id="statActive">0</div></div>
        </div>
        <div class="grid-2" style="margin-top:16px">
          <div class="card">
            <h3>System architecture</h3>
            <div class="flow">
              <div class="flow-step">Caller</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">Twilio Number</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">POST /voice</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">ConversationRelay</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">WebSocket</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">OpenAI + Supabase</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">Twilio TTS</div>
              <div class="flow-join">↓</div>
              <div class="flow-step">Caller</div>
            </div>
          </div>
          <div class="card">
            <h3>Operating rules</h3>
            <p class="help">This system is a disclosed automated authorized assistant. It does not claim to be human, impersonate a person, or invent verification data. If a caller needs identity, signature, consent, credentials, or a fact that is not in authorized_facts, the call is transferred to the configured human number.</p>
            <p class="help">Voice pool entries only change synthetic TTS presentation. Every call remains the same automated assistant.</p>
          </div>
        </div>
      </section>

      <section class="page" id="page-numbers">
        <div class="card">
          <h3>Search US local numbers</h3>
          <div class="row">
            <div>
              <label for="areaCode">Area code</label>
              <input id="areaCode" maxlength="3" placeholder="201" />
            </div>
            <div>
              <button class="primary" id="searchNumbers" type="button">Search numbers</button>
            </div>
          </div>
          <div class="notice" id="numbersNotice"></div>
          <div class="error" id="numbersError"></div>
          <div style="overflow:auto; margin-top:16px">
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
          <p class="help">JSON object only. Include disclosable business facts such as company_name or contract_id. Do not store passwords, PINs, full SSNs, card numbers, or security answers.</p>
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
          <div style="overflow:auto; margin-top:12px">
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
        <div class="grid-2">
          <div class="card">
            <h3>Provider configuration</h3>
            <p class="help"><strong>TWILIO</strong><br>Used for phone numbers, PSTN, ConversationRelay, STT, and TTS.<br>Variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN</p>
            <p class="help"><strong>OPENAI</strong><br>Used for question understanding, approved responses, and escalation logic.<br>Variables: OPENAI_API_KEY, OPENAI_MODEL</p>
            <p class="help"><strong>SUPABASE</strong><br>Used for profiles, contracts, approved facts, calls, and transcripts.<br>Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY</p>
            <p class="help"><strong>VOICE SERVER</strong><br>PUBLIC_BASE_URL example: https://voice.company.com<br>WS_BASE_URL example: wss://voice.company.com</p>
            <p class="help">Secrets stay on the server. They are never sent to this dashboard.</p>
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
      numbers: ["Phone Numbers", "Search and purchase Twilio numbers, then configure the agent before enabling it."],
      agents: ["Agent Profiles", "Approved facts, transfer number, disclosure, and voice pool for each line."],
      calls: ["Calls", "Newest sessions first. Refresh after placing a test call."],
      setup: ["API Setup", "Server-side provider variables and the Twilio webhook map."]
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
        $("sidebar").classList.remove("open");
        if (page === "dashboard") loadDashboard();
        if (page === "agents") loadProfiles();
        if (page === "calls") loadCalls();
        if (page === "setup") loadDashboard();
      });
    });
    $("menuBtn").addEventListener("click", function () {
      $("sidebar").classList.toggle("open");
    });

    async function loadDashboard() {
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
    }

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
        company_name: "Example Contracting LLC",
        contract_id: "JOB-48291",
        service_type: "Warehouse Maintenance",
        authorized_contact: "Operations Desk",
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
      const voicePool = $("profileVoices").value.split(/\\r?\\n/).map(function (item) { return item.trim(); }).filter(Boolean);
      if (!voicePool.length) {
        show($("agentsError"), "Add at least one ConversationRelay voice identifier.");
        return;
      }
      try {
        await api("/api/agents/" + encodeURIComponent(profile.id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: $("profileLabel").value,
            enabled: $("profileEnabled").value === "true",
            disclosure: $("profileDisclosure").value,
            tts_provider: $("profileTts").value,
            human_transfer_number: $("profileTransfer").value || null,
            voice_pool: voicePool,
            authorized_facts: facts
          })
        });
        show($("agentsOk"), "Profile saved. Enable the profile only after facts and the human transfer number are approved.");
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

    loadDashboard().catch(function (err) {
      console.error(err);
    });
  </script>
</body>
</html>`;
}
