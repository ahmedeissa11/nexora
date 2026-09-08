"use strict";

const { getHome } = require("../services/homeService");

async function home(_req, res) {
  const payload = await getHome();
  res.json(payload);
}

module.exports = { home };
