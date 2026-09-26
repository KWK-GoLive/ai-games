/* Level 6 — Narrow window: how much text the model can see (the context window). */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  BTL.levels = BTL.levels || [];

  BTL.levels.push({
    id: "L6", num: 6,
    name: "How much can it see?",
    desc: "Play the model with a narrow window: 1 word, then 2, then 3.",
    goal: "A model can only look at a limited amount of text when it guesses. You'll play the model with a very narrow window and feel the difference each extra word makes.",
    intro: [
      { title: "Imagine reading through a keyhole.", text: "You can see only the last word of the sentence. Guessing the next word is hard.", ex: "░░ ░░░░░ my ___   → sister? keys? teeth?", exSr: "Only the word “my” is visible. Next word: sister? keys? teeth?" },
      { title: "Widen the keyhole to 2 words", text: "and it can suddenly become easy.", ex: "░░ brush my ___   → teeth!", exSr: "Now “brush my” is visible. Next word: teeth!" },
      { title: "How much text a model can see at once is called its context window.", text: "In this level the window is 1 to 3 words (the chat model in Level 4 had 8). In each round you'll guess with 1, then 2, then 3 words visible, and see what the model guessed with the same view." }
    ],
    recap: {
      title: "More to look at, better guesses",
      text: [
        "With one word visible, many next words are possible. Each extra word you (and the model) could see narrowed it down. That is why the chat model in Level 4 needed a window of 8 words: with only 3, it would lose track of which question was asked.",
        "Our counting model has a weakness you saw in the “never seen” round: it only works with word strings it has seen exactly, so a longer window can leave it with no data at all. Real chatbots don't need exact matches; they learn patterns, so a longer window helps them.",
        "Real chatbots have a very large window: often whole documents plus your conversation so far. That's how they can refer back to something you said earlier. In a very long conversation, though, the earliest parts can still fall out of the window, so repeat key facts near your question."
      ],
      words: [["Context window", "How much text the model can see at once when it guesses the next word."]]
    },
    run: function (container, done) {
      var ui = BTL.ui, h = ui.h, M = BTL.Model;
      var C = window.BTL_CORPUS;
      var CFG = window.BTL_CONFIG || {};
      var model = BTL.model;
      var n = (CFG.ROUNDS && CFG.ROUNDS.L6) || 5;

      function top(prefix, k) {
        var d = model.next(prefix, k);
        if (!d.length) return null;
        if (d.length > 1 && d[0].count === d[1].count) return "tie";
        return d[0].word;
      }
      var pool = C.context.map(function (it) {
        var p = M.tokenize(it.prefix);
        return { prefix: p, answer: it.answer, unseen: !!it.unseen };
      }).filter(function (it) { return it.prefix.length >= 3; });
      // Always include the "never seen" round, then a varied mix.
      var unseen = pool.filter(function (it) { return it.unseen; });
      var rest = ui.shuffle(pool.filter(function (it) { return !it.unseen; }));
      var items = ui.shuffle(unseen.slice(0, 1).concat(rest).slice(0, Math.max(1, n)));
      if (unseen.length && items.indexOf(unseen[0]) < 0) items[items.length - 1] = unseen[0];

      var i = 0, youTotal = 0, points = 0, maxPts = items.length * 3;
      var card = h("section", { class: "card stack" });
      container.appendChild(card);

      function choicesFor(it) {
        var set = [it.answer];
        // the model's favourite at each window size (tempting wrong answers), then other words it has seen here
        [1, 2, 3].forEach(function (k) {
          var d = model.next(it.prefix, k);
          if (d.length && set.length < 4 && d[0].word !== M.END && set.indexOf(d[0].word) < 0) set.push(d[0].word);
        });
        model.next(it.prefix, 1).forEach(function (d) { if (set.length < 4 && d.word !== M.END && set.indexOf(d.word) < 0) set.push(d.word); });
        var fill = ui.shuffle(BTL.vocab.filter(function (w) { return set.indexOf(w) < 0 && it.prefix.indexOf(w) < 0 && w !== "chiang" && w !== "mai"; }));
        while (set.length < 4) set.push(fill.pop());
        return ui.shuffle(set);
      }

      function sentenceView(it, k, reveal) {
        var box = h("div", { class: "window-sentence", tabindex: "-1", "data-focus": "", "aria-label": reveal ? "Full sentence" : "The model can see: " + it.prefix.slice(-k).map(M.displayWord).join(" ") });
        it.prefix.forEach(function (w, j) {
          var visible = reveal || j >= it.prefix.length - k;
          var word = M.displayWord(w);
          if (j === 0) word = word.charAt(0).toUpperCase() + word.slice(1);
          box.appendChild(h("span", { class: visible ? "vis" : "hid", "aria-hidden": visible ? null : "true", text: word }));
          box.appendChild(document.createTextNode(" "));
        });
        box.appendChild(h("span", { class: "blank", style: "border-bottom:3px solid var(--accent);color:var(--accent);padding:0 .6em", text: reveal ? M.displayWord(it.answer) : "?" }));
        return box;
      }

      function render() {
        ui.clear(card);
        var it = items[i];
        var choices = choicesFor(it);
        var k = 1;
        var yourHits = [];
        card.appendChild(h("div", { class: "row" },
          h("span", { class: "muted small", text: "Round " + (i + 1) + " of " + items.length }),
          h("span", { style: "flex:1" }),
          h("span", { class: "muted small", text: "Your correct guesses: " + youTotal })));
        card.appendChild(h("div", { class: "progress" }, h("i", { style: "width:" + (i / items.length) * 100 + "%" })));
        var viewBox = h("div");
        var prompt = h("p", { style: "font-weight:600" });
        var grid = h("div", { class: "choices" });
        var stages = h("div", { class: "stage-list" });
        var fb = h("p", { class: "feedback", "aria-live": "polite" });
        var moreBtn = h("button", { class: "btn primary hidden", type: "button" });
        card.appendChild(viewBox);
        card.appendChild(prompt);
        card.appendChild(grid);
        card.appendChild(stages);
        card.appendChild(fb);
        card.appendChild(h("div", { class: "row end" }, moreBtn));

        function showStage() {
          ui.clear(viewBox);
          var v = sentenceView(it, k, false);
          viewBox.appendChild(v);
          prompt.textContent = "You can see " + k + " word" + (k > 1 ? "s" : "") + ". What comes next?";
          ui.clear(grid);
          choices.forEach(function (w) {
            var b = h("button", { class: "choice", type: "button", "data-word": w }, h("span", { text: M.displayWord(w) }));
            b.addEventListener("click", function () { if (!b.disabled) guess(w); });
            grid.appendChild(b);
          });
          moreBtn.classList.add("hidden");
          if (k > 1 || i > 0) v.focus({ preventScroll: true });
        }

        function guess(w) {
          Array.prototype.forEach.call(grid.children, function (b) { b.disabled = true; b.classList.toggle("picked", b.getAttribute("data-word") === w); });
          yourHits.push(w === it.answer);
          var ctx = it.prefix.slice(-k);
          var d = model.next(it.prefix, k);
          var t = top(it.prefix, k);
          var stage = h("div", { class: "stage" },
            h("h4", { text: k + " word" + (k > 1 ? "s" : "") + " visible: “" + ctx.map(M.displayWord).join(" ") + " ___”" }),
            h("p", { class: "small", style: "margin:0 0 6px" }, "You guessed ", h("b", { text: M.displayWord(w) }), ". The model, seeing the same words:"));
          if (!d.length) {
            stage.appendChild(h("p", { class: "small", style: "margin:0" }, h("b", { text: "No data at all. " }),
              "The model never saw “" + ctx.map(M.displayWord).join(" ") + "” anywhere in its training text, so it has nothing to count. A counting model only knows word strings it has seen exactly."));
          } else {
            stage.appendChild(ui.barsEl(d, { top: 3 }));
            if (t === "tie") stage.appendChild(h("p", { class: "small muted", style: "margin:4px 0 0", text: "Tie at the top: the model can't decide." }));
          }
          stages.appendChild(stage);
          if (k < 3) {
            moreBtn.textContent = "Show one more word";
            moreBtn.classList.remove("hidden");
            moreBtn.disabled = false;
            moreBtn.focus();
          } else {
            finishRound();
          }
        }

        function finishRound() {
          ui.clear(viewBox);
          viewBox.appendChild(sentenceView(it, it.prefix.length, true));
          ui.clear(grid);
          prompt.textContent = "";
          var hits = yourHits.filter(Boolean).length;
          youTotal += hits;
          points += hits * 5;
          var modelRight = [1, 2, 3].map(function (kk) { return top(it.prefix, kk) === it.answer; });
          var firstModel = modelRight.indexOf(true);
          fb.className = "feedback";
          fb.textContent = "The next word was “" + M.displayWord(it.answer) + "”. You were right " + hits + " of 3 times. " +
            (firstModel >= 0
              ? "The model first got it with " + (firstModel + 1) + " word" + (firstModel ? "s" : "") + " visible."
              : "The model never got it with 3 words or fewer.") +
            (it.unseen ? " With 3 words it had no data at all, even though it was right with fewer words." : "");
          moreBtn.textContent = i + 1 < items.length ? "Next round" : "Finish level";
          moreBtn.classList.remove("hidden");
          moreBtn.disabled = false;
          moreBtn.focus();
          moreBtn.onclick = function () {
            if (moreBtn.disabled) return;
            moreBtn.disabled = true;
            i++;
            if (i < items.length) render();
            else {
              var frac = youTotal / maxPts;
              done({ stars: frac >= 0.6 ? 3 : frac >= 0.35 ? 2 : 1, points: points, summary: "You guessed right " + youTotal + " of " + maxPts + " times across all windows." });
            }
          };
        }

        moreBtn.onclick = function () {
          if (moreBtn.disabled) return;
          moreBtn.disabled = true;
          k++;
          showStage();
        };
        showStage();
      }
      render();
    }
  });
})();
