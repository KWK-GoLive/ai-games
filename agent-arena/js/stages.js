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
  function resultEl(cmd, r, sentence) {
    return h("div", { class: "card soft stack", style: "margin:0" },
      sentence ? h("div", { class: "small" }, h("b", { text: "“" + sentence + "”" })) : null,
      h("div", { class: "mono small muted", text: "▶ table_tool(“" + cmd + "”)" }),
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

  /* ---------- Stage 2: search (tap word cards, no typing) ---------- */
  function drawSearch(it, box, api) {
    var tries = [], picked = [];
    var qbar = h("div", { class: "search-bar", "aria-live": "polite" });
    var go = h("button", { class: "btn primary", type: "button", text: "🔍 Search", disabled: true });
    var clr = h("button", { class: "btn", type: "button", text: "Clear" });
    var left = h("span", { class: "muted small" });
    var msg = h("p", { class: "feedback", "aria-live": "polite" });
    var results = h("div", { class: "stack" });
    var chips = h("div", { class: "qb-chips", role: "group", "aria-label": "word cards" });
    var btns = it.cards.map(function (w) {
      var b = h("button", { type: "button", class: "qb-chip", "aria-pressed": "false", text: w });
      b.addEventListener("click", function () {
        var i = picked.indexOf(w);
        if (i >= 0) picked.splice(i, 1);
        else { if (picked.length >= it.maxWords) { msg.className = "feedback bad"; msg.textContent = "At most " + it.maxWords + " words. Take one off first."; return; } picked.push(w); }
        msg.textContent = ""; paintBar();
      });
      chips.appendChild(b);
      return b;
    });
    function paintBar() {
      btns.forEach(function (b, i) { b.setAttribute("aria-pressed", String(picked.indexOf(it.cards[i]) >= 0)); });
      qbar.textContent = picked.length ? "🔍 " + picked.join(" ") : "🔍 (tap up to " + it.maxWords + " word cards)";
      go.disabled = !picked.length || tries.length >= it.tries;
    }
    function paintLeft() { left.textContent = (it.tries - tries.length) + " tr" + (it.tries - tries.length === 1 ? "y" : "ies") + " left"; }
    clr.addEventListener("click", function () { picked = []; paintBar(); });
    go.addEventListener("click", function () {
      if (!picked.length || tries.length >= it.tries) return;
      var q = picked.join(" ");
      tries.push(q); paintLeft();
      var r = it.rank(q);
      A.clear(results);
      results.appendChild(h("div", { class: "mono small", text: "▶ search_handbook(“" + q + "”)" }));
      r.res.slice(0, 3).forEach(function (x, i) {
        results.appendChild(h("div", { class: "doc" + (i === 0 && r.win ? " good" : "") },
          h("div", { class: "meta", text: "#" + (i + 1) + " · " + x.score + " matching word" + (x.score === 1 ? "" : "s") + (x.matched.length ? " (" + x.matched.join(", ") + ")" : "") }),
          h("b", { text: x.chunk.title + ": " }), x.chunk.text));
      });
      if (r.win) { msg.className = "feedback good"; msg.textContent = "✓ The right piece is on top."; go.disabled = true; api.submit(tries.slice()); }
      else if (tries.length >= it.tries) { msg.className = "feedback bad"; msg.textContent = "Out of tries."; go.disabled = true; api.submit(tries.slice()); }
      else { msg.className = "feedback bad"; msg.textContent = r.res[0].score === 0 ? "No piece matches those words." : r.res[0].score === (r.res[1] || {}).score ? "A tie at the top: make it clearer." : "The top piece isn't the right one. Try other words."; picked = []; paintBar(); }
    });
    box.appendChild(h("p", { class: "small muted", text: "The search tool ranks the " + it.handbook.length + " handbook pieces by how many of your words they contain (small words like “the” are ignored). Tap up to " + it.maxWords + " word cards. Get the piece that answers the question to #1, on its own." }));
    box.appendChild(chips);
    box.appendChild(h("div", { class: "row" }, qbar, go, clr, left));
    box.appendChild(msg); box.appendChild(results);
    paintBar(); paintLeft();
    return { collect: function () { return tries.slice(); } };
  }

  /* ---------- Stage 3: tool router ---------- */
  function drawMcq(it, box, api) {
    var c = W.choices(it.options, function (v) { api.submit(v); });
    box.appendChild(h("p", { class: "small muted", text: "Which should the agent use?" }));
    box.appendChild(c.el);
    return { collect: c.collect, reveal: function () { c.reveal(it.key); } };
  }

  /* ---------- Stage 4: data detective (tap-to-build, then tap the answer in a result) ---------- */
  function tapResult(cmd, sentence, r, onTap) {
    var body;
    if (!r.ok) body = h("div", { class: "feedback bad", text: "Error: " + r.error });
    else if (r.groups) body = h("div", { class: "stack" }, h("div", { class: "small", text: r.text }),
      h("div", { class: "tap-grid" }, r.groups.map(function (g) { return [tapBtn(String(g[0]), String(g[0])), tapBtn(Number(g[1]).toLocaleString("en-US"), String(g[1]))]; })));
    else if (r.table) body = h("div", { class: "stack" }, h("div", { class: "small", text: r.text }), tableEl(r.table));
    else if (typeof r.value === "number" && !/^No rows match/.test(r.text || "")) body = h("div", { class: "stack" }, h("div", { class: "small", text: r.text }), h("div", {}, tapBtn(Number(r.value).toLocaleString("en-US"), String(r.value))));
    else body = h("div", { text: r.text });
    function tapBtn(label, value) {
      var b = h("button", { type: "button", class: "tap-val", "aria-pressed": "false", "data-value": value, "aria-label": "Answer: " + label, text: label });
      b.addEventListener("click", function () { onTap(value, b); });
      return b;
    }
    return h("div", { class: "card soft stack", style: "margin:0" },
      h("div", { class: "small" }, h("b", { text: "“" + sentence + "”" })),
      h("div", { class: "mono small muted", text: "▶ table_tool(“" + cmd + "”)" }), body);
  }
  function drawData(it, box, api) {
    var calls = 0, errors = 0, answer = null;
    var t = I.Tools.Engine.parseCsv(it.csv);
    box.appendChild(h("p", { class: "small muted" }, "rentals.csv has " + t.rows.length + " rows with the columns ", h("b", { class: "mono", text: t.cols.join(", ") }), ". You can't see the rows: ask the table tool."));
    var counter = h("span", { class: "muted small" });
    function paint() { counter.textContent = calls + " tool call" + (calls === 1 ? "" : "s") + " (2 free)" + (errors ? ", " + errors + " error" + (errors === 1 ? "" : "s") : ""); }
    var log = h("div", { class: "stack" });
    var chosen = h("b", { text: "—" });
    var sub = h("button", { class: "btn primary", type: "button", text: "Submit answer", disabled: true });
    function onTap(v, b) {
      answer = v; chosen.textContent = Number(v) === Number(v) && v !== "" ? Number(v).toLocaleString("en-US") : v;
      Array.prototype.forEach.call(box.querySelectorAll(".tap-val"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      sub.disabled = false;
    }
    var qb = window.QB.create({ csv: it.csv, parse: I.Tools.Engine.parseCsv, run: it.run, file: "rentals.csv",
      onRun: function (c, r, sentence) { calls++; if (!r.ok) errors++; paint(); log.insertBefore(tapResult(c, sentence, r, onTap), log.firstChild); } });
    sub.addEventListener("click", function () { if (answer !== null) api.submit({ answer: answer, calls: calls, errors: errors }); });
    box.appendChild(qb.el);
    box.appendChild(h("div", { class: "row" }, counter));
    box.appendChild(log);
    box.appendChild(h("div", { class: "card soft stack", style: "margin:0" },
      h("div", {}, "Tap the number or name in a result that answers the question. ", h("span", { class: "muted small", text: "Your answer: " }), chosen),
      h("div", { class: "row end" }, sub)));
    paint();
    return { collect: function () { return { answer: answer === null ? "" : answer, calls: calls, errors: errors }; } };
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
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "A. Plan: tap 5 steps in order (leave out the bad ones)" }), planBtns, planOut, h("div", { class: "row" }, undo)));

    // B. permissions
    var perms = h("div", { class: "stack" });
    it.permissions.forEach(function (p, i) {
      var t = W.toggle(["Allow", "Ask me", "Block"], function (v) { st.perms[i] = v; });
      perms.appendChild(h("div", { class: "row" }, h("span", { style: "flex:1;min-width:12em", text: p.text }), t.el));
    });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "B. Permissions: what may the agent do without asking?" }), perms));

    // C. run the tool: three plain questions, then run
    var log = h("div", { class: "stack" });
    var runOk = h("p", { class: "feedback", "aria-live": "polite" });
    var guide = window.QB.guided({
      file: "rentals.csv",
      steps: [
        { q: "What do we add up?", options: [
          { value: "total", label: "💰 total (money taken)", right: true, why: "Revenue is the money taken, which is the total column." },
          { value: "hours", label: "⏱️ hours", why: "Hours are time, not money." },
          { value: "price", label: "🏷️ price", why: "Price is the cost per hour. The money actually taken is in total." }] },
        { q: "One number for each …?", options: [
          { value: "branch", label: "🏪 branch", right: true, why: "The manager wants a number for each branch." },
          { value: "bike", label: "🚲 bike", why: "That gives one number per kind of bike, not per branch." },
          { value: "date", label: "📅 date", why: "That gives one number per day, not per branch." },
          { value: "", label: "Just one number", why: "One grand total can't show each branch." }] },
        { q: "Only which rows?", options: [
          { value: "ebike", label: "⚡ only e-bikes", right: true, why: "The job is about e-bike revenue only." },
          { value: "city", label: "🚲 only city bikes", why: "The job is about e-bikes." },
          { value: "kids", label: "🧒 only kids' bikes", why: "The job is about e-bikes." },
          { value: "", label: "All rows", why: "That mixes in city and kids' bikes." }] }
      ],
      build: function (v) { return "TOTAL " + v[0] + (v[1] ? " BY " + v[1] : "") + (v[2] ? " WHERE bike = " + v[2] : ""); },
      run: it.run,
      onRun: function (c, r, sentence) {
        log.insertBefore(resultEl(c, r, sentence), log.firstChild);
        if (it.isRight(r)) { st.ran = true; runOk.className = "feedback good"; runOk.textContent = "✓ That's the e-bike revenue for each branch."; makeBtn.disabled = false; }
        else if (!st.ran) { runOk.className = "feedback bad"; runOk.textContent = "That's not quite what the manager asked for. Check the three answers."; }
      }
    });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "C. Ask the table tool: e-bike revenue for each branch" }),
      h("p", { class: "small muted", text: "Columns: date, branch, bike, hours, price, total. Answer three questions, then run it." }), guide.el, runOk, log));

    // D. check the draft
    var draftText = "Draft email to staff: “Hi all! E-bike revenue in June: " + it.draft.map(function (g) { return g[0] + " " + g[1].toLocaleString("en-US"); }).join(", ") + ".”";
    var flag = W.choices(it.draft.map(function (g) { return { value: g[0], label: g[0] + ": " + g[1].toLocaleString("en-US") }; }).concat([{ value: "none", label: "All correct" }]), function (v) { st.flagged = v; });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "D. The model drafted the email. Which number is wrong?" }),
      h("div", { class: "doc", text: draftText }), h("p", { class: "small muted", text: "Compare it with your tool result. (One tap; no changing your mind.)" }), flag.el));

    // E. deliver: make the file, then view it here or download it
    var makeBtn = h("button", { class: "btn", type: "button", text: "🛠️ Make the Excel file", disabled: true });
    var madeMsg = h("p", { class: "feedback", "aria-live": "polite" });
    var fileHolder = h("div");
    makeBtn.classList.add("unlock-ok");
    makeBtn.addEventListener("click", function () {
      if (!st.ran || st.made) return;
      var rows = [["Branch", "E-bike revenue"]].concat(it.truth.map(function (g) { return [g[0], g[1]]; }));
      var sum = it.truth.reduce(function (a, g) { return a + g[1]; }, 0);
      rows.push(["Total", { f: "SUM(B2:B" + (it.truth.length + 1) + ")", v: sum }]);
      var sheets = [{ name: "E-bikes June", rows: rows, widths: [16, 18] }];
      var bytes = F.xlsx(sheets);
      var dl = function () { try { F.download(bytes, "ebike_revenue_june.xlsx", F.XLSX_MIME); } catch (e) { /* download blocked: the file was still made */ } };
      st.made = true; makeBtn.disabled = true;
      madeMsg.className = "feedback good"; madeMsg.textContent = "✓ ebike_revenue_june.xlsx made from the tool result (not from the draft).";
      fileHolder.appendChild(window.VIS ? window.VIS.fileActions({ name: "ebike_revenue_june.xlsx", spec: { type: "xlsx", sheets: sheets }, download: dl, note: "View it here or download it." })
        : h("button", { class: "btn", type: "button", text: "⬇ Download", onclick: dl }));
    });
    box.appendChild(h("section", { class: "stack" }, h("h3", { text: "E. Deliver: make the file (after step C)" }), h("div", { class: "row" }, makeBtn), madeMsg, fileHolder));

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
    kicker: "Game 6 · challenge after Be the Agent",
    title: "Agent Arena",
    intro: [
      "You're the app around the model now, for Greenleaf Bikes, a made-up bike-rental shop with three branches. Pack the desk, search the handbook, pick tools, query the data, spot planted orders, and run a whole job.",
      "The token counter, search ranking, table tool and file maker really run in your browser and check your answers. No typing needed: everything is tap-to-choose."
    ],
    stages: [
      { id: "desk", icon: "🗂️", name: "Desk packer", make: wrap("desk"),
        goal: "The context window is a desk with limited space. Give the model everything it needs, and nothing else.",
        rules: ["The model can only use what's on the desk. The system prompt is always there.", "Pick cards so that every question can be answered. You can't go over the desk size.", "Missing a needed card loses its share; each extra card costs 25% of the item.", "Tokens are estimated as words × 4/3."],
        lesson: "Choosing what goes into the context is a big part of making AI useful: the right facts, the newest version, and not too much. More text is not always better." },
      { id: "search", icon: "🔍", name: "Search sniper", make: wrap("search"),
        goal: "Chatbots often read your files by searching them and putting only the top pieces on the desk. Make the search find the right piece.",
        rules: ["Tap up to 3 word cards, then Search.", "The right piece must be #1 on its own (no tie).", "3 tries: 100% on the first, 70% on the second, 40% on the third.", "The search counts matching words. It doesn't understand meaning."],
        lesson: "If the search brings back the wrong piece, the model answers from the wrong piece, and sounds just as sure. Real tools often use smarter search than word counting, but the risk is the same: check the source." },
      { id: "router", icon: "🧭", name: "Tool router", make: wrap("router"),
        goal: "Speed round. For each request, pick what the agent should do.",
        rules: ["The model itself can write and explain.", "Exact maths → calculator. Our documents → search. Our data → table tool. A real file → file maker.", "Anything permanent, public or sent to other people → stop and ask the human.", "15 seconds each."],
        lesson: "The model only writes text. Tools do the exact work, and the app runs them. The riskier the action, the more a human should be in the loop." },
      { id: "data", icon: "📊", name: "Data detective", make: wrap("data"),
        goal: "Answer questions about the rentals data by asking the table tool, as an agent does by writing small programs.",
        rules: ["You can't see the rows: build a question by tapping, run it, and read the result.", "You can add up, count, or find the biggest or smallest, for each branch or bike, and only for some rows (e.g. only where branch is River, only where hours is more than 3).", "Then tap the number or name in your result that answers the question.", "Up to 2 tool calls are free; each extra call costs 10% (never below half marks for a right answer)."],
        example: "Add up total for each branch\nCount the rows, only where bike is kids\nFind the biggest hours, only where branch is Park",
        lesson: "This is how agents answer questions about your data: they write small programs, run them and read the results, and their mistakes show up as errors or odd numbers you can check." },
      { id: "inject", icon: "🕵️", name: "Injection hunter", make: wrap("inject"),
        goal: "Some documents hide orders for the AI (prompt injection). Flag them, and don't flag the innocent ones.",
        rules: ["Planted order: text inside the content that tells the AI (or “any automated system”) to do something the user never asked for.", "Instructions written for people, normal requests and company rules are just content.", "Each document you judge right is worth a quarter of the item."],
        lesson: "An agent reads everything as text, so text in a file can try to steer it. Good apps treat document text as data, not orders, and keep risky actions behind your approval." },
      { id: "boss", icon: "👑", name: "Boss: run the agent", make: wrap("boss"),
        goal: "A whole job, from plan to file. You're the agent and the human in charge.",
        rules: ["A: put 5 good steps in order.", "B: set each permission: Allow, Ask me or Block.", "C: answer three questions to ask the table tool for e-bike revenue by branch, then run it.", "D: find the wrong number in the model's draft email.", "E: make the real Excel file, then view or download it. Each part is a fifth of the marks. 5 minutes."],
        lesson: "Plan, act, check, deliver, with a human deciding anything risky. That's an agent working well." }
    ],
    finalCard: function () {
      return h("section", { class: "card soft stack" },
        h("div", { class: "kicker", text: "You've played all six" }),
        h("h2", { text: "Take it with you" }),
        h("p", { text: "Put the right things on the desk, ask for the source, let tools do the exact work, treat documents as data, and stay the boss of anything risky." }),
        h("div", { class: "row end" }, h("a", { class: "btn", href: "../index.html", text: "All games" })));
    }
  });
})();
