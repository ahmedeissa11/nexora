"use strict";

const subscribeService = require("../services/subscribeService");

async function create(req, res) {
  await subscribeService.subscribe(req.body || {});
  res.status(200).json({ ok: true });
}

module.exports = { create };
