/**
 * AI games — class scoreboard for LLM Arena and Agent Arena.
 *
 * Paste this whole file into Extensions → Apps Script of a Google Sheet you own,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 * See README.md, "Scoreboard".
 *
 * The games send one row per finished stage. Nothing but a nickname, optional team,
 * class code and the stage results is stored. Only a player's FIRST run counts on the board.
 */

var SHEET = "arena";
var HEADERS = ["time", "classCode", "game", "runId", "nickname", "team", "stage", "stageName",
  "items", "correct", "points", "seconds", "hints"];
var GAMES = ["llm", "agent"];
var STAGES = 6;
var MAX_ITEM_POINTS = 225;   // 100 + 50 speed, x1.5 streak: the most one item can give

/* ---------- helpers ---------- */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}
// Add a row. The text columns of the new row are set to Plain text BEFORE the values go in,
// so Sheets never turns a class code like "01" or "1-2" into a number or a date.
function addRow_(sh, values) {
  var r = sh.getLastRow() + 1;
  if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 100);
  while (String(sh.getRange(r, 1).getValue()) !== "") r++; // never overwrite a row (belt and braces with the lock)
  sh.getRange(r, 2, 1, 7).setNumberFormat("@"); // columns B-H in one call (fast); readRows_ turns stage back into a number
  sh.getRange(r, 1, 1, values.length).setValues([values]);
  SpreadsheetApp.flush(); // write now, before the lock is released, so the next request sees this row
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
// Letters (any language), digits, spaces, - and _ only. A leading = + - @ can't start a formula because
// the cell is plain text and we also strip those characters from the start.
function clean_(s, max) {
  s = String(s == null ? "" : s).replace(/[^\p{L}\p{M}\p{N} _\-]/gu, "").replace(/\s+/g, " ").trim();
  s = s.replace(/^[=+\-@]+/, "");
  return s.slice(0, max);
}
function cleanClass_(s) { return clean_(s, 20).replace(/[^A-Za-z0-9\-]/g, "-").toUpperCase(); }
function cleanNick_(s) { return clean_(s, 16); }
function num_(v, lo, hi) {
  var n = Math.round(Number(v));
  if (!isFinite(n)) n = 0;
  return Math.max(lo, Math.min(hi, n));
}
function cleanGame_(g) { g = String(g || "").toLowerCase(); return GAMES.indexOf(g) >= 0 ? g : ""; }

function readRows_() {
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var vals = sh.getRange(2, 1, n, HEADERS.length).getValues();
  return vals.map(function (r) {
    var o = {};
    HEADERS.forEach(function (h, i) { o[h] = r[i]; });
    o.time = o.time instanceof Date ? o.time.getTime() : Number(o.time) || 0;
    // (a stray leading apostrophe, e.g. from a row typed in by hand, is ignored)
    ["classCode", "runId", "nickname", "team", "stageName"].forEach(function (k) { o[k] = String(o[k] == null ? "" : o[k]).replace(/^'/, ""); });
    o.team = String(o.team || ""); o.game = String(o.game); o.stage = Number(o.stage) || 0;
    return o;
  });
}

/* The run that counts for each nickname = the first run we ever heard from under that nickname. */
function countedRuns_(rows) {
  var first = {};
  rows.forEach(function (r) {
    var k = r.nickname.toLowerCase();
    if (!first[k] || r.time < first[k].time) first[k] = { runId: r.runId, time: r.time };
  });
  return first;
}

function board_(game, classCode) {
  var rows = readRows_().filter(function (r) { return r.game === game && r.classCode === classCode; });
  var first = countedRuns_(rows);
  var players = {};
  rows.forEach(function (r) {
    var k = r.nickname.toLowerCase();
    if (first[k].runId !== r.runId) return; // a later run under the same nickname: ignored
    var p = players[k] || (players[k] = { nickname: r.nickname, team: r.team, stages: {}, points: 0, correct: 0, items: 0, seconds: 0, hints: 0 });
    if (r.stage < 1) { if (r.team) p.team = r.team; return; } // stage 0 = "joined" (nickname claimed at sign-in)
    if (p.stages[r.stage] != null) return; // duplicate send of the same stage
    p.stages[r.stage] = Number(r.points);
    p.points += Number(r.points); p.correct += Number(r.correct); p.items += Number(r.items);
    p.seconds += Number(r.seconds); p.hints += Number(r.hints);
    if (r.team) p.team = r.team;
  });
  var list = Object.keys(players).map(function (k) {
    var p = players[k];
    var per = [];
    for (var s = 1; s <= STAGES; s++) per.push(p.stages[s] == null ? null : p.stages[s]);
    return { nickname: p.nickname, team: p.team, perStage: per, done: Object.keys(p.stages).length,
      points: p.points, correct: p.correct, items: p.items, seconds: p.seconds, hints: p.hints };
  });
  list.sort(function (a, b) { return b.points - a.points || b.correct - a.correct || a.seconds - b.seconds || (a.nickname < b.nickname ? -1 : 1); });
  var teams = {};
  list.forEach(function (p) {
    if (!p.team || !p.done) return; // players who have only joined don't pull their team down
    var k = p.team.toLowerCase();
    var t = teams[k] || (teams[k] = { team: p.team, members: 0, total: 0 });
    t.members++; t.total += p.points;
  });
  var tlist = Object.keys(teams).map(function (k) { var t = teams[k]; return { team: t.team, members: t.members, average: Math.round(t.total / t.members) }; });
  tlist.sort(function (a, b) { return b.average - a.average || b.members - a.members; });
  return { ok: true, game: game, classCode: classCode, players: list, teams: tlist, updated: Date.now() };
}


/* ---------- web app ---------- */
// Body: { game, classCode, nickname, team, runId, stage (0 = joining), stageName, items, correct, points, seconds, hints }
// Reply: { ok, duplicate, counted } or, when joining with a nickname someone else already uses, { ok, taken: true }.
// fatal: true means "this row can never be accepted", so the game can stop re-sending it.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var game = cleanGame_(d.game), classCode = cleanClass_(d.classCode), nick = cleanNick_(d.nickname);
    var runId = clean_(d.runId, 40), stage = Number(d.stage);
    if (!game || !classCode || !nick || !runId || d.stage === "" || d.stage == null || !(stage >= 0 && stage <= STAGES && stage === Math.floor(stage)))
      return json_({ ok: false, fatal: true, error: "missing or invalid fields" });
    lock.waitLock(28000);
    var sh = sheet_();
    var mine = readRows_().filter(function (r) { return r.game === game && r.classCode === classCode; });
    var first = countedRuns_(mine.filter(function (r) { return r.nickname.toLowerCase() === nick.toLowerCase(); }))[nick.toLowerCase()];
    var counted = !first || first.runId === runId;
    if (stage === 0 && !counted) return json_({ ok: true, taken: true });
    var dup = mine.some(function (r) { return r.runId === runId && r.stage === stage; });
    if (!dup) {
      var items = num_(d.items, 0, 50);
      addRow_(sh, [new Date(), classCode, game, runId, nick, clean_(d.team, 20), stage, stage ? clean_(d.stageName, 30) : "joined",
        items, num_(d.correct, 0, items), num_(d.points, 0, items * MAX_ITEM_POINTS), num_(d.seconds, 0, 36000), num_(d.hints, 0, items)]);
    }
    return json_({ ok: true, duplicate: dup, counted: counted });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) }); // e.g. busy: the game will try again
  } finally {
    try { lock.releaseLock(); } catch (x) { /* not held */ }
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = String(p.action || "board");
  var classCode = cleanClass_(p.classCode || p["class"]);
  try {
    if (action === "ping") return json_({ ok: true, time: Date.now() });
    // The games send results as a GET (action=post&payload=...): a browser POST to Apps Script is redirected,
    // and some browsers then lose the reply. The payload is the same JSON doPost takes.
    if (action === "post") return doPost({ postData: { contents: String(p.payload || "{}") } });
    if (!classCode) return json_({ ok: false, error: "class code needed" });
    if (action === "board") {
      var game = cleanGame_(p.game);
      if (!game) return json_({ ok: false, error: "unknown game" });
      return json_(board_(game, classCode));
    }
    if (action === "check") {
      // Is this nickname already used by a different run in this class and game?
      var g2 = cleanGame_(p.game), nick = cleanNick_(p.nickname).toLowerCase(), run = clean_(p.runId, 40);
      var rows = readRows_().filter(function (r) { return r.game === g2 && r.classCode === classCode && r.nickname.toLowerCase() === nick; });
      var first = countedRuns_(rows)[nick];
      return json_({ ok: true, taken: !!(first && first.runId !== run) });
    }
    if (action === "rows") {
      // Every row for one class (both games) for the teacher's CSV download. "counted" marks first runs.
      var all = readRows_().filter(function (r) { return r.classCode === classCode; });
      var counted = {};
      GAMES.forEach(function (g) {
        var f = countedRuns_(all.filter(function (r) { return r.game === g; }));
        Object.keys(f).forEach(function (k) { counted[g + "|" + f[k].runId] = true; });
      });
      return json_({ ok: true, headers: HEADERS.concat(["counted"]), rows: all.map(function (r) {
        return HEADERS.map(function (h) { return h === "time" ? new Date(r.time).toISOString() : r[h]; })
          .concat([counted[r.game + "|" + r.runId] ? "yes" : "no"]);
      }) });
    }
    return json_({ ok: false, error: "unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* Run once from the editor to create the sheet and check permissions. */
function testSetup() {
  sheet_();
  doPost({ postData: { contents: JSON.stringify({ game: "llm", classCode: "TEST", nickname: "setup-check", runId: "setup", stage: 1, stageName: "test", items: 1, correct: 1, points: 100, seconds: 5, hints: 0 }) } });
  Logger.log(JSON.stringify(board_("llm", "TEST")));
}
