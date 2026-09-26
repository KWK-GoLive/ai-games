/*
 * LLM Arena — recomputes every answer key with separate, simple code (not the game's model) for many shuffles.
 *   node llm-arena/tests/check-items.js      Exits 1 on any failure.
 */
"use strict";
var path = require("path");
global.window = {};
require(path.join(__dirname, "../data/worlds.js"));
var D = window.LLMA_DATA;
var L = require(path.join(__dirname, "../js/items.js"));
var M = L.M;
var RUNS = 300;
var fails = 0, checked = 0;
function check(c, m) { checked++; if (!c) { fails++; if (fails < 30) console.log("  FAIL  " + m); } }
function rng(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---- independent helpers: plain counting over the sentences ---- */
function toks(world) { return world.text.map(function (s) { return ["<s>"].concat(s.split(" "), ["</s>"]); }); }
// what follows exactly these words, in first-seen order
function follow(world, ctx) {
  var out = [];
  toks(world).forEach(function (t) {
    for (var i = ctx.length; i < t.length; i++) {
      var ok = true;
      for (var j = 0; j < ctx.length; j++) if (t[i - ctx.length + j] !== ctx[j]) { ok = false; break; }
      if (!ok) continue;
      var e = out.filter(function (o) { return o.w === t[i]; })[0];
      if (e) e.n++; else out.push({ w: t[i], n: 1 });
    }
  });
  return out.slice().sort(function (a, b) { return b.n - a.n; }); // stable: ties keep first-seen order
}
function greedy(world, seed, k, max) {
  var words = seed.slice(), out = [];
  for (var s = 0; s < max; s++) {
    var d = [];
    for (var j = k; j >= 1 && !d.length; j--) d = follow(world, ["<s>"].concat(words).slice(-j));
    if (!d.length) break;
    out.push(d[0].w);
    if (d[0].w === "</s>") break;
    words.push(d[0].w);
  }
  return out;
}
function tempPct(counts, T, i) {
  if (T === 0) return i === 0 ? 100 : 0;
  var w = counts.map(function (c) { return Math.pow(c, 1 / T); });
  var s = w.reduce(function (a, b) { return a + b; }, 0);
  return Math.round(100 * w[i] / s);
}

var stats = { keyholeNone: 0, keyhole: 0, chatMade: 0, chat: 0, loops: 0, writer: 0, bossBackoff: 0 };
for (var run = 0; run < RUNS; run++) {
  L.STAGES.forEach(function (st) {
    var items = st.make(D, rng(run * 7919 + st.id.length * 131));
    var want = { count: 5, greedy: 3, dice: 5, keyhole: 6, chat: 4, boss: 3 }[st.id];
    check(items.length === want, st.id + " run " + run + ": " + items.length + " items, want " + want);
    items.forEach(function (it, n) {
      var where = st.id + " run " + run + " item " + n + " (" + it.title + ")";
      check(it.grade(it.key).frac === 1, where + ": the key must score 100%");
      var r = rng(run + n);
      for (var s = 0; s < 5; s++) { var f = it.grade(it.sample(r)).frac; check(f >= 0 && f <= 1, where + ": sample frac out of range"); }
      check(it.grade(null).frac === 0 || it.kind === "tiles", where + ": no answer scores 0");
      if (it.options) {
        var vals = it.options.map(function (o) { return String(o.value); });
        check(vals.indexOf(String(it.key && it.key.answer !== undefined ? it.key.answer : it.key)) >= 0, where + ": key among the options");
        check(vals.length === new Set(vals).size, where + ": options unique");
        var labels = it.options.map(function (o) { return o.label; });
        check(labels.length === new Set(labels).size, where + ": option labels unique");
      }
      if (st.id === "count") {
        var m = /after “([^”]+)”/i.exec(it.title);
        var ctxWord = m[1].toLowerCase();
        var d = follow(it.world, [ctxWord]);
        var total = d.reduce(function (a, x) { return a + x.n; }, 0);
        if (/Which word/.test(it.title)) check(it.key === d[0].w, where + ": top word " + d[0].w);
        else if (/what %/.test(it.title)) { var tw = /does “([^”]+)”/.exec(it.title)[1]; tw = tw === "[end]" ? "</s>" : tw.toLowerCase(); check(it.key === Math.round(100 * d.filter(function (x) { return x.w === tw; })[0].n / total), where + ": pct"); }
        else { var cw = /does “([^”]+)”/.exec(it.title)[1]; cw = cw === "[end]" ? "</s>" : cw.toLowerCase(); check(it.key === d.filter(function (x) { return x.w === cw; })[0].n, where + ": count"); }
      }
      if (st.id === "greedy" || st.id === "boss") {
        var g = greedy(it.world, it.seed, it.k, L.MAX_NEW);
        check(JSON.stringify(g) === JSON.stringify(it.key), where + ": writer key " + it.key.join(" ") + " vs " + g.join(" "));
        check(it.key.length >= 3, where + ": at least 3 pieces");
        stats.writer++; if (it.key[it.key.length - 1] !== "</s>") stats.loops++;
        if (st.id === "boss" && !follow(it.world, it.seed).length) stats.bossBackoff++;
        var tileVals = it.tiles.map(function (t) { return t.value; });
        check(it.key.every(function (w) { return tileVals.indexOf(w) >= 0; }), where + ": every key word has a tile");
        var half = it.key.slice(0, Math.ceil(it.key.length / 2));
        var hf = it.grade(half).frac;
        check(hf > 0 && hf < 1, where + ": part marks for a correct start");
        check(it.grade(it.key.concat(["x"])).frac < 1, where + ": extra pieces don't get full marks");
      }
      if (st.id === "dice" && /what %/.test(it.title)) {
        var T = Number(/temperature ([\d.]+)/.exec(it.title)[1]);
        var w = /does “([^”]+)”/.exec(it.title)[1];
        var idx = it.dice.dist.map(function (x) { return x.word; }).indexOf(w);
        check(it.key === tempPct(it.dice.dist.map(function (x) { return x.count; }), T, idx), where + ": temperature %");
      }
      if (st.id === "keyhole") {
        var d2 = follow(it.world, it.prefix.slice(-it.k));
        var k2 = d2.length ? d2[0].w : "none";
        check(it.key === k2, where + ": keyhole " + it.key + " vs " + k2);
        stats.keyhole++; if (k2 === "none") stats.keyholeNone++;
      }
      if (st.id === "chat") {
        stats.chat++; if (it.key.support === "Made up") stats.chatMade++;
        // Supported iff some example has the same question word, the same topic words and exactly this answer.
        var qw = it.question.split(" ");
        var STOP = ["when", "does", "do", "is", "are", "the", "a", "where", "who", "what", "at", "on"];
        var topic = function (ws) { return ws.filter(function (x) { return STOP.indexOf(x) < 0; }).sort().join(" "); };
        var sup = it.chat.qa.some(function (p) { var pw = p[0].split(" "); return pw[0] === qw[0] && topic(pw) === topic(qw) && p[1] === it.key.answer; });
        check((it.key.support === "Supported") === sup, where + ": supported flag");
        check(it.key.answer.length > 0, where + ": the model answers something");
        check(it.grade({ answer: it.key.answer, support: "x" }).frac === 0.5, where + ": half marks");
      }
    });
  });
}
console.log("  " + checked + " checks over " + RUNS + " shuffles of every stage");
console.log("  keyhole items with 'no data' as the answer: " + stats.keyholeNone + " of " + stats.keyhole);
console.log("  chat items whose answer is made up: " + stats.chatMade + " of " + stats.chat);
console.log("  writer items that loop (no [end]): " + stats.loops + " of " + stats.writer + "; boss seeds needing back-off: " + stats.bossBackoff);
console.log(fails ? fails + " check(s) FAILED" : "All LLM Arena item checks passed");
process.exit(fails ? 1 : 0);
