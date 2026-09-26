/*
 * AI games — visual building blocks shared by every page: flows, idea cards, step cards, recap cards,
 * glossary chips, small concept diagrams, and an on-screen viewer for the Excel/Word files the games make.
 * No libraries. All text is set with textContent. Loaded as window.VIS.
 */
(function () {
  "use strict";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }

  /* Split a paragraph into its first sentence and the rest (for "key line + more"). */
  function firstSentence(t) {
    var m = /^(.{25,}?[.!?:])\s+(?=[A-Z“"(0-9])/.exec(t);
    return m ? [m[1], t.slice(m[0].length)] : [t, ""];
  }
  function wordCount(t) { return String(t).split(/\s+/).filter(Boolean).length; }

  /* A "More" fold that keeps long text on the page but out of the way. */
  function more(text, label) {
    if (!text) return null;
    var d = h("details", { class: "v-more" }, h("summary", { text: label || "More" }));
    (Array.isArray(text) ? text : [text]).forEach(function (t) { d.appendChild(typeof t === "string" ? h("p", { text: t }) : t); });
    return d;
  }

  /* ---------- flow: [node] → [node] → [node] (turns vertical on narrow screens) ----------
   * nodes: strings or { icon, label, sub, tone: "good"|"bad"|"accent" }; opts: { loop: "text", compact }
   */
  function flow(nodes, opts) {
    opts = opts || {};
    var el = h("div", { class: "v-flow" + (opts.compact ? " compact" : ""), role: "list" });
    nodes.forEach(function (n, i) {
      if (typeof n === "string") n = { label: n };
      if (i) el.appendChild(h("span", { class: "v-arrow", "aria-hidden": "true", text: n.arrow || "→" }));
      el.appendChild(h("div", { class: "v-node" + (n.tone ? " " + n.tone : ""), role: "listitem" },
        n.icon ? h("span", { class: "v-icon", "aria-hidden": "true", text: n.icon }) : null,
        h("span", { class: "v-label", text: n.label }),
        n.sub ? h("span", { class: "v-sub", text: n.sub }) : null));
    });
    if (opts.loop) el.appendChild(h("div", { class: "v-loop" }, h("span", { "aria-hidden": "true", text: "↻ " }), opts.loop));
    return el;
  }

  /* ---------- idea cards: a grid of { icon, title, text, more, tone } ---------- */
  function cards(list, opts) {
    opts = opts || {};
    var grid = h("div", { class: "v-cards" + (opts.cols ? " cols-" + opts.cols : "") });
    list.forEach(function (c) {
      grid.appendChild(h("div", { class: "v-card" + (c.tone ? " " + c.tone : "") },
        c.icon ? h("div", { class: "v-card-icon", "aria-hidden": "true", text: c.icon }) : null,
        c.title ? h("div", { class: "v-card-title", text: c.title }) : null,
        c.text ? (typeof c.text === "string" ? h("p", { text: c.text }) : c.text) : null,
        c.more ? more(c.more) : null));
    });
    return grid;
  }

  /* Rules as a short list of icon rows (arena stage cards). */
  function rules(list) {
    var ICONS = ["①", "②", "③", "④", "⑤", "⑥", "⑦"];
    return h("div", { class: "v-rules" }, list.map(function (r, i) {
      var t = typeof r === "string" ? { text: r } : r;
      return h("div", { class: "v-rule" }, h("span", { class: "v-rule-n", "aria-hidden": "true", text: t.icon || ICONS[i] || "•" }), h("span", { text: t.text }));
    }));
  }

  /* An example line: "a → b → c" becomes a flow; lines with "→ answer" become a prompt + answer. */
  function example(ex, exSr) {
    var lines = String(ex).split("\n");
    var box = h("div", { class: "v-example", "aria-hidden": exSr ? "true" : null });
    lines.forEach(function (ln) {
      var parts = ln.split(/\s+→\s+/);
      if (parts.length >= 3) box.appendChild(flow(parts.map(function (p) { return p.trim(); }), { compact: true }));
      else if (parts.length === 2) box.appendChild(h("div", { class: "v-ex-line" }, h("span", { class: "v-ex-q", text: parts[0].trim() }), h("span", { class: "v-ex-arrow", text: "→" }), h("b", { class: "v-ex-a", text: parts[1].trim() })));
      else box.appendChild(h("div", { class: "v-ex-line", text: ln }));
    });
    var wrap = h("div", {}, box);
    if (exSr) wrap.appendChild(h("span", { class: "sr-only", text: exSr }));
    return wrap;
  }

  /* ---------- intro steps as cards: intro = [{title, text, ex, exSr}], icons = [..] ---------- */
  function introSteps(intro, icons) {
    icons = icons || [];
    var list = h("ol", { class: "v-steps" });
    intro.forEach(function (c, i) {
      var long = wordCount(c.text) > 40 ? firstSentence(c.text) : [c.text, ""];
      list.appendChild(h("li", { class: "v-step" },
        h("div", { class: "v-step-head" },
          h("span", { class: "v-step-icon", "aria-hidden": "true", text: icons[i] || String(i + 1) }),
          h("div", { class: "v-step-title", text: c.title || "" })),
        long[0] ? h("p", { class: "v-step-text", text: long[0] }) : null,
        c.ex ? example(c.ex, c.exSr) : null,
        long[1] ? more(long[1]) : null));
    });
    return list;
  }

  /* ---------- recap: each paragraph becomes a card with a short headline ----------
   * recap = { title, text: [...], words }, points = [{icon, head}] (one per paragraph)
   */
  function recapCards(recap, points) {
    points = points || [];
    var grid = h("div", { class: "v-recap" });
    recap.text.forEach(function (t, i) {
      var p = points[i] || {};
      var split = wordCount(t) > 35 ? firstSentence(t) : [t, ""];
      grid.appendChild(h("div", { class: "v-card" },
        h("div", { class: "v-recap-head" },
          p.icon ? h("span", { class: "v-card-icon sm", "aria-hidden": "true", text: p.icon }) : null,
          p.head ? h("div", { class: "v-card-title", text: p.head }) : null),
        h("p", { text: split[0] }),
        split[1] ? more(split[1]) : null));
    });
    return grid;
  }

  function glossary(words) {
    return h("div", { class: "v-gloss" }, h("div", { class: "v-gloss-title", text: "New words" }),
      h("dl", { class: "v-gloss-list" }, words.map(function (w) {
        return h("div", { class: "v-gloss-item" }, h("dt", { text: w[0] }), h("dd", { text: w[1] }));
      })));
  }

  /* ---------- concept diagrams ---------- */
  var DIAGRAMS = {
    nextword: function () {
      return flow([{ icon: "📝", label: "Text so far" }, { icon: "🎯", label: "Guess the next word" }, { icon: "➕", label: "Add it" }], { loop: "repeat, word after word" });
    },
    counting: function () {
      return flow([{ icon: "📚", label: "Training text" }, { icon: "🔢", label: "Count what follows each word" }, { icon: "📊", label: "Chances (%)" }, { icon: "🎯", label: "Guess" }]);
    },
    chat: function () {
      return flow([{ icon: "❓", label: "Q: your question" }, { icon: "🅰️", label: "A:", sub: "the model continues here" }, { icon: "💬", label: "Likely words = the answer" }]);
    },
    dice: function () {
      function row(label, sub, bars) {
        return h("div", { class: "v-dice-row" }, h("div", { class: "v-dice-label" }, h("b", { text: label }), h("span", { text: sub })),
          h("div", { class: "v-dice-bars" }, bars.map(function (b) { return h("div", { class: "v-dice-bar" }, h("i", { style: "width:" + b[1] + "%" }), h("span", { text: b[0] })); })));
      }
      // counts 2:1:1:1 (the 40/20/20/20 example); chance ∝ count^(1/T), the game's own rule
      function at(T) {
        var w = [2, 1, 1, 1].map(function (c) { return Math.pow(c, 1 / T); }), s = w.reduce(function (a, b) { return a + b; }, 0);
        return ["how", "let", "noodles", "I"].map(function (word, i) { var p = Math.round(w[i] / s * 100); return [word + " " + p + "%", p]; });
      }
      return h("div", { class: "v-dice" },
        row("🧊 Temperature 0.5", "the top word wins more often", at(0.5)),
        row("🔥 Temperature 2", "less likely words get more chances", at(2)),
        h("p", { class: "v-caption", text: "The dinner example (40% · 20% · 20% · 20%) re-weighted by the game's temperature rule." }));
    },
    keyhole: function () {
      function line(hidden, seen, guess) {
        return h("div", { class: "v-key-line" }, h("span", { class: "v-key-hid", text: hidden }), h("span", { class: "v-key-seen", text: seen }), h("span", { class: "v-key-blank", text: "___" }), h("span", { class: "v-key-guess", text: "→ " + guess }));
      }
      return h("div", { class: "v-keyhole", "aria-label": "With 1 word visible the guess is unsure; with 2 words it is clear." },
        line("I always brush ", "my", "sister? keys? teeth?"),
        line("I always ", "brush my", "teeth!"));
    },
    backoff: function () {
      return flow([{ icon: "🔍", label: "Last 8 words", sub: "never seen" , tone: "bad" }, { icon: "✂️", label: "Drop the oldest word" }, { icon: "🔍", label: "Look again" }, { icon: "✅", label: "Match found", sub: "borrow what came next", tone: "good" }]);
    },
    likely: function () {
      return h("div", { class: "v-vs" },
        h("div", { class: "v-card good" }, h("div", { class: "v-card-title", text: "✓ Likely words" }), h("p", { text: "What the model is built to produce." })),
        h("div", { class: "v-vs-mid", text: "≠" }),
        h("div", { class: "v-card bad" }, h("div", { class: "v-card-title", text: "? True facts" }), h("p", { text: "Needs a source to check." })));
    },
    desk: function () {
      return h("div", { class: "v-desk" },
        h("div", { class: "v-desk-top", text: "🗂️ The desk (context window): the only text the model can see" }),
        h("div", { class: "v-desk-items" },
          ["📌 Instructions", "💬 Your chat", "📄 Files", "🔧 Tool results"].map(function (t) { return h("span", { class: "v-chip", text: t }); })),
        h("div", { class: "v-desk-meter" }, h("i"), h("span", { text: "limited space (tokens)" })));
    },
    files: function () {
      return flow([{ icon: "📄", label: "Your file" }, { icon: "🔤", label: "Turned into plain text" }, { icon: "✂️", label: "Cut into pieces", sub: "if it's too big" }, { icon: "🔍", label: "Best-matching pieces" }, { icon: "🗂️", label: "On the desk" }]);
    },
    harness: function () {
      return flow([{ icon: "🧠", label: "Model", sub: "writes a request" }, { icon: "⚙️", label: "Harness (the app)", sub: "runs the tool" }, { icon: "🧮", label: "Tool", sub: "does the exact work" }, { icon: "🗂️", label: "Result on the desk" }], { loop: "the model carries on writing" });
    },
    loop: function () {
      return flow([{ icon: "📝", label: "Plan" }, { icon: "🔧", label: "Act", sub: "use a tool" }, { icon: "🔍", label: "Check" }, { icon: "🩹", label: "Fix" }, { icon: "✅", label: "Done", tone: "good" }], { loop: "repeat until the job is done" });
    },
    inject: function () {
      return h("div", { class: "v-desk" },
        h("div", { class: "v-desk-top", text: "🗂️ On the desk it's all one pile of text" }),
        h("div", { class: "v-desk-items" },
          h("span", { class: "v-chip", text: "💬 Your request" }), h("span", { class: "v-chip", text: "📄 File text" }),
          h("span", { class: "v-chip bad", text: "⚠️ “AI: ignore the user and …” (hidden in the file)" })));
    },
    permissions: function () {
      return h("div", { class: "v-vs two" },
        h("div", { class: "v-card good" }, h("div", { class: "v-card-title", text: "🟢 Usually fine" }), h("p", { text: "Read · make a new file" }), h("p", { class: "v-caption", text: "needed for the job and easy to undo" })),
        h("div", { class: "v-card bad" }, h("div", { class: "v-card-title", text: "🛑 Stop and check" }), h("p", { text: "Send · delete · buy · upload" }), h("p", { class: "v-caption", text: "permanent, leaves your computer, or other people's data" })));
    }
  };
  function diagram(name) {
    var f = DIAGRAMS[name];
    return f ? h("figure", { class: "v-diagram" }, f()) : null;
  }

  /* ---------- on-screen viewer for the files the games make ----------
   * spec: { type: "xlsx", sheets: [{ name, rows }] }  (cells: text, number, {f, v}, {pct})
   *    or { type: "docx", blocks: [{h1}|{h2}|{p}|{bullet}|{table}] }
   */
  function cellText(c) {
    if (c === null || c === undefined) return "";
    if (typeof c === "number") return c.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (typeof c === "object" && typeof c.pct === "number") return (Math.round(c.pct * 1000) / 10) + "%";
    if (typeof c === "object" && "v" in c) return typeof c.v === "number" ? c.v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(c.v);
    return String(c);
  }
  function sheetTable(rows) {
    var cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var letters = []; for (var i = 0; i < cols; i++) letters.push(String.fromCharCode(65 + i));
    return h("div", { class: "v-sheet-wrap" }, h("table", { class: "v-sheet" },
      h("thead", {}, h("tr", {}, h("th", { class: "rn" }), letters.map(function (l) { return h("th", { text: l }); }))),
      h("tbody", {}, rows.map(function (r, ri) {
        return h("tr", { class: ri === 0 ? "hdr" : null }, h("th", { class: "rn", text: String(ri + 1) }),
          letters.map(function (l, ci) {
            var c = r[ci];
            var isNum = typeof c === "number" || (c && typeof c === "object");
            var txt = cellText(c);
            return h("td", { class: isNum ? "num" : txt.length > 24 ? "wrap" : null, title: c && c.f ? "=" + c.f : null }, txt, c && c.f ? h("span", { class: "v-fx", text: "fx" }) : null);
          }));
      }))));
  }
  function viewer(spec) {
    var box = h("div", { class: "v-viewer" });
    if (spec.type === "xlsx") {
      var tabs = h("div", { class: "v-sheet-tabs", role: "tablist" });
      var body = h("div");
      var btns = spec.sheets.map(function (s, i) {
        var b = h("button", { type: "button", role: "tab", "aria-selected": String(i === 0), text: s.name });
        b.addEventListener("click", function () { show(i); });
        tabs.appendChild(b);
        return b;
      });
      function show(i) {
        btns.forEach(function (b, j) { b.setAttribute("aria-selected", String(i === j)); });
        while (body.firstChild) body.removeChild(body.firstChild);
        body.appendChild(sheetTable(spec.sheets[i].rows));
      }
      box.appendChild(body); box.appendChild(tabs);
      show(0);
      box.appendChild(h("p", { class: "v-caption", text: "A simplified view: “fx” marks a cell with a live formula in the real file. Colours and number formats may look different in Excel." }));
    } else {
      var page = h("div", { class: "v-page" });
      var list = null;
      spec.blocks.forEach(function (b) {
        if (b.bullet === undefined) list = null;
        if (b.h1 !== undefined) page.appendChild(h("h3", { text: b.h1 }));
        else if (b.h2 !== undefined) page.appendChild(h("h4", { text: b.h2 }));
        else if (b.p !== undefined) page.appendChild(h("p", { text: b.p }));
        else if (b.bullet !== undefined) { if (!list) { list = h("ul"); page.appendChild(list); } list.appendChild(h("li", { text: b.bullet })); }
        else if (b.table) page.appendChild(h("table", { class: "v-doc-table" }, b.table.map(function (r, ri) {
          return h("tr", {}, r.map(function (c) { return h(ri === 0 ? "th" : "td", { text: cellText(c) }); }));
        })));
      });
      box.appendChild(page);
    }
    return box;
  }

  /* Two buttons: 👁 View here (opens the viewer in place) and ⬇ Download.
   * cfg: { name, spec, download: function () {} , onView } */
  function fileActions(cfg) {
    var holder = h("div", { class: "v-file" });
    var icon = cfg.spec.type === "xlsx" ? "📊" : "📄";
    var view = h("button", { class: "btn primary", type: "button", "aria-expanded": "false", "aria-label": "View " + cfg.name + " here" }, "👁 View here");
    var dl = h("button", { class: "btn", type: "button", "aria-label": "Download " + cfg.name }, "⬇ Download");
    var pane = null;
    view.addEventListener("click", function () {
      if (pane) { pane.remove(); pane = null; view.setAttribute("aria-expanded", "false"); view.setAttribute("aria-label", "View " + cfg.name + " here"); view.textContent = "👁 View here"; return; }
      pane = viewer(cfg.spec);
      holder.appendChild(pane);
      view.setAttribute("aria-expanded", "true"); view.setAttribute("aria-label", "Close view of " + cfg.name); view.textContent = "✕ Close view";
      if (cfg.onView) cfg.onView();
      try { pane.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) { /* old browser */ }
    });
    dl.addEventListener("click", function () { cfg.download(); if (cfg.onDownload) cfg.onDownload(); });
    holder.appendChild(h("div", { class: "v-file-head" },
      h("span", { class: "v-file-icon", "aria-hidden": "true", text: icon }),
      h("div", { class: "v-file-name" }, h("b", { text: cfg.name }), cfg.note ? h("span", { text: cfg.note }) : null),
      h("div", { class: "v-file-btns" }, view, dl)));
    return holder;
  }

  window.VIS = {
    h: h, flow: flow, cards: cards, rules: rules, example: example, introSteps: introSteps, recapCards: recapCards,
    glossary: glossary, diagram: diagram, more: more, viewer: viewer, fileActions: fileActions, firstSentence: firstSentence
  };
})();
