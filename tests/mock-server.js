/*
 * Runs the REAL apps-script/Code.gs inside Node with a fake Google Sheet, behind a tiny HTTP server,
 * so the games and the board can be tested without Google.
 *   node tests/mock-server.js [port]         (default 8765)
 * Extra endpoints for tests:  POST /__offline {"on":true|false}   GET /__dump   POST /__reset
 * Also usable as a module: require("./mock-server.js").load() -> { doGet, doPost, rows }
 */
"use strict";
var fs = require("fs"), path = require("path"), vm = require("vm"), http = require("http"), url = require("url");

function load() {
  var data = [];           // rows of the fake sheet (row 0 = headers)
  var clock = Date.UTC(2026, 8, 1, 9, 0, 0);
  function Range(r, c, nr, nc) {
    return {
      setValues: function (v) { for (var i = 0; i < nr; i++) { data[r - 1 + i] = data[r - 1 + i] || []; for (var j = 0; j < nc; j++) { var x = v[i][j]; if (x instanceof Date) x = new Date(clock += 1000); data[r - 1 + i][c - 1 + j] = x; } } return this; },
      getValues: function () { var out = []; for (var i = 0; i < nr; i++) { var row = []; for (var j = 0; j < nc; j++) row.push((data[r - 1 + i] || [])[c - 1 + j]); out.push(row); } return out; },
      setNumberFormat: function () { return this; },
      getValue: function () { var row = data[r - 1]; return row && row[c - 1] != null ? row[c - 1] : ""; }
    };
  }
  var sheet = null;
  var ctx = {
    SpreadsheetApp: { flush: function () {}, getActiveSpreadsheet: function () { return {
      getSheetByName: function () { return sheet; },
      insertSheet: function () { sheet = {
        getRange: function (r, c, nr, nc) { return Range(r, c, nr || 1, nc || 1); },
        setFrozenRows: function () {}, getMaxRows: function () { return 100000; },
        getLastRow: function () { return data.length; },
        insertRowsAfter: function () {}
      }; return sheet; }
    }; } },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: function (t) { return { text: t, setMimeType: function () { return this; } }; } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Logger: { log: function () {} },
    Date: Date, JSON: JSON, Math: Math, String: String, Number: Number, Object: Object, isFinite: isFinite
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../apps-script/Code.gs"), "utf8"), ctx);
  return {
    doGet: function (params) { return JSON.parse(ctx.doGet({ parameter: params }).text); },
    doPost: function (body) { return JSON.parse(ctx.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }).text); },
    rows: function () { return data; },
    reset: function () { data.length = 0; sheet = null; }
  };
}

function serve(port) {
  var S = load(), offline = false;
  var srv = http.createServer(function (req, res) {
    var u = url.parse(req.url, true);
    var cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    var body = "";
    req.on("data", function (c) { body += c; });
    req.on("end", function () {
      if (u.pathname === "/__offline") { offline = !!JSON.parse(body || "{}").on; res.writeHead(200, cors); return res.end("{}"); }
      if (u.pathname === "/__reset") { S.reset(); res.writeHead(200, cors); return res.end("{}"); }
      if (u.pathname === "/__dump") { res.writeHead(200, cors); return res.end(JSON.stringify(S.rows())); }
      if (offline) { req.socket.destroy(); return; }
      var out;
      if (req.method === "POST") out = S.doPost(body);
      else if (req.method === "GET") out = S.doGet(u.query);
      else { res.writeHead(204, cors); return res.end(); }
      res.writeHead(200, cors); res.end(JSON.stringify(out));
    });
  });
  srv.listen(port || 8765, "127.0.0.1");
  return srv;
}

module.exports = { load: load, serve: serve };
if (require.main === module) {
  var p = parseInt(process.argv[2] || "8765", 10);
  serve(p);
  console.log("mock scoreboard on http://127.0.0.1:" + p);
}
