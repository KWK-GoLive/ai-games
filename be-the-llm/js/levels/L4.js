/* Level 4 — Answer a question: a chat is still "continue the text". */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  BTL.levels = BTL.levels || [];

  BTL.levels.push({
    id: "L4", num: 4,
    name: "Answer a question",
    desc: "The model can write sentences. So how does it answer you?",
    goal: "So far the model only continues sentences. But a chatbot answers your questions. Let's find out how, with the same next-word trick.",
    intro: [
      { title: "The language model inside a chatbot doesn't look answers up in a table of facts.", text: "It does one thing: guess the next word, add it, repeat. (Some chatbots can also run a web search, but the search results are simply added to the text, and the model still writes its answer word by word.)" },
      { title: "The trick is in the training text.", text: "Besides ordinary sentences, it also reads thousands of example chats: a question, then a good answer.", ex: "Q: where does my sister live   A: she lives in Bangkok" },
      { title: "So it learns a pattern:", text: "after a question and \u201cA:\u201d, the next words are usually an answer. When you ask something, it just continues the text after \u201cA:\u201d." }
    ],
    recap: {
      title: "Answering = continuing the text after \u201cA:\u201d",
      text: [
        "Before the chat examples, the model treated your question like any other sentence: it stopped or kept writing. After reading example chats, the same next-word guessing produced an answer, because in its training text an answer is what comes after \u201cQ: \u2026 A:\u201d.",
        "Real chatbots are made the same way in spirit: first trained on a huge amount of ordinary text, then trained further on many example conversations written or rated by people. They are far more capable than our toy, but they still write the answer one likely word at a time.",
        "Why did it give YOUR answer and not another one? It could see your whole question, and in its example chats exactly that question was followed by that answer. Our toy can only do this for questions it has seen almost word for word. A real chatbot has read so much that it picks up the general pattern (question \u2192 fitting answer) and draws on facts from all the ordinary text it read first, so it can answer questions nobody ever wrote down.",
        "Notice what the model did NOT do: it didn't check a fact. It produced the words that usually follow a question like yours. Keep that in mind for Level 7."
      ],
      words: [["Prompt", "The text you give the model. It is the start of the text the model continues."]]
    },
    run: function (container, done) {
      var ui = BTL.ui, h = ui.h, M = BTL.Model;
      var C = window.BTL_CORPUS;
      var plain = BTL.model, chat = BTL.chatModel;
      var points = 0, quizOk = false;
      var chosen = null;

      /* ---- Step 1: before ---- */
      var s1 = h("section", { class: "card stack" },
        h("div", { class: "kicker", text: "Step 1 of 3 \u00b7 Before" }),
        h("h2", { text: "Ask the plain model from Levels 1\u20133" }),
        h("p", { class: "muted", text: "This model has only ever read ordinary sentences. Pick a question and see what it writes next." }));
      var chat1 = h("div", { class: "chat" });
      var note1 = h("p", { class: "feedback", "aria-live": "polite" });
      var next1 = h("button", { class: "btn primary hidden", type: "button", text: "Teach it to answer \u2192" });
      var qb1 = ui.questionButtons(C.l4Questions, function (q) {
        chosen = q;
        var qw = M.tokenize(q);
        var r = plain.generate(qw, 3, 0, qw.length + 8);
        var added = r.words.slice(qw.length);
        ui.clear(chat1);
        chat1.appendChild(ui.bubbleQ(qw));
        var stuckWord = !r.finished ? r.words[r.words.length - 1] : null;
        if (!added.length && !r.finished) {
          chat1.appendChild(ui.bubbleA([], { emptyText: "(nothing: it has no data to continue from)" }));
          note1.textContent = "It stopped. The word \u201c" + M.displayWord(stuckWord) + "\u201d never appears in its training text (it may have seen a similar form, like \u201c" + M.displayWord(stuckWord) + "s\u201d, but to this model that's a completely different word), so it has nothing to count and can't guess a next word. And it has never seen a question followed by an answer anyway.";
        } else if (!added.length) {
          chat1.appendChild(ui.bubbleA([], { emptyText: "(nothing: it chose [end] straight away)" }));
          note1.textContent = "It stopped. In its training text, sentences like this simply end there. It has never seen a question followed by an answer, so \u201canswering\u201d isn't something it knows how to continue with.";
        } else {
          chat1.appendChild(h("div", { class: "bubble a" }, h("span", { class: "who", text: "Model" }),
            h("span", { class: "dim", text: M.displaySentence(qw) + " " }), h("b", { text: added.map(M.displayWord).join(" ") + (r.finished ? "." : " \u2026") })));
          note1.textContent = "It didn't answer. It just kept writing your sentence as if it were an ordinary sentence (the bold part is what it added). It has never seen a question followed by an answer.";
        }
        note1.className = "feedback";
        next1.classList.remove("hidden");
      });
      s1.appendChild(qb1);
      s1.appendChild(chat1);
      s1.appendChild(note1);
      s1.appendChild(h("div", { class: "row end" }, next1));
      container.appendChild(s1);
      next1.addEventListener("click", function () {
        if (next1.disabled) return;
        next1.disabled = true;
        qb1.buttons.forEach(function (b) { b.disabled = true; });
        points += 20;
        step2();
      });

      /* ---- Step 2: add chat examples to the training text ---- */
      function step2() {
        var s2 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Step 2 of 3 \u00b7 Teach it to chat" }),
          h("h2", { text: "Add example chats to the training text" }),
          h("p", { text: "Each example is one question and one good answer. Two markers show where each part starts: Q: for the question and A: for the answer. Here are a few of the " + C.qa.length + " examples:" }));
        var shown = C.qa.filter(function (p, i) { return i % 5 === 0; }).slice(0, 6);
        var list = h("ul", { class: "examples" });
        shown.forEach(function (p) { list.appendChild(h("li", {}, ui.tokenStrip(M.qaSequence(p[0], p[1])))); });
        s2.appendChild(list);
        s2.appendChild(h("p", { class: "muted small", text: "\u2026 and " + (C.qa.length - shown.length) + " more. One more change: until now our model looked at only the last 1 to 3 words. This chat model can look at the last 8, enough to see the whole question. (Level 6 shows why that matters.)" }));
        var addBtn = h("button", { class: "btn primary", type: "button", text: "Train on the ordinary sentences + " + C.qa.length + " example chats" });
        var status = h("p", { class: "feedback", "aria-live": "polite" });
        s2.appendChild(h("div", { class: "row end" }, addBtn));
        s2.appendChild(status);
        container.appendChild(s2);
        s2.scrollIntoView({ behavior: "smooth", block: "start" });
        addBtn.addEventListener("click", function () {
          if (addBtn.disabled) return;
          addBtn.disabled = true;
          status.className = "feedback good";
          status.textContent = "\u2713 Trained. It counted " + C.train.length + " sentences and " + C.qa.length + " chats, with the same kind of counting as in Level 2.";
          step3();
        });
      }

      /* ---- Step 3: after ---- */
      function step3() {
        var s3 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Step 3 of 3 \u00b7 After" }),
          h("h2", { text: "Ask again, and watch it write" }),
          h("p", { text: "When you ask a chatbot something, your question becomes the start of the text, followed by \u201cA:\u201d. The model continues from there, one word at a time." }));
        var qw = M.tokenize(chosen);
        var seq = [M.Q].concat(qw, [M.A]);
        var strip = h("div");
        strip.appendChild(ui.tokenStrip(seq));
        var trailBox = h("div", { class: "step-trail" });
        var chatBox = h("div", { class: "chat" });
        chatBox.appendChild(ui.bubbleQ(qw));
        var r = chat.answer(qw, 0);
        var shownSteps = 0;
        var nextWordBtn = h("button", { class: "btn primary", type: "button", text: "Guess the next word" });
        var restBtn = h("button", { class: "btn", type: "button", text: "Write the rest" });
        s3.appendChild(h("p", { class: "small muted", text: "The text the model sees (blue tiles = words it has added):" }));
        s3.appendChild(strip);
        s3.appendChild(h("div", { class: "row" }, nextWordBtn, restBtn));
        s3.appendChild(trailBox);
        s3.appendChild(chatBox);
        container.appendChild(s3);
        s3.scrollIntoView({ behavior: "smooth", block: "start" });

        function showStep() {
          var t = r.trail[shownSteps];
          shownSteps++;
          var soFar = seq.concat(r.answer.slice(0, Math.min(shownSteps, r.answer.length)));
          ui.clear(strip);
          strip.appendChild(ui.tokenStrip(soFar, { newFrom: seq.length }));
          trailBox.appendChild(h("div", { class: "trail-row" },
            h("div", { class: "sees", text: "Guess " + shownSteps + ": the model looks at \u201c" + t.seen.filter(function (w) { return w !== M.START; }).map(M.displayWord).join(" ") + "\u201d. What came next after that in its training text?" }),
            ui.barsEl(t.raw, { top: 4, hit: t.word }),
            h("p", { class: "small", style: "margin:6px 0 0" }, "It picks the most likely: ", h("b", { text: M.displayWord(t.word) }))));
          if (shownSteps >= r.trail.length) finishAnswer();
        }
        function finishAnswer() {
          nextWordBtn.disabled = true; restBtn.disabled = true;
          chatBox.appendChild(ui.bubbleA(r.answer, { finished: r.finished }));
          points += 20;
          quiz();
        }
        nextWordBtn.addEventListener("click", function () { if (!nextWordBtn.disabled && shownSteps < r.trail.length) showStep(); });
        restBtn.addEventListener("click", function () {
          if (restBtn.disabled) return;
          while (shownSteps < r.trail.length) showStep();
        });
      }

      /* ---- check + free play ---- */
      function quiz() {
        var box = h("section", { class: "card stack" });
        box.appendChild(ui.mcq({
          q: "So, when a chatbot answers your question, what is it really doing?",
          options: [
            "Looking the answer up in a database of facts",
            "Continuing the text after your question, one likely word at a time",
            "Understanding the question and checking the facts, like a person would"
          ],
          answer: 1,
          explain: "It writes the words that usually come after a question like yours in its training text. That usually gives a good answer, but nothing in this process checks whether the answer is true."
        }, function (i, ok) {
          quizOk = ok;
          if (ok) points += 20;
          freePlay(box);
        }));
        container.appendChild(box);
        box.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function freePlay(box) {
        var play = h("div", { class: "stack" }, h("h3", { text: "Try more questions" }));
        var chatBox = h("div", { class: "chat" });
        var note = h("p", { class: "small muted", "aria-live": "polite" });
        function ask(words, unknown) {
          var r = chat.answer(words, 0);
          ui.clear(chatBox);
          chatBox.appendChild(ui.bubbleQ(words));
          chatBox.appendChild(ui.bubbleA(r.answer, { finished: r.finished, emptyText: "(nothing)" }));
          chatBox.appendChild(ui.tokenStrip([M.Q].concat(words, [M.A], r.answer), { newFrom: words.length + 2, unknown: new Set(unknown || []) }));
          var known = C.qa.some(function (p) { return M.tokenize(p[0]).join(" ") === words.join(" "); });
          note.textContent = unknown && unknown.length
            ? "The model has never seen these words: " + unknown.map(M.displayWord).join(", ") + " (wavy underline). It answered using only the parts it recognised, so the answer may have nothing to do with your question."
            : known ? "" : "This exact question isn't in its example chats, but it answered anyway, just as confidently. Level 7 is about exactly this.";
        }
        play.appendChild(ui.questionButtons(C.l4Questions, function (q) { ask(M.tokenize(q), []); }));
        play.appendChild(ui.ownQuestionBox(BTL.chatVocab, ask));
        play.appendChild(chatBox);
        play.appendChild(note);
        var fin = h("button", { class: "btn primary", type: "button", text: "Finish level" });
        fin.addEventListener("click", function () {
          if (fin.disabled) return;
          fin.disabled = true;
          done({
            stars: quizOk ? 3 : 2,
            points: points,
            summary: "You saw the same kind of model go from rambling to answering, just by adding example chats to its training text."
          });
        });
        play.appendChild(h("div", { class: "row end" }, fin));
        box.appendChild(play);
      }
    }
  });
})();
