/*
 * AI games — settings for the two arenas and the scoreboard (one place for the whole site).
 */
window.AIG_CONFIG = {
  // Class scoreboard: your Google Apps Script web-app URL, ending in /exec (see README, "Scoreboard").
  // Leave it empty ("") to play without a scoreboard: scores then stay on each student's device.
  SCOREBOARD_URL: "https://script.google.com/macros/s/AKfycby--1yUXqnjoG2cFA7Y7eSUit2n1U6FdHhI-1JQhUYlLXt6uLEregguzDv5ucqPQIV1/exec",

  // How often the projected scoreboard refreshes, in seconds. Raise it for very large classes.
  BOARD_REFRESH_SECONDS: 5,

  // Multiply every item's timer. 1.5 (the default for this class) gives everyone 50% more time for reading; 1 = the original timers.
  TIME_FACTOR: 1.5
};
