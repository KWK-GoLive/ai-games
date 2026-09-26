/*
 * AI games — tap-to-build table questions (no typing, phone friendly).
 * The player taps chips; the builder shows the question in plain English and, underneath in small grey text,
 * the command the agent would really send to the table tool (e.g. TOTAL total BY branch WHERE bike = ebike).
 * The command is run by the game's existing table tool, so answer keys don't change.
 *
 * QB.describe(cmd)  -> plain-English sentence (also works in Node, for tests and hints)
 * QB.create(cfg)    -> { el, reset() }   (browser only)
 *   cfg: { csv, parse(csvText) -> {cols, rows}, run(cmd) -> result, onRun(cmd, result, sentence),
 *          actions: ["show","count","total","max","min"], group: true|false, where: true|false,
 *          file: "rentals.csv" }
 * QB.guided(cfg)    -> the three-question builder for the Agent Arena boss (see below).
 */
(function (root) {
  "use strict";

  /* ---------- plain English ---------- */
  var OPS = { "=": "is", ">": "is more than", "<": "is less than" };
  function describe(cmd) {
    var c = String(cmd || "").replace(/\s+/g, " ").trim(), where = "";
    var wm = /^(.*?)\s+WHERE\s+(\w+)\s*(=|>|<)\s*(.+)$/i.exec(c);
    if (wm) { c = wm[1]; where = ", only where " + wm[2] + " " + OPS[wm[3]] + " " + wm[4].replace(/^["']|["']$/g, ""); }
    var m;
    if ((m = /^SHOW (\d+) ROWS$/i.exec(c))) return "Show the first " + m[1] + " rows" + where;
    if (/^COUNT ROWS$/i.test(c)) return "Count the rows" + where;
    if ((m = /^TOTAL (\w+) BY (\w+)$/i.exec(c))) return "Add up " + m[1] + " for each " + m[2] + where;
    if ((m = /^TOTAL (\w+)$/i.exec(c))) return "Add up " + m[1] + where;
    if ((m = /^MAX (\w+)$/i.exec(c))) return "Find the biggest " + m[1] + where;
    if ((m = /^MIN (\w+)$/i.exec(c))) return "Find the smallest " + m[1] + where;
    return c + where;
  }

  var api = { describe: describe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.QB = api;
  if (typeof document === "undefined") return;

  /* ---------- DOM helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v; else if (k === "text") el.textContent = v;
      else if (v === true) el.setAttribute(k, ""); else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null) el.appendChild(typeof x === "string" ? document.createTextNode(x) : x); }); }
    return el;
  }
  /* A row of single-choice chips. options: [{ value, label }]. onPick(value). */
  function chipRow(label, options, onPick, opts) {
    opts = opts || {};
    var val = opts.value !== undefined ? opts.value : null;
    var group = h("div", { class: "qb-chips", role: "group", "aria-label": label });
    var btns = options.map(function (o) {
      var b = h("button", { type: "button", class: "qb-chip", "aria-pressed": String(o.value === val), "data-value": String(o.value) }, o.label);
      b.addEventListener("click", function () {
        val = o.value;
        btns.forEach(function (x, i) { x.setAttribute("aria-pressed", String(options[i].value === val)); });
        onPick(o.value);
      });
      group.appendChild(b);
      return b;
    });
    var row = h("div", { class: "qb-row" + (opts.hidden ? " qb-hidden" : "") }, h("div", { class: "qb-q", text: label }), group);
    return { el: row, get: function () { return val; }, show: function (on) { row.classList.toggle("qb-hidden", !on); } };
  }
  function uniq(rows, c) { var out = []; rows.forEach(function (r) { if (out.indexOf(r[c]) < 0) out.push(r[c]); }); return out; }

  var ACTIONS = {
    show: { label: "👀 Show 5 rows" }, count: { label: "🔢 Count rows" }, total: { label: "➕ Add up" },
    max: { label: "⬆️ Biggest" }, min: { label: "⬇️ Smallest" }
  };

  function create(cfg) {
    var t = cfg.parse(cfg.csv);
    var numCols = t.cols.filter(function (c) { return t.rows.every(function (r) { return typeof r[c] === "number"; }); });
    var textCols = t.cols.filter(function (c) { return numCols.indexOf(c) < 0; });
    // columns that can be filtered by tapping a value: text columns and numeric ones with few different values
    var filterCols = cfg.where === false ? [] : t.cols.filter(function (c) { return uniq(t.rows, c).length <= 10; });
    var st = { action: null, col: null, by: "", fcol: "", op: "=", fval: null };

    var box = h("div", { class: "qb" });
    var actions = (cfg.actions || ["show", "count", "total", "max", "min"]);
    var rAct = chipRow("1 · What should the table tool do?", actions.map(function (a) { return { value: a, label: ACTIONS[a].label }; }), function (v) { st.action = v; paint(); });
    var rCol = chipRow("2 · Which column?", numCols.map(function (c) { return { value: c, label: c }; }), function (v) { st.col = v; paint(); }, { hidden: true });
    var rBy = chipRow("3 · For each …? (optional)", [{ value: "", label: "No: one number" }].concat(textCols.map(function (c) { return { value: c, label: "for each " + c }; })), function (v) { st.by = v; paint(); }, { hidden: true, value: "" });
    var rF = chipRow("Only some rows? (optional)", [{ value: "", label: "All rows" }].concat(filterCols.map(function (c) { return { value: c, label: "only where " + c + " …" }; })), function (v) { st.fcol = v; st.op = "="; st.fval = null; buildValues(); paint(); }, { hidden: true, value: "" });
    var opHolder = h("div"), valHolder = h("div");
    var sentence = h("div", { class: "qb-sentence", "aria-live": "polite" });
    var cmdEl = h("div", { class: "qb-cmd" });
    var runBtn = h("button", { class: "btn primary qb-run", type: "button", text: "▶ Run the table tool", disabled: true });
    [rAct, rCol, rBy, rF].forEach(function (r) { box.appendChild(r.el); });
    box.appendChild(opHolder); box.appendChild(valHolder);
    box.appendChild(h("div", { class: "qb-preview" }, h("div", { class: "qb-preview-label", text: (cfg.file ? cfg.file + " · " : "") + "your question" }), sentence, cmdEl));
    box.appendChild(h("div", { class: "row end" }, runBtn));

    var rOp = null, rVal = null;
    function buildValues() {
      opHolder.textContent = ""; valHolder.textContent = ""; rOp = null; rVal = null;
      if (!st.fcol) return;
      var isNum = numCols.indexOf(st.fcol) >= 0;
      var vals = uniq(t.rows, st.fcol).sort(function (a, b) { return isNum ? a - b : String(a).localeCompare(String(b)); });
      if (isNum) {
        rOp = chipRow("… that is", [{ value: "=", label: "exactly" }, { value: ">", label: "more than" }, { value: "<", label: "less than" }], function (v) { st.op = v; paint(); }, { value: "=" });
        opHolder.appendChild(rOp.el);
      }
      rVal = chipRow(st.fcol + (isNum ? " (a number)" : " is …"), vals.map(function (v) { return { value: v, label: String(v) }; }), function (v) { st.fval = v; paint(); });
      valHolder.appendChild(rVal.el);
    }
    function command() {
      if (!st.action) return "";
      var c = st.action === "show" ? "SHOW 5 ROWS" : st.action === "count" ? "COUNT ROWS" : null;
      if (!c) {
        if (!st.col) return "";
        c = (st.action === "total" ? "TOTAL " : st.action === "max" ? "MAX " : "MIN ") + st.col + (st.action === "total" && st.by ? " BY " + st.by : "");
      }
      if (st.fcol) { if (st.fval === null) return ""; c += " WHERE " + st.fcol + " " + st.op + " " + st.fval; }
      return c;
    }
    function paint() {
      var needCol = st.action === "total" || st.action === "max" || st.action === "min";
      rCol.show(needCol);
      rBy.show(st.action === "total" && cfg.group !== false);
      if (st.action !== "total") st.by = "";
      rF.show(!!st.action && filterCols.length > 0);
      var c = command();
      sentence.textContent = c ? "“" + describe(c) + "”" : "Tap the choices above to build a question.";
      cmdEl.textContent = c ? "The agent sends: " + c : "";
      runBtn.disabled = !c;
    }
    runBtn.addEventListener("click", function () {
      var c = command(); if (!c) return;
      var r = cfg.run(c);
      if (cfg.onRun) cfg.onRun(c, r, describe(c));
    });
    paint();
    return { el: box, command: command };
  }

  /*
   * Guided builder: one plain question at a time, with a one-line reason after each answer.
   * cfg: { steps: [{ q, options: [{ value, label, why, right }] }], build(values) -> cmd, run, onRun, file }
   */
  function guided(cfg) {
    var box = h("div", { class: "qb qb-guided" });
    var vals = cfg.steps.map(function () { return null; });
    var sentence = h("div", { class: "qb-sentence", "aria-live": "polite" }), cmdEl = h("div", { class: "qb-cmd" });
    var runBtn = h("button", { class: "btn primary qb-run", type: "button", text: "▶ Run the table tool", disabled: true });
    var rows = cfg.steps.map(function (s, i) {
      var why = h("p", { class: "qb-why", "aria-live": "polite" });
      var r = chipRow((i + 1) + " · " + s.q, s.options.map(function (o) { return { value: o.value, label: o.label }; }), function (v) {
        vals[i] = v;
        var o = s.options.filter(function (x) { return x.value === v; })[0];
        why.textContent = (o.right ? "✓ " : "✗ ") + o.why;
        why.className = "qb-why " + (o.right ? "good" : "bad");
        if (i + 1 < rows.length) rows[i + 1].show(true);
        paint();
      }, { hidden: i > 0 });
      r.el.appendChild(why);
      box.appendChild(r.el);
      return r;
    });
    box.appendChild(h("div", { class: "qb-preview" }, h("div", { class: "qb-preview-label", text: (cfg.file ? cfg.file + " · " : "") + "your question" }), sentence, cmdEl));
    box.appendChild(h("div", { class: "row end" }, runBtn));
    function paint() {
      var done = vals.every(function (v) { return v !== null; });
      var c = done ? cfg.build(vals) : "";
      sentence.textContent = c ? "“" + describe(c) + "”" : "Answer the questions above.";
      cmdEl.textContent = c ? "The agent sends: " + c : "";
      runBtn.disabled = !c;
    }
    runBtn.addEventListener("click", function () { var c = cfg.build(vals); var r = cfg.run(c); if (cfg.onRun) cfg.onRun(c, r, describe(c)); });
    paint();
    return { el: box, values: function () { return vals.slice(); } };
  }

  api.create = create;
  api.guided = guided;
})(typeof window !== "undefined" ? window : globalThis);
