import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

interface MaintenanceCache {
  isActive: boolean;
  endTime: string | null;
}

let cache: MaintenanceCache = { isActive: false, endTime: null };

export async function initMaintenanceCache() {
  try {
    const settings = await storage.getPlatformSettings();
    cache = {
      isActive: settings.maintenanceMode,
      endTime: settings.maintenanceEndTime ?? null,
    };
  } catch {
    cache = { isActive: false, endTime: null };
  }
}

export function updateMaintenanceCache(isActive: boolean, endTime: string | null) {
  cache = { isActive, endTime };
}

export function getMaintenanceStatus() {
  return { ...cache };
}

// Routes that are always allowed even during maintenance
const ALLOWED_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/maintenance-status",
  "/maintenance",
];

const ADMIN_PREFIXES = ["/api/admin", "/admin"];

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!cache.isActive) return next();

  const path = req.path;

  // Always allow admin routes
  if (ADMIN_PREFIXES.some((p) => path.startsWith(p))) return next();

  // Always allow specific paths
  if (ALLOWED_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return next();

  // Allow static assets (js, css, images)
  if (path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|map)$/)) return next();

  // Block API requests with 503
  if (path.startsWith("/api/")) {
    return res.status(503).json({
      error: "maintenance",
      message: "Platform is under maintenance. Please try again later.",
      endTime: cache.endTime,
    });
  }

  // For all other requests (HTML pages), let the SPA handle it
  // The frontend will redirect to /maintenance based on the status API
  next();
}
