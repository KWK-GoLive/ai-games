/* Be the Agent — results screen: "what a chatbot app really is", habits, link to the Agent Arena. */
(function () {
  "use strict";
  var BTA = window.BTA = window.BTA || {};

  BTA.renderSummary = function (app) {
    var ui = BTA.ui, h = ui.h;
    var st = BTA.state;
    ui.clear(app);
    window.scrollTo(0, 0);
    if (BTA.markSiteDone) BTA.markSiteDone();

    /* ---- done ---- */
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "All levels done" }),
      h("h1", { text: "You finished all " + BTA.levels.length + " levels." }),
      h("ul", {}, BTA.levels.map(function (l) { return h("li", { text: l.num + ". " + l.name }); }))));

    /* ---- the big picture ---- */
    function box(cls, title, text) { return h("div", { class: "box " + cls }, h("b", { text: title }), h("span", { class: "small", text: text })); }
    app.appendChild(h("section", { class: "card why stack" },
      h("div", { class: "kicker", text: "The big picture" }),
      h("h2", { text: "What a chatbot app really is" }),
      h("div", { class: "appdiagram", role: "img", "aria-label": "You talk to the app. The app puts text on the desk for the model, runs tools, and shows you the result." },
        box("you", "You", "ask, approve, check"),
        h("span", { class: "arrow", "aria-hidden": "true", text: "\u21c4" }),
        box("app", "The app (harness)", "fills the desk, runs tools, asks your permission"),
        h("span", { class: "arrow", "aria-hidden": "true", text: "\u21c4" }),
        box("model", "The model", "reads the desk, writes the next words or a tool request")),
      h("p", { text: "Tools (calculator, search, code, file makers) and your files plug into the app, not the model. In this game the model only reads and writes text (some real models can also look at images). Running tools, reading files and making files is the app\u2019s job." })));

    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Take these with you" }),
      h("h2", { text: "Five habits" }),
      h("ol", {},
        h("li", {}, h("b", { text: "Put the important stuff on the desk. " }), "Give the key facts and files; in a long chat, repeat them or start fresh."),
        h("li", {}, h("b", { text: "Ask for the source. " }), "Have it quote the file or name the page, then check the quote."),
        h("li", {}, h("b", { text: "Numbers come from tools. " }), "Look for a tool or code step behind every figure, and spot-check a few."),
        h("li", {}, h("b", { text: "Files can give orders. " }), "Be wary of documents and pages from strangers; compare summaries with the source."),
        h("li", {}, h("b", { text: "You're the boss. " }), "Approve anything permanent or external yourself, and keep personal data out of unapproved tools.")),
      h("p", { class: "muted small" }, "Want to see how the model itself works? ", h("a", { href: "../be-the-llm/index.html", text: "Play Be the LLM" }), ".")));

    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "For your own data work" }),
      h("h2", { text: "📋 Checking AI data work" }),
      h("p", { text: "Six checks to use whenever AI works with your spreadsheets and reports: tool or guess, recompute one total, missing rows, claims beyond the data, privacy, show the formula." }),
      h("div", { class: "row end" }, h("a", { class: "btn", href: "../checklist.html", text: "Open the checklist (printable)" }))));

    app.appendChild(h("section", { class: "card soft stack" },
      h("div", { class: "kicker", text: "Next: the challenge" }),
      h("h2", { text: "Agent Arena" }),
      h("p", { text: "Now run the agent yourself against the clock: pack the desk, pick the tools, ask the data questions, spot planted orders, and deliver a real file. Compete with your class on a live scoreboard." }),
      h("div", { class: "row end" }, h("a", { class: "btn primary", href: "../agent-arena/index.html", text: "Enter the Agent Arena \u2192" }))));


    var back = h("button", { class: "btn", type: "button", text: "← Level map" });
    var all = h("a", { class: "btn", href: "../index.html", text: "All games" });
    back.addEventListener("click", BTA.renderHome);
    app.appendChild(h("div", { class: "row end" }, all, back));
  };
})();
