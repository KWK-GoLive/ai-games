/* Level 1 — Guess the next word (no help). */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  BTL.levels = BTL.levels || [];

  BTL.levels.push({
    id: "L1", num: 1,
    name: "Guess the next word",
    desc: "Pick the word that comes next. No help, just your gut.",
    goal: "You'll see the start of a real sentence and four possible next words. Pick the one you think actually came next.",
    intro: [
      { title: "You already know this game.", text: "When you type on your phone, the keyboard suggests the next word.", ex: "See you at the  [airport] [station] [office]" },
      { title: "A chatbot does the same thing,", text: "just much better: it looks at the text so far and guesses the next word. Then the next. Then the next." },
      { title: "Your turn.", text: "Guess the next word " + (((window.BTL_CONFIG || {}).ROUNDS || {}).L1 || 8) + " times. A very simple computer model will guess too, and we'll compare how often each of you is right." }
    ],
    recap: {
      title: "You just did what a chatbot does",
      text: [
        "Every chatbot answer is built this way: look at the text so far, guess a likely next word, and repeat.",
        "You guessed using your feel for everyday English. The simple model guessed using only the one word right before the blank, and whatever it had seen most often after that word. Neither of you checked whether the sentence was true, only whether it sounded likely."
      ],
      words: [["Language model", "A computer program that guesses the next word. \u201cLarge\u201d language models (LLMs) are the huge ones behind chatbots."]]
    },
    run: function (container, done) {
      var ui = BTL.ui;
      var CFG = window.BTL_CONFIG || {};
      var n = (CFG.ROUNDS && CFG.ROUNDS.L1) || 8;
      // The phone-keyboard example ("see you at the ___") always comes first; the rest are random.
      var all = window.BTL_CORPUS.test;
      var anchor = all.filter(function (t) { return t.anchor; }).slice(0, 1);
      var tests = anchor.concat(ui.pick(all.filter(function (t) { return !t.anchor; }), n - anchor.length));
      BTL.state.l1Used = tests.map(function (t) { return t.s; });
      ui.save();
      var items = tests.map(function (t) { return ui.makeItem(BTL.model, t, "blind", BTL.vocab); });
      ui.guessRounds(container, {
        items: items,
        showProbs: false,
        onDone: function (res) {
          ui.clear(container);
          container.appendChild(ui.hvmEl(res,
            "The model picked whichever choice it had seen most often after the previous word, using one word of memory and nothing else. Where did it beat you? Where did reading the whole sentence help you?"));
          var frac = res.correct / res.n;
          done({
            stars: frac >= 0.75 ? 3 : frac >= 0.5 ? 2 : 1,
            points: res.points,
            hvm: { human: res.correct, model: res.modelCorrect, n: res.n },
            summary: "You matched the real next word " + res.correct + " time" + (res.correct === 1 ? "" : "s") + " out of " + res.n + "."
          });
        }
      });
    }
  });
})();
