/*
 * LLM Arena — stage texts and how each kind of item is drawn. The items themselves come from items.js.
 */
(function () {
  "use strict";
  var A = window.ARENA, h = A.h, W = A.w, L = window.LLMA, M = L.M, D = window.LLMA_DATA;

  function worldText(world, opts) {
    opts = opts || {};
    var box = h("div", { class: "textbox", "aria-label": "training text" });
    world.text.forEach(function (line, i) {
      box.appendChild(document.createTextNode((i ? "\n" : "") + (i + 1) + "  "));
      if (!opts.mark) { box.appendChild(document.createTextNode(line)); return; }
      line.split(" ").forEach(function (w, j) {
        if (j) box.appendChild(document.createTextNode(" "));
        box.appendChild(opts.mark.indexOf(w) >= 0 ? h("span", { class: "hl", text: w }) : document.createTextNode(w));
      });
    });
    return h("div", { class: "stack" }, h("div", { class: "small muted", text: "Training text: " + world.name + " (" + world.text.length + " sentences; each ends with [end])" }), box);
  }

  function drawMcq(it, box, api) {
    if (it.world && it.prefix) {
      var sent = h("div", { class: "built" });
      it.prefix.forEach(function (w, i) {
        if (i) sent.appendChild(document.createTextNode(" "));
        var inWin = i >= it.prefix.length - it.k;
        sent.appendChild(h("span", { class: inWin ? "w" : "seed", style: inWin ? "background:var(--accent-soft);border-radius:4px;padding:0 4px" : "text-decoration:line-through", text: M.displayWord(w) }));
      });
      sent.appendChild(document.createTextNode(" ___"));
      box.appendChild(h("div", { class: "stack" }, h("div", { class: "small muted", text: "The model only sees the last " + it.k + " word" + (it.k === 1 ? "" : "s") + " (highlighted):" }), sent));
      box.appendChild(worldText(it.world));
    } else if (it.world) {
      box.appendChild(worldText(it.world));
    }
    if (it.dice) {
      box.appendChild(h("div", { class: "card soft stack" },
        h("div", { text: "Training text, after \u201c" + it.dice.ctx + "\u201d, the model counted:" }),
        h("div", { class: "counts" }, it.dice.dist.map(function (d) { return h("div", { class: "c" }, h("b", { text: d.word }), d.count + (d.count === 1 ? " time" : " times")); })),
        h("div", { class: "small muted", text: "Temperature 0: the top word only \u00b7 low temperature: the top word gets even more likely \u00b7 1: the plain counts \u00b7 high temperature: the chances even out." })));
    }
    // Chart questions: each option is a little bar chart (the model's real chances at that temperature).
    var options = it.charts ? it.options.map(function (o) {
      return { value: o.value, label: h("span", { class: "mini-chart" }, h("b", { class: "mc-letter", text: "Chart " + o.letter }),
        o.bars.map(function (b) { return h("span", { class: "mc-row" }, h("span", { class: "mc-word", text: b.word }), h("span", { class: "mc-bar" }, h("i", { style: "width:" + b.pct + "%" })), h("span", { class: "mc-pct", text: b.pct + "%" })); })) };
    }) : it.options;
    var c = W.choices(options, function (v) { api.submit(v); });
    box.appendChild(c.el);
    return { collect: c.collect, reveal: function () { c.reveal(it.key); } };
  }

  function drawNumber(it, box, api) {
    box.appendChild(worldText(it.world));
    var inp = W.inputBox({ type: "text", inputmode: "numeric", label: "count", placeholder: "e.g. 2", onSubmit: function (v) { api.submit(v); } });
    box.appendChild(inp.el);
    return { collect: inp.collect };
  }

  function drawTiles(it, box, api) {
    box.appendChild(worldText(it.world));
    box.appendChild(h("p", { class: "small muted", text: it.k === 1
      ? "Temperature 0, 1-word window: after each word, write the word that most often follows it."
      : "Temperature 0, 2-word window: look up the last two words together; if that pair never appears, use only the last word." }));
    var b = W.tileBuilder({ seed: it.seed.map(M.displayWord), tiles: it.tiles, max: it.max, onSubmit: function (words) { api.submit(words); } });
    box.appendChild(b.el);
    return { collect: b.collect, reveal: function () { b.reveal(it.key); } };
  }

  function drawChat(it, box, api) {
    box.appendChild(h("div", { class: "stack" },
      h("div", { class: "small muted", text: "The example chats this model was trained on (" + it.chat.name + "):" }),
      h("div", { class: "textbox" }, it.chat.qa.map(function (p, i) { return (i ? "\n" : "") + "Q: " + p[0] + "  A: " + p[1]; }))));
    var ans = null;
    var c = W.choices(it.options, function (v) { ans = v; ready(); });
    // allow changing the pick until Submit: rebuild picked state on each click
    Array.prototype.forEach.call(c.el.querySelectorAll(".choice"), function (b) {
      b.addEventListener("click", function () {
        ans = b.getAttribute("data-value");
        Array.prototype.forEach.call(c.el.querySelectorAll(".choice"), function (x) { x.classList.toggle("picked", x === b); });
        ready();
      });
    });
    var t = W.toggle(["Supported", "Made up"], ready);
    var sub = h("button", { class: "btn primary", type: "button", text: "Submit", disabled: true });
    function ready() { sub.disabled = !(ans && t.get()); }
    sub.addEventListener("click", function () { api.submit({ answer: ans, support: t.get() }); });
    box.appendChild(h("div", { class: "stack" },
      h("b", { text: "1. What does the model answer (temperature 0)?" }), c.el,
      h("b", { text: "2. Is that answer backed by the example chats?" }), t.el,
      h("div", { class: "row end" }, sub)));
    return {
      collect: function () { return { answer: ans, support: t.get() }; },
      reveal: function () {
        Array.prototype.forEach.call(c.el.querySelectorAll(".choice"), function (b) {
          var v = b.getAttribute("data-value");
          if (v === it.key.answer) b.classList.add("correct"); else if (v === ans) b.classList.add("wrong");
        });
        t.buttons.forEach(function (b) { if (b.textContent === it.key.support) b.style.boxShadow = "inset 0 0 0 3px var(--good)"; });
      }
    };
  }

  function drawer(it) {
    return function (box, api) {
      if (it.kind === "mcq") return drawMcq(it, box, api);
      if (it.kind === "number") return drawNumber(it, box, api);
      if (it.kind === "tiles") return drawTiles(it, box, api);
      return drawChat(it, box, api);
    };
  }
  function wrap(fn) {
    return function (rng) { return fn(D, rng).map(function (it) { it.render = drawer(it); return it; }); };
  }
  var S = L.STAGES;
  function stageFn(id) { return S.filter(function (s) { return s.id === id; })[0].make; }

  A.start({
    game: "llm",
    minutes: "35–45",
    kicker: "Game 3 \u00b7 challenge after Be the LLM",
    title: "LLM Arena",
    intro: [
      "You learned how a language model works. Now be one, against the clock. Each stage gives you a NEW little training text, so you can't rely on what you remember: you have to think like the model.",
      "The answers are checked by a real toy model running in your browser, the same kind you built in Be the LLM."
    ],
    stages: [
      { id: "count", icon: "🔢", name: "Count it", make: wrap(stageFn("count")),
        goal: "Training is counting. Read a tiny training text and answer what the model learned from it.",
        rules: ["The model counts which word comes right after each word.", "Percentage = that count \u00f7 all the counts after that word.", "The end of each line counts as a next piece called [end].", "Temperature 0 = always the top count. Ties: reading the text from the top, the word that comes right after it first wins."],
        example: "robot fixed the door\nthe robot opened the box\n\nAfter \u201crobot\u201d: fixed 1, opened 1  \u2192  fixed 50%",
        lesson: "Everything this model \u201cknows\u201d is a table of counts from its training text. Real models learn far richer patterns, but they too are trained on one task: predict the next piece of text." },
      { id: "greedy", icon: "✍️", name: "Greedy writer", make: wrap(stageFn("greedy")),
        goal: "Write the whole continuation the model produces at temperature 0, one word at a time.",
        rules: ["The model only sees the LAST word (a 1-word window).", "At each step it writes the word that most often follows it. Ties: reading from the top, the one that comes right after it first wins.", "It stops when it writes [end], or after 8 pieces.", "Part marks: you score the share of pieces you got right before your first slip."],
        example: "Seed: \u201cthe\u201d\nthe \u2192 robot \u2192 fixed \u2192 the \u2192 robot \u2192 \u2026 (a loop!)",
        lesson: "With a tiny window and no dice, the model can go round in circles. Temperature 0 always gives the same text; real chatbots add some randomness and use a far bigger window, which is why they rarely loop like this." },
      { id: "dice", icon: "🎲", name: "Dice master", make: wrap(stageFn("dice")),
        goal: "Temperature decides how the model rolls its dice. Read the charts and predict what the dial does.",
        rules: ["Temperature 1: the plain counts. % = count \u00f7 total.", "Higher temperature (like 2) flattens the chances: the bars even out.", "Lower temperature (like 0.5) sharpens them: the top word grows.", "Temperature 0: no dice, the top word gets 100%.", "No maths needed: look at the shape of the bars."],
        example: "Counts: cat 9, dog 4, fish 1\nTemperature 0.5: cat 83% \u00b7 dog 16% \u00b7 fish 1% (sharper)\nTemperature 1: cat 64% \u00b7 dog 29% \u00b7 fish 7% (the plain counts)\nTemperature 2: cat 50% \u00b7 dog 33% \u00b7 fish 17% (flatter)",
        lesson: "Low temperature makes the model predictable; high temperature makes it more varied (and more likely to pick odd words). The counts never change, only how the dice are weighted. The exact formula doesn't matter: low temperature sharpens, high temperature flattens." },
      { id: "keyhole", icon: "🔑", name: "Keyhole", make: wrap(stageFn("keyhole")),
        goal: "The context window: how many of the last words the model can see. Change the window, change the answer.",
        rules: ["The model sees ONLY the highlighted last words. The crossed-out words don't exist for it.", "Find those exact words, in order, in the training text, and see what follows them.", "If they never appear together, this model has no data.", "Ties: reading the text from the top, the word that comes right after them first wins."],
        lesson: "A wider window gives the model more to go on, but also more chances that it has never seen that exact wording. Real models learn patterns, so they can still guess well there; they also see thousands of words at once." },
      { id: "chat", icon: "💬", name: "Chat brain", make: wrap(stageFn("chat")),
        goal: "A chatbot answers by continuing \u201cQ: \u2026 A:\u201d. Predict its answer, then judge whether the answer is backed by what it was taught.",
        rules: ["The model was trained on the example chats shown. It sees up to 8 words back (an 8-word window).", "For a question it has seen, it copies the answer. For a new one, it finds the longest ending it recognises (like \u201cthe pool open A:\u201d) and continues from there.", "Ties: if two answers could follow, the one higher up in the list of chats wins.", "Supported = the chats contain the same question (maybe worded differently, same question word) with that answer.", "Made up = it borrowed an answer from a different question.", "Half marks for each part."],
        lesson: "This is where made-up answers (hallucinations) come from: the model always continues the text with something that looks like an answer, and it sounds just as sure either way." },
      { id: "boss", icon: "👑", name: "Boss: be the model", make: wrap(stageFn("boss")),
        goal: "Everything at once. A two-word window, backing off to one word when needed.",
        rules: ["Look up the last TWO words together and write the word that most often follows.", "If that pair never appears in the text, back off: use only the last word.", "Ties: reading the text from the top, the word that comes right after them first wins. Stop at [end], or after 8 pieces.", "Part marks for the right pieces before your first slip."],
        example: "\u201cthe boat\u201d never appears \u2192 use \u201cboat\u201d \u2192 is\nthen \u201cboat is\u201d \u2192 on \u2026",
        lesson: "You just did by hand what a language model does billions of times: look at the context, pick the next piece, add it, repeat." }
    ],
    finalCard: function () {
      return h("section", { class: "card soft stack" },
        h("div", { class: "kicker", text: "Next" }),
        h("h2", { text: "Watch a real agent" }),
        h("p", { text: "A model only writes text. So how does a chatbot read your files, run tools and make a real Excel file? First watch a real AI agent do a job, then find out how in Be the Agent." }),
        h("div", { class: "row end" }, h("a", { class: "btn", href: "../be-the-agent/index.html", text: "Skip to Be the Agent" }), h("a", { class: "btn primary", href: "../pregame-agent/index.html", text: "Watch a real agent \u2192" })));
    }
  });
})();
