/* Be the Agent — reusable pieces: the desk (context window), tool-call boxes, tables, chat bubbles. */
(function () {
  "use strict";
  var BTA = window.BTA;
  var ui = BTA.ui, h = ui.h, E = BTA.Engine;

  function fmt(n) { return typeof n === "number" ? n.toLocaleString("en-US") : String(n); }

  /*
   * The desk: a list of items (text + kind) with a token meter.
   * opts.capacity: tokens that fit. Items with pinned:true never fall off.
   * add(item) pushes an item; if the desk overflows, the oldest unpinned items fall off (returned).
   */
  function Desk(opts) {
    opts = opts || {};
    this.capacity = opts.capacity || 200;
    this.items = [];
    this.fallen = [];
    this.el = h("div", { class: "desk" });
    this.meterFill = h("i");
    this.meterText = h("span", { class: "desk-meter-text" });
    this.list = h("div", { class: "desk-items", role: "list", "aria-label": "what is on the desk" });
    this.fallenBox = h("div", { class: "desk-fallen hidden" });
    this.el.appendChild(h("div", { class: "desk-head" },
      h("b", { text: opts.title || "The desk (what the model can see)" }),
      this.meterText));
    this.el.appendChild(h("div", { class: "desk-meter", role: "meter", "aria-label": "desk space used" }, this.meterFill));
    this.el.appendChild(this.list);
    this.el.appendChild(this.fallenBox);
    this.render();
  }
  Desk.prototype.used = function () { return this.items.reduce(function (a, it) { return a + it.tokens; }, 0); };
  Desk.prototype.free = function () { return this.capacity - this.used(); };
  Desk.prototype.has = function (id) { return this.items.some(function (it) { return it.id === id; }); };
  Desk.prototype.add = function (item) {
    item.tokens = item.tokens || E.tokens(item.text);
    this.items.push(item);
    var dropped = [];
    while (this.used() > this.capacity) {
      var idx = -1;
      for (var i = 0; i < this.items.length; i++) if (!this.items[i].pinned && this.items[i] !== item) { idx = i; break; }
      if (idx < 0) break;
      dropped.push(this.items.splice(idx, 1)[0]);
    }
    this.fallen = this.fallen.concat(dropped);
    this.render();
    return dropped;
  };
  Desk.prototype.remove = function (id) {
    this.items = this.items.filter(function (it) { return it.id !== id; });
    this.render();
  };
  Desk.prototype.clear = function (keepPinned) {
    this.items = keepPinned ? this.items.filter(function (it) { return it.pinned; }) : [];
    this.fallen = [];
    this.render();
  };
  Desk.prototype.render = function () {
    var used = this.used(), cap = this.capacity;
    this.meterFill.style.width = Math.min(100, used / cap * 100) + "%";
    this.meterFill.className = used / cap > 0.85 ? "full" : "";
    this.meterText.textContent = used + " / " + cap + " tokens";
    this.el.querySelector(".desk-meter").setAttribute("aria-valuenow", String(used));
    ui.clear(this.list);
    if (!this.items.length) this.list.appendChild(h("p", { class: "small muted", style: "margin:0", text: "(empty)" }));
    this.items.forEach(function (it) {
      this.list.appendChild(h("div", { class: "desk-item kind-" + (it.kind || "chat"), role: "listitem" },
        h("span", { class: "desk-tag", text: it.label || it.kind }),
        h("span", { class: "desk-text", text: it.text }),
        h("span", { class: "desk-tok", text: it.tokens + " tok" })));
    }, this);
    ui.clear(this.fallenBox);
    if (this.fallen.length) {
      this.fallenBox.classList.remove("hidden");
      this.fallenBox.appendChild(h("p", { class: "small", style: "margin:0 0 4px" }, h("b", { text: "Fell off the desk: " }), "the model can no longer see these."));
      this.fallen.forEach(function (it) {
        this.fallenBox.appendChild(h("div", { class: "desk-item fallen" },
          h("span", { class: "desk-tag", text: it.label || it.kind }), h("span", { class: "desk-text", text: it.text })));
      }, this);
    } else this.fallenBox.classList.add("hidden");
  };

  /* A tool request the model writes, e.g.  CALL calculator("1284 * 37") */
  function toolCall(tool, input) {
    var plain = null;
    if (tool === "table" && window.QB) {
      var m = /^([^:]+):\s*(.*)$/.exec(input);
      plain = h("span", { class: "plain", text: "In plain words: " + window.QB.describe(m ? m[2] : input) + (m ? " (in " + m[1] + ")" : "") });
    }
    return h("div", { class: "toolcall" },
      h("span", { class: "who", text: "Model writes a tool request" }),
      plain,
      h("code", { text: "CALL " + tool + "(" + JSON.stringify(input) + ")" }));
  }
  function toolResult(text, ok) {
    return h("div", { class: "toolresult" + (ok === false ? " err" : "") },
      h("span", { class: "who", text: ok === false ? "Tool result: error" : "Tool result" }),
      typeof text === "string" ? h("span", { text: text }) : text);
  }
  function tableEl(rows, opts) {
    opts = opts || {};
    return h("div", { class: "table-wrap" }, h("table", { class: "data" },
      h("thead", {}, h("tr", {}, rows[0].map(function (c) { return h("th", { text: String(c) }); }))),
      h("tbody", {}, rows.slice(1).map(function (r) {
        return h("tr", {}, r.map(function (c) { return h("td", { class: typeof c === "number" ? "num" : "", text: fmt(c) }); }));
      }))));
  }
  function bubble(who, text, cls) {
    return h("div", { class: "bubble " + (who === "you" ? "q" : "a") + (cls ? " " + cls : "") },
      h("span", { class: "who", text: who === "you" ? "You" : who === "ai" ? "Model" : who }), text);
  }
  /* A primary button that runs fn once. */
  function onceBtn(text, fn, cls) {
    var b = h("button", { class: "btn " + (cls || "primary"), type: "button", text: text });
    b.addEventListener("click", function () { if (b.disabled) return; b.disabled = true; fn(b); });
    return b;
  }
  function roleTag(role) {
    var names = { model: "You are the MODEL", harness: "You are the APP (harness)", human: "You are the HUMAN in charge" };
    return h("span", { class: "role role-" + role, text: names[role] });
  }

  BTA.w = { Desk: Desk, toolCall: toolCall, toolResult: toolResult, tableEl: tableEl, bubble: bubble, onceBtn: onceBtn, roleTag: roleTag, fmt: fmt };
})();
