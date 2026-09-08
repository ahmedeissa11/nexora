"use strict";

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { config } = require("./config");
const api = require("./routes");
const { errorHandler, notFoundHandler, isApiRequest, asyncHandler } = require("./middleware/error");
const { requestHardening, corsAndPreflight } = require("./middleware/security");
const { requestId, rejectIfDraining } = require("./middleware/requestId");
const { requestLog } = require("./middleware/requestLog");
const paymentController = require("./controllers/paymentController");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: config.isProd ? ["'self'"] : ["*"],
        },
      },
      frameguard: config.isProd ? { action: "sameorigin" } : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: config.isProd ? "same-origin" : "cross-origin" },
    })
  );

  app.use(requestId);
  app.use(rejectIfDraining);
  app.use(requestHardening);
  app.use(corsAndPreflight);
  app.use(requestLog);

  // Raw body required for Stripe signature verification. Mounted before JSON parsing.
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json", limit: "256kb" }),
    asyncHandler(paymentController.webhook)
  );

  app.use(express.json({ limit: "32kb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use(cookieParser());

  app.use("/api", api);

  app.use((req, res, next) => {
    if (isApiRequest(req)) {
      return res.status(404).json({ error: "Not found" });
    }
    if (req.path === "/server" || req.path.startsWith("/server/")) {
      return res.status(404).json({ error: "Not found" });
    }
    next();
  });

  if (config.serveStatic) {
    const FRONT = config.frontendRoot;
    app.use(
      express.static(FRONT, {
        index: false,
        dotfiles: "deny",
        fallthrough: true,
      })
    );

    app.get("/", (req, res) => {
      res.sendFile(path.join(FRONT, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
