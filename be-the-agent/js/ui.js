/* Be the Agent — shared UI helpers and saved progress. */
(function () {
  "use strict";
  var BTA = window.BTA = window.BTA || {};

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
  var KEY = "be-the-agent-v1";
  function blankState() {
    return { v: 1, levels: {}, nickname: "", classCode: "" };
  }
  var state = blankState();
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.v === 1) state = Object.assign(blankState(), parsed);
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


  BTA.ui = {
    h: h, clear: clear, flags: flags, save: save, reset: reset,
    shuffle: shuffle, pick: pick, starsEl: starsEl, pct: pct, toast: toast, mcq: mcq
  };
  // BTA.state always points at the current progress object (reset() swaps it).
  Object.defineProperty(BTA, "state", { get: function () { return state; }, set: function (v) { state = v; }, configurable: true });
})();

/* Tell the master page (../index.html) this game is finished. Same browser storage, shared key. */
(function () {
  var NS = window.BTA = window.BTA || {};
  NS.markSiteDone = function () {
    try {
      var k = "ai-games-done", d = JSON.parse(localStorage.getItem(k) || "{}") || {};
      if (!d["agent"]) { d["agent"] = Date.now(); localStorage.setItem(k, JSON.stringify(d)); }
    } catch (e) { /* storage blocked: the tick just won't show */ }
  };
})();
