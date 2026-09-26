/* Level 3 — Tools: the model writes a request, the app (harness) runs it and pastes the result back. */
(function () {
  "use strict";
  var BTA = window.BTA = window.BTA || {};
  BTA.levels = BTA.levels || [];

  BTA.levels.push({
    id: "L3", num: 3,
    name: "Tools",
    desc: "The model can't calculate or browse. So who does?",
    goal: "A language model only writes text. It can't press buttons or check today's news, and its sums aren't guaranteed to be exact. Here you'll see how it gets around that: it writes a request, and the app does the work.",
    intro: [
      { title: "The model is a writer, not a doer.", text: "It writes numbers as likely-looking text, so a long sum can come out slightly wrong, and it knows nothing that happened after its training text was collected (its knowledge cutoff)." },
      { title: "So the app gives it tools.", text: "A tool is a program the app can run: a calculator, a web search, a spreadsheet reader. The app tells the model which tools exist. When it needs one, the model writes a special request instead of an answer.", ex: "CALL calculator(\"1284 * 37\")" },
      { title: "The app (called the harness) does the work.", text: "It spots the request, runs the tool, and pastes the result onto the desk. Then the model carries on writing, now with the right number in front of it. You'll play the model first, then the harness." }
    ],
    recap: {
      title: "The model asks; the harness does",
      text: [
        "The model never ran the calculator, searched the web or opened the spreadsheet. It wrote a request as text. The harness (the app around the model) ran the real program and pasted the result onto the desk, and the model then wrote its answer from that result.",
        "That's why the same model can do very different things in different apps: it depends on which tools the app gives it. With no search tool, it can't know today's weather, whatever it says. With a search tool, it can, but only as well as the pages the search found.",
        "Real agents often write code in a programming language such as Python and run it in a sandbox (a closed-off area). Our table tool uses a tiny made-up language so it can run safely in your browser, but the idea is the same."
      ],
      words: [["Tool", "A program the app can run for the model: calculator, search, code runner, file maker."], ["Harness", "The app around the model. It sends the desk to the model, runs tools, and pastes results back."], ["Knowledge cutoff", "The date the model's training text ends. It knows nothing later unless a tool looks it up."]]
    },
    run: function (container, done) {
      var ui = BTA.ui, h = ui.h, w = BTA.w, E = BTA.Engine, D = window.BTA_DATA;
      var points = 0, pickRight = 0;

      /* ---- Part A: you are the model: which tool? ---- */
      var tasks = [
        { q: "What is 1,284 × 37?", best: 1, why: "Exact arithmetic: ask the calculator rather than writing digits that merely look likely." },
        { q: "Will it rain in Bangkok this afternoon?", best: 2, why: "Today's weather happened after the training text was collected. Only a search can find it." },
        { q: "Write a friendly thank-you note to the café staff.", best: 0, why: "Writing is what the model does best. No tool needed." },
        { q: "What were our total sales in sales.csv?", best: 3, why: "The numbers are in the file. Let the table tool add them up exactly." }
      ];
      var toolNames = ["Answer myself (no tool)", "Calculator", "Web search", "Table tool on sales.csv"];
      var partA = h("section", { class: "card stack" },
        h("div", { class: "row" }, w.roleTag("model")),
        h("div", { class: "kicker", text: "Part A · Which tool would you ask for?" }),
        h("p", { text: "You are the model. The app has told you about three tools. For each message, decide: answer straight away, or ask for a tool?" }));
      var ti = 0;
      var aBox = h("div", { class: "stack" });
      partA.appendChild(aBox);
      container.appendChild(partA);
      function nextTask() {
        var t = tasks[ti];
        var box = h("div", { class: "stack" }, h("div", { class: "chat" }, w.bubble("you", t.q)));
        box.appendChild(ui.mcq({ q: "As the model, you…", options: toolNames, answer: t.best, explain: t.why }, function (i, ok) {
          if (ok) { pickRight++; points += 5; }
          ti++;
          if (ti < tasks.length) nextTask(); else partB();
        }));
        aBox.appendChild(box);
      }
      nextTask();

      /* ---- Part B: you are the harness ---- */
      function partB() {
        var sec = h("section", { class: "card stack" },
          h("div", { class: "row" }, w.roleTag("harness")),
          h("div", { class: "kicker", text: "Part B · Run the tools" }),
          h("p", { text: "Now switch sides: you are the app. The model has written a tool request. Run the tool, then paste the result onto the desk so the model can finish its answer." }));
        container.appendChild(sec);
        sec.scrollIntoView({ behavior: "smooth", block: "start" });

        // 1. calculator
        var calcBox = h("div", { class: "stack" },
          h("h3", { text: "1. The calculator" }),
          h("div", { class: "chat" }, w.bubble("you", tasks[0].q)),
          w.toolCall("calculator", "1284 * 37"));
        sec.appendChild(calcBox);
        var result = null;
        calcBox.appendChild(h("div", { class: "row" }, w.onceBtn("Run the calculator", function () {
          result = E.calc("1284 * 37");
          calcBox.appendChild(w.toolResult(w.fmt(result)));
          calcBox.appendChild(h("div", { class: "row" }, w.onceBtn("Paste the result onto the desk", function () {
            calcBox.appendChild(h("div", { class: "chat" }, w.bubble("ai", "1,284 × 37 = " + w.fmt(result) + ".")));
            calcBox.appendChild(h("p", { class: "small muted", text: "The model copied the number from the tool result on its desk. It never did the multiplication itself." }));
            points += 10;
            tableStep();
          })));
        })));

        // 2. table tool + try it yourself
        function tableStep() {
          var box = h("div", { class: "stack" },
            h("h3", { text: "2. The table tool" }),
            h("div", { class: "chat" }, w.bubble("you", tasks[3].q)),
            w.toolCall("table", "sales.csv: TOTAL total"));
          sec.appendChild(box);
          box.appendChild(h("div", { class: "row" }, w.onceBtn("Run the table tool", function () {
            var r = E.runTable(D.salesCsv, "TOTAL total");
            box.appendChild(w.toolResult("Sum of the \u201ctotal\u201d column = " + w.fmt(r.value) + " (added up from all 30 rows)"));
            box.appendChild(h("div", { class: "row" }, w.onceBtn("Paste the result onto the desk", function () {
              box.appendChild(h("div", { class: "chat" }, w.bubble("ai", "Total sales in sales.csv were " + w.fmt(r.value) + " THB.")));
              points += 10;
              var out = h("div", { class: "stack" });
              function show(cmd, res) {
                ui.clear(out);
                out.appendChild(w.toolCall("table", "sales.csv: " + cmd));
                if (!res.ok) out.appendChild(w.toolResult(res.error, false));
                else if (res.table) out.appendChild(w.toolResult(w.tableEl(res.table)));
                else out.appendChild(w.toolResult(res.text));
              }
              var tryBox;
              if (window.QB && window.QB.create) {
                var qb = window.QB.create({ csv: D.salesCsv, parse: E.parseCsv, run: function (c) { return E.runTable(D.salesCsv, c); },
                  actions: ["show", "count", "total"], where: false, file: "sales.csv", onRun: show });
                tryBox = h("div", { class: "card soft stack" },
                  h("b", { text: "Try the table tool yourself" }),
                  h("p", { class: "small muted", text: "Tap to build a question, e.g. “Add up total for each item” or “Add up qty for each date”. Underneath you'll see the command the model would write for the tool." }),
                  qb.el,
                  h("div", { class: "row" }, (function () {
                    var bad = h("button", { class: "btn", type: "button", text: "❌ Try a column that doesn't exist: “sales”" });
                    bad.addEventListener("click", function () { show("TOTAL sales", E.runTable(D.salesCsv, "TOTAL sales")); });
                    return bad;
                  })(), h("span", { class: "small muted", text: "to see what the tool does with a wrong request" })),
                  out);
              } else {
                var inp = h("input", { class: "text-input", type: "text", value: "TOTAL total BY item", "aria-label": "table tool command" });
                var runBtn = h("button", { class: "btn", type: "button", text: "Run" });
                runBtn.addEventListener("click", function () { show(inp.value, E.runTable(D.salesCsv, inp.value)); });
                tryBox = h("div", { class: "card soft stack" }, h("b", { text: "Try the table tool yourself" }),
                  h("div", { class: "row" }, h("div", { style: "flex:1;min-width:180px" }, inp), runBtn), out);
              }
              box.appendChild(tryBox);
              searchStep();
            })));
          })));
        }

        // 3. search: without vs with
        function searchStep() {
          var box = h("div", { class: "stack" },
            h("h3", { text: "3. Web search: off, then on" }),
            h("div", { class: "chat" }, w.bubble("you", tasks[1].q)));
          sec.appendChild(box);
          box.appendChild(h("p", { class: "small", text: "First, an app with NO search tool:" }));
          box.appendChild(h("div", { class: "chat" }, w.bubble("ai", "I can't check live weather. My knowledge comes from training text that ends at a cutoff date, so I don't know today's forecast. Please check a weather service.")));
          box.appendChild(h("p", { class: "small muted", text: "That's the honest answer. A model with no search tool could also just guess something plausible, which is worse." }));
          box.appendChild(h("p", { class: "small", text: "Now the app switches search on, and the model writes a request:" }));
          box.appendChild(w.toolCall("web_search", "Bangkok weather this afternoon"));
          box.appendChild(h("div", { class: "row" }, w.onceBtn("Run the search", function () {
            box.appendChild(w.toolResult(h("span", {},
              h("b", { text: "weather-example.com (a made-up site for this game): " }),
              "Bangkok, today: thunderstorms likely after 3 pm, 80% chance of rain.")));
            box.appendChild(h("div", { class: "row" }, w.onceBtn("Paste the result onto the desk", function () {
              box.appendChild(h("div", { class: "chat" }, w.bubble("ai", "According to weather-example.com, thunderstorms are likely after 3 pm today (80% chance of rain), so take an umbrella.")));
              box.appendChild(h("p", { class: "small muted", text: "The model now “knows” today's weather only because the search result is on its desk. It's only as right as that page, which is why good answers name their source." }));
              points += 10;
              quiz();
            })));
          })));
          box.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        function quiz() {
          var q = h("section", { class: "card stack" }, h("div", { class: "kicker", text: "Check yourself" }));
          q.appendChild(ui.mcq({
            q: "When a chatbot says “I ran your data and the average is 42”, who actually did the calculation?",
            options: ["The language model, in its head", "A tool that the app ran, if there was one. If not, the model just wrote a likely-looking number, which may be wrong", "The chatbot company's staff"],
            answer: 1,
            explain: "Only a tool computes exactly. If you can't see a tool step (many apps show “Running code…” or the code itself), treat the number as unchecked."
          }, function (i, ok) {
            if (ok) points += 10;
            q.appendChild(h("div", { class: "row end" }, w.onceBtn("Finish level", function () {
              var score = pickRight + (ok ? 1 : 0);
              done({ stars: score >= 5 ? 3 : score >= 3 ? 2 : 1, points: points, summary: "You picked the right tool " + pickRight + " of 4 times, then ran a calculator, a table tool and a search as the harness." });
            })));
          }));
          container.appendChild(q);
          q.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }
  });
})();
