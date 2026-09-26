/*
 * Be the LLM — "is this answer backed by the training text?" (Level 7).
 * Works in the browser (window.BTL.Facts) and in Node for tests.
 */
(function (root) {
  "use strict";
  var M = (root.BTL && root.BTL.Model) || (typeof require !== "undefined" ? require("./model.js") : null);

  // Words that don't change what a question is about. Who it's about (i, my, you, your) and
  // words like "not", "from", "in" DO matter, so they are not on this list.
  var STOP = ["what", "time", "does", "do", "the", "when", "is", "are", "where", "how", "long", "did", "a", "an",
    "at", "to", "of", "for", "it", "we", "should", "like", "have", "please", "can", "will", "tell", "me"];
  var VERBS = ["open", "close", "closed", "start", "leave", "live", "work"];
  function topics(words, answerWords) {
    return words.filter(function (w) {
      return STOP.indexOf(w) < 0 && VERBS.indexOf(w) < 0 && (answerWords || []).indexOf(w) < 0;
    }).sort().join(" ");
  }
  function verbs(words) { return words.filter(function (w) { return VERBS.indexOf(w) >= 0; }).sort().join(" "); }
  /*
   * The example chat that backs this answer: the exact question, or a reworded one that is about exactly
   * the same thing (same topic words both ways, same verb) and has the same answer. Fact examples only.
   * Question words that simply repeat the answer (e.g. "... closed on monday") are ignored.
   */
  function backingExample(corpus, qWords, answerWords) {
    var a = answerWords.join(" ");
    var facts = corpus.qa.filter(function (p) { return p[2] && M.tokenize(p[1]).join(" ") === a; });
    var exact = facts.filter(function (p) { return M.tokenize(p[0]).join(" ") === qWords.join(" "); })[0];
    if (exact) return { ex: exact, exact: true };
    var aw = M.tokenize(a);
    var near = facts.filter(function (p) {
      var pw = M.tokenize(p[0]);
      return topics(pw, aw) === topics(qWords, aw) && verbs(pw) === verbs(qWords);
    })[0];
    if (near) return { ex: near, exact: false };
    // everyday questions (no single fact): only the exact question counts
    var everyday = corpus.qa.filter(function (p) { return !p[2] && M.tokenize(p[0]).join(" ") === qWords.join(" ") && M.tokenize(p[1]).join(" ") === a; })[0];
    return everyday ? { ex: everyday, exact: true } : null;
  }

  var api = { backingExample: backingExample, topics: topics, verbs: verbs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BTL = root.BTL || {};
  root.BTL.Facts = api;
})(typeof window !== "undefined" ? window : globalThis);
