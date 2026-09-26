/*
 * AI games — settings for the two arenas and the scoreboard (one place for the whole site).
 */
window.AIG_CONFIG = {
  // Class scoreboard: your Google Apps Script web-app URL, ending in /exec (see README, "Scoreboard").
  // Leave it empty ("") to play without a scoreboard: scores then stay on each student's device.
  SCOREBOARD_URL: "",

  // How often the projected scoreboard refreshes, in seconds. Raise it for very large classes.
  BOARD_REFRESH_SECONDS: 5,

  // Multiply every item's timer, e.g. 1.5 gives everyone 50% more time. 1 = normal.
  TIME_FACTOR: 1
};
