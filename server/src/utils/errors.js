"use strict";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

function badRequest(message) {
  return new HttpError(400, message);
}
function unauthorized(message = "Sign in required") {
  return new HttpError(401, message);
}
function forbidden(message = "Not allowed") {
  return new HttpError(403, message);
}
function notFound(message = "Not found") {
  return new HttpError(404, message);
}
function conflict(message) {
  return new HttpError(409, message);
}
function serviceUnavailable(message = "Payments are unavailable") {
  return new HttpError(503, message);
}

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serviceUnavailable,
};
