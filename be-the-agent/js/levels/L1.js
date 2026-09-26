/* Level 1 — The desk: context window, tokens, forgetting, no memory between chats. */
(function () {
  "use strict";
  var BTA = window.BTA = window.BTA || {};
  BTA.levels = BTA.levels || [];

  BTA.levels.push({
    id: "L1", num: 1,
    name: "The desk",
    desc: "Why a chatbot forgets things, even your name.",
    goal: "Everything the model can use has to be on its “desk”. You'll watch the desk fill up during a chat, see what falls off, and find out what happens when you start a new chat.",
    intro: [
      { title: "The model only sees what's on its desk.", text: "Every time it writes a reply, the app puts text in front of it: some instructions, your conversation, any files. That text is all it has. This desk is called the context window." },
      { title: "The desk has a size limit, measured in tokens.", text: "A token is a small piece of text. In English, one token is roughly three-quarters of a word, so 100 words is about 130 tokens.", ex: "“Welcome to Moonbean Café”  ≈ 4 words ≈ 6 tokens" },
      { title: "Your job:", text: "you are the app, the program around the model (people who build these call it the harness). Put things on the desk, keep the chat going, and see what the model can and can't answer. Our toy desk holds " + (((window.BTA_CONFIG || {}).DESK_TOKENS) || 200) + " tokens; real chatbots hold far more, but the idea is the same." }
    ],
    recap: {
      title: "No desk, no memory",
      text: [
        "The model has no memory of its own between replies. Each time, the app lays the conversation out on the desk again, and the model reads it from the top. When the desk is full, many apps drop the oldest messages or shorten them into a summary (others tell you the chat is too long), so an early detail, like your name, can vanish.",
        "A new chat starts with an almost empty desk: the model has no idea what you said in another chat. A “memory” feature, where an app offers one, doesn't change the model. The app saves notes (some apps also look up your past chats) and pastes what's relevant onto the desk of a new chat. You can usually view and delete what it has saved.",
        "Real context windows are much bigger than our toy desk, big enough for long documents, but they still fill up in a very long chat or with many large files. Tip: in a long chat, repeat the key facts near your question, or start a fresh chat with a short summary."
      ],
      words: [["Context window", "The model's desk: all the text it can see when writing a reply."], ["Token", "A small piece of text the model reads and writes. In English, about ¾ of a word."], ["System prompt", "Instructions the app puts on the desk before your first message. You usually don't see them."]]
    },
    run: function (container, done) {
      var ui = BTA.ui, h = ui.h, w = BTA.w, D = window.BTA_DATA;
      var CFG = window.BTA_CONFIG || {};
      var desk = new w.Desk({ capacity: CFG.DESK_TOKENS || 200 });
      var points = 0, quizRight = 0;

      /* ---- Step 1: start a chat ---- */
      var s1 = h("section", { class: "card stack" },
        h("div", { class: "row" }, w.roleTag("harness")),
        h("div", { class: "kicker", text: "Step 1 of 4 · Start a chat" }),
        h("p", { text: "When a chat starts, the app first puts its own instructions on the desk. This is called the system prompt. You don't normally see it, but the model does." }));
      s1.appendChild(desk.el);
      var chatBox = h("div", { class: "chat" });
      var s1btn = w.onceBtn("Start the chat (put the system prompt on the desk)", function () {
        desk.add({ id: "sys", kind: "system", label: "system prompt", text: D.systemNote, pinned: true });
        step2();
      });
      s1.appendChild(h("div", { class: "row end" }, s1btn));
      container.appendChild(s1);

      /* ---- Step 2: chat until the desk overflows ---- */
      function step2() {
        s1btn.parentNode.classList.add("hidden");
        var s2 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Step 2 of 4 · Keep chatting" }),
          h("p", { text: "Press \u201cNext message\u201d to play the chat. Each message, yours and the model's, goes onto the desk. Watch the meter. When the desk is full, this app pushes the oldest messages off (the system prompt is pinned, so it stays)." }));
        var nextBtn = h("button", { class: "btn primary", type: "button", text: "Next message" });
        var note = h("p", { class: "feedback", "aria-live": "polite" });
        s2.appendChild(desk.el); // move the desk here so it stays next to the chat
        s2.appendChild(note);
        s2.appendChild(h("div", { class: "row end" }, nextBtn));
        s2.appendChild(h("p", { class: "small", style: "margin:0" }, h("b", { text: "Your chat screen" }), " (you still see every message; the model sees only what's on the desk above):"));
        s2.appendChild(chatBox);
        container.appendChild(s2);
        var i = 0;
        nextBtn.addEventListener("click", function () {
          if (nextBtn.disabled) return;
          var m = D.chat[i];
          chatBox.appendChild(w.bubble(m.who, m.text));
          var dropped = desk.add({ id: "m" + i, kind: "chat", label: m.who === "you" ? "you" : "model", text: m.text });
          if (dropped.length) {
            note.className = "feedback bad";
            note.textContent = "The desk was full, so the oldest message" + (dropped.length > 1 ? "s" : "") + " fell off. " + desk.fallen.length + " message" + (desk.fallen.length > 1 ? "s have" : " has") + " fallen off so far: see the bottom of the desk.";
          }
          i++;
          if (i >= D.chat.length) {
            nextBtn.disabled = true;
            nextBtn.classList.add("hidden");
            askName(s2);
          }
        });
        s2.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function askName(s2) {
        var q = h("div", { class: "stack" },
          h("p", {}, h("b", { text: "Now you ask: " }), "“" + D.chatQuestion + "”"));
        var guess = ui.mcq({
          q: "Before the model answers: can it still tell you your name?",
          options: ["Yes: it was the very first thing I said", "No: that message fell off the desk"],
          answer: desk.has("m0") ? 0 : 1,
          explain: desk.has("m0") ? "Your first message is still on the desk, so it can." : "Your first message (“I'm Ploy…”) fell off the desk. The model can only use what is on the desk right now."
        }, function (idx, ok) {
          if (ok) { points += 10; quizRight++; }
          chatBox.appendChild(w.bubble("you", D.chatQuestion));
          chatBox.appendChild(w.bubble("ai", desk.has("m0")
            ? "Your name is Ploy."
            : "I'm sorry, I don't know your name. I can't see it anywhere in our conversation."));
          step3();
        });
        q.appendChild(guess);
        s2.appendChild(q);
      }

      /* ---- Step 3: a new chat ---- */
      function step3() {
        var s3 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Step 3 of 4 · Start a new chat" }),
          h("p", { text: "You close this chat and open a new one tomorrow. What does the desk look like now?" }));
        var chat3 = h("div", { class: "chat" });
        s3.appendChild(chat3);
        s3.appendChild(h("div", { class: "row end" }, w.onceBtn("Open a new chat", function () {
          desk.clear(true);
          s3.insertBefore(desk.el, chat3); // bring the desk along
          chat3.appendChild(w.bubble("you", "What did we talk about yesterday?"));
          chat3.appendChild(w.bubble("ai", "This is the start of our conversation, so I can't see any earlier chats. What would you like to talk about?"));
          chat3.appendChild(h("p", { class: "feedback", text: "Only the system prompt is on the desk. Yesterday's chat isn't there, so for the model it never happened." }));
          step4();
        })));
        container.appendChild(s3);
        s3.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      /* ---- Step 4: memory = saved notes pasted onto the desk ---- */
      function step4() {
        var s4 = h("section", { class: "card stack" },
          h("div", { class: "kicker", text: "Step 4 of 4 · Turn on “memory”" }),
          h("p", { text: "Some chatbot apps offer a memory feature. It doesn't change the model at all. The app keeps a few saved notes about you and pastes them onto the desk of every new chat." }));
        var chat4 = h("div", { class: "chat" });
        s4.appendChild(chat4);
        s4.appendChild(h("div", { class: "row end" }, w.onceBtn("Turn memory on and start a new chat", function () {
          desk.clear(true);
          s4.insertBefore(desk.el, chat4);
          desk.add({ id: "mem", kind: "memory", label: "saved notes", text: D.memoryNotes, pinned: true });
          chat4.appendChild(w.bubble("you", D.chatQuestion));
          chat4.appendChild(w.bubble("ai", "You're Ploy, the shift manager at Moonbean Café."));
          chat4.appendChild(h("p", { class: "feedback good", text: "It “remembers”, but only because the app pasted your saved notes onto the desk. Look at the yellow item." }));
          quiz(s4);
        })));
        container.appendChild(s4);
        s4.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      function quiz(box) {
        box.appendChild(ui.mcq({
          q: "A friend says: “I told the chatbot my password last week, so now it knows it forever.” What's closest to the truth?",
          options: [
            "Right: the model learns everything you tell it",
            "The model itself doesn't change. It only sees what the app puts on the desk: this chat, plus any saved memory notes",
            "Wrong: chatbots can't store anything at all"
          ],
          answer: 1,
          explain: "The model doesn't learn from your chat on the spot. But the app may keep your chat history or memory notes, the company may store conversations, and depending on the product and your settings some companies use chats to train future models. So never type passwords into a chatbot."
        }, function (i, ok) {
          if (ok) { points += 10; quizRight++; }
          var fin = w.onceBtn("Finish level", function () {
            done({ stars: 1 + quizRight, points: points + 20, summary: "You watched the desk fill up, lose a message, start empty, and get “memory” notes pasted in." });
          });
          box.appendChild(h("div", { class: "row end" }, fin));
        }));
      }
    }
  });
})();
