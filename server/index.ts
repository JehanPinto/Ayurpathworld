import dotenv from "dotenv";
import path from "path";
import cookieParser from "cookie-parser";

dotenv.config({ path: path.join(process.cwd(), ".env") });

import express, { NextFunction, type Request, Response } from "express";
import { createServer } from "http";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app = express();
const httpServer = createServer(app);

// Trust EB load balancer so req.ip returns real client IP, not the proxy IP
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5000";

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-registration-token", "x-registration-email"]
}));

app.use(cookieParser());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const REDACTED_KEYS = ["token", "password", "otp", "otpCode"];
        const sanitised = JSON.parse(JSON.stringify(capturedJsonResponse));
        for (const key of REDACTED_KEYS) {
          if (key in sanitised) sanitised[key] = "[REDACTED]";
          if (sanitised.user && key in sanitised.user) sanitised.user[key] = "[REDACTED]";
        }
        logLine += ` :: ${JSON.stringify(sanitised)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Error handler registered after Vite/static so it applies to all layers
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(err);
    res.status(status).json({ message });
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
const port = parseInt(process.env.PORT || "5000", 10);
const host = process.env.HOST || "localhost";

httpServer.listen(
  {
    port,
    host,
  },
  () => {
    log(`serving on http://${host}:${port}`);
  },
);
})();
