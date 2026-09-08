"use strict";

const { config } = require("../config");

function cookieOptions(extra) {
  const sameSite = config.cookieSameSite === "none" ? "none" : "lax";
  return Object.assign(
    {
      httpOnly: true,
      sameSite,
      secure: Boolean(config.isProd || sameSite === "none"),
      path: "/",
    },
    extra || {}
  );
}

function clearCookieOptions() {
  return cookieOptions();
}

module.exports = { cookieOptions, clearCookieOptions };
