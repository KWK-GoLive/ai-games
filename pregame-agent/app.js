/*
 * Watch a Real Agent — a no-score warm-up before Be the Agent. It replays a real, recorded agent run
 * (data.js; excerpts checked against pregames/data/raw/agent-run.json by tests/check-pregames.js).
 * The input file and the two output files in files/ are the real ones.
 */
(function () {
  "use strict";
  var V = window.VIS, h = V.h, D = window.PG_AGENT;
  var app = document.getElementById("app");

  function clear() { while (app.firstChild) app.removeChild(app.firstChild); window.scrollTo(0, 0); }
  function btn(text, cls, fn) { var b = h("button", { class: "btn " + (cls || ""), type: "button", text: text }); b.addEventListener("click", fn); return b; }
  function download(path, name) { var a = h("a", { href: path, download: name }); document.body.appendChild(a); a.click(); a.remove(); }
  function csvSpec(text) {
    return { type: "xlsx", sheets: [{ name: "sales.csv", rows: text.trim().split(/\r?\n/).map(function (l) { return l.split(",").map(function (c) { return c !== "" && !isNaN(Number(c)) ? Number(c) : c; }); }) }] };
  }
  function loadPreview() {
    var P = window.PG_AGENT_FILES;
    return P ? Promise.resolve(P) : Promise.reject(new Error("preview missing"));
  }
  /* A file row with View here / Download. The view is built from the real file's contents. */
  function fileRow(name, path, specOf, note) {
    var holder = h("div");
    loadPreview().then(function (P) {
      holder.appendChild(V.fileActions({ name: name, spec: specOf(P), note: note, download: function () { download(path, name); } }));
    }).catch(function () {
      holder.appendChild(h("div", { class: "v-file" }, h("b", { text: name }), " ", h("a", { class: "btn", href: path, download: name, text: "⬇ Download" })));
    });
    return holder;
  }
  var FILES = {
    csv: function () { return fileRow("sales.csv", "files/sales.csv", function (P) { return csvSpec(P.csv); }, "Input: 38 sales from July (made up for this game)."); },
    xlsx: function () { return fileRow("sales_summary.xlsx", "files/sales_summary.xlsx", function (P) { return { type: "xlsx", sheets: P.xlsx }; }, "Made by the agent."); },
    docx: function () { return fileRow("sales_memo.docx", "files/sales_memo.docx", function (P) { return { type: "docx", blocks: P.docx }; }, "Made by the agent."); }
  };

  /* ---------- intro ---------- */
  function intro() {
    clear();
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Game 4 · warm-up before Be the Agent" }),
      h("h1", { text: "Watch a Real Agent" }),
      h("p", { class: "goal-line", text: "An AI agent is a chatbot that can use tools and make things. We gave a real one a file and a job, and recorded every step it took. Guess what it does next, then check its work." }),
      V.flow([{ icon: "📄", label: "A file goes in" }, { icon: "🤖", label: "The agent works", sub: "step by step" }, { icon: "📊", label: "Files come out" }, { icon: "🧐", label: "You check them" }]),
      h("p", { class: "muted small", text: "No score, no typing. About 6 minutes." }),
      h("div", { class: "row end" }, btn("Start →", "primary", job))));
  }

  /* ---------- the job ---------- */
  function job() {
    clear();
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "The job" }),
      h("div", { class: "chat-line" }, h("div", { class: "v-card accent" }, h("div", { class: "pg-label", text: "🧑‍💼 The shop owner asks" }), h("p", { class: "pg-said", text: "“" + D.request + "”" }))),
      h("div", { class: "pg-label", text: "The file the agent gets" }),
      FILES.csv(),
      h("p", { class: "small muted", text: "Open it: a small made-up stationery shop, one row per sale. (We left one row incomplete on purpose, to see what the agent would do with it.)" }),
      h("div", { class: "row end" }, btn("Watch the agent →", "primary", function () { step(0); }))));
  }

  /* ---------- replay, one step per screen, with a guess before some steps ---------- */
  function stepCard(s, n) {
    return h("section", { class: "card stack pg-step" },
      h("div", { class: "kicker", text: "Step " + (n + 1) + " of " + D.steps.length }),
      h("h2", {}, h("span", { "aria-hidden": "true", text: s.icon + " " }), s.title),
      s.said ? h("div", {}, h("div", { class: "pg-label", text: "🤖 The agent wrote" }), h("p", { class: "pg-said", text: "“" + s.said + "”" })) : null,
      s.calls.map(function (c) {
        return h("div", { class: "stack" },
          h("div", {}, h("div", { class: "pg-label", text: "🔧 Tool: " + c.tool }), h("pre", { class: "pg-code", text: c.call })),
          c.result !== null && c.result !== undefined ? h("div", {}, h("div", { class: "pg-label", text: "📥 What came back" }), h("pre", { class: "pg-out", text: c.result })) : null,
          c.note ? h("p", { class: "small muted", text: c.note }) : null);
      }),
      s.said2 ? h("div", {}, h("div", { class: "pg-label", text: "🤖 Then the agent wrote" }), h("p", { class: "pg-said", text: "“" + s.said2 + "”" })) : null,
      h("div", { class: "v-card accent" }, h("div", { class: "v-card-title", text: "💡 What happened" }), h("p", { text: s.explain })));
  }
  function step(n) {
    clear();
    var s = D.steps[n], g = D.guesses[s.id];
    var holder = h("div");
    app.appendChild(holder);
    function show() {
      var c = stepCard(s, n);
      holder.appendChild(c);
      c.appendChild(h("div", { class: "row end" }, btn(n + 1 < D.steps.length ? "Next step →" : "See what it sent back →", "primary", function () { if (n + 1 < D.steps.length) step(n + 1); else report(); })));
      if (g) c.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!g) return show();
    var q = h("section", { class: "card stack" }, h("div", { class: "kicker", text: "Guess first" }), h("p", { style: "font-weight:700", text: g.q }));
    var grid = h("div", { class: "choices one", role: "group", "aria-label": "your guess" });
    var fb = h("p", { class: "feedback", "aria-live": "polite" });
    g.options.forEach(function (o, i) {
      var b = h("button", { class: "choice", type: "button", text: o });
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(grid.children, function (x, j) { x.disabled = true; if (j === g.answer) x.classList.add("correct"); });
        if (i !== g.answer) b.classList.add("wrong");
        fb.className = "feedback " + (i === g.answer ? "good" : "bad");
        fb.textContent = i === g.answer ? "✓ That's what it did." : "It did something else. Here's what really happened:";
        show();
      });
      grid.appendChild(b);
    });
    q.appendChild(grid); q.appendChild(fb);
    holder.appendChild(q);
  }

  /* ---------- the report and the real files ---------- */
  function report() {
    clear();
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Done: what it sent back" }),
      h("div", { class: "pg-label", text: "🤖 The agent's final message (exactly as written)" }),
      h("div", { class: "pg-reply", style: "animation:none" }, D.final),
      h("div", { class: "pg-label", text: "The real files it made" }),
      FILES.xlsx(), FILES.docx(),
      h("p", { class: "small muted", text: "These are the actual files from the run. Open them and look around." }),
      h("div", { class: "row end" }, btn("Now check its work →", "primary", checkWork))));
  }

  /* ---------- your turn: check the agent ---------- */
  function checkWork() {
    clear();
    var answered = 0, right = 0;
    var card = h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Your turn: be the checker" }),
      h("h2", { text: "Is each statement true?" }),
      h("p", { class: "small muted", text: D.claimsNote + " sales.csv is here if you want to look:" }),
      FILES.csv());
    var out = h("div", { class: "stack" });
    D.claims.forEach(function (c) {
      var fb = h("p", { class: "feedback", "aria-live": "polite" });
      var t = V.h("div", { class: "tabs toggle", role: "group", "aria-label": c.text });
      var bOk = h("button", { type: "button", "aria-pressed": "false", text: "✓ True" });
      var bNo = h("button", { type: "button", "aria-pressed": "false", text: "⚠ Needs checking" });
      [bOk, bNo].forEach(function (b) {
        b.addEventListener("click", function () {
          if (bOk.disabled) return;
          var saysOk = b === bOk; bOk.disabled = bNo.disabled = true; b.setAttribute("aria-pressed", "true");
          var good = saysOk === c.ok; answered++; if (good) right++;
          fb.className = "feedback " + (good ? "good" : "bad"); fb.textContent = (good ? "✓ " : "✗ ") + (c.ok ? "True. " : "Not quite. ") + c.why;
          if (answered === D.claims.length) finish();
        });
        t.appendChild(b);
      });
      card.appendChild(h("div", { class: "v-card pg-claim" }, h("b", { text: c.text }), t, fb));
    });
    card.appendChild(out);
    app.appendChild(card);
    function finish() {
      out.appendChild(h("div", { class: "v-card accent" }, h("div", { class: "v-card-title", text: "🤔 Notice" }),
        h("p", { text: "You judged " + right + " of " + D.claims.length + " correctly. The numbers came from a program and were right. But one memo sentence misread the data, another claimed more than the data shows, and the agent stepped outside the folder it was told to stay in. It did a lot of good work, and still needed a human to check it." })));
      out.appendChild(h("div", { class: "row end" }, btn("Last step →", "primary", finale)));
    }
  }

  /* ---------- finale ---------- */
  function finale() {
    clear();
    try { var k = "ai-games-done", d = JSON.parse(localStorage.getItem(k) || "{}") || {}; if (!d["pre-agent"]) { d["pre-agent"] = Date.now(); localStorage.setItem(k, JSON.stringify(d)); } } catch (e) { /* storage blocked */ }
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Four mysteries" }),
      h("h2", { text: "A model only writes text. So how did it do all that?" }),
      h("div", { class: "pg-mystery" }, [
        ["📄", "How did it “read” sales.csv?", "Levels 1 and 2"],
        ["🧮", "Why write a program instead of adding up in its head?", "Level 3"],
        ["🔁", "Why plan, act, check and fix, again and again?", "Level 4"],
        ["🧑‍💼", "What should an agent never do without asking you?", "Levels 5 and 6"]
      ].map(function (m) { return h("div", { class: "v-card" }, h("span", { class: "v-card-icon sm", "aria-hidden": "true", text: m[0] }), h("div", {}, h("div", { class: "q", text: m[1] }), h("div", { class: "small muted", text: "Find out in Be the Agent, " + m[2] }))); })),
      h("div", { class: "row end" }, h("a", { class: "btn", href: "../index.html", text: "All games" }), h("a", { class: "btn primary", href: "../be-the-agent/index.html", text: "Play Be the Agent →" })),
      h("p", { class: "pg-foot", text: "About this run: recorded on " + D.recorded + " (UTC). The agent was the Claude model “" + D.model + "” working in an AI agent tool that can run commands and programs and read and write files. We gave it sales.csv, the owner's request, and three instructions: work as it normally would, only read and write inside the shop's folder, and finish with a short message for the owner. Every tool step is shown, in the order it happened; long commands and results are shortened (“…” marks a cut) but not changed. The files are the real outputs. Another run could take different steps." })));
  }

  intro();
})();
