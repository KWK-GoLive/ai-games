/* Level 7 — Fact-check the chatbot: confident answers that no source supports (hallucinations). */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  BTL.levels = BTL.levels || [];

  BTL.levels.push({
    id: "L7", num: 7,
    name: "Fact-check the chatbot",
    desc: "It always sounds sure. Is it right? Check the source.",
    goal: "You'll ask the chat model from Level 4 some questions. Its training text answers some of them and not others. The model answers all of them, just as confidently. Your job: spot which answers are backed by the training text.",
    intro: [
      { title: "Our model has no \u201cI don't know\u201d button.", text: "It always continues the text after \u201cA:\u201d with likely words, whether or not it has ever seen the answer. (Real chatbots can learn to say \u201cI don't know\u201d from their training examples, but they don't always do it when they should.)" },
      { title: "When it hasn't seen your question, it backs off.", text: "It looks at the last 8 words. If it has never seen those exact words, it drops the oldest word and looks again, and again, until the words match something in its training. Then it continues from there, and borrows the answer that came after it.", ex: "Q: what time does the museum open  A:\n\u2717 \u201c\u2026 does the museum open A:\u201d never seen\n\u2717 \u201cthe museum open A:\u201d never seen\n\u2717 \u201cmuseum open A:\u201d never seen\n\u2713 \u201copen A:\u201d seen! \u2192 \u201cit opens at ten\u201d (that was the shop!)", exSr: "It never saw the whole question, then drops words one by one: does the museum open, the museum open, museum open are all unseen. It has seen open A:, so it borrows the answer it opens at ten, which was about the shop." },
      { title: "Your job.", text: "For each answer, decide: Supported (the training text really says this) or Made up (it sounds fine, but no training text says it). You can open the training text to check. Then press \u201cCheck the source\u201d to see where each answer came from." }
    ],
    recap: {
      title: "Sounding sure is not the same as being right",
      text: [
        "Every answer came out in the same calm, fluent style, true or not. A made-up answer that sounds right is called a hallucination. It isn't lying or glitching: it is doing exactly what it always does, writing likely words.",
        "Real chatbots know vastly more than our toy, so they hallucinate much less often, but the cause is the same: they produce likely text, and likely is not the same as true. They are also often trained and tested in ways that reward a confident guess over \u201cI don't know\u201d.",
        "So treat a chatbot like a very fluent helper, not a source: when a fact, number, name or quote matters, check it somewhere reliable. And it helps to tell the chatbot it may say \u201cI don't know\u201d."
      ],
      words: [["Hallucination", "A confident, fluent answer that isn't supported by any real source."]]
    },
    run: function (container, done) {
      var ui = BTL.ui, h = ui.h, M = BTL.Model;
      var C = window.BTL_CORPUS;
      var CFG = window.BTL_CONFIG || {};
      var chat = BTL.chatModel;
      var n = (CFG.ROUNDS && CFG.ROUNDS.L7) || 6;

      // Fact questions = chat examples that have a source sentence.
      var factQs = C.qa.filter(function (p) { return p[2]; }).map(function (p) { return p[0]; });
      function backingExample(qWords, answerWords) { return BTL.Facts.backingExample(C, qWords, answerWords); }
      function examplesWithAnswer(answerWords) {
        var a = answerWords.join(" ");
        return C.qa.filter(function (p) { return M.tokenize(p[1]).join(" ") === a; });
      }

      var nMade = Math.min(C.unanswerable.length, Math.ceil(n / 2));
      var nReal = Math.min(factQs.length, n - nMade);
      var items = ui.shuffle(
        ui.pick(factQs, nReal).map(function (q) { return { q: q } })
          .concat(ui.pick(C.unanswerable, nMade).map(function (q) { return { q: q }; })));
      items.forEach(function (it) {
        it.words = M.tokenize(it.q);
        it.r = chat.answer(it.words, 0);
        it.backing = backingExample(it.words, it.r.answer);
        it.supported = !!it.backing;
      });
      var marks = items.map(function () { return null; });
      var points = 0;

      var peek = h("details", { class: "card soft" },
        h("summary", { style: "cursor:pointer;font-weight:600", text: "Open the training text (the facts it read)" }),
        h("p", { class: "small muted", text: "These are the facts its example chats are about. The model read each one as an ordinary sentence and again as the answer to an example chat. The rest of its training text is everyday chat, with no answer to anything else you'll be asked here." }),
        h("ul", { class: "examples" }, C.qa.filter(function (p) { return p[2]; }).map(function (p) {
          return h("li", { text: M.displaySentence(M.tokenize(p[2])) + "." });
        })));
      container.appendChild(peek);
      var card = h("section", { class: "card stack" },
        h("p", { class: "muted small", text: items.length + " questions and the chatbot's answers. Mark each answer Supported or Made up." }));
      var list = h("div");
      var submit = h("button", { class: "btn primary", type: "button", text: "Check my answers", disabled: true });
      var fb = h("p", { class: "feedback", "aria-live": "polite" });
      card.appendChild(list);
      card.appendChild(fb);
      card.appendChild(h("div", { class: "row end" }, submit));
      container.appendChild(card);

      var rows = items.map(function (it, idx) {
        var bYes = h("button", { type: "button", text: "Supported", "aria-pressed": "false" });
        var bNo = h("button", { type: "button", text: "Made up", "aria-pressed": "false" });
        function set(v) {
          marks[idx] = v;
          bYes.classList.toggle("on", v === true);
          bNo.classList.toggle("on", v === false);
          bYes.setAttribute("aria-pressed", String(v === true));
          bNo.setAttribute("aria-pressed", String(v === false));
          submit.disabled = marks.some(function (m) { return m === null; });
        }
        bYes.addEventListener("click", function () { set(true); });
        bNo.addEventListener("click", function () { set(false); });
        var extra = h("div");
        var row = h("div", { class: "mark-row" },
          h("div", { class: "chat" }, ui.bubbleQ(it.words), ui.bubbleA(it.r.answer, { finished: it.r.finished }), extra),
          h("div", { class: "toggle", role: "group", "aria-label": "supported or made up" }, bYes, bNo));
        list.appendChild(row);
        return { extra: extra, bYes: bYes, bNo: bNo };
      });

      function sourceBox(it) {
        var box = h("div", { class: "card soft stack", style: "margin:6px 0 0;padding:12px" });
        if (it.supported) {
          box.appendChild(h("p", { class: "small", style: "margin:0" }, h("b", { text: it.backing.exact ? "Found in the training text. " : "Supported, even though your wording is new. " }),
            it.backing.exact ? "It learned this answer from this example chat:" : "It learned this answer from an example chat about the same thing:"));
          box.appendChild(ui.tokenStrip(M.qaSequence(it.backing.ex[0], it.backing.ex[1])));
          var plain = it.backing.ex[2];
          if (plain) box.appendChild(h("p", { class: "small", style: "margin:0" }, "The same fact in an ordinary sentence: ", h("b", { text: "\u201c" + M.displaySentence(M.tokenize(plain)) + ".\u201d" })));
          return box;
        }
        var first = it.r.trail[0];
        var ending = first ? first.seen.filter(function (w) { return w !== M.START; }) : [];
        if (ending.length <= 1) {
          box.appendChild(h("p", { class: "small", style: "margin:0" }, h("b", { text: "No training text says this. " }),
            "It didn't recognise the end of your question at all, so it just continued from \u201cA:\u201d with the most common way answers start."));
        } else {
          box.appendChild(h("p", { class: "small", style: "margin:0" }, h("b", { text: "No training text says this. " }),
            "It had never seen your whole question. It looks at the end of the text, and the longest ending it had seen before was \u201c" + ending.map(M.displayWord).join(" ") + "\u201d, so it carried on from there."));
        }
        var ex = examplesWithAnswer(it.r.answer);
        if (ex.length) {
          box.appendChild(h("p", { class: "small", style: "margin:0", text: "It borrowed the answer from " + (ex.length === 1 ? "this example" : "these examples") + " about something else:" }));
          ex.forEach(function (p) { box.appendChild(ui.tokenStrip(M.qaSequence(p[0], p[1]))); });
        } else {
          box.appendChild(h("p", { class: "small", style: "margin:0", text: "It stitched the answer together from pieces of different examples." }));
        }
        // Was one of its choices a coin-flip?
        for (var s = 0; s < it.r.trail.length; s++) {
          var raw = it.r.trail[s].raw;
          if (raw.length > 1 && raw[0].count === raw[1].count) {
            box.appendChild(h("p", { class: "small", style: "margin:0", text: "One choice was a coin-flip: \u201c" + M.displayWord(raw[0].word) + "\u201d and \u201c" + M.displayWord(raw[1].word) + "\u201d were equally likely, and it took the one it had seen first. Either way, it would have sounded just as sure." }));
            break;
          }
        }
        box.appendChild(h("p", { class: "small muted", style: "margin:0", text: "It never said \u201cI don't know\u201d: no example in its training text answers that way, so those words were never likely." }));
        return box;
      }

      submit.addEventListener("click", function () {
        if (submit.disabled) return;
        submit.disabled = true;
        submit.classList.add("hidden");
        var right = 0;
        items.forEach(function (it, idx) {
          var r = rows[idx];
          r.bYes.disabled = true; r.bNo.disabled = true;
          var ok = marks[idx] === it.supported;
          if (ok) right++;
          r.extra.appendChild(h("p", { class: "feedback " + (ok ? "good" : "bad"), style: "margin:4px 0",
            text: (ok ? "\u2713 " : "\u2717 ") + (it.supported ? "Supported: the training text really says this." : "Made up: it sounds just as sure, but no training text says this.") }));
          var srcBtn = h("button", { class: "btn small", type: "button", text: "Check the source" });
          var srcHolder = h("div");
          srcBtn.addEventListener("click", function () {
            if (srcBtn.disabled) return;
            srcBtn.disabled = true;
            srcHolder.appendChild(sourceBox(it));
          });
          r.extra.appendChild(h("div", {}, srcBtn));
          r.extra.appendChild(srcHolder);
        });
        points = right * 10;
        fb.className = "feedback " + (right >= items.length - 1 ? "good" : "bad");
        fb.textContent = "You got " + right + " of " + items.length + " right. Press \u201cCheck the source\u201d on the made-up ones: where did the answer really come from?";
        afterCheck(right);
      });

      function afterCheck(right) {
        var own = h("section", { class: "card stack" },
          h("h3", { text: "Try your own question" }),
          h("p", { class: "small muted", text: "Ask anything using everyday words. The game tells you whether the training text supports the answer." }));
        var chatBox = h("div", { class: "chat" });
        var verdict = h("div");
        own.appendChild(ui.ownQuestionBox(BTL.chatVocab, function (words, unknown) {
          var it = { q: words.join(" "), words: words, r: chat.answer(words, 0) };
          it.backing = backingExample(words, it.r.answer);
          it.supported = !!it.backing;
          ui.clear(chatBox); ui.clear(verdict);
          chatBox.appendChild(ui.bubbleQ(words));
          chatBox.appendChild(ui.bubbleA(it.r.answer, { finished: it.r.finished }));
          verdict.appendChild(h("p", { class: "feedback " + (it.supported ? "good" : "bad"),
            text: it.supported ? "Supported by the training text." : "Not backed: no example chat asks about exactly this, so the model made up an answer. (If you reworded a question using new words, the answer may still happen to match a fact: open the training text to check.)" + (unknown.length ? " (It has never seen: " + unknown.map(M.displayWord).join(", ") + ".)" : "") }));
          if (it.r.trail.length) verdict.appendChild(sourceBox(it));
        }));
        own.appendChild(chatBox);
        own.appendChild(verdict);
        var fin = h("button", { class: "btn primary", type: "button", text: "Finish level" });
        fin.addEventListener("click", function () {
          if (fin.disabled) return;
          fin.disabled = true;
          var frac = right / items.length;
          done({ stars: frac >= 0.83 ? 3 : frac >= 0.5 ? 2 : 1, points: points, summary: "You judged " + right + " of " + items.length + " answers correctly." });
        });
        own.appendChild(h("div", { class: "row end" }, fin));
        container.appendChild(own);
      }
    }
  });
})();
