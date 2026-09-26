/* Level 2 — Train the model by counting. */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  BTL.levels = BTL.levels || [];

  // Facts for the recap, computed from the corpus so they stay true if the corpus is edited.
  var C0 = window.BTL_CORPUS, M0 = BTL.Model;
  var tallyTop = M0.Model.train(C0.train.slice(0, C0.tallyCount), 1).next([C0.tallyWord], 1)[0];
  var fullTop = M0.Model.train(C0.train, 1).next([C0.tallyWord], 1)[0];
  var changed = tallyTop && fullTop && tallyTop.word !== fullTop.word;

  BTL.levels.push({
    id: "L2", num: 2,
    name: "Train the model",
    desc: "Teach a model by counting which word comes after which.",
    goal: "How did the simple model in Level 1 make its guesses? It counted. You'll count a few sentences by hand, then let the computer count the rest.",
    intro: [
      { title: "A model starts knowing nothing.", text: "To learn, it reads lots of example text. This is called training." },
      { title: "Our tiny model learns by counting.", text: "For every word, it counts which word came right after it.", ex: "see you at the airport \u2192 after \u201cthe\u201d: airport +1" },
      { title: "Counts become chances.", text: "If \u201cairport\u201d came after \u201cthe\u201d 2 times out of 4, the model gives it a 2 \u00f7 4 = 50% chance. That percentage is called a probability." }
    ],
    recap: {
      title: "Training = learning from lots of examples",
      text: [
        "Our model learned by counting " + C0.train.length + " short sentences." + (changed
          ? " After " + C0.tallyCount + " sentences it thought \u201c" + tallyTop.word + "\u201d usually follows \u201c" + C0.tallyWord + "\u201d; after all " + C0.train.length + " it changed its mind to \u201c" + fullTop.word + "\u201d. More text, better guesses."
          : " The more text it counts, the better its guesses."),
        "Real chatbots are trained on a huge amount of text: far more than a person could read in many lifetimes. They don't keep a simple count table like ours (they use a neural network, a kind of very large adjustable formula), but the training task is the same: guess the next word, check what really came next, and adjust.",
        "Training is finished before you use the chatbot. Chatting with it doesn't change the model on the spot (though some companies use conversations to train later versions)."
      ],
      words: [["Training", "Learning from example text, before the model is used."], ["Probability", "A chance, written as a percentage: how often something came next in the training text."]]
    },
    run: function (container, done) {
      var ui = BTL.ui, h = ui.h, M = BTL.Model;
      var C = window.BTL_CORPUS;
      var word = C.tallyWord;
      var first = C.train.slice(0, C.tallyCount);
      var tallyModel = M.Model.train(first, 1);
      var truth = {};
      tallyModel.next([word], 1).forEach(function (d) { truth[d.word] = d.count; });
      var attempts = 0, points = 0;

      /* ---- Step 1: hand tally ---- */
      var s1 = h("section", { class: "card stack" },
        h("div", { class: "kicker", text: "Step 1 of 3 · Count by hand" }),
        h("h2", {}, "What came after “", h("span", { style: "color:var(--accent)", text: word }), "”?"),
        h("p", { class: "muted", text: "Here are the first " + first.length + " sentences of the training text. Every time you see “" + word + "”, look at the next word and add one to its count." }));
      var ol = h("ol", { class: "stack", style: "font-size:1.15rem;padding-left:1.4em" });
      first.forEach(function (s) {
        var li = h("li");
        M.tokenize(s).forEach(function (w, i) {
          if (i) li.appendChild(document.createTextNode(" "));
          li.appendChild(w === word ? h("b", { style: "color:var(--accent)", text: M.displayWord(w) }) : document.createTextNode(M.displayWord(w)));
        });
        ol.appendChild(li);
      });
      s1.appendChild(ol);
      var inputs = {};
      var tbody = h("tbody");
      C.tallyRows.forEach(function (w) {
        var inp = h("input", { class: "tally-input", type: "number", min: "0", max: "9", inputmode: "numeric", "aria-label": "count for " + w, value: "" });
        inputs[w] = inp;
        tbody.appendChild(h("tr", {}, h("td", { text: "“" + word + "” → " + w }), h("td", { class: "num" }, inp)));
      });
      s1.appendChild(h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, h("th", { text: "Word pair" }), h("th", { class: "num", text: "Count" }))), tbody)));
      var fb1 = h("p", { class: "feedback" });
      var checkBtn = h("button", { class: "btn primary", type: "button", text: "Check my counts" });
      s1.appendChild(fb1);
      s1.appendChild(h("div", { class: "row end" }, checkBtn));
      container.appendChild(s1);

      checkBtn.addEventListener("click", function () {
        attempts++;
        var allOk = true, wrong = [];
        C.tallyRows.forEach(function (w) {
          var v = parseInt(inputs[w].value, 10);
          if (isNaN(v)) v = 0;
          var ok = v === (truth[w] || 0);
          inputs[w].classList.toggle("ok", ok);
          inputs[w].classList.toggle("no", !ok);
          inputs[w].setAttribute("aria-invalid", String(!ok));
          if (!ok) { allOk = false; wrong.push("\u201c" + w + "\u201d"); }
        });
        if (allOk) {
          fb1.className = "feedback good";
          fb1.textContent = "✓ Correct. That's all training is for this model: counting.";
          checkBtn.disabled = true;
          Object.keys(inputs).forEach(function (k) { inputs[k].disabled = true; });
          points += attempts === 1 ? 30 : attempts === 2 ? 20 : 10;
          step2();
        } else {
          fb1.className = "feedback bad";
          fb1.textContent = "✗ Check the count for " + wrong.join(" and ") + " (orange boxes). Look again at the word right after each “" + word + "”." +
            (attempts >= 2 ? " Hint: one of these words never appears after “" + word + "”, so its count is 0." : "");
        }
      });

      /* ---- Step 2: counts -> probabilities ---- */
      function step2() {
        var dist = tallyModel.next([word], 1);
        if (!dist.length) { step3(); return; } // only if the corpus was edited so the tally word is missing
        var total = dist.reduce(function (a, b) { return a + b.count; }, 0);
        var target = dist[1] || dist[0];
        var right = Math.round(target.p * 100) + "%";
        var s2 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Step 2 of 3 · Counts become probabilities" }),
          h("p", { text: "Divide each count by the total (" + total + "). Probability = count ÷ total." }),
          ui.barsEl(dist, { showCount: true }));
        var opts = ["10%", right, "50%", "75%"].filter(function (v, i, a) { return a.indexOf(v) === i; });
        while (opts.length < 4) opts.push(opts.length * 20 + 5 + "%");
        var q = {
          q: "Check: “" + target.word + "” appeared " + target.count + " time" + (target.count === 1 ? "" : "s") + " out of " + total + ". What probability does the model give it?",
          options: opts, answer: opts.indexOf(right),
          explain: target.count + " ÷ " + total + " = " + right + "."
        };
        s2.appendChild(ui.mcq(q, function (i, ok) { if (ok) points += 10; step3(); }));
        container.appendChild(s2);
        s2.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      /* ---- Step 3: train on everything ---- */
      function step3() {
        var live = new M.Model(1);
        first.forEach(function (s) { live.addSentence(s); });
        var s3 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Step 3 of 3 · Let the machine count" }),
          h("p", { text: "You counted " + first.length + " sentences. The training text has " + C.train.length + ". Press the button and watch the counts for “" + word + "” change as the model reads the rest." }));
        var counter = h("p", { class: "muted", text: "Sentences read: " + first.length + " / " + C.train.length });
        var ticker = h("p", { class: "small", style: "font-family:var(--mono);min-height:1.5em;color:var(--ink-2)" });
        var barsBox = h("div");
        barsBox.appendChild(ui.barsEl(live.next([word], 1), { showCount: true }));
        var trainBtn = h("button", { class: "btn primary", type: "button", text: "Train on the other " + (C.train.length - first.length) + " sentences" });
        s3.appendChild(counter); s3.appendChild(ticker); s3.appendChild(barsBox);
        s3.appendChild(h("div", { class: "row end" }, trainBtn));
        container.appendChild(s3);
        s3.scrollIntoView({ behavior: "smooth", block: "start" });

        trainBtn.addEventListener("click", function () {
          trainBtn.disabled = true;
          var i = first.length;
          var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          var step = reduce ? C.train.length : 3;
          (function tick() {
            for (var j = 0; j < step && i < C.train.length; j++, i++) live.addSentence(C.train[i]);
            counter.textContent = "Sentences read: " + i + " / " + C.train.length;
            ticker.textContent = i < C.train.length ? "reading: “" + C.train[i - 1] + "”" : "Done. Training finished.";
            ui.clear(barsBox);
            barsBox.appendChild(ui.barsEl(live.next([word], 1), { showCount: true }));
            if (i < C.train.length) setTimeout(tick, 60);
            else explore();
          })();
        });
      }

      /* ---- Explore + final check ---- */
      function explore() {
        var full = BTL.model;
        var s4 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Explore the trained model" }),
          h("p", { text: "Pick a word to see what the model learned usually comes after it." }));
        var sel = h("select", { class: "text-input", style: "max-width:14em", "aria-label": "word to explore" });
        ["the", "my", "you", "so", "at", "i", "to"].forEach(function (w) { sel.appendChild(h("option", { value: w, text: M.displayWord(w) })); });
        var box = h("div");
        function show() { ui.clear(box); box.appendChild(ui.barsEl(full.next([sel.value], 1), { showCount: true })); }
        sel.addEventListener("change", show);
        s4.appendChild(sel); s4.appendChild(box);
        show();
        var dist = full.next([word], 1);
        var opts = dist.slice(0, 4).map(function (d) { return M.displayWord(d.word); });
        var shuffled = ui.shuffle(opts);
        var q = {
          q: "After training on everything, which word does the model think most often comes after “" + word + "”?",
          options: shuffled, answer: shuffled.indexOf(opts[0]),
          explain: "It's “" + opts[0] + "”, with " + dist[0].count + " of the " + dist.reduce(function (a, b) { return a + b.count; }, 0) +
            " times." + (tallyModel.next([word], 1)[0].word !== dist[0].word
              ? " After your " + first.length + " sentences it was “" + M.displayWord(tallyModel.next([word], 1)[0].word) + "”. More data changed the model's mind."
              : "")
        };
        s4.appendChild(ui.mcq(q, function (i, ok) {
          if (ok) points += 10;
          done({
            stars: attempts === 1 ? 3 : attempts === 2 ? 2 : 1,
            points: points,
            summary: "Counts correct on attempt " + attempts + ". You trained a model on " + C.train.length + " sentences."
          });
        }));
        container.appendChild(s4);
        s4.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
})();
