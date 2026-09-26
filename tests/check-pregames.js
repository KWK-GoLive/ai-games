/*
 * Checks that the two pre-games show only what really happened:
 *  - every chatbot reply in pregame-llm/data.js is character-identical to the raw record;
 *  - every agent-replay excerpt in pregame-agent/data.js is made of pieces ("…" = cut) found in that step's raw record;
 *  - the agent's files are the real output files, and the numbers the game states are true for sales.csv.
 *   node tests/check-pregames.js     Exits 1 on any failure.
 */
"use strict";
var fs = require("fs"), path = require("path");
var R = path.join(__dirname, "..");
var fails = 0, checked = 0;
function check(c, m) { checked++; if (!c) { fails++; console.log("  FAIL  " + m); } }
global.window = {};
require(path.join(R, "pregame-llm/data.js"));
require(path.join(R, "pregame-agent/data.js"));
var L = window.PG_LLM, A = window.PG_AGENT;

/* ---- LLM replies ---- */
var raw = JSON.parse(fs.readFileSync(path.join(R, "pregames/data/raw/llm-runs.json"), "utf8"));
function rawOf(g) { return raw.runs.filter(function (r) { return r.group === g; }); }
[["S1", L.sentences[0]], ["S2", L.sentences[1]], ["S3", L.sentences[2]], ["Q", L.same], ["M", L.madeup]].forEach(function (x) {
  var rr = rawOf(x[0]);
  check(rr.length === 5 && x[1].replies.length === 5, x[0] + ": 5 runs");
  rr.forEach(function (r, i) {
    check(x[1].replies[i] === r.reply, x[0] + " run " + (i + 1) + ": reply identical to the raw record");
    check(r.model === L.model, x[0] + " run " + (i + 1) + ": model " + r.model);
    check(r.tools.length === 1 && r.tools[0] === "SubagentHandback", x[0] + " run " + (i + 1) + ": no tools used");
    check(r.prompt === L.wrapper + "\n\nUser's message:\n" + x[1].prompt, x[0] + " run " + (i + 1) + ": prompt as stated");
    check(r.time && r.time.slice(0, 10) === L.recorded, x[0] + " run " + (i + 1) + ": recorded on " + L.recorded);
  });
});
L.same.names.forEach(function (n, i) { check(L.same.replies[i].indexOf(n) >= 0, "name " + n + " is in reply " + (i + 1)); });
check(new Set(L.same.names).size === 4, "4 different names");
L.sentences.forEach(function (s) { check(s.prompt.indexOf(s.start) >= 0, "sentence start matches the prompt: " + s.start); });

/* ---- agent replay ---- */
var ar = JSON.parse(fs.readFileSync(path.join(R, "pregames/data/raw/agent-run.json"), "utf8"));
function rawText(i) { var s = ar.steps[i]; return s.kind === "tool_use" ? (s.input.command || s.input.skill || s.input.file_path || JSON.stringify(s.input)) : String(s.text); }
var callShown = {};
A.steps.forEach(function (s) {
  var parts = [["said", s.said, s.calls.reduce(function (a, c) { return a.concat(c.raw); }, [])], ["said2", s.said2, s.calls.reduce(function (a, c) { return a.concat(c.raw); }, [])]];
  s.calls.forEach(function (c) { parts.push(["call", c.call, c.raw]); parts.push(["result", c.result, c.raw]); callShown[c.raw[0]] = c.call && c.call.length > 0; });
  parts.forEach(function (x) {
    if (!x[1]) return;
    var pool = (x[0].indexOf("said") === 0 ? (s.saidRaw || []) : x[2]).map(rawText).join("\n");
    x[1].split("…").map(function (p) { return p.replace(/^\n|\n$/g, "").trim(); }).filter(Boolean).forEach(function (p) {
      check(pool.indexOf(p) >= 0, s.id + "." + x[0] + ": excerpt found in raw steps " + x[2].join(",") + ": " + JSON.stringify(p.slice(0, 60)));
    });
  });
});
// every tool call of the run is shown with its own command, in the order it happened
var order = [];
A.steps.forEach(function (s) { s.calls.forEach(function (c) { order.push(c.raw[0]); }); });
check(order.every(function (v, i) { return !i || v > order[i - 1]; }), "replay order = real order: " + order.join(","));
ar.steps.forEach(function (s, i) { if (s.kind === "tool_use" && s.name !== "SubagentHandback") check(callShown[i] === true, "tool call " + i + " (" + s.name + ") is shown with its command"); });
check(A.final === ar.steps[31].input.message, "final message identical to the raw record");
check(ar.steps.some(function (s) { return s.kind === "tool_use"; }) && ar.model === A.model, "agent model " + ar.model);
["sales.csv", "sales_summary.xlsx", "sales_memo.docx"].forEach(function (f) {
  var a = fs.readFileSync(path.join(R, "pregame-agent/files", f)), b = fs.readFileSync(path.join(R, "pregames/data/raw", f === "sales.csv" ? f : "agent-output/" + f));
  check(a.equals(b), f + ": the game's file is the real run's file");
});
// the claims the game marks as right or wrong, recomputed from sales.csv
var rows = fs.readFileSync(path.join(R, "pregame-agent/files/sales.csv"), "utf8").trim().split(/\r?\n/).slice(1).map(function (l) { return l.split(","); });
check(rows.length === 38, "38 rows");
var complete = rows.filter(function (r) { return r[2] !== "" && r[4] !== ""; });
var tot = complete.reduce(function (a, r) { return a + Number(r[4]); }, 0);
var bp = complete.filter(function (r) { return r[1] === "Backpack"; }).reduce(function (a, r) { return a + Number(r[4]); }, 0);
check(complete.length === 37 && tot === 10497, "37 complete rows, total 10,497");
check(Math.round(bp / tot * 1000) / 10 === 64.3, "backpacks 64.3%");
var jul5 = rows.filter(function (r) { return r[0] === "2026-07-05" && r[1] === "Backpack"; })[0];
check(jul5 && jul5.join(",") === "2026-07-05,Backpack,,450," && A.claims[1].why.indexOf("2026-07-05,Backpack,,450,") >= 0, "July 5 row: price there, quantity and total missing");
// the three memo claims are exact quotes ("…" = cut); every tool step of the run is shown
var memo = JSON.parse(fs.readFileSync(path.join(R, "pregame-agent/files/preview.json"), "utf8")).docx.map(function (b) { return b.h1 || b.p; }).join(" ");
A.claims.slice(0, 3).forEach(function (c) { c.text.replace(/^“|”$/g, "").split("…").map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (piece) { check(memo.indexOf(piece) >= 0, "memo quote found: " + piece.slice(0, 50)); }); });
check(ar.steps[10].input.command.indexOf("find / ") === 0 && ar.steps[8].input.command.indexOf("/tmp/") >= 0, "the out-of-folder steps really happened");
check(fs.readFileSync(path.join(R, "pregame-agent/files/sales.csv"), "utf8").split(/\r?\n/)[0] === "date,product,qty,unit_price,total", "no cost column in sales.csv (so margin can't be known)");
var prev = JSON.parse(fs.readFileSync(path.join(R, "pregame-agent/files/preview.json"), "utf8"));
check(prev.docx.map(function (b) { return b.h1 || b.p; }).join(" ").indexOf("suggesting good margin-per-sale") >= 0, "the memo really says 'margin-per-sale'");
check(prev.docx.map(function (b) { return b.p || ""; }).join(" ").indexOf("is missing its quantity and price") >= 0, "the memo really says 'missing its quantity and price'");

require(path.join(R, "pregame-agent/files/preview.js"));
check(JSON.stringify(window.PG_AGENT_FILES.xlsx) === JSON.stringify(prev.xlsx) && JSON.stringify(window.PG_AGENT_FILES.docx) === JSON.stringify(prev.docx), "preview.js = preview.json");
check(window.PG_AGENT_FILES.csv === fs.readFileSync(path.join(R, "pregame-agent/files/sales.csv"), "utf8"), "preview.js holds the real sales.csv");
console.log("  " + checked + " checks");
console.log(fails ? fails + " check(s) FAILED" : "All pre-game checks passed");
process.exit(fails ? 1 : 0);
