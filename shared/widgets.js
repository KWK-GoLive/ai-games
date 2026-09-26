/*
 * AI games — small answer widgets used by both arenas.
 * Every widget returns { el, collect(), reveal(answer, result) } so the shell can time out and show the answer.
 */
(function () {
  "use strict";
  var A = window.ARENA, h = A.h;

  /* Multiple choice. options: [{value, label}] . One click answers (onAnswer(value)). */
  function choices(options, onAnswer, opts) {
    opts = opts || {};
    var picked = null;
    var grid = h("div", { class: "choices" + (opts.oneCol ? " one" : ""), role: "group" });
    var btns = options.map(function (o) {
      var b = h("button", { class: "choice", type: "button", "data-value": String(o.value) }, o.label);
      b.addEventListener("click", function () {
        if (picked !== null) return;
        picked = o.value; b.classList.add("picked");
        onAnswer(o.value);
      });
      grid.appendChild(b);
      return b;
    });
    return {
      el: grid,
      collect: function () { return picked; },
      reveal: function (key) {
        btns.forEach(function (b, i) {
          var v = options[i].value;
          if (String(v) === String(key)) b.classList.add("correct");
          else if (picked !== null && String(v) === String(picked)) b.classList.add("wrong");
        });
      }
    };
  }

  /* Two-way toggle (e.g. Supported / Made up). Doesn't submit by itself. */
  function toggle(labels, onChange) {
    var val = null;
    // plain toggle buttons (aria-pressed): work with Tab + Enter/Space, and screen readers announce "pressed"
    var wrap = h("div", { class: "tabs toggle", role: "group" });
    var btns = labels.map(function (l) {
      var b = h("button", { type: "button", "aria-pressed": "false", text: l });
      b.addEventListener("click", function () {
        val = l; btns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        if (onChange) onChange(l);
      });
      wrap.appendChild(b);
      return b;
    });
    return { el: wrap, get: function () { return val; }, buttons: btns };
  }

  /*
   * Build a word sequence by clicking tiles. cfg: { seed: [words shown grey], tiles: [{value,label}], max, onSubmit(values) }
   * Values are model words ("</s>" for [end]); labels are what the player sees.
   */
  function tileBuilder(cfg) {
    var words = [];
    var built = h("div", { class: "built", "aria-live": "polite" });
    var count = h("span", { class: "muted small" });
    var labelOf = {};
    cfg.tiles.forEach(function (t) { labelOf[t.value] = t.label; });
    function paint(marks) {
      A.clear(built);
      built.appendChild(h("span", { class: "seed", text: cfg.seed.join(" ") }));
      words.forEach(function (w, i) {
        built.appendChild(document.createTextNode(" "));
        built.appendChild(h("span", { class: "w" + (marks ? (marks[i] ? " good" : " bad") : ""), text: labelOf[w] || w }));
      });
      count.textContent = words.length + " of up to " + cfg.max + " pieces ([end] counts as one)";
    }
    var tiles = h("div", { class: "tiles" });
    var tileBtns = cfg.tiles.map(function (t) {
      var b = h("button", { class: "tile" + (t.value === "</s>" ? " end" : ""), type: "button", text: t.label });
      b.addEventListener("click", function () {
        if (words.length >= cfg.max) return;                               // [end] counts as one of the pieces
        if (words.length && words[words.length - 1] === "</s>") return;  // nothing comes after [end]
        words.push(t.value); paint();
      });
      tiles.appendChild(b);
      return b;
    });
    var undo = h("button", { class: "btn small", type: "button", text: "⌫ Undo" });
    undo.addEventListener("click", function () { words.pop(); paint(); });
    var clr = h("button", { class: "btn small ghost", type: "button", text: "Clear" });
    clr.addEventListener("click", function () { words = []; paint(); });
    var sub = h("button", { class: "btn primary", type: "button", text: "Submit" });
    sub.addEventListener("click", function () { cfg.onSubmit(words.slice()); });
    paint();
    var el = h("div", { class: "stack" }, built, h("div", { class: "row" }, count, h("span", { style: "flex:1" }), undo, clr), tiles, h("div", { class: "row end" }, sub));
    return {
      el: el, tiles: tileBtns,
      collect: function () { return words.slice(); },
      reveal: function (key) {
        var marks = words.map(function (w, i) { return key[i] === w; });
        // only the matching start counts: mark everything after the first slip as wrong
        var ok = true;
        marks = marks.map(function (m) { ok = ok && m; return ok; });
        paint(marks);
      }
    };
  }

  /* Number (or short text) box with a Submit button. */
  function inputBox(cfg) {
    var inp = h("input", { class: "text-input", type: cfg.type || "text", inputmode: cfg.inputmode || null, autocomplete: "off", "aria-label": cfg.label || "answer", placeholder: cfg.placeholder || "", style: "max-width:" + (cfg.width || "10em") });
    var sub = h("button", { class: "btn primary", type: "submit", text: cfg.button || "Submit" });
    var form = h("form", { class: "row" }, inp, cfg.suffix ? h("span", { text: cfg.suffix }) : null, sub);
    form.addEventListener("submit", function (e) { e.preventDefault(); if (inp.value.trim() === "") { inp.focus(); return; } cfg.onSubmit(inp.value); });
    return { el: form, input: inp, collect: function () { return inp.value.trim() === "" ? null : inp.value; }, reveal: function () {} };
  }

  A.w = { choices: choices, toggle: toggle, tileBuilder: tileBuilder, inputBox: inputBox };
})();
