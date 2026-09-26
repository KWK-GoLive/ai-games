/*
 * Be the LLM — the toy language model.
 *
 * A word n-gram model: it counts which word followed the last 1, 2 or 3 words
 * in the training sentences. Probability = count / total count for that context.
 * Real LLMs use tokens and a neural network instead of a count table, but they are
 * trained on the same main task: predict the next piece of text.
 *
 * Chat: a question-and-answer example is stored as one sequence  [q] question words [a] answer words.
 * "Answering" is just generating the words that come after [a].
 *
 * Works in the browser (window.BTL.Model) and in Node (module.exports) for tests.
 */
(function (root) {
  "use strict";

  var START = "<s>";
  var END = "</s>";
  var Q = "[q]";   // marks where a question starts in a chat example
  var A = "[a]";   // marks where the answer starts

  function tokenize(sentence) {
    return String(sentence)
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  /* Display helpers: "</s>" -> "[end]", "i" -> "I" */
  var PROPER = {
    i: "I", bangkok: "Bangkok", london: "London", tokyo: "Tokyo", chiang: "Chiang", mai: "Mai",
    monday: "Monday", friday: "Friday", sunday: "Sunday", "[q]": "Q:", "[a]": "A:"
  };
  function displayWord(w) {
    if (w === END) return "[end]";
    if (w === START) return "[start]";
    return PROPER[w] || w;
  }
  function displaySentence(words) {
    var out = words.filter(function (w) { return w !== START && w !== END; }).map(displayWord);
    if (out.length) out[0] = out[0].charAt(0).toUpperCase() + out[0].slice(1);
    return out.join(" ");
  }

  /* Seeded random number generator (mulberry32) so tests are repeatable. */
  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function Model(maxContext) {
    this.maxContext = maxContext || 3;
    // tables[k] : Map(contextKey -> Map(nextWord -> count)), k = 1..maxContext
    this.tables = {};
    for (var k = 1; k <= this.maxContext; k++) this.tables[k] = new Map();
    this.sentences = [];         // tokenized training sentences (without <s>, </s>)
    this.sentenceSet = new Set(); // "w1 w2 w3" strings for exact lookup
    this.pairCount = 0;          // number of (context -> next word) events at k = 1
  }

  Model.prototype.addSentence = function (sentence) {
    var words = Array.isArray(sentence) ? sentence.slice() : tokenize(sentence);
    if (!words.length) return;
    this.sentences.push(words);
    this.sentenceSet.add(words.join(" "));
    var toks = [START].concat(words, [END]);
    for (var i = 1; i < toks.length; i++) {
      for (var k = 1; k <= this.maxContext; k++) {
        if (i - k < 0) break;
        var key = toks.slice(i - k, i).join(" ");
        var table = this.tables[k];
        if (!table.has(key)) table.set(key, new Map());
        var m = table.get(key);
        m.set(toks[i], (m.get(toks[i]) || 0) + 1);
        if (k === 1) this.pairCount++;
      }
    }
  };

  Model.train = function (sentences, maxContext) {
    var m = new Model(maxContext);
    sentences.forEach(function (s) { m.addSentence(s); });
    return m;
  };

  /*
   * Next-word distribution after `contextWords`, using exactly the last k words.
   * Returns [] if that context never appeared in training.
   * Ties keep the order in which the words were first seen (stable sort).
   */
  Model.prototype.next = function (contextWords, k) {
    k = k || 1;
    var ctx = contextWords.slice(-k);
    if (ctx.length < k) ctx = [START].concat(ctx).slice(-k);
    var m = this.tables[k] && this.tables[k].get(ctx.join(" "));
    if (!m) return [];
    var total = 0;
    m.forEach(function (c) { total += c; });
    var list = [];
    m.forEach(function (c, w) { list.push({ word: w, count: c, p: c / total }); });
    list.sort(function (a, b) { return b.count - a.count; }); // Array.prototype.sort is stable
    return list;
  };

  /* Same as next(), but falls back to shorter memory if the context was never seen. */
  Model.prototype.nextBackoff = function (contextWords, k) {
    for (var j = k; j >= 1; j--) {
      var d = this.next(contextWords, j);
      if (d.length) return { dist: d, used: j };
    }
    return { dist: [], used: 0 };
  };

  /*
   * Temperature: p_i proportional to count_i^(1/T). This equals softmax(log(count)/T),
   * the usual temperature formula applied to log-probabilities. T = 0 means "always the top word".
   */
  function applyTemperature(dist, T) {
    if (!dist.length) return [];
    if (T <= 0.001) {
      return dist.map(function (d, i) { return { word: d.word, count: d.count, p: i === 0 ? 1 : 0 }; });
    }
    var maxC = dist[0].count;
    var weights = dist.map(function (d) { return Math.pow(d.count / maxC, 1 / T); });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    return dist.map(function (d, i) { return { word: d.word, count: d.count, p: weights[i] / sum }; });
  }

  function sample(dist, rng) {
    var r = (rng || Math.random)();
    var acc = 0;
    for (var i = 0; i < dist.length; i++) {
      acc += dist[i].p;
      if (r < acc) return dist[i].word;
    }
    return dist[dist.length - 1].word;
  }

  /* Generate words after `seedWords` until [end] or maxLen words. */
  Model.prototype.generate = function (seedWords, k, T, maxLen, rng) {
    var words = seedWords.slice();
    maxLen = maxLen || 12;
    var stopped = false;
    while (words.length < maxLen) {
      var res = this.nextBackoff([START].concat(words), k);
      if (!res.dist.length) break;
      var w = sample(applyTemperature(res.dist, T), rng);
      if (w === END) { stopped = true; break; }
      words.push(w);
    }
    return { words: words, finished: stopped };
  };

  /*
   * Generate with a record of every step: what the model could see, the choices, and what it picked.
   * Returns { words, finished, trail: [{ seen, used, dist (after temperature), raw (plain counts), word }] }.
   */
  Model.prototype.generateTrail = function (seedWords, k, T, maxNew, rng) {
    var words = seedWords.slice();
    var trail = [];
    var finished = false;
    for (var n = 0; n < (maxNew || 12); n++) {
      var ctx = [START].concat(words);
      var res = this.nextBackoff(ctx, k);
      if (!res.dist.length) break;
      var dist = applyTemperature(res.dist, T);
      var w = sample(dist, rng);
      trail.push({ seen: ctx.slice(-res.used), used: res.used, dist: dist, raw: res.dist, word: w });
      if (w === END) { finished = true; break; }
      words.push(w);
    }
    return { words: words, finished: finished, trail: trail };
  };

  /* Chat: answer a question (array of words). Returns generateTrail's result plus .answer (the new words). */
  Model.prototype.answer = function (questionWords, T, rng, k) {
    var seed = [Q].concat(questionWords, [A]);
    var r = this.generateTrail(seed, k || this.maxContext, T || 0, 14, rng);
    r.answer = r.words.slice(seed.length);
    return r;
  };

  Model.prototype.inTraining = function (words) {
    return this.sentenceSet.has(words.join(" "));
  };

  /*
   * "Check the source": split a sentence into the longest pieces that appear,
   * word for word, inside some training sentence. Returns [{words, source}].
   */
  Model.prototype.sources = function (words) {
    var pieces = [];
    var i = 0;
    var sents = this.sentences;
    function findIn(seq) {
      for (var s = 0; s < sents.length; s++) {
        var t = sents[s];
        for (var a = 0; a + seq.length <= t.length; a++) {
          var ok = true;
          for (var b = 0; b < seq.length; b++) if (t[a + b] !== seq[b]) { ok = false; break; }
          if (ok) return s;
        }
      }
      return -1;
    }
    while (i < words.length) {
      var best = null;
      for (var j = words.length; j > i; j--) {
        var idx = findIn(words.slice(i, j));
        if (idx >= 0) { best = { words: words.slice(i, j), source: idx }; break; }
      }
      if (!best) best = { words: [words[i]], source: -1 };
      pieces.push(best);
      i += best.words.length;
    }
    return pieces;
  };

  function qaSequence(q, a) {
    return [Q].concat(tokenize(q), [A], tokenize(a));
  }

  var api = {
    START: START,
    END: END,
    Q: Q,
    A: A,
    qaSequence: qaSequence,
    tokenize: tokenize,
    displayWord: displayWord,
    displaySentence: displaySentence,
    makeRng: makeRng,
    applyTemperature: applyTemperature,
    sample: sample,
    Model: Model
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.BTL = root.BTL || {};
  root.BTL.Model = api;
})(typeof window !== "undefined" ? window : globalThis);
