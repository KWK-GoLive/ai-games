/*
 * AI games — the class scoreboard (board.html). Two tabs: LLM Arena and Agent Arena.
 * Reads the Google Sheet through the Apps Script web app; refreshes every few seconds.
 * URL options: ?class=SEC1  &game=llm|agent  &projector=1 (big text)
 */
(function () {
  "use strict";
  var A = window.ARENA, h = A.h, clear = A.clear;
  var CFG = window.AIG_CONFIG || {};
  var app = document.getElementById("app");
  var updated = document.getElementById("updated");
  var params = new URLSearchParams(location.search);
  var GAMES = [{ id: "llm", name: "LLM Arena" }, { id: "agent", name: "Agent Arena" }];
  var game = params.get("game") === "agent" ? "agent" : "llm";
  var classCode = A.cleanClass(params.get("class") || "");
  var refresh = Math.max(3, Number(CFG.BOARD_REFRESH_SECONDS) || 5) * 1000;
  var STAGE_NAMES = {
    llm: ["Count it", "Greedy writer", "Dice master", "Keyhole", "Chat brain", "Boss"],
    agent: ["Desk packer", "Search sniper", "Tool router", "Data detective", "Injection hunter", "Boss"]
  };
  if (params.get("projector") === "1") document.documentElement.classList.add("projector");

  if (!A.boardEnabled) {
    app.appendChild(h("section", { class: "card stack" },
      h("div", { class: "kicker", text: "Class scoreboard" }),
      h("h1", { text: "The scoreboard isn't connected yet" }),
      h("p", { text: "Paste your Google Apps Script web-app URL into SCOREBOARD_URL in config.js (see README, “Scoreboard”). Until then, the arenas still work and each student sees their own score." })));
    return;
  }

  var codeIn = h("input", { class: "text-input", id: "cc", maxlength: "20", value: classCode, style: "max-width:14em" });
  var tabs = h("div", { class: "tabs", role: "tablist" });
  var tabBtns = GAMES.map(function (g) {
    var b = h("button", { type: "button", role: "tab", "aria-selected": String(g.id === game), "data-game": g.id, text: g.name });
    b.addEventListener("click", function () { game = g.id; tabBtns.forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); }); syncUrl(); load(true); });
    tabs.appendChild(b);
    return b;
  });
  var csvBtn = h("button", { class: "btn", type: "button", text: "Download results (CSV)" });
  var projBtn = h("button", { class: "btn ghost", type: "button", text: "Big text" });
  var form = h("form", { class: "row" },
    h("label", { class: "field", for: "cc", style: "display:flex;gap:8px;align-items:center" }, "Class code", codeIn),
    h("button", { class: "btn primary", type: "submit", text: "Show" }));
  form.addEventListener("submit", function (e) { e.preventDefault(); classCode = A.cleanClass(codeIn.value); codeIn.value = classCode; syncUrl(); load(true); });
  projBtn.addEventListener("click", function () { document.documentElement.classList.toggle("projector"); });
  app.appendChild(h("section", { class: "card stack" },
    h("div", { class: "kicker", text: "Class scoreboard" }),
    h("div", { class: "row" }, tabs, h("span", { style: "flex:1" }), projBtn, csvBtn),
    form));
  var msg = h("p", { class: "feedback", "aria-live": "polite" });
  var body = h("div");
  app.appendChild(msg);
  app.appendChild(body);

  function syncUrl() {
    var q = new URLSearchParams(location.search);
    q.set("game", game); if (classCode) q.set("class", classCode); else q.delete("class");
    try { history.replaceState(null, "", "?" + q.toString()); } catch (e) { /* file:// */ }
  }

  var seq = 0;
  function load(show) {
    if (!classCode) { clear(body); msg.className = "feedback muted"; msg.textContent = "Type the class code to show its scoreboard."; return; }
    var my = ++seq;
    if (show) { msg.className = "feedback muted"; msg.textContent = "Loading…"; }
    A.apiGet({ action: "board", game: game, classCode: classCode }).then(function (r) {
      if (my !== seq) return;
      if (!r || !r.ok) throw new Error((r && r.error) || "bad reply");
      msg.textContent = ""; render(r);
      updated.textContent = "Updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }).catch(function (e) {
      if (my !== seq) return;
      msg.className = "feedback bad"; msg.textContent = "Can't reach the scoreboard right now (" + e.message + "). Retrying…";
    });
  }

  function render(r) {
    clear(body);
    var names = STAGE_NAMES[game];
    var gname = GAMES.filter(function (g) { return g.id === game; })[0].name;
    if (!r.players.length) {
      body.appendChild(h("section", { class: "card" }, h("p", { class: "muted", text: "No results yet for " + classCode + " in " + gname + ". Rows appear after each player finishes a stage." })));
      return;
    }
    var tb = h("tbody");
    r.players.forEach(function (p, i) {
      tb.appendChild(h("tr", { class: i === 0 ? "top1" : null },
        h("td", { class: "rank", text: String(i + 1) }),
        h("td", {}, h("b", { text: p.nickname }), p.team ? h("div", { class: "small muted", text: p.team }) : null),
        p.perStage.map(function (v) { return h("td", { class: "num", text: v == null ? "·" : String(v) }); }),
        h("td", { class: "num", text: p.correct + "/" + p.items }),
        h("td", { class: "num acc", text: p.items ? Math.round(100 * p.correct / p.items) + "%" : "–" }),
        h("td", { class: "num" }, h("b", { text: String(p.points) }))));
    });
    body.appendChild(h("section", { class: "card stack" },
      h("h2", { text: gname + " · " + classCode + " · " + r.players.length + " player" + (r.players.length === 1 ? "" : "s") }),
      h("div", { class: "table-wrap" }, h("table", { class: "board" },
        h("thead", {}, h("tr", {}, h("th", { text: "#" }), h("th", { text: "Player" }),
          names.map(function (n, i) { return h("th", { class: "num", title: n, text: "S" + (i + 1) }); }),
          h("th", { class: "num", text: "Right" }), h("th", { class: "num", title: "Share of answers fully right (speed doesn't count here)", text: "% right" }), h("th", { class: "num", text: "Points" }))),
        tb)),
      h("p", { class: "muted small", text: "Points include speed bonuses. “% right” shows careful answers, whatever the speed." }),
      h("p", { class: "muted small", text: "S1–S6 = stages: " + names.map(function (n, i) { return (i + 1) + " " + n; }).join(" · ") + ". Only each nickname's first run counts. Ties: more fully right answers, then less time." })));
    if (r.teams.length) {
      body.appendChild(h("section", { class: "card stack" },
        h("h2", { text: "Teams" }),
        h("div", { class: "table-wrap" }, h("table", { class: "board" },
          h("thead", {}, h("tr", {}, h("th", { text: "#" }), h("th", { text: "Team" }), h("th", { class: "num", text: "Members" }), h("th", { class: "num", text: "Average points" }))),
          h("tbody", {}, r.teams.map(function (t, i) {
            return h("tr", { class: i === 0 ? "top1" : null }, h("td", { class: "rank", text: String(i + 1) }), h("td", {}, h("b", { text: t.team })),
              h("td", { class: "num", text: String(t.members) }), h("td", { class: "num" }, h("b", { text: String(t.average) })));
          })))),
        h("p", { class: "muted small", text: "A team's score is the average of its members' points, so big and small teams are compared fairly." })));
    }
  }

  function csvCell(v) {
    var s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // don't let a spreadsheet treat it as a formula
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  csvBtn.addEventListener("click", function () {
    if (!classCode) { msg.className = "feedback bad"; msg.textContent = "Type the class code first."; return; }
    csvBtn.disabled = true;
    A.apiGet({ action: "rows", classCode: classCode }).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || "bad reply");
      var lines = [r.headers].concat(r.rows).map(function (row) { return row.map(csvCell).join(","); });
      var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "scoreboard-" + classCode + "-" + new Date().toISOString().slice(0, 10) + ".csv" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      msg.className = "feedback good"; msg.textContent = "✓ Downloaded " + r.rows.length + " rows (one per player per stage, both arenas).";
    }).catch(function (e) { msg.className = "feedback bad"; msg.textContent = "Download failed (" + e.message + ")."; })
      .then(function () { csvBtn.disabled = false; });
  });

  load(true);
  setInterval(function () { if (!document.hidden) load(false); }, refresh);
})();
