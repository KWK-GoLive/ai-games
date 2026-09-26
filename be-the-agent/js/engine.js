/*
 * Be the Agent — the working parts: token estimate, a safe calculator, a tiny table tool, and keyword search.
 * Nothing here uses eval: every "tool" is a small hand-written interpreter, so it is safe to run in a browser.
 * Works in the browser (window.BTA.Engine) and in Node (module.exports) for tests.
 */
(function (root) {
  "use strict";

  /* ---------- tokens ---------- */
  // Rough rule for English: 1 token is about 3/4 of a word, so tokens ~ words x 4/3.
  // Real tokenizers differ by model and language; the game always calls this an estimate.
  function words(text) { return String(text).trim().split(/\s+/).filter(Boolean).length; }
  function tokens(text) { var w = words(text); return w ? Math.ceil(w * 4 / 3) : 0; }

  /* ---------- calculator: numbers, + - * / and brackets ---------- */
  function calc(expr) {
    var s = String(expr).replace(/,/g, "").replace(/×/g, "*").replace(/÷/g, "/");
    var i = 0;
    function peek() { while (s[i] === " ") i++; return s[i]; }
    function num() {
      peek();
      var m = /^\d+(\.\d+)?/.exec(s.slice(i));
      if (!m) throw new Error("expected a number at position " + (i + 1));
      i += m[0].length;
      return parseFloat(m[0]);
    }
    function factor() {
      var c = peek();
      if (c === "-") { i++; return -factor(); }
      if (c === "(") { i++; var v = sum(); if (peek() !== ")") throw new Error("missing )"); i++; return v; }
      return num();
    }
    function product() {
      var v = factor();
      for (;;) {
        var c = peek();
        if (c === "*") { i++; v *= factor(); }
        else if (c === "/") { i++; var d = factor(); if (d === 0) throw new Error("can't divide by zero"); v /= d; }
        else return v;
      }
    }
    function sum() {
      var v = product();
      for (;;) {
        var c = peek();
        if (c === "+") { i++; v += product(); }
        else if (c === "-") { i++; v -= product(); }
        else return v;
      }
    }
    var out = sum();
    if (peek() !== undefined) throw new Error("unexpected “" + s[i] + "”");
    return Math.round(out * 1e6) / 1e6;
  }

  /* ---------- table tool ---------- */
  function parseCsv(text) {
    var lines = String(text).trim().split(/\r?\n/);
    var cols = lines[0].split(",").map(function (c) { return c.trim(); });
    var rows = lines.slice(1).map(function (l) {
      var cells = l.split(","), o = {};
      cols.forEach(function (c, j) { var v = (cells[j] || "").trim(); o[c] = v !== "" && !isNaN(Number(v)) ? Number(v) : v; });
      return o;
    });
    return { cols: cols, rows: rows };
  }
  /*
   * A tiny language the model "writes" (real agents usually write Python):
   *   SHOW 5 ROWS
   *   COUNT ROWS
   *   TOTAL <column>
   *   TOTAL <column> BY <column>      (sorted, biggest first)
   * Returns { ok, text, table?: [[header...], [row...]], value? } or { ok:false, error }
   */
  function runTable(csvText, command) {
    var t = parseCsv(csvText);
    var cmd = String(command).trim();
    function col(name) {
      var c = t.cols.filter(function (x) { return x.toLowerCase() === String(name).toLowerCase(); })[0];
      if (!c) throw new Error("there is no column called “" + name + "”. The columns are: " + t.cols.join(", ") + ".");
      return c;
    }
    try {
      var m;
      if ((m = /^SHOW\s+(\d+)\s+ROWS$/i.exec(cmd))) {
        var n = Math.min(parseInt(m[1], 10), t.rows.length);
        return { ok: true, text: "First " + n + " of " + t.rows.length + " rows", table: [t.cols].concat(t.rows.slice(0, n).map(function (r) { return t.cols.map(function (c) { return r[c]; }); })) };
      }
      if (/^COUNT\s+ROWS$/i.test(cmd)) return { ok: true, value: t.rows.length, text: t.rows.length + " rows" };
      if ((m = /^TOTAL\s+(\w+)\s+BY\s+(\w+)$/i.exec(cmd))) {
        var v = col(m[1]), g = col(m[2]), sums = {}, order = [];
        t.rows.forEach(function (r) {
          if (typeof r[v] !== "number") throw new Error("the column “" + v + "” has text in it, so it can't be added up.");
          if (!(r[g] in sums)) { sums[r[g]] = 0; order.push(r[g]); }
          sums[r[g]] += r[v];
        });
        order.sort(function (a, b) { return sums[b] - sums[a]; });
        var all = order.reduce(function (a, k) { return a + sums[k]; }, 0);
        return { ok: true, text: "Total " + v + " for each " + g, groups: order.map(function (k) { return [k, sums[k]]; }), value: all,
          table: [[g, "sum of " + v]].concat(order.map(function (k) { return [k, sums[k]]; })) };
      }
      if ((m = /^TOTAL\s+(\w+)$/i.exec(cmd))) {
        var c2 = col(m[1]), s = 0;
        t.rows.forEach(function (r) {
          if (typeof r[c2] !== "number") throw new Error("the column “" + c2 + "” has text in it, so it can't be added up.");
          s += r[c2];
        });
        return { ok: true, value: s, text: "Sum of the \u201c" + c2 + "\u201d column = " + s };
      }
      throw new Error("I don't understand “" + cmd + "”. Try: SHOW 5 ROWS, COUNT ROWS, TOTAL <column>, TOTAL <column> BY <column>.");
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* ---------- keyword search over chunks ---------- */
  var STOP = ["a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "is", "are", "i", "my", "me", "she", "he", "her", "his",
    "it", "do", "does", "doesn", "don", "t", "what", "should", "can", "get", "wants", "want", "at", "with", "if", "they", "we", "our", "be", "any", "time"];
  function stem(w) { return w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""); }
  function keywords(text) {
    return String(text).toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w && STOP.indexOf(w) < 0; }).map(stem);
  }
  /* chunks: [{id, title, text}] -> [{chunk, score, matched:[words]}] sorted by score (ties keep order) */
  function search(query, chunks) {
    var q = keywords(query);
    return chunks.map(function (c, idx) {
      var words = keywords(c.title + " " + c.text);
      var matched = q.filter(function (w, i) { return q.indexOf(w) === i && words.indexOf(w) >= 0; });
      return { chunk: c, score: matched.length, matched: matched, idx: idx };
    }).sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
  }

  var api = { words: words, tokens: tokens, calc: calc, parseCsv: parseCsv, runTable: runTable, search: search, keywords: keywords };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BTA = root.BTA || {};
  root.BTA.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
