/* Be the LLM — results screen: Human vs Model, "what the toy gets wrong", link to the LLM Arena. */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};

  BTL.renderSummary = function (app) {
    var ui = BTL.ui, h = ui.h, M = BTL.Model;
    var st = BTL.state;
    ui.clear(app);
    window.scrollTo(0, 0);
    if (BTL.markSiteDone) BTL.markSiteDone();

    /* ---- done ---- */
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "All levels done" }),
      h("h1", { text: "You finished all " + BTL.levels.length + " levels." }),
      h("ul", {}, BTL.levels.map(function (l) { return h("li", { text: l.num + ". " + l.name }); }))));

    /* ---- human vs model ---- */
    var hv = st.hvm;
    if (hv.L1 || hv.L3) {
      var rows = [["L1", "Level 1 · blind (you had no numbers)"], ["L3", "Level 3 · with probabilities"]].filter(function (r) { return hv[r[0]]; });
      app.appendChild(h("section", { class: "card stack" },
        h("h2", { text: "Human vs Model" }),
        h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, h("th", { text: "" }), h("th", { class: "num", text: "You" }), h("th", { class: "num", text: "Counting model" }))),
          h("tbody", {}, rows.map(function (r) {
            var x = hv[r[0]];
            return h("tr", {}, h("td", { text: r[1] }), h("td", { class: "num", text: x.human + "/" + x.n }), h("td", { class: "num", text: x.model + "/" + x.n }));
          })))),
        h("p", { class: "muted", text: "Did the numbers help you in Level 3? The model reads only the last word; you read the whole sentence. Real LLMs combine both: statistics learned from huge amounts of text AND a long context." })));
    }

    /* ---- what the toy gets wrong ---- */
    app.appendChild(h("section", { class: "card why stack" },
      h("div", { class: "kicker", text: "Before you go" }),
      h("h2", { text: "What this toy model gets wrong" }),
      h("p", { text: "The game showed you the core idea honestly, but please don't leave thinking a chatbot is a big table of word counts. The main differences:" }),
      h("ul", {},
        h("li", {}, h("b", { text: "Pieces of words, not whole words. " }), "Real models work with tokens: whole words, parts of words, or punctuation."),
        h("li", {}, h("b", { text: "A much bigger window. " }), "Our toy sees 1\u20138 words. A real chatbot can see whole documents plus your conversation."),
        h("li", {}, h("b", { text: "Patterns, not a count table. " }), "Real models learn patterns with a neural network, so they can handle sentences they have never seen word for word. Our toy is stuck whenever a word string is new."),
        h("li", {}, h("b", { text: "Vastly more training. " }), "Ours read " + window.BTL_CORPUS.train.length + " short sentences and " + window.BTL_CORPUS.qa.length + " example chats. Real chatbots are trained on a huge amount of text, then on many example conversations, and are tuned further with feedback from people.")),
      h("p", { class: "muted", text: "What stays the same: guess the next word, add it, repeat. A chat is still \u201ccontinue the text\u201d. Likely is not the same as true, so check what matters." })));

    /* ---- next game ---- */
    app.appendChild(h("section", { class: "card soft stack" },
      h("div", { class: "kicker", text: "Next: the challenge" }),
      h("h2", { text: "LLM Arena" }),
      h("p", { text: "Now prove it. In the LLM Arena you play the model against the clock, with new training texts, and compete with your class on a live scoreboard." }),
      h("div", { class: "row end" }, h("a", { class: "btn primary", href: "../llm-arena/index.html", text: "Enter the LLM Arena \u2192" }))));


    var back = h("button", { class: "btn", type: "button", text: "← Level map" });
    var all = h("a", { class: "btn", href: "../index.html", text: "All games" });
    back.addEventListener("click", BTL.renderHome);
    app.appendChild(h("div", { class: "row end" }, all, back));
  };
})();
