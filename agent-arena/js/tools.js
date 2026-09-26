/*
 * Agent Arena — the table tool, a bit more powerful than in Be the Agent: one WHERE filter, MAX and MIN.
 * A small hand-written interpreter (no eval). Works in the browser (window.AGA.Tools) and in Node for tests.
 *
 *   SHOW 5 ROWS                         COUNT ROWS
 *   TOTAL <column>                      TOTAL <column> BY <column>
 *   MAX <column>                        MIN <column>
 * Any of them can end with  WHERE <column> = <value>   or   WHERE <column> > <number>   or   < <number>
 */
(function (root) {
  "use strict";
  var E = (root.BTA && root.BTA.Engine) || require("../../be-the-agent/js/engine.js");

  var HELP = "Try: SHOW 5 ROWS, COUNT ROWS, TOTAL <column>, TOTAL <column> BY <column>, MAX <column>, MIN <column>, each optionally followed by WHERE <column> = <value> (or > / < a number).";

  function run(csvText, command) {
    var t = E.parseCsv(csvText);
    var cmd = String(command).replace(/\s+/g, " ").trim();
    function col(name) {
      var c = t.cols.filter(function (x) { return x.toLowerCase() === String(name).toLowerCase(); })[0];
      if (!c) throw new Error("there is no column called “" + name + "”. The columns are: " + t.cols.join(", ") + ".");
      return c;
    }
    function numeric(c, rows) {
      rows.forEach(function (r) { if (typeof r[c] !== "number") throw new Error("the column “" + c + "” has text in it, so it can't be added up or compared."); });
    }
    try {
      if (!cmd) throw new Error("the command is empty. " + HELP);
      var rows = t.rows, filterText = "";
      var wm = /^(.*?)\s+WHERE\s+(\w+)\s*(=|>|<)\s*(.+)$/i.exec(cmd);
      if (wm) {
        cmd = wm[1].trim();
        var fc = col(wm[2]), op = wm[3], raw = wm[4].trim().replace(/^["']|["']$/g, "");
        if (op !== "=") {
          if (isNaN(Number(raw))) throw new Error("“" + op + "” needs a number, like WHERE hours > 3.");
          numeric(fc, rows);
        }
        rows = rows.filter(function (r) {
          var v = r[fc];
          if (op === ">") return v > Number(raw);
          if (op === "<") return v < Number(raw);
          return typeof v === "number" && !isNaN(Number(raw)) ? v === Number(raw) : String(v).toLowerCase() === raw.toLowerCase();
        });
        filterText = " where " + fc + " " + op + " " + raw;
        if (!rows.length) return { ok: true, value: 0, rows: 0, text: "No rows match" + filterText + ". (Check the spelling: the values in “" + fc + "” are: " + uniqueVals(t.rows, fc) + ".)" };
      } else if (/\bWHERE\b/i.test(cmd)) {
        throw new Error("a WHERE needs a column, a sign and a value, like WHERE branch = River.");
      }
      var m;
      if ((m = /^SHOW\s+(\d+)\s+ROWS$/i.exec(cmd))) {
        var n = Math.min(parseInt(m[1], 10), rows.length, 30);
        return { ok: true, rows: rows.length, text: "First " + n + " of " + rows.length + " rows" + filterText, table: [t.cols].concat(rows.slice(0, n).map(function (r) { return t.cols.map(function (c) { return r[c]; }); })) };
      }
      if (/^COUNT\s+ROWS$/i.test(cmd)) return { ok: true, value: rows.length, rows: rows.length, text: rows.length + " rows" + filterText };
      if ((m = /^TOTAL\s+(\w+)\s+BY\s+(\w+)$/i.exec(cmd))) {
        var v = col(m[1]), g = col(m[2]), sums = {}, order = [];
        numeric(v, rows);
        rows.forEach(function (r) { if (!(r[g] in sums)) { sums[r[g]] = 0; order.push(r[g]); } sums[r[g]] += r[v]; });
        order.sort(function (a, b) { return sums[b] - sums[a]; });
        return { ok: true, rows: rows.length, text: "Sum of " + v + " for each " + g + filterText + " (biggest first)", groups: order.map(function (k) { return [k, sums[k]]; }),
          value: order.reduce(function (a, k) { return a + sums[k]; }, 0), table: [[g, "sum of " + v]].concat(order.map(function (k) { return [k, sums[k]]; })) };
      }
      if ((m = /^(TOTAL|MAX|MIN)\s+(\w+)$/i.exec(cmd))) {
        var op2 = m[1].toUpperCase(), c2 = col(m[2]);
        numeric(c2, rows);
        var vals = rows.map(function (r) { return r[c2]; });
        var val = op2 === "TOTAL" ? vals.reduce(function (a, b) { return a + b; }, 0) : op2 === "MAX" ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
        var word = op2 === "TOTAL" ? "Sum" : op2 === "MAX" ? "Largest" : "Smallest";
        return { ok: true, value: val, rows: rows.length, text: word + " of “" + c2 + "”" + filterText + " = " + val + " (from " + rows.length + " rows)" };
      }
      throw new Error("I don't understand “" + cmd + "”. " + HELP);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  function uniqueVals(rows, c) {
    var out = [];
    rows.forEach(function (r) { if (out.indexOf(String(r[c])) < 0) out.push(String(r[c])); });
    return out.slice(0, 8).join(", ") + (out.length > 8 ? ", …" : "");
  }

  var api = { run: run, HELP: HELP, Engine: E };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AGA = root.AGA || {};
  root.AGA.Tools = api;
})(typeof window !== "undefined" ? window : globalThis);
