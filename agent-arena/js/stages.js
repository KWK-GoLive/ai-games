/*
 * Agent Arena — stage texts and how each kind of item is drawn. The items themselves come from items.js.
 */
(function () {
  "use strict";
  var A = window.ARENA, h = A.h, W = A.w, I = window.AGA.Items, D = window.AGA_DATA;
  var F = window.BTA.Files;

  function tableEl(rows) {
    return h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, rows[0].map(function (c) { return h("th", { text: String(c) }); }))),
      h("tbody", {}, rows.slice(1).map(function (r) { return h("tr", {}, r.map(function (c) { return h("td", { class: typeof c === "number" ? "num" : null, text: typeof c === "number" ? c.toLocaleString("en-US") : String(c) }); })); }))));
  }
  function resultEl(cmd, r) {
    return h("div", { class: "card soft stack", style: "margin:0" },
      h("div", { class: "mono small", text: "▶ table_tool(“" + cmd + "”)" }),
      r.ok ? h("div", { class: "stack" }, h("div", { text: r.text }), r.table ? tableEl(r.table) : null)
        : h("div", { class: "feedback bad", text: "Error: " + r.error }));
  }

  /* ---------- Stage 1: desk ---------- */
  function drawDesk(it, box, api) {
    var chosen = [];
    var meterBar = h("span"), meter = h("div", { class: "meter", role: "progressbar", "aria-label": "desk space used" }, meterBar);
    var used = h("b"), msg = h("p", { class: "feedback", "aria-live": "polite" });
    function paint() {
      var u = it.use(chosen);
      used.textContent = u + " / " + it.capacity + " tokens";
      meterBar.style.width = Math.min(100, 100 * u / it.capacity) + "%";
      meter.classList.toggle("over", u > it.capacity);
    }
    box.appendChild(h("ol", {}, it.desk.questions.map(function (q) { return h("li", {}, h("b", { text: q })); })));
    box.appendChild(h("div", { class: "stack" }, h("div", { class: "row" }, h("span", { text: "Desk space:" }), used), meter));
    box.appendChild(h("div", { class: "pick on", style: "cursor:default" }, h("span", { text: "📌" }), h("span", {}, h("b", { text: "System prompt (always on the desk): " }), it.system), h("span", { class: "tok", text: it.tokens({ text: it.system }) + " tok" })));
    var list = h("div", { class: "pick-list" });
    var btns = it.cards.map(function (c) {
      var b = h("button", { class: "pick", type: "button", "aria-pressed": "false", "data-id": c.id },
        h("span", { class: "small muted", text: c.kind }), h("span", { text: c.text }), h("span", { class: "tok", text: it.tokens(c) + " tok" }));
      b.addEventListener("click", function () {
        var i = chosen.indexOf(c.id);
        if (i >= 0) chosen.splice(i, 1);
        else {
          if (it.use(chosen.concat([c.id])) > it.capacity) { msg.className = "feedback bad"; msg.textContent = "That won't fit: the desk is full. Take something off first."; return; }
          chosen.push(c.id);
        }
        msg.textContent = "";
        b.classList.toggle("on", chosen.indexOf(c.id) >= 0);
        b.setAttribute("aria-pressed", String(chosen.indexOf(c.id) >= 0));
        paint();
      });
      list.appendChild(b);
      return b;
    });
    box.appendChild(list);
    box.appendChild(msg);
    var sub = h("button", { class: "btn primary", type: "button", text: "Hand the desk to the model" });
    sub.addEventListener("click", function () { api.submit(chosen.slice()); });
    box.appendChild(h("div", { class: "row end" }, sub));
    paint();
    return {
      collect: function () { return chosen.slice(); },
      reveal: function () { btns.forEach(function (b, i) { var c = it.cards[i]; var on = chosen.indexOf(c.id) >= 0; if (c.need) b.classList.add(on ? "good" : "bad"); else if (on) b.classList.add("bad"); }); }
    };
  }

  /* ---------- Stage 2: search ---------- */
  function drawSearch(it, box, api) {
    var tries = [];
    var inp = h("input", { class: "text-input", type: "text", autocomplete: "off", "aria-label": "search words", placeholder: "up to " + it.maxWords + " words", style: "max-width:18em" });
    var go = h("button", { class: "btn primary", type: "submit", text: "Search" });
    var left = h("span", { class: "muted small" });
    var msg = h("p", { class: "feedback", "aria-live": "polite" });
    var results = h("div", { class: "stack" });
    function paintLeft() { left.textContent = (it.tries - tries.length) + " tr" + (it.tries - tries.length === 1 ? "y" : "ies") + " left"; }
    var form = h("form", { class: "row" }, inp, go, left);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = inp.value.trim().replace(/\s+/g, " ");
      if (!q) { inp.focus(); return; }
      if (q.split(" ").length > it.maxWords) { msg.className = "feedback bad"; msg.textContent = "At most " + it.maxWords + " words. Pick the ones that matter."; return; }
      tries.push(q); paintLeft();
      var r = it.rank(q);
      A.clear(results);
      results.appendChild(h("div", { class: "mono small", text: "▶ search_handbook(“" + q + "”)" }));
      r.res.slice(0, 3).forEach(function (x, i) {
        results.appendChild(h("div", { class: "doc" + (i === 0 && r.win ? " good" : "") },
          h("div", { class: "meta", text: "Result " + (i + 1) + " · " + x.score + " matching word" + (x.score === 1 ? "" : "s") + (x.matched.length ? " (" + x.matched.join(", ") + ")" : "") }),
          h("b", { text: x.chunk.title + ": " }), x.chunk.text));
      });
      if (r.win) { msg.className = "feedback good"; msg.textContent = "✓ The right piece is on top."; api.submit(tries.slice()); }
      else if (tries.length >= it.tries) { msg.className = "feedback bad"; msg.textContent = "Out of tries."; api.submit(tries.slice()); }
      else { msg.className = "feedback bad"; msg.textContent = r.res[0].score === 0 ? "No piece matches those words." : r.res[0].score === (r.res[1] || {}).score ? "A tie at the top: make it clearer." : "The top piece isn't the right one. Try other words."; inp.select(); }
    });
    box.appendChild(h("p", { class: "small muted", text: "The search tool ranks the " + it.handbook.length + " handbook pieces by how many of your words they contain (small words like “the” are ignored). Get the piece that answers the question to #1, on its own." }));
    box.appendChild(form); box.appendChild(msg); box.appendChild(results);
    paintLeft();
    return { collect: function () { return tries.slice(); } };
  }

  /* ---------- Stage 3: tool router ---------- */
  function drawMcq(it, box, api) {
    var c = W.choices(it.options, function (v) { api.submit(v); });
    box.appendChild(h("p", { class: "small muted", text: "Which should the agent use?" }));
    box.appendChild(c.el);
    return { collect: c.collect, reveal: function () { c.reveal(it.key); } };
  }

  /* ---------- Stage 4: data detective ---------- */
  function drawData(it, box, api) {
    var calls = 0, errors = 0;
    var t = I.Tools.Engine.parseCsv(it.csv);
    box.appendChild(h("p", { class: "small muted" }, "rentals.csv has " + t.rows.length + " rows with the columns ", h("b", { class: "mono", text: t.cols.join(", ") }), ". You can't see the rows: use the table tool."));
    box.appendChild(h("div", { class: "textbox small", text: "SHOW 5 ROWS    COUNT ROWS    TOTAL col    TOTAL col BY col    MAX col    MIN col\n… WHERE col = value    … WHERE col > number    … WHERE col < number" }));
    var cmd = h("input", { class: "text-input mono", type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "table tool command", placeholder: "e.g. SHOW 5 ROWS" });
    var run = h("button", { class: "btn", type: "submit", text: "▶ Run" });
    var counter = h("span", { class: "muted small" });
    function paint() { counter.textContent = calls + " call" + (calls === 1 ? "" : "s") + ", " + errors + " error" + (errors === 1 ? "" : "s"); }
    var log = h("div", { class: "stack" });
    var f1 = h("form", { class: "row" }, h("div", { style: "flex:1;min-width:14em" }, cmd), run, counter);
    f1.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = cmd.value.trim(); if (!c) { cmd.focus(); return; }
      var r = it.run(c); calls++; if (!r.ok) errors++; paint();
      log.insertBefore(resultEl(c, r), log.firstChild);
    });
    var ans = W.inputBox({ label: "your answer", placeholder: "answer", width: "12em", button: "Submit answer", onSubmit: function (v) { api.submit({ answer: v, calls: calls, errors: errors }); } });
    box.appendChild(f1); box.appendChild(log);
    box.appendChild(h("div", { class: "stack" }, h("b", { text: "Your answer:" }), ans.el));
    paint();
    return { collect: function () { return { answer: ans.collect(), calls: calls, errors: errors }; } };
  }

  /* ---------- Stage 5: injection hunter ---------- */
  function drawDocs(it, box, api) {
    var marks = it.docs.map(function () { return null; });
    var sub = h("button", { class: "btn primary", type: "button", text: "Submit", disabled: true });
    var rows = it.docs.map(function (d, i) {
      var t = W.toggle(["Planted order", "Fine"], function (v) { marks[i] = v === "Planted order"; sub.disabled = marks.some(function (m) { return m === null; }); });
      var card = h("div", { class: "doc stack" }, h("div", { class: "meta", text: d.kind }), h("div", { text: d.text }), t.el);
      box.appendChild(card);
      return card;
    });
    sub.addEventListener("click", function () { api.submit(marks.slice()); });
    box.appendChild(h("div", { class: "row end" }, sub));
    return {
      collect: function () { return marks.map(function (m) { return m === null ? undefined : m; }); },
      reveal: function (ans) { rows.forEach(function (r, i) { r.style.borderColor = (ans || [])[i] === it.key[i] ? "var(--good)" : "var(--warn)"; r.style.borderWidth = "2px"; }); }
    };
  }

  /* ---------- Stage 6: boss ---------- */
  function drawBoss(it, box, api) {
    var st = { order: [], perms: it.permissions.map(function () { return null; }), ran: false, flagged: null, made: false };
    box.appendChild(h("div", { class: "card soft" }, h("b", { text: it.job })));

    // A. plan
    var planOut = h("ol", { class: "rules" });
    var planBtns = h("div", { class: "tiles" });
    function paintPlan() {
      A.clear(planOut);
      st.order.forEach(function (id) { planOut.appendChild(h("li", { text: it.plan.filter(function (p) { return p.id === id; })[0].text })); });
      Array.prototype.forEach.call(planBtns.children, function (b) { b.disabled = st.order.indexOf(b.getAttribute("data-id")) >= 0 || st.order.length >= 5; });
    }
    it.plan.forEach(function (p) {
      var b = h("button", { class: "tile", type: "button", "data-id": p.id, text: p.text });
      b.addEventListener("click", function () { if (st.order.length < 5 && st.order.indexOf(p.id) < 0) { st.order.push(p.id); paintPlan(); } });
      planBtns.appendChild(b);
    });
    var undo = h("button", { class: "btn small", type: "button", text: "⌫ Undo" });
    undo.addEventListener("click", function () { st.order.pop(); paintPlan(); });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "A. Plan: click 5 steps in order (leave out the bad ones)" }), planBtns, planOut, h("div", { class: "row" }, undo)));

    // B. permissions
    var perms = h("div", { class: "stack" });
    it.permissions.forEach(function (p, i) {
      var t = W.toggle(["Allow", "Ask me", "Block"], function (v) { st.perms[i] = v; });
      perms.appendChild(h("div", { class: "row" }, h("span", { style: "flex:1;min-width:12em", text: p.text }), t.el));
    });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "B. Permissions: what may the agent do without asking?" }), perms));

    // C. run the tool
    var cmd = h("input", { class: "text-input mono", type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "table tool command", placeholder: "table tool command" });
    var log = h("div", { class: "stack" });
    var runOk = h("p", { class: "feedback", "aria-live": "polite" });
    var f = h("form", { class: "row" }, h("div", { style: "flex:1;min-width:14em" }, cmd), h("button", { class: "btn", type: "submit", text: "▶ Run" }));
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = cmd.value.trim(); if (!c) return;
      var r = it.run(c);
      log.insertBefore(resultEl(c, r), log.firstChild);
      if (it.isRight(r)) { st.ran = true; runOk.className = "feedback good"; runOk.textContent = "✓ That's the e-bike revenue for each branch."; makeBtn.disabled = false; }
    });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "C. Run the table tool: e-bike revenue for each branch" }),
      h("p", { class: "small muted", text: "Columns: date, branch, bike, hours, price, total. Commands as in stage 4." }), f, runOk, log));

    // D. check the draft
    var draftText = "Draft email to staff: “Hi all! E-bike revenue in June: " + it.draft.map(function (g) { return g[0] + " " + g[1].toLocaleString("en-US"); }).join(", ") + ".”";
    var flag = W.choices(it.draft.map(function (g) { return { value: g[0], label: g[0] + ": " + g[1].toLocaleString("en-US") }; }).concat([{ value: "none", label: "All correct" }]), function (v) { st.flagged = v; });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "D. The model drafted the email. Which number is wrong?" }),
      h("div", { class: "doc", text: draftText }), h("p", { class: "small muted", text: "Compare it with your tool result. (One click; no changing your mind.)" }), flag.el));

    // E. deliver
    var makeBtn = h("button", { class: "btn", type: "button", text: "⬇ Make the Excel file", disabled: true });
    var madeMsg = h("p", { class: "feedback", "aria-live": "polite" });
    makeBtn.classList.add("unlock-ok");
    makeBtn.addEventListener("click", function () {
      if (!st.ran) return;
      var rows = [["Branch", "E-bike revenue"]].concat(it.truth.map(function (g) { return [g[0], g[1]]; }));
      var sum = it.truth.reduce(function (a, g) { return a + g[1]; }, 0);
      rows.push(["Total", { f: "SUM(B2:B" + (it.truth.length + 1) + ")", v: sum }]);
      try { F.download(F.xlsx([{ name: "E-bikes June", rows: rows, widths: [16, 18] }]), "ebike_revenue_june.xlsx", F.XLSX_MIME); } catch (e) { /* download blocked: the file was still made */ }
      st.made = true; madeMsg.className = "feedback good"; madeMsg.textContent = "✓ ebike_revenue_june.xlsx made from the tool result (not from the draft).";
    });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "E. Deliver: make the file (after step C)" }), h("div", { class: "row" }, makeBtn), madeMsg));

    var sub = h("button", { class: "btn primary", type: "button", text: "Finish the job" });
    sub.addEventListener("click", function () { api.submit(JSON.parse(JSON.stringify(st))); });
    box.appendChild(h("div", { class: "row end" }, sub));
    return { collect: function () { return JSON.parse(JSON.stringify(st)); }, reveal: function () { flag.reveal(it.key.flagged); } };
  }

  function drawer(it) {
    return function (box, api) {
      return ({ desk: drawDesk, search: drawSearch, mcq: drawMcq, data: drawData, docs: drawDocs, boss: drawBoss })[it.kind](it, box, api);
    };
  }
  function wrap(id) {
    var mk = I.STAGES.filter(function (s) { return s.id === id; })[0].make;
    return function (rng) { return mk(D, rng).map(function (it) { it.render = drawer(it); return it; }); };
  }

  A.start({
    game: "agent",
    kicker: "Game 4 · challenge after Be the Agent",
    title: "Agent Arena",
    intro: [
      "You're the app around the model now, for Greenleaf Bikes, a made-up bike-rental shop with three branches. Pack the desk, search the handbook, pick tools, query the data, spot planted orders, and run a whole job.",
      "The token counter, search ranking, table tool and file maker really run in your browser and check your answers."
    ],
    stages: [
      { id: "desk", name: "Desk packer", make: wrap("desk"),
        goal: "The context window is a desk with limited space. Give the model everything it needs, and nothing else.",
        rules: ["The model can only use what's on the desk. The system prompt is always there.", "Pick cards so that every question can be answered. You can't go over the desk size.", "Missing a needed card loses its share; each extra card costs 25% of the item.", "Tokens are estimated as words × 4/3."],
        lesson: "Choosing what goes into the context is a big part of making AI useful: the right facts, the newest version, and not too much. More text is not always better." },
      { id: "search", name: "Search sniper", make: wrap("search"),
        goal: "Chatbots often read your files by searching them and putting only the top pieces on the desk. Make the search find the right piece.",
        rules: ["Type up to 3 search words.", "The right piece must be #1 on its own (no tie).", "3 tries: 100% on the first, 70% on the second, 40% on the third.", "The search counts matching words. It doesn't understand meaning."],
        lesson: "If the search brings back the wrong piece, the model answers from the wrong piece, and sounds just as sure. Real tools often use smarter search than word counting, but the risk is the same: check the source." },
      { id: "router", name: "Tool router", make: wrap("router"),
        goal: "Speed round. For each request, pick what the agent should do.",
        rules: ["The model itself can write and explain.", "Exact maths → calculator. Our documents → search. Our data → table tool. A real file → file maker.", "Anything permanent, public or sent to other people → stop and ask the human.", "15 seconds each."],
        lesson: "The model only writes text. Tools do the exact work, and the app runs them. The riskier the action, the more a human should be in the loop." },
      { id: "data", name: "Data detective", make: wrap("data"),
        goal: "Answer questions about the rentals data by writing table-tool commands, as an agent writes code.",
        rules: ["You can't see the rows: run commands and read the results.", "New: MAX, MIN and one WHERE filter (e.g. WHERE branch = River, WHERE hours > 3).", "Then type the answer: a number, or just one name.", "Up to 2 tool calls are free; each extra call or error costs 10% (never below half marks for a right answer)."],
        example: "TOTAL total BY branch\nCOUNT ROWS WHERE bike = kids\nMAX hours WHERE branch = Park",
        lesson: "This is how agents answer questions about your data: they write small programs, run them and read the results, and their mistakes show up as errors or odd numbers you can check." },
      { id: "inject", name: "Injection hunter", make: wrap("inject"),
        goal: "Some documents hide orders for the AI (prompt injection). Flag them, and don't flag the innocent ones.",
        rules: ["Planted order: text inside the content that tells the AI (or “any automated system”) to do something the user never asked for.", "Instructions written for people, normal requests and company rules are just content.", "Each document you judge right is worth a quarter of the item."],
        lesson: "An agent reads everything as text, so text in a file can try to steer it. Good apps treat document text as data, not orders, and keep risky actions behind your approval." },
      { id: "boss", name: "Boss: run the agent", make: wrap("boss"),
        goal: "A whole job, from plan to file. You're the agent and the human in charge.",
        rules: ["A: put 5 good steps in order.", "B: set each permission: Allow, Ask me or Block.", "C: run the table command that gives e-bike revenue by branch.", "D: find the wrong number in the model's draft email.", "E: make the real Excel file. Each part is a fifth of the marks. 5 minutes."],
        lesson: "Plan, act, check, deliver, with a human deciding anything risky. That's an agent working well." }
    ],
    finalCard: function () {
      return h("section", { class: "card soft stack" },
        h("div", { class: "kicker", text: "You've played all four" }),
        h("h2", { text: "Take it with you" }),
        h("p", { text: "Put the right things on the desk, ask for the source, let tools do the exact work, treat documents as data, and stay the boss of anything risky." }),
        h("div", { class: "row end" }, h("a", { class: "btn", href: "../index.html", text: "All games" })));
    }
  });
})();
