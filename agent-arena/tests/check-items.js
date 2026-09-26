/*
 * Agent Arena — checks the data and recomputes every answer key with separate, simple code, for many shuffles.
 *   node agent-arena/tests/check-items.js      Exits 1 on any failure.
 */
"use strict";
var path = require("path");
global.window = {};
require(path.join(__dirname, "../data/shop.js"));
var D = window.AGA_DATA;
var I = require(path.join(__dirname, "../js/items.js"));
var T = I.Tools, E = T.Engine;
var F = require(path.join(__dirname, "../../be-the-agent/js/files.js"));
var RUNS = 300;
var fails = 0, checked = 0;
function check(c, m) { checked++; if (!c) { fails++; if (fails < 30) console.log("  FAIL  " + m); } }
function rng(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---- the data itself ---- */
var rows = D.rentalsCsv.split("\n").slice(1).map(function (l) { var c = l.split(","); return { date: c[0], branch: c[1], bike: c[2], hours: +c[3], price: +c[4], total: +c[5] }; });
check(rows.length === 24, "24 rentals");
var PRICE = { city: 6, ebike: 12, kids: 4 };
rows.forEach(function (r) { check(r.price === PRICE[r.bike] && r.hours * r.price === r.total, "price x hours = total on " + r.date + " " + r.branch); });
function sum(rs, f) { return rs.reduce(function (a, r) { return a + r[f]; }, 0); }
function by(rs, g) { var o = {}; rs.forEach(function (r) { o[r[g]] = (o[r[g]] || 0) + r.total; }); return o; }
var byBranch = by(rows, "branch");
check(byBranch.Station === 190 && byBranch.River === 170 && byBranch.Park === 132, "branch totals quoted in desk card d3");
check(sum(rows, "total") === 492 && rows.length === 24, "desk card d2 quotes 24 rentals, total 492");
// handbook facts quoted elsewhere must agree
check(/6 per hour, e-bikes 12 per hour and kids' bikes 4/.test(D.handbook[1].text), "handbook prices match the data");

/* ---- desks ---- */
D.desks.forEach(function (d) {
  var need = d.cards.filter(function (c) { return c.need; }).map(function (c) { return c.id; });
  check(I.deskUse(D, d, need) <= d.capacity, d.id + ": the needed cards fit");
  check(I.deskUse(D, d, d.cards.map(function (c) { return c.id; })) > d.capacity, d.id + ": everything does NOT fit (so choosing matters)");
});

/* ---- search: the naive question never wins outright; at least one 1-word search does ---- */
D.searchQuestions.forEach(function (sq) {
  check(!I.searchRank(D, sq.q, sq.target).win, "search: typing the whole question must not already work: " + sq.q);
  var tgt = D.handbook.filter(function (c) { return c.id === sq.target; })[0];
  var winners = E.keywords(tgt.title + " " + tgt.text).filter(function (w) { return I.searchRank(D, w, sq.target).win; });
  check(winners.length >= 3, "search: several 1-word searches find " + tgt.title + " (" + winners.join(",") + ")");
});

/* ---- data questions: independent answers ---- */
var indep = {
  "How much did e-bikes earn in total?": String(sum(rows.filter(function (r) { return r.bike === "ebike"; }), "total")),
  "Which branch earned the most in total?": Object.keys(byBranch).sort(function (a, b) { return byBranch[b] - byBranch[a]; })[0],
  "How many rentals lasted more than 3 hours?": String(rows.filter(function (r) { return r.hours > 3; }).length),
  "What was the longest single rental at the River branch, in hours?": String(Math.max.apply(null, rows.filter(function (r) { return r.branch === "River"; }).map(function (r) { return r.hours; }))),
  "How much did kids' bikes earn in total?": String(sum(rows.filter(function (r) { return r.bike === "kids"; }), "total")),
  "What was the smallest single rental total at the Station branch?": String(Math.min.apply(null, rows.filter(function (r) { return r.branch === "Station"; }).map(function (r) { return r.total; }))),
  "How many rentals were at the Park branch?": String(rows.filter(function (r) { return r.branch === "Park"; }).length),
  "Which kind of bike earned the least in total?": (function () { var b = by(rows, "bike"); return Object.keys(b).sort(function (x, y) { return b[x] - b[y]; })[0]; })()
};
D.dataQuestions.forEach(function (dq) {
  check(I.answerOf(D, dq) === indep[dq.q], "data: " + dq.q + " -> " + I.answerOf(D, dq) + " vs " + indep[dq.q]);
});
// no ties where a single name is asked for
(function () { var v = Object.keys(byBranch).map(function (k) { return byBranch[k]; }).sort(function (a, b) { return b - a; }); check(v[0] !== v[1], "no tie for the top branch"); })();
// table tool behaviour players rely on
check(T.run(D.rentalsCsv, "total total where BIKE = EBIKE").value === 228, "commands are case-insensitive");
check(!T.run(D.rentalsCsv, "TOTAL bike").ok, "adding up a text column is an error");
check(T.run(D.rentalsCsv, "COUNT ROWS WHERE bike = ebikes").value === 0, "a misspelt value gives 0 rows with a spelling tip");

// naming every option must not count as the answer
D.dataQuestions.filter(function (dq) { return dq.type !== "number"; }).forEach(function (dq) {
  var names = I.namesFor(D, dq), key = I.answerOf(D, dq);
  check(!I.matches(names.join(" "), key, dq.type, names), "data: listing every name is not accepted (" + dq.q + ")");
  check(I.matches("the " + key + " ones", key, dq.type, names), "data: a natural phrasing is accepted (" + dq.q + ")");
});

/* ---- router ---- */
var toolVals = D.tools.map(function (t) { return t.value; });
D.requests.forEach(function (r) { check(toolVals.indexOf(r.key) >= 0 && r.why, "router key valid: " + r.text); });
toolVals.forEach(function (v) { check(D.requests.filter(function (r) { return r.key === v; }).length >= 3, "router: at least 3 requests for " + v); });

/* ---- docs ---- */
check(D.docs.filter(function (d) { return d.planted; }).length === 5 && D.docs.filter(function (d) { return !d.planted; }).length === 5, "5 planted and 5 innocent documents");

/* ---- items over many shuffles ---- */
var stats = { bossWrong: {} };
for (var run = 0; run < RUNS; run++) {
  I.STAGES.forEach(function (st) {
    var items = st.make(D, rng(run * 7919 + st.id.length * 131));
    var want = { desk: 3, search: 4, router: 12, data: 3, inject: 2, boss: 1 }[st.id];
    check(items.length === want, st.id + " run " + run + ": " + items.length + " items");
    items.forEach(function (it, n) {
      var where = st.id + " run " + run + " item " + n;
      check(it.grade(it.key).frac === 1, where + ": the key must score 100%");
      var r = rng(run * 31 + n);
      for (var s = 0; s < 5; s++) { var f = it.grade(it.sample(r)).frac; check(f >= 0 && f <= 1, where + ": sample frac in range"); }
      check(it.grade(null).frac === 0, where + ": no answer scores 0");
      if (st.id === "data") check(it.grade({ answer: it.key.answer, calls: 9, errors: 9 }).frac === 0.5, where + ": right answer never below half marks");
      if (st.id === "inject") {
        var p = it.docs.filter(function (d) { return d.planted; }).length;
        check(p >= 1 && p <= 3, where + ": 1-3 planted documents");
      }
      if (st.id === "boss") {
        var truth = [["Station", 144], ["River", 60], ["Park", 24]];
        check(JSON.stringify(it.truth) === JSON.stringify(truth), where + ": e-bike revenue by branch");
        var diff = it.draft.filter(function (g, i) { return g[1] !== truth[i][1]; });
        check(diff.length === 1 && diff[0][0] === it.key.flagged && diff[0][1] > 0, where + ": exactly one wrong number in the draft, and it's the key");
        stats.bossWrong[it.key.flagged] = (stats.bossWrong[it.key.flagged] || 0) + 1;
        check(it.isRight(it.run(I.BOSS_CMD)) && !it.isRight(it.run("TOTAL total BY branch")), where + ": only the e-bike command counts");
        var partial = it.grade({ order: it.key.order, perms: it.key.perms, ran: true, flagged: "none", made: false }).frac;
        check(Math.abs(partial - 0.6) < 1e-9, where + ": each part is a fifth");
      }
    });
  });
}
// the boss file is a real .xlsx (zip)
var x = F.xlsx([{ name: "E-bikes June", rows: [["Branch", "E-bike revenue"], ["Station", 144], ["River", 60], ["Park", 24], ["Total", { f: "SUM(B2:B4)", v: 228 }]] }]);
check(x[0] === 0x50 && x[1] === 0x4b, "boss xlsx is a zip");
/* ---- v3: no typing. Word cards, tap-to-build questions, tap-the-answer ---- */
var QB = require(path.join(__dirname, "../../shared/querybuilder.js"));
D.searchQuestions.forEach(function (sq) {
  var cards = sq.cards || [];
  check(cards.length === 10 && new Set(cards).size === 10, sq.target + ": 10 different word cards");
  var wins = cards.filter(function (w) { return I.searchRank(D, w, sq.target).win; });
  check(wins.length >= 1 && wins.length <= 4, sq.target + ": 1-4 cards win on their own (got " + wins.join(",") + ")");
  var traps = cards.filter(function (w) { var r = I.searchRank(D, w, sq.target).res; return r[0].score > 0 && r[0].chunk.id !== sq.target; });
  check(traps.length >= 1, sq.target + ": at least one card pulls up a wrong piece (a trap)");
});
// every data question can be built with the chips: numeric column to add up, a text column to split by,
// a filter column with at most 10 different values, and a value that is one of the chips
var tbl = E.parseCsv(D.rentalsCsv);
function uniqVals(c) { var o = []; tbl.rows.forEach(function (r) { if (o.indexOf(r[c]) < 0) o.push(r[c]); }); return o; }
var numCols = tbl.cols.filter(function (c) { return tbl.rows.every(function (r) { return typeof r[c] === "number"; }); });
function buildable(cmd) {
  var m = /^(COUNT ROWS|SHOW 5 ROWS|(TOTAL|MAX|MIN) (\w+)( BY (\w+))?)( WHERE (\w+) ([=<>]) (\S+))?$/.exec(cmd);
  if (!m) return false;
  if (m[3] && numCols.indexOf(m[3]) < 0) return false;
  if (m[5] && (m[2] !== "TOTAL" || numCols.indexOf(m[5]) >= 0)) return false;
  if (m[7]) {
    var vals = uniqVals(m[7]).map(String);
    if (vals.length > 10 || vals.indexOf(m[9]) < 0) return false;
    if (m[8] !== "=" && numCols.indexOf(m[7]) < 0) return false;
  }
  return true;
}
D.dataQuestions.forEach(function (dq) {
  check(buildable(dq.ref), dq.q + ": the reference question can be built with the chips (" + dq.ref + ")");
  var r = T.run(D.rentalsCsv, dq.ref), key = I.answerOf(D, dq);
  var tappable = r.groups ? r.groups.map(function (g) { return String(g[0]); }).concat(r.groups.map(function (g) { return String(g[1]); })) : [String(r.value)];
  check(tappable.indexOf(key) >= 0, dq.q + ": the answer " + key + " can be tapped in the result");
  check(I.matches(key, key, dq.type, I.namesFor(D, dq)), dq.q + ": a tapped answer is marked right");
  check(!/TOTAL|WHERE|COUNT ROWS/.test(QB.describe(dq.ref)), dq.q + ": plain English has no command words: " + QB.describe(dq.ref));
});
check(QB.describe(I.BOSS_CMD) === "Add up total for each branch, only where bike is ebike", "boss question in plain English");
check("TOTAL " + "total" + " BY " + "branch" + " WHERE bike = " + "ebike" === I.BOSS_CMD, "the guided builder's right answers give the boss command");

console.log("  " + checked + " checks over " + RUNS + " shuffles; boss wrong-number branch spread: " + JSON.stringify(stats.bossWrong));
console.log(fails ? fails + " check(s) FAILED" : "All Agent Arena item checks passed");
process.exit(fails ? 1 : 0);
