/*
 * Corpus and model checks. Run from the project folder:  node tests/check-corpus.js
 * Exits with code 1 if any check fails.
 */
"use strict";
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var rootDir = path.join(__dirname, "..");
var sandbox = { window: {}, globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(rootDir, "data/corpus.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(rootDir, "js/model.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(rootDir, "js/facts.js"), "utf8"), sandbox);
var C = sandbox.window.BTL_CORPUS;
var M = sandbox.window.BTL.Model;

var failures = 0;
function check(cond, msg) {
  if (!cond) { failures++; console.log("  FAIL  " + msg); }
}
function section(t) { console.log("\n== " + t); }

var model = M.Model.train(C.train, 3);
var words = new Set();
C.train.forEach(function (s) { M.tokenize(s).forEach(function (w) { words.add(w); }); });

section("Corpus size");
console.log("  training sentences: " + C.train.length + ", vocabulary: " + words.size +
  ", test items: " + C.test.length + ", context items: " + C.context.length);
check(new Set(C.train).size === C.train.length, "duplicate training sentences");
C.train.forEach(function (s) {
  check(/^[a-z ]+$/.test(s), "training sentence has characters other than a-z/space: " + s);
});

section("Probabilities sum to 1 for every context");
[1, 2, 3].forEach(function (k) {
  model.tables[k].forEach(function (_, key) {
    var d = model.next(key.split(" "), k);
    var sum = d.reduce(function (a, b) { return a + b.p; }, 0);
    check(Math.abs(sum - 1) < 1e-9, "k=" + k + " context '" + key + "' sums to " + sum);
  });
});
[0, 0.5, 1, 2].forEach(function (T) {
  var d = M.applyTemperature(model.next(["the"], 1), T);
  var sum = d.reduce(function (a, b) { return a + b.p; }, 0);
  check(Math.abs(sum - 1) < 1e-9, "temperature " + T + " sums to " + sum);
});
var t1 = M.applyTemperature(model.next(["the"], 1), 1);
var raw = model.next(["the"], 1);
check(t1.every(function (d, i) { return Math.abs(d.p - raw[i].p) < 1e-12; }), "T=1 must equal raw probabilities");

section("Temperature 0 is deterministic");
var outs = new Set();
for (var r = 0; r < 20; r++) outs.add(model.generate(["see", "you"], 3, 0, 12, M.makeRng(r + 1)).words.join(" "));
check(outs.size === 1, "T=0 produced " + outs.size + " different outputs");
console.log("  T=0 output: " + Array.from(outs)[0]);

section("Level 2 hand tally");
var tallyModel = M.Model.train(C.train.slice(0, C.tallyCount), 1);
var tally = tallyModel.next([C.tallyWord], 1);
console.log("  after '" + C.tallyWord + "' in first " + C.tallyCount + ": " +
  tally.map(function (d) { return d.word + "=" + d.count; }).join(", "));
tally.forEach(function (d) {
  check(C.tallyRows.indexOf(d.word) >= 0, "tally row missing for word '" + d.word + "'");
});
var theTop = model.next([C.tallyWord], 1).slice(0, 8);
console.log("  after full training, top after '" + C.tallyWord + "': " +
  theTop.map(function (d) { return d.word + "=" + d.count; }).join(", "));

check(tally.length > 0, "tallyWord '" + C.tallyWord + "' must appear in the first " + C.tallyCount + " training sentences");
check(C.test.filter(function (t) { return t.anchor; }).length === 1, "exactly one test item should be marked anchor: true (Slide C1 example)");

section("Levels 1 and 3 test items");
var modelHits = 0;
C.test.forEach(function (it) {
  var w = M.tokenize(it.s);
  check(C.train.indexOf(it.s) < 0, "test sentence is also a training sentence: " + it.s);
  check(it.k >= 1 && it.k < w.length, "bad k for: " + it.s);
  var prefix = w.slice(0, it.k), answer = w[it.k];
  var d = model.next(prefix, 1);
  var seen = d.some(function (x) { return x.word === answer; });
  check(seen, "answer '" + answer + "' never follows '" + prefix[prefix.length - 1] + "' in training (" + it.s + ")");
  var top = d.length ? d[0].word : "-";
  if (top === answer) modelHits++;
  console.log("  " + (top === answer ? "model right " : "model wrong ") + prefix.join(" ") + " ___  answer=" + answer +
    "  model top=" + top + "  (" + d.length + " candidates)");
});
console.log("  model (full-vocabulary top guess) right on " + modelHits + "/" + C.test.length);

section("Level 6 window rounds (smallest window where the model is right)");
var dist = { 1: 0, 2: 0, 3: 0 }, flips = 0;
C.context.forEach(function (it) {
  var p = M.tokenize(it.prefix);
  var minimal = 0, row = [];
  for (var k = 1; k <= 3; k++) {
    var d = model.next(p, k);
    var top = d.length ? d[0].word : "(never seen)";
    var tie = d.length > 1 && d[0].count === d[1].count;
    row.push(k + ":" + top + (tie ? "(tie!)" : ""));
    if (!minimal && top === it.answer && !tie) minimal = k;
  }
  check(minimal > 0, "no memory size solves: " + it.prefix + " -> " + it.answer);
  if (it.unseen) check(model.next(p, 3).length === 0, "item marked unseen but its 3-word context is in training: " + it.prefix);
  if (minimal && model.next(p, 1).length && model.next(p, 1)[0].word !== model.next(p, 3).concat([{ word: "-" }])[0].word) flips++;
  if (minimal) dist[minimal]++;
  console.log("  " + it.prefix + " ___ = " + it.answer + "   " + row.join("  ") + "   smallest=" + minimal);
});
console.log("  smallest-memory mix: 1-word " + dist[1] + ", 2-word " + dist[2] + ", 3-word " + dist[3]);
check(dist[1] > 0 && dist[2] > 0 && dist[3] > 0, "Level 6 needs rounds where 1, 2 and 3 words are needed");
check(C.context.some(function (it) { return it.unseen; }), "Level 6 needs one round marked unseen: true");
console.log("  items whose top guess changes between 1-word and 3-word memory: " + flips);
check(flips >= 3, "at least 3 Level 6 rounds should change the model's guess between 1 and 3 words");

section("Chat model (Levels 4, 5, 7)");
var chat = M.Model.train(C.train, 8);
C.qa.forEach(function (p) { chat.addSentence(M.qaSequence(p[0], p[1])); });
// Expected answer at temperature 0 = the most frequent answer for that question (first listed wins a tie).
var answersFor = {};
C.qa.forEach(function (p) { var q = M.tokenize(p[0]).join(" "); (answersFor[q] = answersFor[q] || []).push(M.tokenize(p[1]).join(" ")); });
Object.keys(answersFor).forEach(function (q) {
  var counts = {};
  answersFor[q].forEach(function (a) { counts[a] = (counts[a] || 0) + 1; });
  var best = answersFor[q].slice().sort(function (x, y) { return counts[y] - counts[x]; })[0];
  var got = chat.answer(q.split(" "), 0);
  check(got.finished && got.answer.join(" ") === best, "chat answer for '" + q + "' is '" + got.answer.join(" ") + "', expected '" + best + "'");
});
console.log("  " + Object.keys(answersFor).length + " questions answered correctly at temperature 0");
C.qa.forEach(function (p) { check(M.tokenize(p[0]).length > 0 && M.tokenize(p[1]).length > 0, "empty question or answer in qa"); });
C.unanswerable.forEach(function (q) {
  var w = M.tokenize(q);
  check(!answersFor[w.join(" ")], "unanswerable question is in qa: " + q);
  w.forEach(function (x) { check(chat.tables[1].has(x), "unanswerable question uses a word the model never saw: " + x + " (" + q + ")"); });
  var r = chat.answer(w, 0);
  var a = r.answer.join(" ");
  var supported = (answersFor[w.join(" ")] || []).indexOf(a) >= 0;
  check(r.finished && r.answer.length >= 2 && r.answer.length <= 10, "unanswerable '" + q + "' gave an unfinished/odd answer: " + a);
  check(!supported, "unanswerable '" + q + "' is somehow supported");
  var borrowed = C.qa.some(function (p) { return M.tokenize(p[1]).join(" ") === a; });
  console.log("  made up: " + q + " -> " + a + (borrowed ? "  (borrowed from another example)" : "  (stitched)"));
});
C.l4Questions.concat(C.l5Questions, [C.l5DialQuestion]).forEach(function (q) {
  check(!!answersFor[M.tokenize(q).join(" ")], "Level 4/5 question is not in qa: " + q);
});
section("Level 7 'Supported' judging (reworded and tricky questions)");
var F = sandbox.window.BTL.Facts;
C.qa.forEach(function (p) { if (p[2]) check(C.train.indexOf(p[2]) >= 0, "qa source sentence not in train: " + p[2]); });
[
  ["when does the shop open", true], ["is the shop open", true], ["when does the bank close", true],
  ["is the museum closed on monday", true], ["where does my sister live", true],
  ["what time does the museum open", false], ["where does my mother live", false], ["what time does the bank open", false],
  ["where does my best friend s brother live", false], ["where did my brother leave my keys", false],
  ["what did my brother have for lunch", false], ["where did i leave my sister s keys", false],
  ["what time does the shop in london open", false], ["how long is the flight from tokyo", false],
  ["what time does the shop not open", false], ["where does my sister not live", false], ["what time is it", false]
].forEach(function (t) {
  var w = M.tokenize(t[0]);
  var r = chat.answer(w, 0);
  var got = !!F.backingExample(C, w, r.answer);
  check(got === t[1], "judging '" + t[0] + "' -> '" + r.answer.join(" ") + "': expected " + (t[1] ? "Supported" : "Made up") + ", got " + (got ? "Supported" : "Made up"));
});
C.qa.forEach(function (p) {
  if (!p[2]) return;
  var w = M.tokenize(p[0]);
  check(!!F.backingExample(C, w, chat.answer(w, 0).answer), "fact question not judged Supported: " + p[0]);
});
C.unanswerable.forEach(function (q) {
  var w = M.tokenize(q);
  check(!F.backingExample(C, w, chat.answer(w, 0).answer), "unanswerable question judged Supported: " + q);
});
console.log("  17 tricky questions, all fact questions and all unanswerable questions judged");

section("Level 4 'before' (plain model, 3-word memory, temperature 0)");
C.l4Questions.forEach(function (q) {
  var w = M.tokenize(q);
  var r = model.generate(w, 3, 0, w.length + 8);
  var added = r.words.slice(w.length).join(" ");
  check(added !== answersFor[w.join(" ")][0], "plain model already answers '" + q + "'");
  console.log("  " + q + " -> " + (added || (r.finished ? "[end]" : "NO DATA (last word never seen)")));
});
section("Level 5 dial");
var dial = chat.next([M.Q].concat(M.tokenize(C.l5DialQuestion), [M.A]), 8);
console.log("  first answer word: " + dial.map(function (d) { return d.word + " " + Math.round(d.p * 100) + "%"; }).join(", "));
check(dial.length >= 3, "Level 5 dial question needs at least 3 possible first words");
var variety = new Set();
for (var v = 0; v < 30; v++) variety.add(chat.answer(M.tokenize(C.l5Questions[0]), 1.5, M.makeRng(v + 11)).answer.join(" "));
console.log("  '" + C.l5Questions[0] + "' at temperature 1.5 over 30 runs: " + variety.size + " different answers");
check(variety.size >= 3, "Level 5 first question should vary at high temperature");

section("Sources lookup");
var pcs = model.sources(M.tokenize("the train to chiang mai leaves at nine"));
console.log("  " + pcs.map(function (p) { return "[" + p.words.join(" ") + "] <- #" + p.source; }).join(" + "));
check(pcs.length >= 2, "stitched example should need at least 2 pieces");
check(model.sources(M.tokenize(C.train[5])).length === 1, "a training sentence should be one piece");

console.log("\n" + (failures ? failures + " check(s) FAILED" : "All checks passed"));
process.exit(failures ? 1 : 0);
