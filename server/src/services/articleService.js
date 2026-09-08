"use strict";

const { prisma } = require("../db/prisma");
const { notFound } = require("../utils/errors");

function mapArticle(row) {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
  };
}

async function listArticles() {
  const rows = await prisma.article.findMany({ orderBy: { createdAt: "desc" } });
  return { articles: rows.map(mapArticle) };
}

async function getArticle(id) {
  const row = await prisma.article.findUnique({ where: { id } });
  if (!row) throw notFound("Note not found");
  return mapArticle(row);
}

module.exports = { listArticles, getArticle };
