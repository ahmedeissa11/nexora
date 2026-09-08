"use strict";

function redact(value) {
  let s = String(value == null ? "" : value)
    .replace(/postgres(?:ql)?:\/\/[^ \n]+/gi, "postgresql://redacted")
    .replace(/Bearer\s+\S+/gi, "Bearer redacted")
    .replace(/\bsk_(?:live|test)_[A-Za-z0-9]+/g, "sk_redacted")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "whsec_redacted")
    .replace(/\beyJ[A-Za-z0-9._-]{20,}/g, "jwt_redacted")
    .replace(/\b(password|token|secret|authorization)\s*[:=]\s*\S+/gi, "$1=redacted")
    .replace(/\/home\/[^\s:]+/g, "/redacted")
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,180}/gi, "SQL redacted");
  return s;
}

function base(level, scope, extra) {
  const row = Object.assign(
    { ts: new Date().toISOString(), level, scope },
    extra && typeof extra === "object" ? extra : {}
  );
  return row;
}

function logInfo(scope, extra) {
  console.log(JSON.stringify(base("info", scope, extra)));
}

function logError(scope, err, extra) {
  const e = err || {};
  const msg = redact(e.message || "error").slice(0, 200);
  const row = base(
    "error",
    scope,
    Object.assign(
      { status: e.status || null, code: e.code || null, msg },
      extra && typeof extra === "object" ? extra : {}
    )
  );
  console.error(JSON.stringify(row));
}

module.exports = { redact, logInfo, logError };
