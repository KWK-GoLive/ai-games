/* Checks the scoreboard logic in apps-script/Code.gs (run in Node with a fake sheet). node tests/check-backend.js */
"use strict";
var S = require("./mock-server.js").load();
var fails = 0;
function check(c, m) { if (!c) { fails++; console.log("  FAIL  " + m); } }
function post(o) { return S.doPost(Object.assign({ game: "llm", classCode: "sec1", items: 5, correct: 3, seconds: 60, hints: 0, stageName: "x" }, o)); }

check(post({ nickname: "Ann", runId: "r1", stage: 1, points: 300 }).ok, "post ok");
check(post({ nickname: "Ann", runId: "r1", stage: 1, points: 300 }).duplicate, "same run + stage is ignored");
post({ nickname: "Ann", runId: "r1", stage: 2, points: 200, team: "Red" });
post({ nickname: "Bob", runId: "r2", stage: 1, points: 450, team: "red" });
post({ nickname: "ann", runId: "r9", stage: 3, points: 999 });            // second run under the same nickname
post({ nickname: "Cat", runId: "r3", stage: 1, points: 450, correct: 4 }); // tie on points, more correct
post({ nickname: "Dan", runId: "r4", stage: 1, points: 100, game: "agent" });
post({ nickname: "Eve", runId: "r5", stage: 1, points: 100, classCode: "SEC2" });
check(!post({ nickname: "", runId: "r6", stage: 1 }).ok, "nickname required");
check(post({ nickname: "x", runId: "r6", stage: 9 }).fatal === true && post({ nickname: "x", runId: "r6", stage: "abc" }).fatal === true, "a stage outside 0-6 is refused as fatal");
check(!post({ nickname: "x", runId: "r6", stage: 1, game: "chess" }).ok, "unknown game refused");
post({ nickname: "=HYPERLINK(1)", runId: "r7", stage: 1, points: 5 });
post({ nickname: "Mali มะลิ", runId: "r8", stage: 1, points: 5, points2: 1 });

var b = S.doGet({ action: "board", game: "llm", classCode: "SEC1" });
var names = b.players.map(function (p) { return p.nickname; });
console.log("  board:", names.join(", "));
check(b.ok && names[0] === "Ann" && b.players[0].points === 500, "Ann first with 500 (second run ignored)");
check(names[1] === "Cat" && names[2] === "Bob", "tie broken by number correct");
check(names.indexOf("Dan") < 0 && names.indexOf("Eve") < 0, "other game / class excluded");
check(names.indexOf("HYPERLINK1") >= 0, "formula characters stripped: " + names);
check(names.indexOf("Mali มะลิ") >= 0, "Thai nickname kept");
check(b.players[0].perStage[0] === 300 && b.players[0].perStage[1] === 200 && b.players[0].perStage[2] === null, "per-stage points");
check(b.teams.length === 1 && b.teams[0].members === 2 && b.teams[0].average === 475, "team average (case-insensitive team name): " + JSON.stringify(b.teams));
check(S.doGet({ action: "check", game: "llm", classCode: "sec1", nickname: "ANN", runId: "zzz" }).taken === true, "nickname taken by another run");
check(S.doGet({ action: "check", game: "llm", classCode: "sec1", nickname: "Ann", runId: "r1" }).taken === false, "own run is not 'taken'");
check(S.doGet({ action: "check", game: "agent", classCode: "sec1", nickname: "Ann", runId: "q" }).taken === false, "nickname per game");
var rows = S.doGet({ action: "rows", classCode: "SEC1" });
check(rows.rows.length === 8, "CSV rows for class SEC1 = 8, got " + rows.rows.length);
var r9 = rows.rows.filter(function (r) { return r[3] === "r9"; })[0];
check(r9 && r9[r9.length - 1] === "no", "later run marked counted=no");
check(!S.doGet({ action: "board", game: "llm" }).ok, "class code needed");
// joining (stage 0) claims the nickname; a second run with the same nickname is refused and its rows don't count
S.reset();
check(post({ nickname: "Zed", runId: "z1", stage: 0, items: 0, points: 0 }).ok, "join ok");
check(post({ nickname: "zed", runId: "z2", stage: 0, items: 0 }).taken === true, "second join with the same nickname is refused");
check(post({ nickname: "Zed", runId: "z1", stage: 1, points: 100 }).counted === true, "first run counts");
check(post({ nickname: "ZED", runId: "z2", stage: 1, points: 900 }).counted === false, "other run is told it doesn't count");
post({ nickname: "Yan", runId: "y1", stage: 0, items: 0, team: "Blue" });
var b2 = S.doGet({ action: "board", game: "llm", classCode: "SEC1" });
var z = b2.players.filter(function (p) { return p.nickname === "Zed"; })[0], y = b2.players.filter(function (p) { return p.nickname === "Yan"; })[0];
check(z.points === 100 && z.done === 1, "joined + one stage: 100 points, 1 stage done");
check(y && y.done === 0 && y.points === 0 && y.team === "Blue", "a player who has only joined is listed with 0");
post({ nickname: "Xu", runId: "x1", stage: 1, points: 200, team: "blue" });
check(S.doGet({ action: "board", game: "llm", classCode: "SEC1" }).teams.filter(function (t) { return t.team.toLowerCase() === "blue"; })[0].average === 200, "joined-only players don't pull the team average down");
post({ nickname: "Nt", runId: "t1", stage: 1, points: 10 });
check(S.rows().filter(function (r) { return r[4] === "Nt"; })[0][5] === "", "empty team is stored empty");
check(post({ nickname: "Big", runId: "b1", stage: 3, items: 12, points: 2700 }) && S.doGet({ action: "board", game: "llm", classCode: "SEC1" }).players.filter(function (p) { return p.nickname === "Big"; })[0].points === 2700, "12 items x 225 = 2700 is kept (no 2000 cap)");
post({ nickname: "Cap", runId: "c1", stage: 1, items: 2, points: 5000 });
check(S.doGet({ action: "board", game: "llm", classCode: "SEC1" }).players.filter(function (p) { return p.nickname === "Cap"; })[0].points === 450, "points capped at items x 225");
check(S.doPost({ game: "llm" }).fatal === true, "a bad row is marked fatal so the game stops re-sending it");
post({ nickname: "Num", runId: "n1", stage: 1, classCode: "01" });
check(S.doGet({ action: "board", game: "llm", classCode: "01" }).players.length === 1, "class code 01 stays text");

console.log(fails ? fails + " check(s) FAILED" : "All backend checks passed");
process.exit(fails ? 1 : 0);
