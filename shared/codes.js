/*
 * AI games — carry-on codes for the two learning games (Be the LLM, Be the Agent).
 *
 * Finishing a level shows its code. Typing that code on another computer marks that level and all
 * earlier ones as done, so the student carries on where they were. The teacher code unlocks every level
 * of both games (give it out in class if you want to jump around).
 *
 * The codes are fixed and anyone who reads this file can see them. That's fine: the learning games
 * have no scores. The arenas use a different, per-run resume code that the scoreboard checks.
 * To change the teacher code, edit TEACHER below (letters, digits and dashes).
 */
(function () {
  "use strict";
  var TEACHER = "OPEN-ALL-LEVELS";
  var CODES = {
    llm: ["LLM1-ECBQ", "LLM2-MCHZ", "LLM3-9RQJ", "LLM4-4DVN", "LLM5-6LNH", "LLM6-WYSR", "LLM7-XA5Y"],
    agent: ["AGT1-SBFM", "AGT2-28M4", "AGT3-GK3K", "AGT4-LMNF", "AGT5-ZCD7", "AGT6-QTV5"]
  };
  function norm(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  window.AIG_CODES = {
    /* code shown after finishing level n (1-based) of a game */
    forLevel: function (game, n) { return (CODES[game] || [])[n - 1] || ""; },
    /* -> { all: true } | { level: n } | { otherGame: true } | null */
    check: function (game, input) {
      var c = norm(input);
      if (!c) return null;
      if (c === norm(TEACHER)) return { all: true };
      var list = CODES[game] || [];
      for (var i = 0; i < list.length; i++) if (norm(list[i]) === c) return { level: i + 1 };
      for (var g in CODES) if (g !== game && CODES[g].some(function (x) { return norm(x) === c; })) return { otherGame: true };
      return null;
    }
  };
})();
