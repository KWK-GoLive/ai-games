/*
 * Checks the café data and the engine. Run from the project folder:  node tests/check-data.js
 * Exits with code 1 if any check fails.
 */
"use strict";
var path = require("path");
global.window = {};
require(path.join(__dirname, "../data/cafe.js"));
var D = window.BTA_DATA;
var E = require(path.join(__dirname, "../js/engine.js"));
var F = require(path.join(__dirname, "../js/files.js"));

var failures = 0;
function check(cond, msg) { if (!cond) { failures++; console.log("  FAIL  " + msg); } }

// sales: qty x price = total, and the totals the game quotes
var t = E.parseCsv(D.salesCsv);
check(t.rows.length === 30, "sales has 30 rows");
t.rows.forEach(function (r) { check(r.qty * r.price === r.total, "qty x price != total on " + r.date + " " + r.item); });
var byItem = E.runTable(D.salesCsv, "TOTAL total BY item");
var grand = E.runTable(D.salesCsv, "TOTAL total").value;
check(byItem.groups.reduce(function (a, g) { return a + g[1]; }, 0) === grand, "item totals add up to grand total");
console.log("  sales: 30 rows, total " + grand + ", best " + byItem.groups[0].join(" "));
check(!E.runTable(D.salesCsv, "TOTAL sales BY item").ok, "Level 4 error step: 'sales' column must not exist");

// calculator
check(E.calc("1284 * 37") === 47508, "calculator 1284*37");
check(E.calc("(2+3)*4-10/4") === 17.5, "calculator precedence");
["2+", "2**3", "alert(1)", "1/0"].forEach(function (x) { var bad = false; try { E.calc(x); } catch (e) { bad = true; } check(bad, "calculator should reject " + x); });

// desk: the name message must fall off during the Level 1 chat
var cap = 200, used = E.tokens(D.systemNote), fell = false, deskMsgs = [];
D.chat.forEach(function (m, i) {
  deskMsgs.push({ i: i, t: E.tokens(m.text) });
  used += E.tokens(m.text);
  while (used > cap) { var d = deskMsgs.shift(); used -= d.t; if (d.i === 0) fell = true; }
});
check(fell, "Level 1: the first message (the name) must fall off a " + cap + "-token desk");

// Level 2: questions, needed chunks, traps, and the search ranking the game relies on
D.fileQuestions.forEach(function (fq, qi) {
  var ids = D.handbook.map(function (c) { return c.id; });
  check(ids.indexOf(fq.need) >= 0 && ids.indexOf(fq.trap) >= 0, "Level 2 chunk ids exist for question " + (qi + 1));
  var top4 = E.search(fq.q, D.handbook).slice(0, 4).map(function (r) { return r.chunk.id; });
  check(top4.indexOf(fq.need) >= 0 && top4.indexOf(fq.trap) >= 0, "Level 2 question " + (qi + 1) + ": right piece and trap both in the top 4 (" + top4 + ")");
  console.log("  search Q" + (qi + 1) + " top 4: " + top4.join(", "));
});
var s2 = E.search(D.fileQuestions[1].q, D.handbook);
check(s2[0].chunk.id === D.fileQuestions[1].trap && s2[0].score > s2[1].score, "Level 2 question 2: the trap must be the TOP search result outright, not by a tie (the recap says so)");
var fileTok = D.handbook.reduce(function (a, c) { return a + E.tokens(c.title + " " + c.text); }, 0);
check(fileTok > cap - E.tokens(D.systemNote) - 30, "Level 2: the whole handbook must NOT fit on the desk (" + fileTok + " tokens)");

// Level 5 and 6 data
check(D.emails.filter(function (m) { return m.hidden; }).length === 1, "exactly one email hides an instruction");
check(D.webPage.hiddenIndex >= 0 && D.webPage.hiddenIndex < D.webPage.lines.length, "web page hidden line index");
check(D.requests.length === 8 && D.requests.some(function (r) { return r.ok; }) && D.requests.some(function (r) { return !r.ok; }), "Level 6 has 8 requests, mixed");

// files are valid zips with the right parts
var x = F.xlsx([{ name: "S", rows: [["a", "b"], [1, "=SUM(A2:A2)"]] }]);
var d = F.docx([{ h1: "T" }, { p: "x & <y>" }, { table: [["a"], ["b"]] }]);
check(x[0] === 0x50 && x[1] === 0x4b, "xlsx starts with a zip signature");
check(d[0] === 0x50 && d[1] === 0x4b, "docx starts with a zip signature");

console.log(failures ? failures + " check(s) FAILED" : "All checks passed");
process.exit(failures ? 1 : 0);
