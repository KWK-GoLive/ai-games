/* Level 4 — The agent loop: plan -> act -> check -> fix, ending with real .xlsx and .docx files. */
(function () {
  "use strict";
  var BTA = window.BTA = window.BTA || {};
  BTA.levels = BTA.levels || [];

  BTA.levels.push({
    id: "L4", num: 4,
    name: "The agent loop",
    desc: "Watch an agent turn a data file into a real Excel file and a Word memo.",
    goal: "Give an AI agent a whole job, not just a question. It works in a loop: plan, do one step with a tool, look at the result, fix mistakes, repeat. At the end you can view the real files it made on screen, or download them.",
    intro: [
      { title: "An agent is a model + a harness + tools, working in a loop.", text: "Instead of answering once, it takes a step, reads the tool's result from its desk, and decides the next step, until the job is done." },
      { title: "The loop:", text: "", ex: "PLAN → ACT (use a tool) → CHECK the result → FIX if needed → … → DONE" },
      { title: "The job:", text: "“Using sales.csv, make an Excel summary of sales by item, and a short Word memo for the owner.” You'll switch between choosing the agent's moves (model) and running its tools (harness)." }
    ],
    recap: {
      title: "An agent = a loop of small, checked steps",
      text: [
        "The agent didn't do the job in one go. It planned, used a tool, read the result, hit an error, fixed it, and checked its numbers before writing the files. Each step was just the model writing text (a plan, a tool request, a draft) and the harness running tools and pasting results back.",
        "Notice the two mistakes. The error message was easy: the tool refused, so the agent saw it and fixed it. The wrong total in the memo was the dangerous one: nothing failed, it just looked right. It was only caught because someone compared the memo with the tool's result.",
        "The Excel and Word files are real because a file-making tool wrote them; the model only described what should go in them. Real agents use the same idea, usually by writing and running code. Always open the files and check a few numbers yourself."
      ],
      words: [["Agent", "A model that works in a loop, choosing tools and steps until a job is done."], ["Sandbox", "A closed-off area where an agent's code can run without touching the rest of your computer."]]
    },
    run: function (container, done) {
      var ui = BTA.ui, h = ui.h, w = BTA.w, E = BTA.Engine, F = BTA.Files, D = window.BTA_DATA;
      var points = 0, goodMoves = 0;
      var phases = ["Plan", "Act", "Check", "Fix", "Done"];
      var bar = h("div", { class: "loopbar", "aria-label": "agent loop" }, phases.map(function (p) { return h("span", { text: p }); }));
      function phase(name) {
        Array.prototype.forEach.call(bar.children, function (s) { s.classList.toggle("on", s.textContent === name); });
      }
      var byItem = E.runTable(D.salesCsv, "TOTAL total BY item");
      var grand = E.runTable(D.salesCsv, "TOTAL total").value;
      var nRows = E.runTable(D.salesCsv, "COUNT ROWS").value;
      var top = byItem.groups[0], bottom = byItem.groups[byItem.groups.length - 1];

      container.appendChild(h("div", { class: "card soft stack" },
        h("div", { class: "chat" }, w.bubble("you", "Using sales.csv, make an Excel summary of sales by item, and a short Word memo for the owner.")),
        bar));

      function section(role, title, text) {
        var s = h("section", { class: "card stack" }, h("div", { class: "row" }, w.roleTag(role)), h("div", { class: "kicker", text: title }));
        if (text) s.appendChild(h("p", { text: text }));
        container.appendChild(s);
        s.scrollIntoView({ behavior: "smooth", block: "start" });
        return s;
      }

      /* ---- 1. Plan ---- */
      phase("Plan");
      var s1 = section("model", "Step 1 · Plan", "You are the model. Before using any tool, you write a short plan. Which plan is best?");
      s1.appendChild(ui.mcq({
        q: "Your plan:",
        options: [
          "Write the memo straight away from what I know about cafés, then make the Excel file",
          "Look at the file → add up sales by item with the table tool → check the total → make the Excel file → write the memo from the results → check the memo",
          "Make the Excel file first, then look at the data if something goes wrong"
        ],
        answer: 1,
        explain: "Look first, calculate with a tool, check, then build. A plan written down also lets the human see what the agent intends before it acts."
      }, function (i, ok) { if (ok) { goodMoves++; points += 10; } step2(); }));

      /* ---- 2. Act: look at the file ---- */
      function step2() {
        phase("Act");
        var s = section("harness", "Step 2 · Look at the file", "The agent's first tool request. You are the harness: run it.");
        s.appendChild(w.toolCall("table", "sales.csv: SHOW 5 ROWS"));
        s.appendChild(h("div", { class: "row" }, w.onceBtn("Run the tool", function () {
          var r = E.runTable(D.salesCsv, "SHOW 5 ROWS");
          s.appendChild(w.toolResult(h("span", {}, r.text + ":", w.tableEl(r.table))));
          s.appendChild(h("p", { class: "small muted", text: "The harness pastes this onto the desk. Now the model can see the column names: date, item, qty, price, total." }));
          s.appendChild(h("div", { class: "row end" }, w.onceBtn("Continue", step3)));
        })));
      }

      /* ---- 3. Act: add up, hits an error ---- */
      function step3() {
        var s = section("harness", "Step 3 · Add up sales by item", "The model writes its next request. Run it.");
        s.appendChild(w.toolCall("table", "sales.csv: TOTAL sales BY item"));
        s.appendChild(h("div", { class: "row" }, w.onceBtn("Run the tool", function () {
          var r = E.runTable(D.salesCsv, "TOTAL sales BY item");
          s.appendChild(w.toolResult(r.error, false));
          step4();
        })));
      }

      /* ---- 4. Fix ---- */
      function step4() {
        phase("Fix");
        var s = section("model", "Step 4 · Fix the mistake", "You are the model again. The error message is now on your desk. What do you write next?");
        s.appendChild(ui.mcq({
          q: "Your next move:",
          options: ["Run exactly the same request again", "Ask again with the column that really exists: add up total for each item (TOTAL total BY item)", "Give up and estimate the numbers"],
          answer: 1,
          explain: "Read the error, fix the request. The column is called “total”, not “sales”. Agents recover from errors like this because the error text lands on their desk."
        }, function (i, ok) {
          if (ok) { goodMoves++; points += 10; }
          phase("Act");
          s.appendChild(w.toolCall("table", "sales.csv: TOTAL total BY item"));
          s.appendChild(h("div", { class: "row" }, w.onceBtn("Run the tool", function () {
            s.appendChild(w.toolResult(w.tableEl(byItem.table)));
            s.appendChild(h("div", { class: "row end" }, w.onceBtn("Continue", step5)));
          })));
        }));
      }

      /* ---- 5. Check the total ---- */
      function step5() {
        phase("Check");
        var s = section("model", "Step 5 · Check before building", "A careful agent checks its numbers a second way. It asks for the grand total directly and compares it with the item totals added together.");
        s.appendChild(w.toolCall("table", "sales.csv: TOTAL total"));
        s.appendChild(h("div", { class: "row" }, w.onceBtn("Run the tool (as the harness)", function () {
          s.appendChild(w.toolResult("Sum of the \u201ctotal\u201d column = " + w.fmt(grand)));
          var sumGroups = byItem.groups.reduce(function (a, g) { return a + g[1]; }, 0);
          s.appendChild(h("p", { class: "feedback " + (sumGroups === grand ? "good" : "bad"), text: (sumGroups === grand ? "✓ " : "✗ ") + "Item totals added together: " + w.fmt(sumGroups) + ". Grand total: " + w.fmt(grand) + ". " + (sumGroups === grand ? "They match." : "They don't match!") }));
          s.appendChild(h("div", { class: "row end" }, w.onceBtn("Continue", step6)));
        })));
      }

      /* View on screen (phones, iPads) or download the real file */
      function fileBox(name, made, mime, note) {
        var dl = function () { F.download(made.bytes, name, mime); };
        if (window.VIS) return window.VIS.fileActions({ name: name, spec: made.spec, download: dl, note: note });
        var b = h("button", { class: "btn", type: "button", text: "⬇ Download " + name });
        b.addEventListener("click", dl);
        return h("div", { class: "row" }, b, h("span", { class: "small muted", text: note }));
      }

      /* ---- 6. Make the Excel file ---- */
      function buildXlsx() {
        var rows = [["Item", "Sales (THB)", "Share of sales"]];
        byItem.groups.forEach(function (g) { rows.push([g[0], g[1], { pct: Math.round(g[1] / grand * 10000) / 10000 }]); });
        rows.push(["Total", { f: "SUM(B2:B" + (byItem.groups.length + 1) + ")", v: grand }, { pct: 1 }]);
        var csv = E.parseCsv(D.salesCsv);
        var data = [csv.cols].concat(csv.rows.map(function (r) { return csv.cols.map(function (c) { return r[c]; }); }));
        var sheets = [
          { name: "Summary", rows: rows, widths: [16, 14, 16] },
          { name: "Data", rows: data, widths: [12, 12, 6, 7, 8] }
        ];
        return { bytes: F.xlsx(sheets), spec: { type: "xlsx", sheets: sheets } };
      }
      function step6() {
        phase("Act");
        var s = section("harness", "Step 6 · Make the Excel file", "The model writes a request to the file-making tool, describing what goes in the file. Run it.");
        s.appendChild(w.toolCall("create_excel", "sales_summary.xlsx: sheet Summary = sales by item + share + total; sheet Data = all rows"));
        s.appendChild(h("div", { class: "row" }, w.onceBtn("Run the tool", function () {
          var made = buildXlsx(), bytes = made.bytes;
          s.appendChild(w.toolResult("Created sales_summary.xlsx (" + w.fmt(bytes.length) + " bytes, 2 sheets)."));
          s.appendChild(fileBox("sales_summary.xlsx", made, F.XLSX_MIME, "It's a real Excel file. View it here, or download it and look at both sheets."));
          points += 10;
          s.appendChild(h("div", { class: "row end" }, w.onceBtn("Continue", step7)));
        })));
      }

      /* ---- 7. Draft the memo; catch the wrong number ---- */
      function step7() {
        phase("Check");
        var wrongTotal = grand + 100;
        var s = section("human", "Step 7 · Check the memo draft", "The model wrote this draft by itself, word by word. Compare it with the tool results above. One number is wrong. Tap it.");
        var claims = [
          { text: "Total sales from 1 to 10 August were " + w.fmt(wrongTotal) + " THB.", ok: false },
          { text: top[0] + " was the best seller with " + w.fmt(top[1]) + " THB.", ok: true },
          { text: "The file has " + nRows + " sales records.", ok: true },
          { text: bottom[0] + " sold the least, only " + w.fmt(bottom[1]) + " THB.", ok: true }
        ];
        var fb = h("p", { class: "feedback", "aria-live": "polite" });
        var picked = false;
        var btns = claims.map(function (c) {
          var b = h("button", { class: "pickline", type: "button", text: c.text });
          b.addEventListener("click", function () {
            if (picked) return;
            picked = true;
            btns.forEach(function (x, i) { x.disabled = true; if (!claims[i].ok) x.classList.add("correct"); });
            if (!c.ok) { points += 20; goodMoves++; fb.className = "feedback good"; fb.textContent = "✓ Caught it. The tool said " + w.fmt(grand) + ", but the draft says " + w.fmt(wrongTotal) + ". The model wrote a number that looked right instead of copying the tool result exactly."; }
            else { b.classList.add("wrong"); fb.className = "feedback bad"; fb.textContent = "✗ That one matches the tool results. The wrong one is the total: the tool said " + w.fmt(grand) + ", the draft says " + w.fmt(wrongTotal) + "."; }
            s.appendChild(h("div", { class: "row end" }, w.onceBtn("Tell the agent to fix it", step8)));
          });
          return b;
        });
        btns.forEach(function (b) { s.appendChild(b); });
        s.appendChild(fb);
      }

      /* ---- 8. Make the Word file ---- */
      function buildDocx() {
        var table = [["Item", "Sales (THB)"]].concat(byItem.groups.map(function (g) { return [g[0], w.fmt(g[1])]; }));
        table.push(["Total", w.fmt(grand)]);
        var blocks = [
          { h1: "Moonbean Café: sales summary, 1–10 August 2026" },
          { p: "Total sales from 1 to 10 August were " + w.fmt(grand) + " THB, from " + nRows + " sales records." },
          { h2: "Highlights" },
          { bullet: top[0] + " was the best seller with " + w.fmt(top[1]) + " THB (" + (top[1] / grand * 100).toFixed(0) + "% of sales)." },
          { bullet: bottom[0] + " sold the least, only " + w.fmt(bottom[1]) + " THB." },
          { h2: "Sales by item" },
          { table: table },
          { p: "Prepared by an AI agent (a demo in the game “Be the Agent”). All numbers were calculated by a tool from sales.csv and checked by a person. Moonbean Café is a made-up business." }
        ];
        return { bytes: F.docx(blocks), spec: { type: "docx", blocks: blocks } };
      }
      function step8() {
        phase("Act");
        var s = section("harness", "Step 8 · Make the Word memo", "The model corrects the total (copying it from the tool result this time) and asks the file tool for the memo. Run it.");
        s.appendChild(w.toolCall("create_word", "memo.docx: title, total " + w.fmt(grand) + " THB, 2 highlights, table of sales by item"));
        s.appendChild(h("div", { class: "row" }, w.onceBtn("Run the tool", function () {
          var made = buildDocx(), bytes = made.bytes;
          s.appendChild(w.toolResult("Created memo.docx (" + w.fmt(bytes.length) + " bytes)."));
          s.appendChild(fileBox("memo.docx", made, F.DOCX_MIME, "A real Word file. Check the total in it yourself."));
          points += 10;
          phase("Done");
          s.appendChild(h("div", { class: "chat" }, w.bubble("ai", "Done. I made sales_summary.xlsx (sales by item, plus all the data) and memo.docx for the owner. Total sales: " + w.fmt(grand) + " THB; " + top[0] + " sold best. Please check a few numbers before you share them.")));
          s.appendChild(h("div", { class: "row end" }, w.onceBtn("Finish level", function () {
            done({ stars: goodMoves >= 3 ? 3 : goodMoves === 2 ? 2 : 1, points: points, summary: "Good moves: " + goodMoves + " of 3 (plan, fix, catching the wrong total). You made two real files." });
          })));
        })));
      }
    }
  });
})();
