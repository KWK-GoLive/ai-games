/*
 * AI games — the arena shell shared by LLM Arena and Agent Arena.
 * Player sign-in, stages and items, timer, scoring (speed bonus, streak, hints), saved progress,
 * "first run counts" lock, practice mode, and a send queue for the class scoreboard.
 *
 * A game calls ARENA.start({ game, title, ... stages: [...] }). Each stage has make(rng) -> items.
 * An item: { title, limit (s), hint, key, grade(answer) -> {frac, explain}, render(box, api) -> {collect(), reveal(ans, res)} }
 */
(function () {
  "use strict";
  var CFG = window.AIG_CONFIG || {};
  var URL_ = String(CFG.SCOREBOARD_URL || "").trim();
  var TIME_FACTOR = Number(CFG.TIME_FACTOR) > 0 ? Number(CFG.TIME_FACTOR) : 1;
  // test hook for the automated tests only: never on the published site
  var TEST = /[?&]test=1\b/.test(location.search) && /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "text") el.textContent = v;
      else if (k === "html") el.innerHTML = v; // only ever used with our own constant strings
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  /* ---------- random numbers (seeded, so a resumed run gets the same items) ---------- */
  function hash(str) {
    var x = 2166136261;
    for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  function makeRng(seed) {
    var a = (typeof seed === "string" ? hash(seed) : seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  function newId() { return Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36); }
  /* A run's id doubles as its resume code: 8 easy-to-read characters, e.g. K7Q2-XPMA (no 0/O, 1/I). */
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function newCode() {
    var out = "", buf = new Uint32Array(8);
    try { crypto.getRandomValues(buf); } catch (e) { for (var j = 0; j < 8; j++) buf[j] = Math.floor(Math.random() * 4294967296); }
    for (var i = 0; i < 8; i++) { out += CODE_CHARS[buf[i] % CODE_CHARS.length]; if (i === 3) out += "-"; }
    return out;
  }
  function normCode(s) {
    var c = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : "";
  }

  /* ---------- the same cleaning rules as the scoreboard script ---------- */
  function cleanText(s, max) {
    s = String(s == null ? "" : s).replace(/[^\p{L}\p{M}\p{N} _\-]/gu, "").replace(/\s+/g, " ").trim();
    return s.replace(/^[=+\-@]+/, "").slice(0, max);
  }
  function cleanNick(s) { return cleanText(s, 16); }
  function cleanTeam(s) { return cleanText(s, 20); }
  function cleanClass(s) { return cleanText(s, 20).replace(/[^A-Za-z0-9\-]/g, "-").toUpperCase(); }

  /* ---------- scoring ---------- */
  // base 100 x how right you were, + up to 50 for speed, x1.5 from the 3rd fully right answer in a row, halved by a hint.
  function score(o) {
    var frac = Math.max(0, Math.min(1, o.frac || 0));
    var base = Math.round(100 * frac);
    var speed = frac > 0 && o.limit > 0 ? Math.round(50 * frac * Math.max(0, o.remaining) / o.limit) : 0;
    var streak = frac === 1 ? (o.streakBefore || 0) + 1 : 0;
    var mult = frac === 1 && streak >= 3 ? 1.5 : 1;
    var total = Math.round((base + speed) * mult * (o.hint ? 0.5 : 1));
    return { base: base, speed: speed, mult: mult, hint: !!o.hint, streak: streak, total: total };
  }

  /* ---------- storage (works even if the browser blocks it) ---------- */
  var mem = {};
  function load(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return mem[key] ? JSON.parse(mem[key]) : null; } }
  function save(key, val) { var s = JSON.stringify(val); try { localStorage.setItem(key, s); } catch (e) { mem[key] = s; } }
  function markSiteDone(id) {
    var d = load("ai-games-done") || {};
    if (!d[id]) { d[id] = Date.now(); save("ai-games-done", d); }
  }

  /* ---------- scoreboard connection ---------- */
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("no answer from the scoreboard")); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function apiGet(params, ms) {
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return withTimeout(fetch(URL_ + (URL_.indexOf("?") >= 0 ? "&" : "?") + q, { cache: "no-store" }).then(function (r) { return r.json(); }), ms || 10000);
  }
  function apiPost(obj) {
    // Sent as a GET: a browser POST to Apps Script gets redirected and the reply can be lost (seen in Chrome),
    // while GET replies arrive reliably. The server treats action=post exactly like a POST. Payloads are small.
    return apiGet({ action: "post", payload: JSON.stringify(obj), t: Date.now() }, 35000); // a busy class can queue for a while
  }

  /* The player's nickname, team and class code, typed once on the front page and shared by both arenas. */
  var PROFILE_KEY = "aig-player";
  function getProfile() { var p = load(PROFILE_KEY) || {}; return { nickname: cleanNick(p.nickname), team: cleanTeam(p.team), classCode: cleanClass(p.classCode) }; }
  function setProfile(p) { save(PROFILE_KEY, { nickname: p.nickname || "", team: p.team || "", classCode: p.classCode || "" }); }

  var ARENA = window.ARENA = {
    getProfile: getProfile, setProfile: setProfile,
    h: h, clear: clear, makeRng: makeRng, shuffle: shuffle, pick: pick, score: score,
    cleanNick: cleanNick, cleanClass: cleanClass, cleanTeam: cleanTeam, hash: hash,
    boardEnabled: !!URL_, apiGet: apiGet
  };

  /* ================================================================== */
  ARENA.start = function (def) {
    var KEY = "aig-arena-" + def.game;
    var app = document.getElementById("app");
    var st = load(KEY) || {};
    st.player = st.player || { nickname: "", team: "", classCode: "" };
    st.official = st.official || null;
    st.practice = st.practice || null;
    st.queue = st.queue || [];
    function persist() { save(KEY, st); }
    var stages = def.stages;
    var timerId = null;
    function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
    function top() { window.scrollTo(0, 0); }

    /* ---------- send queue ---------- */
    var statusEls = [];
    var flushing = false;
    // Did the scoreboard say that the CURRENT official run doesn't count (nickname already used)?
    function notCounted() { return !!(st.official && st.notCountedRuns && st.notCountedRuns[st.official.runId]); }
    function queueStatus() {
      if (!URL_) return "";
      if (notCounted()) return "\u26a0 Your nickname was already taken in this class (maybe by you on another device or browser), so these results don't count on the scoreboard. Tell your teacher.";
      var n = st.queue.length;
      return n ? "Waiting to send " + n + " stage result" + (n === 1 ? "" : "s") + " to the scoreboard…" : "Scoreboard up to date ✓";
    }
    function paintStatus() {
      statusEls = statusEls.filter(function (el) { return document.body.contains(el); });
      statusEls.forEach(function (el) { el.textContent = queueStatus(); el.className = "status " + (st.queue.length || notCounted() ? "wait" : "ok"); });
    }
    function statusEl() { var el = h("p", { class: "status", "aria-live": "polite" }); statusEls.push(el); el.textContent = queueStatus(); el.className = "status " + (st.queue.length || notCounted() ? "wait" : "ok"); return el; }
    function flush() {
      if (!URL_ || flushing || !st.queue.length) { paintStatus(); return; }
      flushing = true;
      var row = st.queue[0];
      var sentOk = false;
      apiPost(row).then(function (r) {
        if (r && r.ok) {
          st.queue.shift(); sentOk = true;
          if (r.taken || r.counted === false) { st.notCountedRuns = st.notCountedRuns || {}; st.notCountedRuns[row.runId] = true; }
          persist();
        } else if (r && r.fatal) { st.queue.shift(); sentOk = true; persist(); console.warn("scoreboard refused a row:", r.error); }
        // any other error (busy, quota): keep the row and try again later
      }).catch(function () { /* offline: try again later */ }).then(function () {
        flushing = false; paintStatus();
        if (st.queue.length && sentOk) setTimeout(flush, 300);
      });
    }
    setInterval(flush, 12000 + Math.floor(Math.random() * 8000)); // spread retries so a class doesn't retry in step
    window.addEventListener("online", flush);

    /* ---------- runs ---------- */
    function newRun(mode) {
      var id = newCode();
      return { runId: id, seed: id, mode: mode, stage: 0, item: 0, results: [], complete: false,
        player: { nickname: st.player.nickname, team: st.player.team, classCode: st.player.classCode } };
    }
    function current() { return st.official && !st.official.complete ? st.official : st.practice && !st.practice.complete ? st.practice : null; }
    function runTotals(run) {
      var pts = 0, correct = 0, items = 0, hints = 0, secs = 0;
      run.results.forEach(function (sr) { (sr || []).forEach(function (r) { pts += r.points; correct += r.frac === 1 ? 1 : 0; items++; hints += r.hint ? 1 : 0; secs += r.secs; }); });
      return { points: pts, correct: correct, items: items, hints: hints, secs: Math.round(secs) };
    }
    function streakOf(run) {
      var n = 0;
      run.results.forEach(function (sr) { (sr || []).forEach(function (r) { n = r.frac === 1 ? n + 1 : 0; }); });
      return n;
    }
    function itemsFor(run, si) {
      return stages[si].make(makeRng(run.seed + ":" + stages[si].id), { game: def.game });
    }
    function sendsToBoard(run) { return run.mode === "official" && !!URL_ && !!run.player.classCode; }
    function resumeNote(run) {
      if (!sendsToBoard(run) || !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(run.runId)) return null;
      return h("p", { class: "small muted" }, "Switching computers? Your resume code is ", h("b", { class: "mono", text: run.runId }),
        ". On the other computer, open this arena, choose \u201cContinue on another computer\u201d and type your nickname, class code and this code. You carry on from the next stage.");
    }

    /* ---------- home ---------- */
    function renderHome() {
      stopTimer(); clear(app); top();
      var V = window.VIS;
      app.appendChild(h("section", { class: "card stack" },
        h("div", { class: "kicker", text: def.kicker }),
        h("h1", { text: def.title }),
        def.intro.map(function (p) { return h("p", { text: p }); }),
        V && def.stages ? V.flow(def.stages.map(function (sd, i) { return { label: (i + 1) + ". " + sd.name, icon: sd.icon }; }), { compact: true }) : null));

      var PTS = [
        { icon: "💯", title: "100 points", text: "for each fully right answer (some answers give part marks)." },
        { icon: "⚡", title: "Up to +50 speed bonus", text: "shrinking as the timer runs down." },
        { icon: "🔥", title: "Streak ×1.5", text: "from your 3rd fully right answer in a row." },
        { icon: "💡", title: "Hints", text: "help, but halve that item's points." },
        { icon: "🏁", title: "Only your first full run counts", text: "on the class scoreboard. After that you can practise as much as you like." }
      ];
      app.appendChild(h("section", { class: "card soft stack" },
        h("h2", { text: "How points work" }),
        V ? V.cards(PTS, { cols: 3 }) : h("ul", { class: "rules" }, PTS.map(function (x) { return h("li", {}, h("b", { text: x.title }), " " + x.text); })),
        h("p", { class: "muted small", text: "6 stages, about 20 minutes. Everything the model does here is really computed in your browser, with the same rules as in the learning game." })));

      var run = current();
      if (st.official && st.official.complete) {
        var t = runTotals(st.official);
        var card = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Your official run" }),
          h("div", { class: "big-points", text: t.points + " points" }),
          h("p", { class: "muted", text: t.correct + " of " + t.items + " fully right · played as " + st.official.player.nickname + (st.official.player.classCode ? " in class " + st.official.player.classCode : "") }),
          statusEl());
        var resBtn = h("button", { class: "btn", type: "button", text: "See the breakdown" });
        resBtn.addEventListener("click", function () { renderFinal(st.official); });
        var pr = h("button", { class: "btn primary", type: "button", text: run ? "Continue practice run" : "Practice run (not scored)" });
        pr.addEventListener("click", function () { if (!run) { st.practice = newRun("practice"); persist(); } go(current()); });
        card.appendChild(h("div", { class: "row end" }, boardLink(st.official), resBtn, pr));
        app.appendChild(card);
      } else if (run) {
        var c2 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: run.mode === "official" ? "Your run is in progress" : "Practice run in progress" }),
          h("p", { text: "Playing as " + run.player.nickname + ". You're on stage " + (run.stage + 1) + " of " + stages.length + ", item " + (run.item + 1) + "." }),
          resumeNote(run),
          (run.cur && run.cur.s === run.stage && run.cur.i === run.item) ? h("p", { class: "muted small", text: "You carry on from the item you were on. Its timer kept running while you were away." }) : null);
        var cont = h("button", { class: "btn primary", type: "button", text: "Continue →", "data-focus": "1" });
        cont.addEventListener("click", function () { go(run); });
        c2.appendChild(h("div", { class: "row end" }, cont));
        app.appendChild(c2);
      } else {
        app.appendChild(playerForm());
      }
      var s = statusEl(); if (URL_ && st.queue.length) app.appendChild(s);
      flush();
    }

    function boardLink(run) {
      if (!URL_ || !run.player.classCode) return null;
      return h("a", { class: "btn", href: "../board.html?game=" + def.game + "&class=" + encodeURIComponent(run.player.classCode), target: "_blank", rel: "noopener", text: "Class scoreboard" });
    }

    function playerForm() {
      var prof = getProfile();
      var pre = { nickname: prof.nickname || st.player.nickname || "", team: prof.nickname ? prof.team : (st.player.team || ""), classCode: prof.classCode || st.player.classCode || "" };
      var nick = h("input", { class: "text-input", id: "nick", maxlength: "16", autocomplete: "off", value: pre.nickname });
      var team = h("input", { class: "text-input", id: "team", maxlength: "20", autocomplete: "off", value: pre.team });
      var code = h("input", { class: "text-input", id: "classCode", maxlength: "20", autocomplete: "off", value: pre.classCode });
      var msg = h("p", { class: "feedback", "aria-live": "polite" });
      var btn = h("button", { class: "btn primary", type: "submit", text: "Start my run →" });
      var form = h("form", { class: "card stack", novalidate: true },
        h("div", { class: "kicker", text: "Sign in" }),
        h("h2", { text: "Who's playing?" }),
        h("label", { class: "field", for: "nick" }, "Nickname ", h("span", { class: "muted", text: "(not your real name or student ID)" }), nick),
        h("label", { class: "field", for: "team" }, "Team name ", h("span", { class: "muted", text: "(optional; everyone in a team types the same name)" }), team),
        URL_ ? h("label", { class: "field", for: "classCode" }, "Class code ", h("span", { class: "muted", text: "(from your teacher)" }), code)
          : h("p", { class: "muted small", text: "The class scoreboard isn't connected, so your score stays on this device." }),
        msg,
        h("div", { class: "row end" }, btn));
      // Signed in on the front page already? Show a short "Playing as …" card; "Change" opens the full form.
      var ready = pre.nickname && (!URL_ || pre.classCode);
      var wrap = h("div");
      if (ready) {
        var go1 = h("button", { class: "btn primary", type: "button", text: "Start my run \u2192" });
        var chg = h("button", { class: "btn ghost", type: "button", text: "Change" });
        var summary = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Signed in" }),
          h("h2", {}, "Playing as ", h("b", { text: pre.nickname })),
          h("p", { class: "muted", text: [pre.team ? "Team " + pre.team : "No team", URL_ ? "class " + pre.classCode : "scores stay on this device"].join(" \u00b7 ") }),
          h("div", { class: "row end" }, chg, go1));
        form.classList.add("hidden");
        chg.addEventListener("click", function () { summary.remove(); form.classList.remove("hidden"); nick.focus(); });
        go1.addEventListener("click", function () {
          if (go1.disabled) return;
          go1.disabled = true;
          form.classList.remove("hidden"); summary.classList.add("hidden"); // any message (e.g. nickname taken) shows in the form
          form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
        });
        wrap.appendChild(summary);
      }
      wrap.appendChild(form);
      if (URL_) wrap.appendChild(resumeForm());
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (btn.disabled) return;
        var n = cleanNick(nick.value), tm = cleanTeam(team.value), cc = URL_ ? cleanClass(code.value) : "";
        if (!n) { msg.className = "feedback bad"; msg.textContent = "Please type a nickname (letters or numbers)."; nick.focus(); return; }
        if (URL_ && !cc) { msg.className = "feedback bad"; msg.textContent = "Please type the class code your teacher gave you."; code.focus(); return; }
        st.player = { nickname: n, team: tm, classCode: cc };
        setProfile({ nickname: n, team: tm, classCode: cc || getProfile().classCode });
        var run = newRun("official");
        function begin() { st.official = run; persist(); go(run); }
        if (!URL_) return begin();
        // Joining claims the nickname on the scoreboard straight away (stage 0), so two students can't both use it.
        var join = { game: def.game, classCode: cc, runId: run.runId, nickname: n, team: tm, stage: 0, stageName: "joined", items: 0, correct: 0, points: 0, seconds: 0, hints: 0 };
        btn.disabled = true; msg.className = "feedback muted"; msg.textContent = "Joining the class scoreboard\u2026";
        apiPost(join).then(function (r) {
          if (r && r.ok && r.taken) {
            btn.disabled = false; msg.className = "feedback bad";
            msg.textContent = "The nickname \u201c" + n + "\u201d is already taken in " + cc + " (maybe by you on another device or browser). Please pick a different one.";
            nick.focus();
          } else if (r && r.ok) begin();
          else throw new Error("busy");
        }).catch(function () { st.queue.push(join); begin(); /* can't reach the scoreboard: play now, send later */ });
      });
      return wrap;
    }

    /* ---------- continue an official run that was started on another computer ---------- */
    function resumeForm() {
      var p0 = getProfile();
      var rn = h("input", { class: "text-input", id: "rNick", maxlength: "16", autocomplete: "off", value: p0.nickname || st.player.nickname || "" });
      var rc = h("input", { class: "text-input", id: "rClass", maxlength: "20", autocomplete: "off", value: p0.classCode || st.player.classCode || "" });
      var rk = h("input", { class: "text-input mono", id: "rCode", maxlength: "12", autocomplete: "off", placeholder: "e.g. K7Q2-XPMA" });
      var msg = h("p", { class: "feedback", "aria-live": "polite" });
      var btn = h("button", { class: "btn primary", type: "submit", text: "Continue my run \u2192" });
      var f = h("form", { class: "stack", novalidate: true },
        h("label", { class: "field", for: "rNick" }, "Nickname (the same as before)", rn),
        h("label", { class: "field", for: "rClass" }, "Class code", rc),
        h("label", { class: "field", for: "rCode" }, "Resume code ", h("span", { class: "muted", text: "(shown after each stage on the other computer)" }), rk),
        msg, h("div", { class: "row end" }, btn));
      var det = h("details", { class: "card soft" }, h("summary", { style: "cursor:pointer;font-weight:600", text: "Continue on another computer" }),
        h("p", { class: "muted small", text: "Started your run on a different computer? Use the resume code from its stage screen. Stages you finished there keep their points; the stage you were in the middle of starts again with new questions." }), f);
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        if (btn.disabled) return;
        var n = cleanNick(rn.value), cc = cleanClass(rc.value), code = normCode(rk.value);
        if (!n || !cc) { msg.className = "feedback bad"; msg.textContent = "Please type your nickname and class code."; return; }
        if (!code) { msg.className = "feedback bad"; msg.textContent = "A resume code has 8 letters or digits, like K7Q2-XPMA."; rk.focus(); return; }
        btn.disabled = true; msg.className = "feedback muted"; msg.textContent = "Looking up your run\u2026";
        apiGet({ action: "resume", game: def.game, classCode: cc, nickname: n, runId: code, t: Date.now() }, 20000).then(function (r) {
          if (!r || !r.ok) throw new Error((r && r.error) || "no answer");
          if (!r.found) { btn.disabled = false; msg.className = "feedback bad"; msg.textContent = "No run found for that nickname, class code and resume code in this arena. Check all three."; return; }
          var run = { runId: code, seed: code + "~resumed", mode: "official", stage: 0, item: 0, results: [], complete: false, resumed: true,
            player: { nickname: n, team: cleanTeam(r.team || ""), classCode: cc } };
          r.stages.forEach(function (sr) {
            var arr = [];
            for (var i = 0; i < sr.items; i++) arr.push({ frac: i < sr.correct ? 1 : 0, points: i === 0 ? sr.points : 0, hint: i < sr.hints, secs: i === 0 ? sr.seconds : 0, imported: true });
            run.results[sr.stage - 1] = arr;
          });
          while (run.stage < stages.length && run.results[run.stage]) run.stage++;
          run.complete = run.stage >= stages.length;
          st.player = run.player;
          setProfile(run.player);
          if (!r.counted) { st.notCountedRuns = st.notCountedRuns || {}; st.notCountedRuns[code] = true; }
          st.official = run; persist();
          go(run);
        }).catch(function (err) { btn.disabled = false; msg.className = "feedback bad"; msg.textContent = "Can't reach the scoreboard right now (" + err.message + "). Try again in a moment."; });
      });
      return det;
    }

    /* ---------- run flow ---------- */
    function go(run) {
      if (run.complete) return renderFinal(run);
      var started = run.cur && run.cur.s === run.stage && run.cur.i === run.item;
      if (run.item === 0 && !started && !(run.results[run.stage] || []).length) return renderStageIntro(run);
      renderItem(run);
    }

    function renderStageIntro(run) {
      stopTimer(); clear(app); top();
      var V = window.VIS;
      var sd = stages[run.stage];
      var items = itemsFor(run, run.stage);
      app.appendChild(h("section", { class: "card stack" },
        h("div", { class: "kicker", text: "Stage " + (run.stage + 1) + " of " + stages.length + (run.mode === "practice" ? " · practice" : "") }),
        h("h1", {}, sd.icon ? h("span", { "aria-hidden": "true", text: sd.icon + " " }) : null, sd.name),
        h("p", { class: "goal-line", text: sd.goal })));
      var rules = h("section", { class: "card why stack" },
        h("h2", { text: "The rules" }),
        V ? V.rules(sd.rules) : h("ul", { class: "rules" }, sd.rules.map(function (r) { return h("li", { text: r }); })),
        sd.example ? (V ? h("div", {}, h("div", { class: "small muted", text: "Example:" }), V.example(sd.example)) : h("div", { class: "textbox", text: sd.example })) : null,
        h("p", { class: "muted small", text: items.length + " item" + (items.length === 1 ? "" : "s") + ". The timer starts when you press Start." }));
      var go1 = h("button", { class: "btn primary", type: "button", text: "Start stage " + (run.stage + 1) + " →", "data-focus": "1" });
      go1.addEventListener("click", function () { if (go1.disabled) return; go1.disabled = true; renderItem(run); });
      rules.appendChild(h("div", { class: "row end" }, go1));
      app.appendChild(rules);
      go1.focus({ preventScroll: true });
    }

    function renderItem(run) {
      stopTimer(); clear(app); top();
      var sd = stages[run.stage];
      var items = itemsFor(run, run.stage);
      var it = items[run.item];
      var limit = Math.round((it.limit || 45) * TIME_FACTOR);
      // The start time and hint are saved, so reloading the page doesn't restart the clock or undo a hint.
      if (!run.cur || run.cur.s !== run.stage || run.cur.i !== run.item) { run.cur = { s: run.stage, i: run.item, t0: Date.now(), hint: false }; persist(); }
      var t0 = run.cur.t0, done = false, hintUsed = !!run.cur.hint;
      var tot = runTotals(run), streak = streakOf(run);

      var bar = h("span", { style: "width:100%" });
      var timer = h("div", { class: "timer", role: "progressbar", "aria-label": "time left", "aria-valuemin": "0", "aria-valuemax": String(limit) }, bar);
      var secsEl = h("b", { text: limit + "s" });
      app.appendChild(h("section", { class: "card stack" },
        h("div", { class: "hud" },
          h("span", {}, "Stage ", h("b", { text: (run.stage + 1) + "/" + stages.length }), " · ", sd.name),
          h("span", {}, "Item ", h("b", { text: (run.item + 1) + "/" + items.length })),
          h("span", {}, h("b", { text: String(tot.points) }), " pts"),
          streak >= 2 ? h("span", { class: "streak", text: "🔥 " + streak + " in a row" + (streak >= 2 ? " (next right answer ×1.5)" : "") }) : null,
          run.mode === "practice" ? h("span", { class: "pill", text: "Practice" }) : null),
        h("div", { class: "row" }, timer, secsEl)));

      var box = h("div", { class: "item-box stack" });
      var itemCard = h("section", { class: "card stack" }, it.title ? h("h2", { text: it.title }) : null, box);
      app.appendChild(itemCard);
      var hintBox = h("div");
      var ctl;
      var api = {
        h: h, clear: clear,
        submit: function (ans) { finish(ans, false); }
      };
      ctl = it.render(box, api) || {};
      function showHint() { hintBox.appendChild(h("div", { class: "card soft small", role: "note" }, h("b", { text: "Hint: " }), typeof it.hint === "function" ? it.hint() : it.hint)); }
      if (it.hint && hintUsed) showHint();
      else if (it.hint) {
        var hb = h("button", { class: "btn ghost small", type: "button", text: "Hint (halves this item's points)" });
        hb.addEventListener("click", function () {
          if (done || hintUsed) return;
          hintUsed = true; run.cur.hint = true; persist(); hb.remove();
          showHint();
        });
        itemCard.appendChild(h("div", { class: "row" }, hb));
      }
      itemCard.appendChild(hintBox);
      var resultHolder = h("div");
      app.appendChild(resultHolder);
      var f = box.querySelector("[data-focus]") || box.querySelector("button, input, textarea, select");
      if (f) f.focus({ preventScroll: true });

      function tick() {
        var left = limit - (Date.now() - t0) / 1000;
        if (left <= 0) { left = 0; }
        bar.style.width = (100 * left / limit) + "%";
        timer.classList.toggle("low", left < limit * 0.25);
        timer.setAttribute("aria-valuenow", String(Math.ceil(left)));
        secsEl.textContent = Math.ceil(left) + "s";
        if (left <= 0 && !done) finish(ctl.collect ? ctl.collect() : null, true);
      }
      timerId = setInterval(tick, 200);
      tick();

      if (TEST) window.ARENA_TEST = { item: it, run: run, submit: function (a) { finish(a, false); } };

      function finish(ans, timedOut) {
        if (done) return;
        done = true; stopTimer();
        var elapsed = Math.min(limit, (Date.now() - t0) / 1000);
        var res;
        try { res = it.grade(ans); } catch (e) { res = { frac: 0, explain: "That answer couldn't be read." }; }
        if (!res) res = { frac: 0 };
        var sc = score({ frac: res.frac, limit: limit, remaining: timedOut ? 0 : limit - elapsed, streakBefore: streak, hint: hintUsed });
        box.classList.add("locked");
        if (!box.querySelector(".v-file")) box.setAttribute("aria-disabled", "true"); // (a made file stays usable)
        Array.prototype.forEach.call(box.querySelectorAll("button, input, textarea, select"), function (el) { if (!el.classList.contains("unlock-ok") && !el.closest(".v-file")) el.disabled = true; }); // a made file can still be viewed/downloaded
        if (ctl.reveal) { try { ctl.reveal(ans, res); } catch (e) { /* display only */ } }

        run.results[run.stage] = run.results[run.stage] || [];
        run.results[run.stage][run.item] = { frac: res.frac, points: sc.total, hint: hintUsed, secs: Math.round(elapsed * 10) / 10, timeout: timedOut };
        run.item++;
        var stageDone = run.item >= items.length;
        if (stageDone) { run.stage++; run.item = 0; }
        if (stageDone && run.stage >= stages.length) run.complete = true;
        if (stageDone) stageFinished(run, run.stage - 1, items.length);
        persist();

        var verdict = res.frac === 1 ? "✓ Right!" : res.frac > 0 ? "Partly right (" + Math.round(res.frac * 100) + "%)" : timedOut ? "⏱ Time's up" : "✗ Not quite";
        if (timedOut && res.frac > 0) verdict = "⏱ Time's up. What you had: " + Math.round(res.frac * 100) + "% right";
        var parts = [sc.base + " base"];
        if (sc.speed) parts.push("+ " + sc.speed + " speed");
        if (sc.mult > 1) parts.push("× 1.5 streak");
        if (sc.hint) parts.push("÷ 2 hint");
        var nextBtn = h("button", { class: "btn primary", type: "button", text: stageDone ? (run.complete ? "See my results →" : "Stage " + run.stage + " done →") : "Next item →" });
        nextBtn.addEventListener("click", function () { if (nextBtn.disabled) return; nextBtn.disabled = true; stageDone ? renderStageEnd(run, run.stage - 1) : renderItem(run); });
        var card = h("section", { class: "card stack result-card" + (res.frac === 1 ? "" : res.frac > 0 ? " part" : " bad"), tabindex: "-1" },
          h("h2", { text: verdict }),
          res.explain ? (typeof res.explain === "string" ? h("p", { text: res.explain })
            : Array.isArray(res.explain) ? h("div", { class: "stack" }, res.explain.map(function (t, i) { return h("p", { class: i ? "small" : null, text: t }); }))
            : res.explain) : null,
          h("p", { class: "pts-line", text: "+" + sc.total + " points  (" + parts.join(" ") + ")" }),
          h("div", { class: "row end" }, nextBtn));
        resultHolder.appendChild(card);
        card.focus({ preventScroll: true });
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    function stageFinished(run, si, n) {
      if (!sendsToBoard(run)) return;
      var sr = run.results[si] || [];
      st.queue.push({
        game: def.game, classCode: run.player.classCode, runId: run.runId, nickname: run.player.nickname, team: run.player.team,
        stage: si + 1, stageName: stages[si].name,
        items: n, correct: sr.filter(function (r) { return r.frac === 1; }).length,
        points: sr.reduce(function (a, r) { return a + r.points; }, 0),
        seconds: Math.round(sr.reduce(function (a, r) { return a + r.secs; }, 0)),
        hints: sr.filter(function (r) { return r.hint; }).length
      });
      setTimeout(flush, 0);
    }

    function renderStageEnd(run, si) {
      stopTimer(); clear(app); top();
      var sr = run.results[si] || [];
      var pts = sr.reduce(function (a, r) { return a + r.points; }, 0);
      var ok = sr.filter(function (r) { return r.frac === 1; }).length;
      var sd = stages[si];
      var next = h("button", { class: "btn primary", type: "button", text: run.complete ? "See my results →" : "Next: stage " + (si + 2) + " →", "data-focus": "1" });
      next.addEventListener("click", function () { if (next.disabled) return; next.disabled = true; go(run); });
      var home = h("button", { class: "btn", type: "button", text: "Pause (arena home)" });
      home.addEventListener("click", renderHome);
      app.appendChild(h("section", { class: "card stack" },
        h("div", { class: "kicker", text: "Stage " + (si + 1) + " complete" }),
        h("h1", { text: sd.name + ": " + pts + " points" }),
        h("p", { class: "muted", text: ok + " of " + sr.length + " fully right. Total so far: " + runTotals(run).points + " points." }),
        sd.lesson ? h("div", { class: "card soft lesson-card" }, h("div", { class: "lesson-icon", "aria-hidden": "true", text: "💡" }), h("div", {}, h("b", { text: "What this stage shows: " }), sd.lesson)) : null,
        sendsToBoard(run) ? statusEl() : null,
        run.complete ? null : resumeNote(run),
        h("div", { class: "row end" }, home, next)));
      next.focus({ preventScroll: true });
      if (run.complete) markSiteDone(def.game + "-arena");
    }

    function renderFinal(run) {
      stopTimer(); clear(app); top();
      markSiteDone(def.game + "-arena");
      var t = runTotals(run);
      var tbody = h("tbody");
      stages.forEach(function (sd, i) {
        var sr = run.results[i] || [];
        tbody.appendChild(h("tr", {},
          h("td", { text: (i + 1) + ". " + sd.name }),
          h("td", { class: "num", text: sr.filter(function (r) { return r.frac === 1; }).length + "/" + sr.length }),
          h("td", { class: "num", text: String(sr.filter(function (r) { return r.hint; }).length) }),
          h("td", { class: "num", text: String(sr.reduce(function (a, r) { return a + r.points; }, 0)) })));
      });
      var again = h("button", { class: "btn primary", type: "button", text: "Practice run (not scored)" });
      again.addEventListener("click", function () { st.practice = newRun("practice"); persist(); go(st.practice); });
      var home = h("a", { class: "btn", href: "../index.html", text: "All games" });
      app.appendChild(h("section", { class: "card stack" },
        h("div", { class: "kicker", text: run.mode === "official" ? "Your official run" : "Practice run (not on the scoreboard)" }),
        h("div", { class: "big-points", text: t.points + " points" }),
        h("p", { class: "muted", text: t.correct + " of " + t.items + " fully right · " + t.hints + " hint" + (t.hints === 1 ? "" : "s") + " · " + Math.round(t.secs / 60) + " min of answering" }),
        h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, h("th", { text: "Stage" }), h("th", { class: "num", text: "Right" }), h("th", { class: "num", text: "Hints" }), h("th", { class: "num", text: "Points" }))),
          tbody)),
        sendsToBoard(run) ? statusEl() : null,
        run.mode === "official" && !run.player.classCode ? h("p", { class: "muted small", text: "Played without a class code, so this score stays on this device." }) : null,
        h("div", { class: "row end" }, home, boardLink(run), again)));
      if (def.finalCard) app.appendChild(def.finalCard(h));
      flush();
    }

    document.getElementById("brand").addEventListener("click", renderHome);
    var reset = document.getElementById("resetBtn");
    if (reset) reset.addEventListener("click", function () {
      var msg = "Delete this arena's saved progress on this device?" + (st.official && URL_ && st.official.player.classCode
        ? " Anything already sent stays on the class scoreboard, and your nickname stays taken there: another official run would need a new nickname." : "");
      if (!window.confirm || window.confirm(msg)) {
        var q = st.queue; st = { player: st.player, queue: q, official: null, practice: null }; persist(); renderHome();
      }
    });
    ARENA._renderHome = renderHome;
    renderHome();
  };
})();
