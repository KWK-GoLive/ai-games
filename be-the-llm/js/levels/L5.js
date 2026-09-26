/* Level 5 — Temperature: same question, different answers. */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  BTL.levels = BTL.levels || [];

  BTL.levels.push({
    id: "L5", num: 5,
    name: "Same question, different answers",
    desc: "Why a chatbot can answer the same question differently each time.",
    goal: "Ask a chatbot the same question twice and you may get two different answers. Here's the dial that causes it.",
    intro: [
      { title: "The model doesn't always take the top word.", text: "It can roll a weighted dice: a word with 40% wins 4 times in 10, a word with 20% wins 2 times in 10.", ex: "Q: What should we have for dinner?  A: ___\nhow (about pizza) 40%  ·  let (us get…) 20%  ·  noodles 20%  ·  I (want soup) 20%" },
      { title: "A dial called temperature", text: "decides how adventurous that dice is. Low temperature: it almost always takes the top word, so you get the same answer every time. High temperature: less likely words get more chances, so answers vary more." },
      { title: "Your turn.", text: "Turn the dial, then ask the same question 5 times at a low setting and 5 times at a high setting." }
    ],
    recap: {
      title: "Different answers are normal, not a fault",
      text: [
        "Chatbots usually run at a temperature above zero, so the same question can come back with different wording, or even different content. In our toy, temperature 0 always takes the top word and repeats itself exactly; real chatbots at 0 are very consistent, though not always word-for-word identical.",
        "Look at what varied: questions with many good answers (“what should we have for dinner?”) changed a lot. The fact question (“what time does the shop open?”) didn't, because the model had seen only one answer to it. In real chatbots, facts can occasionally change between runs too, which is one more reason to check an important answer rather than trust one run."
      ],
      words: [["Temperature", "A setting for how adventurous the next-word choice is. Low = predictable, high = varied."]]
    },
    run: function (container, done) {
      var ui = BTL.ui, h = ui.h, M = BTL.Model;
      var C = window.BTL_CORPUS;
      var chat = BTL.chatModel;
      var dialQ = M.tokenize(C.l5DialQuestion);
      var dialSeq = [M.Q].concat(dialQ, [M.A]);
      var base = chat.next(dialSeq, chat.maxContext);
      var T = 1, rolled = null, didLow = false, didHigh = false, points = 0;
      var currentQ = C.l5Questions[0];

      /* ---- Step 1: the dial ---- */
      var card = h("section", { class: "card stack" },
        h("div", { class: "kicker", text: "Step 1 · The dial" }),
        h("p", {}, "The chatbot is asked “", h("b", { text: M.displaySentence(dialQ) + "?" }), "”. These are its chances for the FIRST word of the answer. Drag the temperature and watch the bars change."));
      var read = h("span", { class: "temp-read", text: "Temperature 1.0" });
      var note = h("p", { class: "muted small" });
      var slider = h("input", { type: "range", min: "0", max: "2", step: "0.1", value: "1", "aria-label": "temperature" });
      var barsBox = h("div");
      var rollBtn = h("button", { class: "btn", type: "button", text: "Roll the dice once" });
      var rollOut = h("p", { class: "feedback", "aria-live": "polite" });
      card.appendChild(h("div", { class: "row" }, read, h("span", { style: "flex:1" }), rollBtn));
      card.appendChild(slider);
      card.appendChild(h("div", { class: "row small muted", style: "justify-content:space-between" }, h("span", { text: "0 = always the top word" }), h("span", { text: "1 = chances as counted" }), h("span", { text: "2 = very adventurous" })));
      card.appendChild(barsBox);
      card.appendChild(rollOut);
      card.appendChild(note);
      container.appendChild(card);

      function draw() {
        ui.clear(barsBox);
        barsBox.appendChild(ui.barsEl(M.applyTemperature(base, T), { rolled: rolled, top: 8 }));
        read.textContent = "Temperature " + T.toFixed(1);
        note.textContent = T === 0
          ? "At 0 the top word gets 100%: every roll gives the same word."
          : T < 1 ? "Below 1 the favourite gets even stronger."
          : T === 1 ? "At 1 the chances are exactly what the model counted in training."
          : "Above 1 the bars even out: less likely words get picked more often.";
        slider.setAttribute("aria-valuetext", "temperature " + T.toFixed(1));
      }
      slider.addEventListener("input", function () { T = Math.round(parseFloat(slider.value) * 10) / 10; rolled = null; rollOut.textContent = ""; draw(); syncT(); });
      rollBtn.addEventListener("click", function () {
        rolled = M.sample(M.applyTemperature(base, T));
        rollOut.className = "feedback";
        rollOut.textContent = "The dice picked: “" + M.displayWord(rolled) + "”";
        draw();
      });
      draw();

      /* ---- Step 2: same question, five times ---- */
      var gen = h("section", { class: "card stack" },
        h("div", { class: "kicker", text: "Step 2 · Same question, five times" }),
        h("p", { text: "Pick a question, then ask it 5 times. Do it once at a LOW temperature (0–0.2) and once at a HIGH temperature (1.2 or more). Try the shop question too." }));
      var tRead = h("p", { class: "small muted" });
      function syncT() { tRead.textContent = "Current temperature: " + T.toFixed(1) + " (change it with the slider in Step 1)."; }
      syncT();
      var qb = ui.questionButtons(C.l5Questions, function (q) { currentQ = q; });
      qb.buttons[0].classList.add("on"); qb.buttons[0].setAttribute("aria-pressed", "true");
      var genBtn = h("button", { class: "btn primary", type: "button", text: "Ask 5 times" });
      var checklist = h("p", { class: "small muted" });
      var out = h("div", { class: "stack" });
      gen.appendChild(qb);
      gen.appendChild(tRead);
      gen.appendChild(h("div", { class: "row" }, genBtn, checklist));
      gen.appendChild(out);
      container.appendChild(gen);
      var checkBox = h("div");
      container.appendChild(checkBox);

      function updChecklist() {
        checklist.textContent = (didLow ? "✓" : "○") + " low temperature   " + (didHigh ? "✓" : "○") + " high temperature";
      }
      updChecklist();
      genBtn.addEventListener("click", function () {
        var qw = M.tokenize(currentQ);
        var list = h("ol", { class: "gen-list" });
        var distinct = new Set();
        for (var i = 0; i < 5; i++) {
          var r = chat.answer(qw, T);
          var s = M.displaySentence(r.answer) + (r.finished ? "." : " …");
          distinct.add(s);
          list.appendChild(h("li", { text: s }));
        }
        out.insertBefore(h("div", { class: "card soft" },
          h("div", { class: "kicker", text: "“" + M.displaySentence(qw) + "?” at temperature " + T.toFixed(1) + " · " + distinct.size + " different answer" + (distinct.size === 1 ? "" : "s") }),
          list), out.firstChild);
        if (T <= 0.2) didLow = true;
        if (T >= 1.2) didHigh = true;
        updChecklist();
        if (didLow && didHigh && !checkBox.firstChild) checks();
      });

      /* ---- Step 3: check yourself ---- */
      function checks() {
        var box = h("section", { class: "card stack" }, h("div", { class: "kicker", text: "Step 3 · Check yourself" }));
        var right = 0;
        var q1 = {
          q: "A friend asks a chatbot the same question twice and gets two differently worded answers. What's the most likely reason?",
          options: ["The chatbot is broken", "Temperature: it rolled the dice differently each time", "Someone retrained the chatbot in between"],
          answer: 1,
          explain: "Rolling the weighted dice picks different words on different runs. That's expected. If the answer matters, compare the answers and check the facts."
        };
        var q2 = {
          q: "You want the same, predictable wording every time. Which temperature would you choose, if the tool lets you?",
          options: ["Low temperature", "High temperature"],
          answer: 0,
          explain: "Low temperature gives consistent, repeatable output. High temperature trades consistency for variety."
        };
        box.appendChild(ui.mcq(q1, function (i, ok) {
          if (ok) right++;
          box.appendChild(ui.mcq(q2, function (j, ok2) {
            if (ok2) right++;
            points = 20 + right * 10;
            var fin = h("button", { class: "btn primary", type: "button", text: "Finish level" });
            fin.addEventListener("click", function () {
              if (fin.disabled) return;
              fin.disabled = true;
              done({ stars: right === 2 ? 3 : right === 1 ? 2 : 1, points: points, summary: "Check questions: " + right + " of 2 right." });
            });
            box.appendChild(h("div", { class: "row end" }, fin));
          }));
        }));
        checkBox.appendChild(box);
        box.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
})();
