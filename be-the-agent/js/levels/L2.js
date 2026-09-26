/* Level 2 — Reading your files: file -> text -> the desk; search picks pieces (retrieval). */
(function () {
  "use strict";
  var BTA = window.BTA = window.BTA || {};
  BTA.levels = BTA.levels || [];

  BTA.levels.push({
    id: "L2", num: 2,
    name: "Reading your files",
    desc: "How it “reads” a file, and why it sometimes reads the wrong part.",
    goal: "When you attach a file, the model doesn't open it like you do. The app turns it into text and puts text on the desk. If the file is too big, a search picks a few pieces. You'll be that search.",
    intro: [
      { title: "Step one: the file becomes plain text.", text: "The app pulls the words out of your PDF, Word or Excel file. (A scanned photo of a page has no words inside it; the app first needs text recognition, or it may just look at the picture.)" },
      { title: "Step two: the text goes on the desk,", text: "right next to your question. The model then answers from whatever text is there, word by word, like any other reply." },
      { title: "If the file doesn't fit,", text: "a search tool cuts it into pieces (chunks) and puts only the pieces that best match your question on the desk. Your job: be that search. Pick the piece to put on the desk." }
    ],
    recap: {
      title: "It answers from the pieces it was given",
      text: [
        "The model never “opens” your file. It reads whatever text the app put on its desk. With the right piece, it answered correctly. With a piece that only looked similar (same words, different topic), it gave a wrong answer that sounded just as sure.",
        "Search tools usually match words and meanings, not facts, so the top result can be the wrong one, as in the student-discount question. Apps that fit whole files on the desk avoid that step, but very large files and folders still have to be searched.",
        "Good habits: ask the chatbot to quote the exact sentence it used, and check that quote in your file. If the answer really matters, open the file yourself."
      ],
      words: [["Chunk", "A small piece of a long document, cut out so it fits on the desk."], ["Retrieval", "Searching your files for the chunks that best match a question, then putting them on the desk."]]
    },
    run: function (container, done) {
      var ui = BTA.ui, h = ui.h, w = BTA.w, E = BTA.Engine, D = window.BTA_DATA;
      var CFG = window.BTA_CONFIG || {};
      var capacity = CFG.DESK_TOKENS || 200;
      var chunks = D.handbook;
      var fileTokens = chunks.reduce(function (a, c) { return a + E.tokens(c.title + " " + c.text); }, 0);
      var points = 0, firstTryRight = 0;

      /* ---- Step 1: the file doesn't fit ---- */
      var s1 = h("section", { class: "card stack" },
        h("div", { class: "row" }, w.roleTag("harness")),
        h("div", { class: "kicker", text: "Step 1 · Attach the staff handbook" }),
        h("p", { text: "A staff member attaches staff_handbook.pdf and asks a question. First, the app pulls the text out of the file:" }));
      var list = h("ol", { class: "examples" });
      chunks.forEach(function (c) { list.appendChild(h("li", {}, h("b", { text: c.title + ": " }), c.text)); });
      s1.appendChild(list);
      var roomForFile = capacity - E.tokens(D.systemNote) - 30;
      s1.appendChild(h("p", { class: "feedback bad", text: "The whole handbook is about " + fileTokens + " tokens. After the system prompt and the question, the desk has room for only about " + Math.max(0, roomForFile) + ". It doesn't fit, so the app searches it and puts only the best piece on the desk. (Real apps usually add several pieces; here you pick one, to keep things clear.)" }));
      container.appendChild(s1);

      /* ---- Rounds ---- */
      var r = 0;
      function round() {
        var fq = D.fileQuestions[r];
        var tries = 0;
        var sec = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Question " + (r + 1) + " of " + D.fileQuestions.length }),
          h("div", { class: "chat" }, w.bubble("you", fq.q)),
          h("p", { text: "The search tool found these pieces, best match first (highlighted words match the question). Pick ONE piece to put on the desk." }));
        var results = E.search(fq.q, chunks).slice(0, 4);
        var grid = h("div", { class: "stack" });
        var answerBox = h("div", { class: "stack" });
        var btns = results.map(function (res, i) {
          var textEl = h("span");
          (res.chunk.title + ": " + res.chunk.text).split(/(\s+)/).forEach(function (tok) {
            var k = E.keywords(tok)[0];
            if (k && res.matched.indexOf(k) >= 0) textEl.appendChild(h("mark", { text: tok }));
            else textEl.appendChild(document.createTextNode(tok));
          });
          var b = h("button", { class: "chunk", type: "button", "data-chunk": res.chunk.id },
            h("span", { class: "meta", text: "Search result " + (i + 1) + " · " + res.score + " matching word" + (res.score === 1 ? "" : "s") }), textEl);
          b.addEventListener("click", function () { choose(res.chunk, b); });
          grid.appendChild(b);
          return b;
        });
        sec.appendChild(grid);
        sec.appendChild(answerBox);
        container.appendChild(sec);
        sec.scrollIntoView({ behavior: "smooth", block: "start" });

        function choose(chunk, b) {
          if (b.disabled) return;
          tries++;
          btns.forEach(function (x) { x.disabled = true; x.classList.toggle("on", x === b); });
          ui.clear(answerBox);
          var desk = new w.Desk({ capacity: capacity });
          desk.add({ id: "sys", kind: "system", label: "system prompt", text: D.systemNote, pinned: true });
          desk.add({ id: chunk.id, kind: "file", label: "handbook piece", text: chunk.title + ": " + chunk.text, pinned: true });
          desk.add({ id: "q", kind: "chat", label: "you", text: fq.q, pinned: true });
          answerBox.appendChild(desk.el);
          var ans = chunk.id === fq.need ? fq.right : chunk.id === fq.trap ? fq.trapAnswer : fq.none;
          answerBox.appendChild(h("div", { class: "chat" }, w.bubble("ai", ans)));
          var ok = chunk.id === fq.need;
          if (ok && tries === 1) { firstTryRight++; points += 20; }
          answerBox.appendChild(h("p", { class: "feedback " + (ok ? "good" : "bad"), text: ok
            ? "✓ Right piece, right answer."
            : chunk.id === fq.trap
              ? "✗ Wrong piece, and the model still answered confidently. That piece shares words with the question but is about something else. The right piece was “" + chunks.filter(function (c) { return c.id === fq.need; })[0].title + "”."
              : "✗ This piece doesn't answer the question. This time the model said so, but only because nothing on its desk looked like an answer." }));
          var row = h("div", { class: "row end" });
          if (!ok) row.appendChild(w.onceBtn("Try another piece", function () {
            ui.clear(answerBox);
            btns.forEach(function (x) { x.classList.remove("on"); });
            // re-enable a moment later, so a double-click can't also pick a piece by accident
            setTimeout(function () { btns.forEach(function (x) { x.disabled = false; }); }, 400);
          }, ""));
          row.appendChild(w.onceBtn(r + 1 < D.fileQuestions.length ? "Next question" : "Continue", function () {
            btns.forEach(function (x) { x.disabled = true; });
            r++;
            if (r < D.fileQuestions.length) round(); else searchPractice();
          }));
          answerBox.appendChild(row);
        }
      }
      round();

      /* ---- v4: you choose the search words (practice for the Agent Arena's Search sniper) ---- */
      function searchPractice() {
        var P = D.searchPractice, MAXW = 3, TRIES = 3, tries = 0, picked = [];
        var tgt = chunks.filter(function (c) { return c.id === P.target; })[0];
        var winners = P.cards.filter(function (c) { var r0 = E.search(c, chunks); return r0[0].chunk.id === P.target && r0[0].score > r0[1].score; });
        var sec = h("section", { class: "card stack" },
          h("div", { class: "row" }, w.roleTag("harness")),
          h("div", { class: "kicker", text: "Your turn: choose the search words" }),
          h("div", { class: "chat" }, w.bubble("you", P.q)),
          h("p", { text: "This time you pick the words the search tool looks for. It counts how many of your words each piece contains, and puts the best piece first. Tap up to 3 word cards, then Search. Get the piece that answers the question to #1, on its own." }));
        var chips = h("div", { class: "qb-chips", role: "group", "aria-label": "word cards" });
        var bar = h("div", { class: "search-bar", "aria-live": "polite" });
        var go = h("button", { class: "btn primary", type: "button", text: "🔍 Search" });
        var msg = h("p", { class: "feedback", "aria-live": "polite" });
        var out = h("div", { class: "stack" });
        var cardBtns = P.cards.map(function (word) {
          var b = h("button", { type: "button", class: "qb-chip", "aria-pressed": "false", text: word });
          b.addEventListener("click", function () {
            var i = picked.indexOf(word);
            if (i >= 0) picked.splice(i, 1); else if (picked.length < MAXW) picked.push(word);
            paint();
          });
          chips.appendChild(b);
          return b;
        });
        function paint() {
          cardBtns.forEach(function (b, i) { b.setAttribute("aria-pressed", String(picked.indexOf(P.cards[i]) >= 0)); });
          bar.textContent = picked.length ? "🔍 " + picked.join(" ") : "🔍 (tap up to 3 word cards)";
          go.disabled = !picked.length || tries >= TRIES;
        }
        go.addEventListener("click", function () {
          if (!picked.length || tries >= TRIES) return;
          tries++;
          var res = E.search(picked.join(" "), chunks);
          var win = res[0].chunk.id === P.target && res[0].score > 0 && res[0].score > res[1].score;
          ui.clear(out);
          res.slice(0, 3).forEach(function (x, i) {
            out.appendChild(h("div", { class: "chunk" + (i === 0 && win ? " on" : "") },
              h("span", { class: "meta", text: "#" + (i + 1) + " · " + x.score + " matching word" + (x.score === 1 ? "" : "s") + (x.matched.length ? " (" + x.matched.join(", ") + ")" : "") }),
              h("span", {}, h("b", { text: x.chunk.title + ": " }), x.chunk.text)));
          });
          if (win) { points += tries === 1 ? 20 : 10; msg.className = "feedback good"; msg.textContent = "✓ “" + tgt.title + "” is on top, on its own. The model would now answer from the right piece."; go.disabled = true; next(); }
          else if (tries >= TRIES) { msg.className = "feedback bad"; msg.textContent = "Out of tries. Words that appear only in the “" + tgt.title + "” piece work best, like “" + winners.slice(0, 2).join("” or “") + "”."; go.disabled = true; next(); }
          else { msg.className = "feedback bad"; msg.textContent = res[0].score === 0 ? "No piece has those words. Try others." : res[0].score === res[1].score ? "A tie at the top: the search can't tell which piece is best. Try more specific words." : "The top piece isn't the one that answers the question. Some words appear in several pieces."; picked = []; paint(); }
        });
        function next() { sec.appendChild(h("p", { class: "small muted", text: "Good search words appear in the right piece and in no other. Real search tools also match meanings, not just words, but they can still bring back the wrong piece." })); sec.appendChild(h("div", { class: "row end" }, w.onceBtn("Continue", quiz))); }
        sec.appendChild(chips);
        sec.appendChild(h("div", { class: "row" }, bar, go));
        sec.appendChild(msg); sec.appendChild(out);
        container.appendChild(sec);
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
        paint();
      }

      function quiz() {
        var box = h("section", { class: "card stack" }, h("div", { class: "kicker", text: "Check yourself" }));
        box.appendChild(ui.mcq({
          q: "A chatbot answers a question about your 80-page contract. What's the best way to trust the answer?",
          options: [
            "It read the whole contract, so it must be right",
            "Ask it to quote the exact sentence it used, then find that sentence in the contract yourself",
            "Ask the same question again and see if the answer changes"
          ],
          answer: 1,
          explain: "It may only have seen a few pieces, possibly the wrong ones. A quote you can find in the real file is the quickest check."
        }, function (i, ok) {
          if (ok) points += 10;
          box.appendChild(h("div", { class: "row end" }, w.onceBtn("Finish level", function () {
            done({ stars: Math.max(1, firstTryRight + (ok ? 1 : 0)), points: points + 10,
              summary: "Right piece on the first try: " + firstTryRight + " of " + D.fileQuestions.length + "." });
          })));
        }));
        container.appendChild(box);
        box.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
})();
