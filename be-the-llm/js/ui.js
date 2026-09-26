/* Be the LLM — shared UI helpers, saved progress, and the guessing-round component. */
(function () {
  "use strict";
  var BTL = window.BTL = window.BTL || {};
  var M = BTL.Model;

  /* ---------- tiny DOM helper (text is always set with textContent) ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
        else if (k === "style") el.setAttribute("style", v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  /* ---------- URL flags ---------- */
  var params = new URLSearchParams(location.search);
  var flags = {
    teacher: params.get("teacher") === "1",
    classMode: params.get("mode") === "class"
  };

  /* ---------- saved progress (localStorage may be missing or blocked) ---------- */
  var KEY = "be-the-llm-v2"; // v2 = 7-level version; old v1 saves are ignored
  function blankState() {
    return { v: 2, levels: {}, hvm: {}, l1Used: [], nickname: "", classCode: "" };
  }
  var state = blankState();
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.v === 2) state = Object.assign(blankState(), parsed);
    }
  } catch (e) { /* private window or blocked storage: play without saving */ }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function reset() {
    state = blankState();
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- random helpers ---------- */
  var rng = Math.random;
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(arr, n) { return shuffle(arr).slice(0, n); }

  /* ---------- small components ---------- */
  function starsEl(n, max) {
    max = max || 3;
    var s = h("span", { class: "stars", "aria-label": n + " of " + max + " stars" });
    for (var i = 0; i < max; i++) s.appendChild(h("span", { class: i < n ? "" : "off", text: "★" }));
    return s;
  }

  function pct(p) {
    if (p > 0 && p < 0.005) return "<1%";
    return Math.round(p * 100) + "%";
  }

  /*
   * Probability bars. dist = [{word, count, p}] sorted by p.
   * opts: top (default 8), highlight (word), hit (word), rolled (word), showCount (bool)
   * Words beyond `top` are folded into one "other words" row.
   */
  function barsEl(dist, opts) {
    opts = opts || {};
    var top = opts.top || 8;
    var shown = dist.slice(0, top);
    var rest = dist.slice(top);
    // One scale for every row drawn, including the folded "other words" row, so bar lengths stay comparable.
    var restP = rest.reduce(function (a, b) { return a + b.p; }, 0);
    var maxP = dist.length ? Math.max.apply(null, shown.map(function (d) { return d.p; }).concat([restP])) : 1;
    var wrap = h("div", { class: "bars", role: "list" });
    function row(label, p, count, cls) {
      var v = pct(p) + (opts.showCount && count !== null ? " (" + count + ")" : "");
      return h("div", { class: "bar-row " + (cls || ""), role: "listitem", title: label + ": " + v },
        h("span", { class: "w", text: label }),
        h("span", { class: "track" }, h("span", { class: "fill", style: "width:" + (maxP ? (p / maxP) * 100 : 0) + "%" })),
        h("span", { class: "v", text: v }));
    }
    shown.forEach(function (d) {
      var cls = [];
      if (opts.highlight === d.word) cls.push("hl");
      if (opts.hit === d.word) cls.push("hit");
      if (opts.rolled === d.word) cls.push("rolled");
      wrap.appendChild(row(M.displayWord(d.word), d.p, d.count, cls.join(" ")));
    });
    if (rest.length) {
      var p = rest.reduce(function (a, b) { return a + b.p; }, 0);
      var c = rest.reduce(function (a, b) { return a + b.count; }, 0);
      wrap.appendChild(row(rest.length + " other words", p, c, "other"));
    }
    if (!dist.length) wrap.appendChild(h("p", { class: "muted small", text: "Never seen in training — no data." }));
    return wrap;
  }

  function miniBar(p) {
    return h("span", { class: "mini-track" }, h("span", { style: "width:" + Math.max(2, p * 100) + "%" }));
  }

  function sentenceEl(prefixWords, blankText) {
    var s = h("div", { class: "sentence" });
    var shown = M.displaySentence(prefixWords);
    s.appendChild(document.createTextNode(shown + " "));
    s.appendChild(h("span", { class: "blank", text: blankText || "?" }));
    return s;
  }

  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector(".toast");
    if (old) old.remove();
    var t = h("div", { class: "toast", role: "status", text: msg });
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.remove(); }, 2600);
  }

  /*
   * Multiple-choice check question.
   * q = { q, options:[...], answer: index or null, explain }
   * onDone(pickedIndex, correct)
   */
  function mcq(q, onDone, opts) {
    opts = opts || {};
    var box = h("div", { class: "stack" });
    box.appendChild(h("p", { style: "font-weight:600", text: q.q }));
    var list = h("div");
    var fb = h("p", { class: "feedback", "aria-live": "polite" });
    var buttons = q.options.map(function (o, i) {
      var b = h("button", { class: "opt", type: "button" }, h("span", { text: String.fromCharCode(65 + i) + "." }), h("span", { text: o }));
      b.addEventListener("click", function () {
        buttons.forEach(function (x) { x.disabled = true; });
        var correct = q.answer === null || q.answer === undefined ? null : i === q.answer;
        if (opts.reveal !== false && correct !== null) {
          b.classList.add(correct ? "correct" : "wrong");
          if (!correct) buttons[q.answer].classList.add("correct");
          fb.className = "feedback " + (correct ? "good" : "bad");
          fb.textContent = (correct ? "✓ Right. " : "✗ Not quite. ") + (q.explain || "");
        } else {
          b.classList.add("picked");
          fb.textContent = opts.lockedText || "Locked in. You'll find out at the end of the level.";
          fb.className = "feedback muted";
        }
        onDone(i, correct);
      });
      list.appendChild(b);
      return b;
    });
    box.appendChild(list);
    box.appendChild(fb);
    return box;
  }

  /*
   * Guessing rounds, shared by Levels 1 and 3.
   * cfg.items: [{prefix:[words], answer:word, choices:[{word, p?}], modelPick:word}]
   * cfg.showProbs: show the model's % on each choice
   * cfg.onDone({correct, modelCorrect, n, points, log:[...]})
   */
  function guessRounds(container, cfg) {
    var i = 0, correct = 0, modelCorrect = 0, streak = 0, points = 0, log = [];
    var card = h("div", { class: "card stack" });
    container.appendChild(card);

    function render() {
      clear(card);
      var it = cfg.items[i];
      card.appendChild(h("div", { class: "row" },
        h("span", { class: "muted small", text: "Round " + (i + 1) + " of " + cfg.items.length }),
        h("span", { class: "spacer", style: "flex:1" }),
        h("span", { class: "muted small", text: "Your hits: " + correct + (streak >= 2 ? "  ·  streak " + streak : "") })));
      var bar = h("div", { class: "progress" }, h("i", { style: "width:" + (i / cfg.items.length) * 100 + "%" }));
      card.appendChild(bar);
      if (cfg.intro) card.appendChild(h("p", { class: "muted", text: cfg.intro }));
      var sent = sentenceEl(it.prefix);
      sent.setAttribute("tabindex", "-1");
      sent.setAttribute("data-focus", "");
      sent.setAttribute("aria-label", "Round " + (i + 1) + ": " + M.displaySentence(it.prefix) + ", blank");
      card.appendChild(sent);
      var grid = h("div", { class: "choices" });
      var fb = h("p", { class: "feedback", "aria-live": "polite" });
      var picked = null;
      var revealBtn = h("button", { class: "btn primary hidden", type: "button", text: "Reveal the answer" });
      var nextBtn = h("button", { class: "btn primary hidden", type: "button", text: i + 1 < cfg.items.length ? "Next round" : "See results" });

      var btns = it.choices.map(function (c) {
        var inner = [h("span", { text: M.displayWord(c.word) })];
        if (cfg.showProbs) {
          inner.push(h("span", { class: "tag", text: "model: " + pct(c.p) }));
          inner.push(miniBar(c.p));
        }
        var b = h("button", { class: "choice", type: "button", "data-word": c.word }, inner);
        b.addEventListener("click", function () {
          if (b.disabled) return;
          picked = c.word;
          btns.forEach(function (x) { x.classList.toggle("picked", x === b); });
          if (flags.classMode) { revealBtn.classList.remove("hidden"); }
          else reveal();
        });
        grid.appendChild(b);
        return b;
      });

      function reveal() {
        btns.forEach(function (x) { x.disabled = true; });
        revealBtn.classList.add("hidden");
        var ok = picked === it.answer;
        var mok = it.modelPick === it.answer;
        if (ok) { correct++; streak++; points += 10 + (streak >= 3 ? 5 : 0); } else streak = 0;
        if (mok) modelCorrect++;
        log.push({ prefix: it.prefix.join(" "), answer: it.answer, you: picked, model: it.modelPick });
        btns.forEach(function (x) {
          var w = x.getAttribute("data-word");
          if (w === it.answer) x.classList.add("correct");
          else if (w === picked) x.classList.add("wrong");
          if (w === it.modelPick) x.appendChild(h("span", { class: "tag", text: "▲ the model's pick" }));
        });
        clear(sent);
        sent.appendChild(document.createTextNode(M.displaySentence(it.prefix) + " "));
        sent.appendChild(h("span", { class: "blank", text: M.displayWord(it.answer) }));
        if (it.rest && it.rest.length) sent.appendChild(h("span", { class: "dim", text: " " + it.rest.join(" ") }));
        fb.className = "feedback " + (ok ? "good" : "bad");
        fb.textContent = (ok ? "✓ Match! The real text said “" : "✗ The real text said “") + M.displayWord(it.answer) + "”.";
        if (cfg.showProbs && it.tie) {
          fb.appendChild(h("span", { class: "tie-note", text: " ⚖️ Tie at the top: " + (function (l) { return l.length > 1 ? l.slice(0, -1).join(", ") + " and " + l[l.length - 1] : l[0]; })(it.tie.map(function (x) { return "“" + M.displayWord(x) + "”"; })) +
            " were seen equally often. This model then takes the one it saw first right after that word in its training text: “" + M.displayWord(it.modelPick) + "”." }));
        }
        nextBtn.classList.remove("hidden");
        nextBtn.focus();
      }
      revealBtn.addEventListener("click", function () { if (picked) reveal(); });
      nextBtn.addEventListener("click", function () {
        if (nextBtn.disabled) return;
        nextBtn.disabled = true; // guard against double clicks
        i++;
        if (i < cfg.items.length) render();
        else cfg.onDone({ correct: correct, modelCorrect: modelCorrect, n: cfg.items.length, points: points, log: log });
      });

      card.appendChild(grid);
      card.appendChild(fb);
      card.appendChild(h("div", { class: "row end" }, revealBtn, nextBtn));
      if (flags.classMode) card.appendChild(h("p", { class: "muted small", text: "Class mode: take a hand vote, click the class's choice, then reveal." }));
      if (i > 0) sent.focus({ preventScroll: true }); // keep keyboard users in the game after "Next round"
    }
    render();
  }

  /* Human-vs-Model scoreboard */
  function hvmEl(res, note) {
    return h("div", { class: "card stack" },
      h("h3", { text: "Human vs Model" }),
      h("div", { class: "hvm" },
        h("div", { class: "card soft" }, h("div", { class: "who", text: "You" }), h("div", { class: "score", text: res.correct + "/" + res.n })),
        h("div", { class: "card soft" }, h("div", { class: "who", text: "The counting model" }), h("div", { class: "score", text: res.modelCorrect + "/" + res.n }))),
      note ? h("p", { class: "muted", text: note }) : null,
      h("details", {},
        h("summary", { text: "Round by round" }),
        h("div", { class: "table-wrap" }, h("table", {},
          h("thead", {}, h("tr", {}, h("th", { text: "Text so far" }), h("th", { text: "Real" }), h("th", { text: "You" }), h("th", { text: "Model" }))),
          h("tbody", {}, res.log.map(function (r) {
            return h("tr", {},
              h("td", { text: M.displaySentence(r.prefix.split(" ")) + " ___" }),
              h("td", { text: M.displayWord(r.answer) }),
              h("td", { text: (r.you === r.answer ? "✓ " : "✗ ") + M.displayWord(r.you) }),
              h("td", { text: (r.model === r.answer ? "✓ " : "✗ ") + M.displayWord(r.model) }));
          }))))));
  }

  /*
   * Build a guessing item from a test sentence.
   * mode "blind": 3 distractors = other words the model saw after the previous word (if any), then random words.
   * mode "probs": the real answer + the model's top word + 2 other words it has seen here (0% padding if needed).
   * The model's pick = the choice with the highest probability after the previous word.
   */
  var NOT_ALONE = ["chiang", "mai"]; // halves of a two-word name: never offered as a random distractor
  function makeItem(model, test, mode, vocab, opts) {
    var w = M.tokenize(test.s);
    var prefix = w.slice(0, test.k), answer = w[test.k];
    var dist = model.next(prefix, 1);
    var pOf = {};
    dist.forEach(function (d) { pOf[d.word] = d.p; });
    var choices;
    var followers = dist.map(function (d) { return d.word; }).filter(function (x) { return x !== answer && x !== M.END; });
    var fill = shuffle(vocab.filter(function (x) {
      return x !== answer && followers.indexOf(x) < 0 && prefix.indexOf(x) < 0 && NOT_ALONE.indexOf(x) < 0;
    }));
    var others;
    if (mode === "probs" && opts && opts.showTie) {
      // A tie round: the two words that share the top count are both on screen (the answer may be one of them).
      var top2 = dist.filter(function (d) { return d.word !== M.END; }).slice(0, 2).map(function (d) { return d.word; }).filter(function (x) { return x !== answer; });
      others = top2.concat(shuffle(followers.filter(function (x) { return top2.indexOf(x) < 0; }))).slice(0, 3);
      while (others.length < 3) others.push(fill.pop());
    } else if (mode === "probs") {
      // The model's favourite is always on screen (so its pick is visible), plus other words it has
      // seen here drawn from anywhere in its list, so the answer's position doesn't give it away.
      others = followers.slice(0, 1).concat(shuffle(followers.slice(1)).slice(0, 2));
      // Fewer than 3 other words ever followed? Pad with words the model never saw here (0%).
      while (others.length < 3) others.push(fill.pop());
    } else {
      others = shuffle(followers).slice(0, 2);
      while (others.length < 3) others.push(fill.pop());
    }
    choices = [answer].concat(others);
    choices = shuffle(choices).map(function (x) { return { word: x, p: pOf[x] || 0 }; });
    var modelPick = choices.slice().sort(function (a, b) { return b.p - a.p; })[0].word;
    // tie-break: if several choices share the top probability, prefer the one first seen in training
    var bestP = pOf[modelPick] || 0;
    for (var d = 0; d < dist.length; d++) {
      if (dist[d].p === bestP && choices.some(function (c) { return c.word === dist[d].word; })) { modelPick = dist[d].word; break; }
    }
    // Tie: another shown choice has exactly the same top chance. This model then takes the word it saw first.
    var tiedWith = choices.filter(function (c) { return c.word !== modelPick && bestP > 0 && c.p === bestP; }).map(function (c) { return c.word; });
    return { prefix: prefix, answer: answer, rest: w.slice(test.k + 1), choices: choices, modelPick: modelPick, tie: tiedWith.length ? [modelPick].concat(tiedWith) : null };
  }

  /* ---------- chat helpers (Levels 4, 5, 7) ---------- */
  function bubbleQ(words) {
    return h("div", { class: "bubble q" }, h("span", { class: "who", text: "You" }), M.displaySentence(words) + "?");
  }
  function bubbleA(words, opts) {
    opts = opts || {};
    var who = opts.who || "Model";
    if (!words || !words.length) return h("div", { class: "bubble a empty" }, h("span", { class: "who", text: who }), opts.emptyText || "(nothing)");
    return h("div", { class: "bubble a" }, h("span", { class: "who", text: who }), M.displaySentence(words) + (opts.finished === false ? " \u2026" : "."));
  }
  /* Words as little tiles. opts.newFrom: index where "new" (generated) words start; opts.unknown: Set of unknown words */
  function tokenStrip(words, opts) {
    opts = opts || {};
    var box = h("div", { class: "tokens" });
    words.forEach(function (w, i) {
      var cls = "tok";
      if (w === M.Q || w === M.A) cls += " mark";
      else if (opts.newFrom !== undefined && i >= opts.newFrom) cls += " new";
      if (opts.unknown && opts.unknown.has(w)) cls += " unknown";
      box.appendChild(h("span", { class: cls, text: M.displayWord(w) }));
    });
    return box;
  }
  /* Question buttons. onPick(questionString, button) */
  function questionButtons(list, onPick) {
    var wrap = h("div", { class: "qbtns", role: "group", "aria-label": "questions" });
    var btns = list.map(function (q) {
      var b = h("button", { class: "qbtn", type: "button", "aria-pressed": "false", text: M.displaySentence(M.tokenize(q)) + "?" });
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        onPick(q, b);
      });
      wrap.appendChild(b);
      return b;
    });
    wrap.buttons = btns;
    return wrap;
  }
  /* "Type your own question" box. onAsk(words, unknownWords[]) */
  function ownQuestionBox(vocab, onAsk) {
    var inp = h("input", { class: "text-input", type: "text", maxlength: "80", placeholder: "e.g. what time does the bank open", "aria-label": "your own question" });
    var btn = h("button", { class: "btn", type: "button", text: "Ask" });
    function go() {
      var words = M.tokenize(inp.value);
      if (!words.length) { toast("Type a question first."); inp.focus(); return; }
      var unknown = words.filter(function (w) { return !vocab.has(w); });
      onAsk(words, unknown);
    }
    btn.addEventListener("click", go);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    return h("div", { class: "stack" },
      h("p", { class: "small muted", text: "Or type your own question (English, simple words; the model only knows about " + Array.from(vocab).filter(function (w) { return w !== M.Q && w !== M.A; }).length + " words):" }),
      h("div", { class: "row" }, h("div", { style: "flex:1;min-width:180px" }, inp), btn));
  }

  BTL.ui = {
    h: h, clear: clear, flags: flags, save: save, reset: reset,
    shuffle: shuffle, pick: pick, starsEl: starsEl, pct: pct, barsEl: barsEl,
    sentenceEl: sentenceEl, miniBar: miniBar, toast: toast, mcq: mcq, guessRounds: guessRounds,
    hvmEl: hvmEl, makeItem: makeItem,
    bubbleQ: bubbleQ, bubbleA: bubbleA, tokenStrip: tokenStrip, questionButtons: questionButtons, ownQuestionBox: ownQuestionBox
  };
  // BTL.state always points at the current progress object (reset() swaps it).
  Object.defineProperty(BTL, "state", { get: function () { return state; }, set: function (v) { state = v; }, configurable: true });
})();

/* Tell the master page (../index.html) this game is finished. Same browser storage, shared key. */
(function () {
  var NS = window.BTL = window.BTL || {};
  NS.markSiteDone = function () {
    try {
      var k = "ai-games-done", d = JSON.parse(localStorage.getItem(k) || "{}") || {};
      if (!d["llm"]) { d["llm"] = Date.now(); localStorage.setItem(k, JSON.stringify(d)); }
    } catch (e) { /* storage blocked: the tick just won't show */ }
  };
})();
