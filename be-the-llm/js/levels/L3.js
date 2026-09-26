/* Level 3 — Build a sentence: guess, add, repeat. */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  BTL.levels = BTL.levels || [];

  BTL.levels.push({
    id: "L3", num: 3,
    name: "Build a sentence",
    desc: "See the model's percentages, then write a whole sentence one word at a time.",
    goal: "Part A: guess again, but now you can see the model's probability for each choice. Part B: write a whole sentence by picking one word at a time.",
    intro: [
      { title: "Now you can peek at the model's numbers.", text: "Each choice shows how often the model saw that word after the previous word.", ex: "I left my ___   sister 11% \u00b7 keys 6% \u00b7 phone 6%" },
      { title: "The highest % is the most likely word,", text: "not a guaranteed right answer. Real text sometimes takes the less common path." },
      { title: "Then: a whole sentence.", text: "Pick a word, add it to the text, and the model guesses again. Repeat until you choose [end] (a marker meaning “the sentence stops here”). This loop is how a chatbot writes every answer." }
    ],
    recap: {
      title: "Guess \u2192 add \u2192 repeat",
      text: [
        "Your sentence was written one word at a time, each word chosen from the model's guesses. That is exactly how a chatbot writes a long answer: one small guess, add it, guess again, hundreds of times.",
        "The model never plans the whole sentence first and never checks it at the end. It only ever asks: what word is likely to come next?"
      ]
    },
    run: function (container, done) {
      var ui = BTL.ui, h = ui.h, M = BTL.Model;
      var CFG = window.BTL_CONFIG || {};
      var n = (CFG.ROUNDS && CFG.ROUNDS.L3) || 8;
      var used = BTL.state.l1Used || [];
      var pool = window.BTL_CORPUS.test;
      var fresh = ui.shuffle(pool.filter(function (t) { return used.indexOf(t.s) < 0; }));
      var reused = ui.shuffle(pool.filter(function (t) { return used.indexOf(t.s) >= 0; }));
      var tests = fresh.concat(reused).slice(0, n);
      var items = tests.map(function (t) { return ui.makeItem(BTL.model, t, "probs", BTL.vocab); });
      var partA = null;

      container.appendChild(h("div", { class: "card soft" },
        h("div", { class: "kicker", text: "Part A" }),
        h("p", { style: "margin:0", text: "The bar under each choice shows how often the model saw that word after the previous word in training. The real answer can be any of the four, even a low-% one. Use the numbers, or overrule them." })));

      ui.guessRounds(container, {
        items: items,
        showProbs: true,
        onDone: function (res) {
          partA = res;
          ui.clear(container);
          var prev = BTL.state.hvm.L1;
          container.appendChild(ui.hvmEl(res,
            "The model picked the highest % every time." + (prev ? " In Level 1 it was you " + prev.human + "/" + prev.n + " vs model " + prev.model + "/" + prev.n + "." : "") +
            " Look at the rounds the model got wrong: the real text took a less common path, or the answer depended on words further back than the model can see."));
          partB();
        }
      });

      function partB() {
        var model = BTL.model;
        var words = [];
        var maxLen = 12;
        var card = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Part B · Write a sentence like an LLM" }),
          h("p", { text: "Start from nothing. Each turn, pick one of the model's top next words. It gets added to the text, and the model guesses again. Keep going until you pick [end]." }),
          h("div", { class: "loop" }, h("b", { text: "guess" }), "\u2192", h("b", { text: "add" }), "\u2192", h("b", { text: "repeat" })));
        var sent = h("div", { class: "sentence" });
        var grid = h("div", { class: "choices" });
        var info = h("p", { class: "muted small" });
        card.appendChild(sent); card.appendChild(info); card.appendChild(grid);
        container.appendChild(card);
        card.scrollIntoView({ behavior: "smooth", block: "start" });

        function render() {
          ui.clear(sent);
          if (!words.length) sent.appendChild(h("span", { class: "dim", text: "[start] " }));
          else sent.appendChild(document.createTextNode(M.displaySentence(words) + " "));
          sent.appendChild(h("span", { class: "blank", text: "?" }));
          var dist = model.next([M.START].concat(words), 1);
          info.textContent = "Model sees only the last word: “" + (words.length ? M.displayWord(words[words.length - 1]) : "[start]") + "” · " + dist.length + " possible next words, top 5 shown.";
          ui.clear(grid);
          dist.slice(0, 5).forEach(function (d) {
            var b = h("button", { class: "choice", type: "button" },
              h("span", { text: M.displayWord(d.word) }),
              h("span", { class: "tag", text: "model: " + ui.pct(d.p) }),
              ui.miniBar(d.p));
            b.addEventListener("click", function () {
              if (d.word === M.END || words.length + 1 >= maxLen) {
                if (d.word !== M.END) words.push(d.word);
                finish(d.word === M.END);
              } else { words.push(d.word); render(); }
            });
            grid.appendChild(b);
          });
        }

        function finish(ended) {
          ui.clear(grid);
          info.textContent = "";
          ui.clear(sent);
          sent.appendChild(document.createTextNode(M.displaySentence(words) + (ended ? "." : " …")));
          var inTrain = model.inTraining(words);
          var pieces = model.sources(words);
          card.appendChild(h("div", { class: "card soft stack" },
            h("p", {}, h("b", { text: "You made " + words.length + " guesses in a row" }), ", one word at a time, without planning the sentence in advance."),
            h("p", { text: inTrain
              ? "This exact sentence is in the training text: the model can repeat what it read."
              : "This exact sentence is NOT in the training text as a whole sentence. " + (pieces.length > 1 ? "It was stitched from " + pieces.length + " pieces the model had seen." : "It is only part of a longer training sentence.") + " Remember this for Level 7." }),
            ended ? null : h("p", { class: "muted small", text: "(Stopped at " + maxLen + " words.)" })));
          var fin = h("button", { class: "btn primary", type: "button", text: "Finish level" });
          fin.addEventListener("click", function () {
            fin.disabled = true;
            var frac = partA.correct / partA.n;
            done({
              stars: frac >= 0.75 ? 3 : frac >= 0.5 ? 2 : 1,
              points: partA.points + 20,
              hvm: { human: partA.correct, model: partA.modelCorrect, n: partA.n },
              summary: "Part A: " + partA.correct + "/" + partA.n + " (model " + partA.modelCorrect + "/" + partA.n + "). Part B: you wrote “" + M.displaySentence(words) + "”."
            });
          });
          card.appendChild(h("div", { class: "row end" }, fin));
        }
        render();
      }
    }
  });
})();
