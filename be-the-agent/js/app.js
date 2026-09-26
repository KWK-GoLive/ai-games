/* Be the Agent — app shell: level map, level flow (how it works -> play -> what you just saw), saved progress. */
(function () {
  "use strict";
  var BTA = window.BTA;
  var ui = BTA.ui, h = ui.h;
  var app = document.getElementById("app");

  var levels = (BTA.levels || []).slice().sort(function (a, b) { return a.num - b.num; });
  BTA.levels = levels;

  function levelState(id) { return BTA.state.levels[id] || null; }
  function isUnlocked(def) {
    if (ui.flags.teacher || def.num === 1) return true;
    var prev = levels[def.num - 2];
    return !!(prev && levelState(prev.id) && levelState(prev.id).done);
  }
  function allDone() { return levels.every(function (l) { return levelState(l.id) && levelState(l.id).done; }); }

  function updatePill() {
    var mp = document.getElementById("modePill");
    var modes = [];
    if (ui.flags.classMode) modes.push("Class mode");
    if (ui.flags.teacher) modes.push("Teacher");
    mp.textContent = modes.join(" · ");
    mp.classList.toggle("hidden", !modes.length);
  }
  function top() { window.scrollTo(0, 0); }

  /* ---------- level map ---------- */
  function renderHome() {
    ui.clear(app); top(); updatePill();
    app.appendChild(h("section", { class: "card" },
      h("div", { class: "kicker", text: "Game 2 \u00b7 A game about AI assistants" }),
      h("h1", { text: "Be the Agent." }),
      h("p", { text: "In the first game you saw that a language model does one thing: it guesses the next word. So how can a chatbot read your files, do sums it can't reliably do in its head, and hand you a real Excel file?" }),
      h("p", { text: "The answer is the app built around the model. In six levels you'll take turns playing the model, the app around it, and the human in charge, using the files of a small made-up caf\u00e9, Moonbean Caf\u00e9." }),
      h("p", { class: "small", text: "Honest note: the model\u2019s replies in this game are pre-written to show what typically happens (a simplified replay). The calculator, table tool, search ranking and file makers really run in your browser." }),
      h("p", { class: "muted small" }, "No background needed. About 25\u201330 minutes. Haven't played the first game? ",
        h("a", { href: "../be-the-llm/index.html", text: "Play Be the LLM first" }), " (recommended, not required).")));

    var grid = h("div", { class: "levels" });
    levels.forEach(function (def) {
      var st = levelState(def.id);
      var open = isUnlocked(def);
      var b = h("button", { class: "level-card", type: "button", disabled: !open, "data-level": def.id },
        h("span", { class: "num", text: "LEVEL " + def.num }),
        h("span", { class: "name", text: def.name }),
        h("span", { class: "desc", text: def.desc }),
        h("span", { class: "foot" },
          h("span", { text: open ? (st && st.done ? "Play again" : "Play") : "Locked" }),
          st && st.done ? h("span", { class: "done-tick", text: "\u2713 Done" }) : null));
      b.addEventListener("click", function () { openLevel(def); });
      grid.appendChild(b);
    });
    app.appendChild(grid);

    var endBtn = h("button", { class: "btn primary", type: "button", text: "See my results", disabled: !(allDone() || ui.flags.teacher) });
    endBtn.addEventListener("click", function () { BTA.renderSummary(app); });
    app.appendChild(h("div", { class: "card soft row", style: "margin-top:16px" },
      h("div", { style: "flex:1;min-width:200px" },
        h("h3", { text: "Finish line" }),
        h("p", { class: "muted small", style: "margin:0", text: allDone() ? "All " + levels.length + " levels done." : "Finish all " + levels.length + " levels to see your results." })),
      endBtn));
  }
  BTA.renderHome = renderHome;

  /* ---------- one level: how it works -> play -> what you just saw ---------- */
  function introCard(def, onStart) {
    var card = h("section", { class: "card stack intro" },
      h("div", { class: "kicker", text: "How it works" }));
    var steps = h("ol", { class: "steps" });
    def.intro.forEach(function (c) {
      steps.appendChild(h("li", { class: "step" },
        h("div", { class: "step-text" },
          c.title ? h("b", { text: c.title }) : null,
          c.title ? " " : null,
          c.text),
        c.ex ? h("div", { class: "step-ex", text: c.ex, "aria-hidden": c.exSr ? "true" : null }) : null,
        c.exSr ? h("span", { class: "sr-only", text: c.exSr }) : null));
    });
    card.appendChild(steps);
    card.appendChild(h("p", { class: "small muted", style: "margin:0", text: "The model\u2019s replies in this level are a simplified replay; the tools really run." }));
    var go = h("button", { class: "btn primary", type: "button", text: "Got it, let's play" });
    go.addEventListener("click", function () { if (go.disabled) return; go.disabled = true; onStart(card); });
    card.appendChild(h("div", { class: "row end" }, go));
    return card;
  }

  function openLevel(def) {
    ui.clear(app); top(); updatePill();
    app.appendChild(h("section", { class: "card" },
      h("div", { class: "kicker", text: "Level " + def.num + " of " + levels.length }),
      h("h1", { text: def.name }),
      h("p", { class: "muted", text: def.goal })));

    var body = h("div", { tabindex: "-1" });
    app.appendChild(introCard(def, function (card) {
      card.classList.add("hidden");
      var finished = false; // a double-click on any "Finish" button must not add a second result block
      def.run(body, function (res) {
        if (finished) return;
        finished = true;
        finishLevel(def, res, body);
      });
      var focusTarget = body.querySelector("[data-focus]") || body;
      focusTarget.focus({ preventScroll: true });
      body.scrollIntoView({ block: "start" });
    }));
    app.appendChild(body);
  }

  function finishLevel(def, res, bodyEl) {
    BTA.state.levels[def.id] = {
      done: true
    };
    ui.save();
    updatePill();
    if (allDone()) BTA.markSiteDone && BTA.markSiteDone();

    var recap = h("section", { class: "card why stack" },
      h("div", { class: "kicker", text: "What you just saw" }),
      h("h2", { text: def.recap.title }),
      def.recap.text.map(function (t) { return h("p", { text: t }); }),
      def.recap.words ? h("dl", { class: "glossary" }, def.recap.words.map(function (w) {
        return [h("dt", { text: w[0] }), h("dd", { text: w[1] })];
      })) : null);

    var next = levels[def.num];
    var nextBtn = next
      ? h("button", { class: "btn primary", type: "button", text: "Next: Level " + next.num + " →" })
      : h("button", { class: "btn primary", type: "button", text: "See my results →" });
    nextBtn.addEventListener("click", function () { if (next) openLevel(next); else BTA.renderSummary(app); });
    var mapBtn = h("button", { class: "btn", type: "button", text: "Level map" });
    mapBtn.addEventListener("click", renderHome);
    var againBtn = h("button", { class: "btn ghost", type: "button", text: "Play again" });
    againBtn.addEventListener("click", function () { openLevel(def); });

    var result = h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Level " + def.num + " complete" }),
      res.summary ? h("p", { text: res.summary }) : null);

    var holder = h("div");
    holder.appendChild(result);
    holder.appendChild(recap);
    holder.appendChild(h("div", { class: "row end" }, againBtn, mapBtn, nextBtn));
    bodyEl.appendChild(holder);
    result.setAttribute("tabindex", "-1");
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("brand").addEventListener("click", renderHome);
  document.getElementById("resetBtn").addEventListener("click", function () {
    if (!window.confirm || window.confirm("Reset your progress in this browser?")) {
      ui.reset(); renderHome(); ui.toast("Progress reset.");
    }
  });
  if (ui.flags.classMode) { document.documentElement.classList.add("class-mode"); document.body.classList.add("class-mode"); }
  renderHome();
})();
