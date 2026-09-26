/*
 * Guess the Chatbot — a no-score warm-up before Be the LLM. Every reply shown is a real, recorded reply
 * (data.js, checked against pregames/data/raw/llm-runs.json by tests/check-pregames.js).
 */
(function () {
  "use strict";
  var V = window.VIS, h = V.h, D = window.PG_LLM;
  var app = document.getElementById("app");
  var STOP = ["the", "a", "an", "and", "to", "with", "some", "i", "you", "it", "is", "of", "in", "into", "out", "before", "what", "that", "my", "me", "your", "at", "on", "for", "when", "even", "its", "it's", "s", "something", "good", "just", "do"];

  function clear() { while (app.firstChild) app.removeChild(app.firstChild); window.scrollTo(0, 0); }
  function progress(n) { var p = h("div", { class: "pg-progress", "aria-label": "part " + n + " of 4" }); for (var i = 1; i <= 4; i++) p.appendChild(h("span", { class: i <= n ? "on" : "" })); return p; }
  function btn(text, cls, fn) { var b = h("button", { class: "btn " + (cls || ""), type: "button", text: text }); b.addEventListener("click", fn); return b; }
  function words(t) { return String(t).toLowerCase().replace(/[“”"…]/g, " ").split(/[^a-z']+/).filter(Boolean); }

  /* Reply bubble; optional keyword gets highlighted */
  function reply(text, n, mark) {
    var el = h("div", { class: "pg-reply" + (mark && text.toLowerCase().indexOf(mark) >= 0 ? " hit" : "") }, h("span", { class: "run", text: "Run " + n }));
    if (mark) {
      var low = text.toLowerCase(), i = 0, j;
      while ((j = low.indexOf(mark, i)) >= 0) { el.appendChild(document.createTextNode(text.slice(i, j))); el.appendChild(h("mark", { text: text.slice(j, j + mark.length) })); i = j + mark.length; }
      el.appendChild(document.createTextNode(text.slice(i)));
    } else el.appendChild(document.createTextNode(text));
    return el;
  }
  /* Words that show up in 3 or more of the 5 replies (not counting the sentence start) */
  function common(replies, start) {
    var skip = words(start), count = {};
    replies.forEach(function (r) { var seen = {}; words(r).forEach(function (w) { if (STOP.indexOf(w) < 0 && skip.indexOf(w) < 0 && !seen[w]) { seen[w] = 1; count[w] = (count[w] || 0) + 1; } }); });
    return Object.keys(count).filter(function (w) { return count[w] >= 3; }).sort(function (a, b) { return count[b] - count[a]; }).map(function (w) { return [w, count[w]]; });
  }

  /* ---------- intro ---------- */
  function intro() {
    clear();
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Game 1 · warm-up before Be the LLM" }),
      h("h1", { text: "Guess the Chatbot" }),
      h("p", { class: "goal-line", text: "Before you learn how a chatbot works, see if you can predict one. Every reply here is real: we asked a real AI chatbot the same things several times and saved exactly what it wrote." }),
      V.cards([
        { icon: "✍️", title: "1 · Finish the sentence", text: "Guess how the chatbot ends a sentence." },
        { icon: "🔁", title: "2 · Same question, 5 times", text: "Does it say the same thing every time?" },
        { icon: "🕵️", title: "3 · The made-up thing", text: "What does it do when we ask about something that doesn't exist?" }
      ], { cols: 3 }),
      h("p", { class: "muted small", text: "No score, no typing. About 5 minutes." }),
      h("div", { class: "row end" }, btn("Start →", "primary", function () { sentence(0); }))));
  }

  /* ---------- round 1: finish the sentence ---------- */
  function sentence(k) {
    clear();
    var S = D.sentences[k];
    var card = h("section", { class: "card stack" },
      progress(1),
      h("div", { class: "kicker", text: "Round 1 · Finish the sentence (" + (k + 1) + " of " + D.sentences.length + ")" }),
      h("p", { text: "We asked the chatbot to finish this sentence. What do you think it wrote?" }),
      h("div", { class: "pg-prompt" }, S.start + " ", h("span", { class: "blank", text: "?" })));
    var out = h("div", { class: "stack" });
    var grid = h("div", { class: "choices", role: "group", "aria-label": "your guess" });
    S.guesses.forEach(function (g) {
      var b = h("button", { class: "choice", type: "button", text: "… " + g.label });
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(grid.children, function (x) { x.disabled = true; });
        b.classList.add("picked");
        reveal(g);
      });
      grid.appendChild(b);
    });
    card.appendChild(grid); card.appendChild(out);
    app.appendChild(card);

    function reveal(g) {
      var hits = S.replies.filter(function (r) { return r.toLowerCase().indexOf(g.match) >= 0; }).length;
      out.appendChild(h("div", { class: "feedback " + (hits ? "good" : "bad"), text: "Your guess (“" + g.label + "”) showed up in " + hits + " of " + S.replies.length + " real runs." }));
      out.appendChild(h("div", { class: "pg-replies" }, S.replies.map(function (r, i) { return reply(r, i + 1, g.match); })));
      var c = common(S.replies, S.start);
      if (c.length) out.appendChild(h("div", { class: "stack" }, h("div", { class: "small muted", text: "Words that came up in 3 or more of the 5 runs:" }),
        h("div", { class: "pg-stat" }, c.map(function (x) { return h("span", { class: "v-chip" }, x[0], h("b", { text: "×" + x[1] })); }))));
      out.appendChild(h("div", { class: "v-card accent" }, h("div", { class: "v-card-title", text: "🤔 Notice" }),
        h("p", { text: "The endings are very alike, but not all the same, even though the question never changed. Keep that in mind." })));
      out.appendChild(h("div", { class: "row end" }, btn(k + 1 < D.sentences.length ? "Next sentence →" : "Round 2 →", "primary", function () { if (k + 1 < D.sentences.length) sentence(k + 1); else same(); })));
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------- round 2: same question, 5 times ---------- */
  function same() {
    clear();
    var Q = D.same;
    var card = h("section", { class: "card stack" },
      progress(2),
      h("div", { class: "kicker", text: "Round 2 · Same question, 5 times" }),
      h("p", { text: "We asked exactly this, word for word, in 5 separate chats:" }),
      h("div", { class: "pg-prompt", text: "“" + Q.prompt + "”" }),
      h("p", { style: "font-weight:600", text: "How many different names do you think it gave?" }));
    var grid = h("div", { class: "choices", role: "group", "aria-label": "your guess" });
    var out = h("div", { class: "stack" }), guess = null;
    [[1, 1, "Just 1 (the same every time)"], [2, 3, "2 or 3"], [4, 5, "4 or 5"]].forEach(function (o) {
      var b = h("button", { class: "choice", type: "button", text: o[2] });
      b.addEventListener("click", function () { guess = o; Array.prototype.forEach.call(grid.children, function (x) { x.disabled = true; }); b.classList.add("picked"); cards(); });
      grid.appendChild(b);
    });
    card.appendChild(grid); card.appendChild(out); app.appendChild(card);

    function cards() {
      out.appendChild(h("p", { class: "small muted", text: "Tap each chat to open it." }));
      var list = h("div", { class: "pg-replies" });
      var opened = 0;
      Q.replies.forEach(function (r, i) {
        var hid = h("button", { class: "pg-hidden-reply", type: "button", text: "💬 Chat " + (i + 1) });
        hid.addEventListener("click", function () {
          list.replaceChild(reply(r, i + 1), hid);
          opened++;
          if (opened === Q.replies.length) done();
        });
        list.appendChild(hid);
      });
      out.appendChild(list);
      var all = btn("Open all", "", function () { Array.prototype.slice.call(list.querySelectorAll(".pg-hidden-reply")).forEach(function (b) { b.click(); }); all.disabled = true; });
      out.appendChild(h("div", { class: "row" }, all));
    }
    function done() {
      var distinct = Q.names.filter(function (n, i) { return Q.names.indexOf(n) === i; });
      var right = guess && distinct.length >= guess[0] && distinct.length <= guess[1];
      out.appendChild(h("div", { class: "feedback " + (right ? "good" : "bad"), text: (right ? "✓ " : "") + "You guessed “" + guess[2] + "”. It gave " + distinct.length + " different names." }));
      out.appendChild(h("div", { class: "pg-stat" }, distinct.map(function (n) {
        var c = Q.names.filter(function (x) { return x === n; }).length;
        return h("span", { class: "v-chip" }, n, c > 1 ? h("b", { text: "×" + c }) : null);
      })));
      out.appendChild(h("div", { class: "v-card accent" }, h("div", { class: "v-card-title", text: "🤔 Notice" }),
        h("p", { text: distinct.length + " different names from " + Q.names.length + " identical questions. Same chatbot, same words in, different answers out." })));
      out.appendChild(h("div", { class: "row end" }, btn("Round 3 →", "primary", madeup)));
    }
  }

  /* ---------- round 3: the made-up thing ---------- */
  function madeup() {
    clear();
    var M = D.madeup;
    var card = h("section", { class: "card stack" },
      progress(3),
      h("div", { class: "kicker", text: "Round 3 · The made-up thing" }),
      h("p", { text: "There is no “Zentrovia Cup”. We invented it. We asked:" }),
      h("div", { class: "pg-prompt", text: "“" + M.prompt + "”" }),
      h("p", { style: "font-weight:600", text: "What do you think the chatbot did?" }));
    var grid = h("div", { class: "choices", role: "group", "aria-label": "your guess" });
    var out = h("div", { class: "stack" });
    [["Made up a winner and a time"], ["Said it doesn't know"], ["Sometimes one, sometimes the other"]].forEach(function (o) {
      var b = h("button", { class: "choice", type: "button", text: o[0] });
      b.addEventListener("click", function () { Array.prototype.forEach.call(grid.children, function (x) { x.disabled = true; }); b.classList.add("picked"); show(); });
      grid.appendChild(b);
    });
    card.appendChild(grid); card.appendChild(out); app.appendChild(card);
    function show() {
      out.appendChild(h("div", { class: "pg-replies" }, M.replies.map(function (r, i) { return reply(r, i + 1); })));
      out.appendChild(h("div", { class: "v-card accent" }, h("div", { class: "v-card-title", text: "🤔 Notice" }),
        h("p", { text: "In all " + M.replies.length + " of our runs it said it had no record of this race and gave no winner (3 of the 5 also said outright that they wouldn't invent one). Good!" }),
        h("p", { text: "Don't count on that every time, with every chatbot and every question: chatbots can still give confident answers that are wrong. In Be the LLM you'll see where such answers come from." })));
      out.appendChild(h("div", { class: "row end" }, btn("Last step →", "primary", finale)));
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------- finale: mystery questions ---------- */
  function finale() {
    clear();
    try { var k = "ai-games-done", d = JSON.parse(localStorage.getItem(k) || "{}") || {}; if (!d["pre-llm"]) { d["pre-llm"] = Date.now(); localStorage.setItem(k, JSON.stringify(d)); } } catch (e) { /* storage blocked */ }
    app.appendChild(h("section", { class: "card stack" },
      progress(4),
      h("div", { class: "kicker", text: "Three mysteries" }),
      h("h2", { text: "You've seen what a chatbot does. Now: how?" }),
      h("div", { class: "pg-mystery" }, [
        ["❓", "How does it choose the next words?", "Be the LLM, Levels 1–3"],
        ["🎲", "Why did 5 identical questions get different answers?", "Be the LLM, Level 5"],
        ["🕵️", "When does a chatbot make things up, and why does it sound so sure?", "Be the LLM, Levels 4 and 7"]
      ].map(function (m) { return h("div", { class: "v-card" }, h("span", { class: "v-card-icon sm", "aria-hidden": "true", text: m[0] }), h("div", {}, h("div", { class: "q", text: m[1] }), h("div", { class: "small muted", text: "Find out in " + m[2] }))); })),
      h("div", { class: "row end" }, h("a", { class: "btn", href: "../index.html", text: "All games" }), h("a", { class: "btn primary", href: "../be-the-llm/index.html", text: "Play Be the LLM →" })),
      h("p", { class: "pg-foot", text: "About these replies: recorded on " + D.recorded + " (UTC) from the Claude model “" + D.model + "”. Each reply came from a fresh chat with no memory of the others, run inside an AI agent tool and told to answer as in a normal chat, without tools. Replies are shown exactly as the model wrote them. Other chatbots, or the same one on another day, may answer differently." })));
  }

  intro();
})();
