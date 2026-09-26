/*
 * Agent Arena — the six stages' items. Answer keys come from the real tools (token counter, search ranking,
 * table tool); the rest (which tool, which document is planted) are marked in data/shop.js with a reason.
 * No DOM here, so tests can run it in Node.
 */
(function (root) {
  "use strict";
  var T = (root.AGA && root.AGA.Tools) || require("./tools.js");
  var E = T.Engine;
  var QB = root.QB || require("../../shared/querybuilder.js"); // plain-English wording of table commands

  function shuffle(a, rng) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a, rng) { return a[Math.floor(rng() * a.length)]; }
  function fmt(n) { return Number(n).toLocaleString("en-US"); }

  /* ================= Stage 1: Desk packer ================= */
  function deskUse(D, desk, ids) {
    return E.tokens(D.system) + desk.cards.filter(function (c) { return ids.indexOf(c.id) >= 0; }).reduce(function (a, c) { return a + E.tokens(c.text); }, 0);
  }
  function stage1(D, rng) {
    return shuffle(D.desks, rng).map(function (desk) {
      var cards = shuffle(desk.cards, rng);
      var need = desk.cards.filter(function (c) { return c.need; }).map(function (c) { return c.id; });
      return { kind: "desk", desk: desk, cards: cards, capacity: desk.capacity, system: D.system, limit: 90, key: need,
        tokens: function (c) { return E.tokens(c.text); }, use: function (ids) { return deskUse(D, desk, ids); },
        title: "Pack the desk so the model can answer:",
        hint: "Only what's on the desk exists for the model. Pick the smallest cards that together contain every answer.",
        grade: function (ids) {
          ids = ids || [];
          var have = need.filter(function (id) { return ids.indexOf(id) >= 0; }).length;
          var extras = ids.filter(function (id) { return need.indexOf(id) < 0; });
          var extra = extras.length;
          var bad = desk.cards.filter(function (c) { return c.misleading && extras.indexOf(c.id) >= 0; }).length;
          var over = deskUse(D, desk, ids) > desk.capacity;
          // a misleading (outdated or contradicting) card costs 25%; a harmless extra costs 10% (it takes space, time and money)
          var frac = over ? 0 : Math.round(100 * (have / need.length) * Math.max(0.5, 1 - 0.25 * bad - 0.10 * (extra - bad))) / 100;
          var lines = desk.cards.filter(function (c) { return c.need || c.why; }).map(function (c) {
            return (c.need ? "Needed: " : "Not needed: ") + "“" + c.text.slice(0, 60) + (c.text.length > 60 ? "…" : "") + "” " + (c.why || "");
          });
          return { frac: frac, explain: [(have === need.length ? "Every answer was on the desk." : "Missing " + (need.length - have) + " card" + (need.length - have === 1 ? "" : "s") + ": the model would have to guess.") +
            (bad ? " " + bad + " misleading card" + (bad === 1 ? "" : "s") + " (−25% each): outdated or contradicting text can make the model give the wrong answer." : "") +
            (extra - bad ? " " + (extra - bad) + " harmless extra card" + (extra - bad === 1 ? "" : "s") + " (−10% each): they take desk space, time and money." : "") +
            (over ? " The desk overflowed." : "")].concat(lines) };
        },
        sample: function (r) { return desk.cards.filter(function () { return r() < 0.4; }).map(function (c) { return c.id; }); }
      };
    });
  }

  /* ================= Stage 2: Search sniper ================= */
  var MAX_WORDS = 3, TRIES = 3;
  function searchRank(D, query, target) {
    var res = E.search(query, D.handbook);
    var first = res[0];
    var win = first.chunk.id === target && first.score > 0 && (res.length < 2 || first.score > res[1].score);
    return { win: win, res: res };
  }
  function stage2(D, rng) {
    return shuffle(D.searchQuestions, rng).slice(0, 4).map(function (sq) {
      var tgt = D.handbook.filter(function (c) { return c.id === sq.target; })[0];
      return { kind: "search", handbook: D.handbook, question: sq.q, target: sq.target, limit: 60, key: [tgt.title.toLowerCase()],
        maxWords: MAX_WORDS, tries: TRIES, rank: function (q) { return searchRank(D, q, sq.target); }, cards: shuffle(sq.cards, rng),
        title: "Find the right handbook piece for: “" + sq.q + "”",
        hint: "The right piece is “" + tgt.title + "”. Which word appears in it and in no other piece?",
        // answer = the list of queries tried, in order
        grade: function (tries) {
          tries = (tries || []).slice(0, TRIES);
          var at = -1;
          tries.forEach(function (q, i) { if (at < 0 && searchRank(D, q, sq.target).win) at = i; });
          var frac = at === 0 ? 1 : at === 1 ? 0.7 : at === 2 ? 0.4 : 0;
          var naive = searchRank(D, sq.q, sq.target).res[0].chunk;
          return { frac: frac, explain: [(at >= 0 ? "Found “" + tgt.title + "” on try " + (at + 1) + "." : "The right piece was “" + tgt.title + "”: " + tgt.text),
            "Searching with the whole question would have put “" + naive.title + "” on top" + (naive.id === sq.target ? " too." : ", the wrong piece.") +
            " Keyword search only matches words; a word that appears in just one piece works best. The model then answers only from the pieces it gets."] };
        },
        sample: function (r) { return [pick(sq.cards, r), pick(sq.cards, r) + " " + pick(sq.cards, r)]; }
      };
    });
  }

  /* ================= Stage 3: Tool router ================= */
  function stage3(D, rng) {
    return shuffle(D.requests, rng).slice(0, 12).map(function (rq) {
      var label = D.tools.filter(function (t) { return t.value === rq.key; })[0].label;
      return { kind: "mcq", title: "“" + rq.text + "”", limit: 25, key: rq.key, options: D.tools, oneCol: false,
        hint: "Ask: is it plain writing, exact maths, our documents, our data, a file, or something risky?",
        grade: function (a) { return { frac: a === rq.key ? 1 : 0, explain: label + ". " + rq.why }; },
        sample: function (r) { return pick(D.tools, r).value; } };
    });
  }

  /* ================= Stage 4: Data detective ================= */
  function answerOf(D, dq) {
    var r = T.run(D.rentalsCsv, dq.ref);
    if (!r.ok) throw new Error("bad reference command " + dq.ref + ": " + r.error);
    if (dq.type === "top") return String(r.groups[0][0]);
    if (dq.type === "bottom") return String(r.groups[r.groups.length - 1][0]);
    return String(r.value);
  }
  function norm(s) { return String(s == null ? "" : s).toLowerCase().replace(/[,\s]/g, "").replace(/-/g, ""); }
  // Numbers must match exactly (commas allowed). Names are forgiving ("kids' bikes", "the Station branch", "e-bikes"),
  // but the answer must name exactly one of the possible names, so "Park River Station" doesn't count.
  function words(s) { return String(s == null ? "" : s).toLowerCase().replace(/-/g, "").split(/[^a-z0-9]+/).filter(Boolean).map(function (w) { return w.replace(/s$/, ""); }); }
  function matches(ans, key, type, names) {
    if (type === "number") { var n = String(ans == null ? "" : ans).replace(/,/g, "").trim(); return n !== "" && Number(n) === Number(key); }
    var said = words(ans), joined = said.join("");
    var ALSO = { ebike: ["electric"], kids: ["child", "children"] };
    var named = (names || [key]).filter(function (nm) {
      var w = words(nm)[0];
      return said.indexOf(w) >= 0 || joined.indexOf(w) >= 0 && w.length > 3 || (ALSO[nm] || []).some(function (x) { return said.indexOf(x.replace(/s$/, "")) >= 0; });
    });
    return named.length === 1 && named[0] === key;
  }
  function namesFor(D, dq) {
    var m = /BY (\w+)/i.exec(dq.ref);
    if (!m) return null;
    var t = E.parseCsv(D.rentalsCsv), out = [];
    t.rows.forEach(function (r) { var v = String(r[m[1]]); if (out.indexOf(v) < 0) out.push(v); });
    return out;
  }
  function stage4(D, rng) {
    var pool = shuffle(D.dataQuestions, rng);
    // one "which one" question and two number questions
    var words = pool.filter(function (x) { return x.type !== "number"; }).slice(0, 1);
    var nums = pool.filter(function (x) { return x.type === "number"; }).slice(0, 2);
    return shuffle(words.concat(nums), rng).map(function (dq) {
      var key = answerOf(D, dq), names = namesFor(D, dq);
      return { kind: "data", csv: D.rentalsCsv, question: dq.q, ref: dq.ref, limit: 120, key: { answer: key, calls: 1, errors: 0 },
        run: function (cmd) { return T.run(D.rentalsCsv, cmd); },
        title: dq.q,
        hint: "A question that works here: “" + QB.describe(dq.ref).replace(/(only where \w+ is (more than |less than )?).*$/, "$1…") + "”",
        grade: function (a) {
          a = a || {};
          var ok = matches(a.answer, key, dq.type, names);
          var calls = a.calls || 0, errors = a.errors || 0;
          var frac = ok ? Math.max(0.5, Math.round(100 * (1 - 0.1 * Math.max(0, calls - 2) - 0.1 * errors)) / 100) : 0;
          return { frac: frac, explain: [(ok ? "Right: " : "The answer is ") + key + ". One question that finds it: “" + QB.describe(dq.ref) + "” (the agent sends " + dq.ref + ").",
            "You made " + calls + " tool call" + (calls === 1 ? "" : "s") + (errors ? " with " + errors + " error" + (errors === 1 ? "" : "s") : "") + ". Up to 2 calls are free; each extra call" + (errors ? " or error" : "") + " costs 10%. Real agents also pay for every step, in time and money."] };
        },
        sample: function (r) { return { answer: r() < 0.3 ? key : String(Math.floor(r() * 300)), calls: 1 + Math.floor(r() * 4), errors: Math.floor(r() * 2) }; }
      };
    });
  }

  /* ================= Stage 5: Injection hunter ================= */
  function stage5(D, rng) {
    var planted = shuffle(D.docs.filter(function (d) { return d.planted; }), rng);
    var fine = shuffle(D.docs.filter(function (d) { return !d.planted; }), rng);
    // two items of 4 documents; each has 2 planted + 2 fine, or 1 + 3 / 3 + 1, so you can't just count
    var splits = pick([[2, 2], [1, 3], [3, 1]], rng);
    var a = shuffle(planted.slice(0, splits[0]).concat(fine.slice(0, 4 - splits[0])), rng);
    var b = shuffle(planted.slice(splits[0], splits[0] + splits[1]).concat(fine.slice(4 - splits[0], 4 - splits[0] + 4 - splits[1])), rng);
    return [a, b].map(function (docs) {
      var key = docs.map(function (d) { return d.planted; });
      return { kind: "docs", docs: docs, limit: 90, key: key,
        title: "The agent is about to read these 4 documents. Flag every one with a planted order for the AI.",
        hint: "A planted order talks to the AI (or “any automated system”) and asks for something the user never asked for. Instructions written for people are just content.",
        grade: function (ans) {
          ans = ans || [];
          var right = key.filter(function (k, i) { return ans[i] === k; }).length;
          return { frac: right / key.length, explain: ["You judged " + right + " of " + key.length + " correctly."].concat(docs.map(function (d) { return (d.planted ? "⚠ Planted – " : "✓ Fine – ") + d.kind + ": " + d.why; })) };
        },
        sample: function (r) { return docs.map(function () { return r() < 0.5; }); }
      };
    });
  }

  /* ================= Stage 6: Boss, run the agent ================= */
  var BOSS_CMD = "TOTAL total BY branch WHERE bike = ebike";
  function stage6(D, rng) {
    var truth = T.run(D.rentalsCsv, BOSS_CMD).groups; // [[branch, value], ...]
    var wrongIdx = Math.floor(rng() * truth.length);
    var draft = truth.map(function (g, i) {
      if (i !== wrongIdx) return [g[0], g[1]];
      // off by one e-bike hour (12): close enough to look right
      var bad = g[1] > 12 && rng() < 0.5 ? g[1] - 12 : g[1] + 12;
      return [g[0], bad];
    });
    var order = D.plan.filter(function (p) { return p.pos > 0; }).sort(function (a, b) { return a.pos - b.pos; }).map(function (p) { return p.id; });
    var key = { order: order, perms: D.permissions.map(function (p) { return p.key; }), ran: true, flagged: truth[wrongIdx][0], made: true };
    return [{
      kind: "boss", limit: 300, key: key, job: D.job, plan: shuffle(D.plan, rng), permissions: D.permissions, csv: D.rentalsCsv,
      truth: truth, draft: draft, bossCmd: BOSS_CMD,
      run: function (cmd) { return T.run(D.rentalsCsv, cmd); },
      isRight: function (r) { return !!(r && r.ok && r.groups && JSON.stringify(r.groups) === JSON.stringify(truth)); },
      title: "Boss job",
      hint: "Plan: look → total → check → make → ask. The question: “" + QB.describe(BOSS_CMD) + "”.",
      grade: function (a) {
        a = a || {};
        var o = a.order || [];
        var pOrder = order.filter(function (id, i) { return o[i] === id; }).length / order.length;
        var perms = a.perms || [];
        var pPerm = key.perms.filter(function (k, i) { return perms[i] === k; }).length / key.perms.length;
        var pRan = a.ran ? 1 : 0, pFlag = a.flagged === key.flagged ? 1 : 0, pMade = a.made ? 1 : 0;
        var frac = Math.round(100 * (pOrder + pPerm + pRan + pFlag + pMade) / 5) / 100;
        return { frac: frac, explain: [
          "Plan " + Math.round(pOrder * 100) + "% · Permissions " + Math.round(pPerm * 100) + "% · Tool run " + (pRan ? "✓" : "✗") + " · Caught the wrong number " + (pFlag ? "✓" : "✗") + " · File delivered " + (pMade ? "✓" : "✗"),
          "The plan: " + order.map(function (id) { return D.plan.filter(function (p) { return p.id === id; })[0].text; }).join(" → ") + ".",
          "Permissions: read, run and create are fine; the email to all staff needs your OK first (it goes out in the company's name); emailing all customers and deleting files should be blocked.",
          "The draft said " + truth[wrongIdx][0] + " = " + fmt(draft[wrongIdx][1]) + ", but the tool said " + fmt(truth[wrongIdx][1]) + ". Always check the words against the tool result."] };
      },
      sample: function (r) {
        return { order: shuffle(D.plan, r).slice(0, 5).map(function (p) { return p.id; }), perms: D.permissions.map(function () { return pick(["Allow", "Ask me", "Block"], r); }),
          ran: r() < 0.5, flagged: pick(truth, r)[0], made: r() < 0.5 };
      }
    }];
  }

  var STAGES = [
    { id: "desk", make: stage1 }, { id: "search", make: stage2 }, { id: "router", make: stage3 },
    { id: "data", make: stage4 }, { id: "inject", make: stage5 }, { id: "boss", make: stage6 }
  ];
  var api = { STAGES: STAGES, answerOf: answerOf, matches: matches, namesFor: namesFor, searchRank: searchRank, deskUse: deskUse, BOSS_CMD: BOSS_CMD, MAX_WORDS: MAX_WORDS, Tools: T };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.AGA = root.AGA || {};
  root.AGA.Items = api;
})(typeof window !== "undefined" ? window : globalThis);
