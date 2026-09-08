"use strict";

const articleService = require("../services/articleService");
const { assertString } = require("../utils/validate");

async function list(_req, res) {
  const result = await articleService.listArticles();
  res.json(result);
}

async function getOne(req, res) {
  const id = assertString(req.params.id, "id", { min: 1, max: 64 });
  const article = await articleService.getArticle(id);
  res.json(article);
}

module.exports = { list, getOne };
