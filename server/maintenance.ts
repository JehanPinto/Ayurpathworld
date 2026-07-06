import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import jwt from "jsonwebtoken";

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

const ALLOWED_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/maintenance-status",
  "/maintenance",
];

const ADMIN_PREFIXES = ["/api/admin", "/admin"];

function getTokenRole(req: Request): string | null {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.SESSION_SECRET!) as any;
    return decoded?.role ?? null;
  } catch {
    return null;
  }
}

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!cache.isActive) return next();

  const path = req.path;

  // Always allow admin routes
  if (ADMIN_PREFIXES.some((p) => path.startsWith(p))) return next();

  // Always allow specific paths
  if (ALLOWED_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return next();

  // Allow static assets
  if (path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|map)$/)) return next();

  // Allow any request with a valid admin JWT token
  if (getTokenRole(req) === "admin") return next();

  // Block API requests with 503
  if (path.startsWith("/api/")) {
    return res.status(503).json({
      error: "maintenance",
      message: "Platform is under maintenance. Please try again later.",
      endTime: cache.endTime,
    });
  }

  next();
}
