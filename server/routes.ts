// import { createHmac, randomInt, randomUUID } from "crypto";
import { createHash, randomInt, randomUUID } from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { db, pool } from "./db";
import { storage } from "./storage";
import { getMaintenanceStatus, updateMaintenanceCache } from "./maintenance";
import { sendApplicationEmail, sendDoctorVerifiedEmail, sendPasswordResetOtpEmail } from "./util/email";

import {
  AppointmentStatus,
  AuthProvider,
  bookingSchema,
  ConsultationType,
  DoctorStatus,
  insertAppointmentSlotSchema,
  insertDoctorProfileSchema,
  insertDoctorScheduleSchema,
  insertHospitalSchema,
  insertPrescriptionSchema,
  insertReviewSchema,
  insertSpecializationSchema,
  insertUserSchema,
  Language,
  loginSchema,
  PaymentMethod,
  PaymentStatus,
  refunds,
  updateHospitalSchema,
  UserRole,
} from "@shared/schema";

import { insertCareerSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import type { File as MulterFile } from "multer";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { z } from "zod";
import { upload } from "../config/cloudinary";
import jwt from "jsonwebtoken";
import { createGoogleMeetEvent } from "./util/google-calendar";
import { sendPatientBookingReceiptEmail, sendDoctorNewBookingEmail, sendRegistrationOtpEmail } from "./util/email";
import { time } from "console";

const getReqInfo = (req: Request, jti?: string) => {
  let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "127.0.0.1";
  
  if (Array.isArray(ipAddress)) {
    ipAddress = ipAddress[0];
  } else if (typeof ipAddress === 'string' && ipAddress.includes(',')) {
    ipAddress = ipAddress.split(',')[0].trim();
  }

  if (ipAddress === "::1" || ipAddress === "::ffff:127.0.0.1") {
    ipAddress = "127.0.0.1 (Localhost)";
  }

  const device = req.headers['user-agent'] || "Unknown Device";

  const sessionId = jti ? `SES-${jti.substring(0, 8).toUpperCase()}` : "N/A";

  return { ipAddress: String(ipAddress), device, location: "Sri Lanka", sessionId };
};

// Password strength validation utility
function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Doctor fees validation utility
function validateDoctorFees(fees: { consultationFee?: number; onlineConsultationFee?: number; homeVisitFee?: number }) {
  const MAX_FEE = 500000;
  if (fees.consultationFee !== undefined && (fees.consultationFee < 0 || fees.consultationFee > MAX_FEE)) {
    return "In-person consultation fee must be between 0 and 500,000 LKR";
  }
  if (fees.onlineConsultationFee !== undefined && (fees.onlineConsultationFee < 0 || fees.onlineConsultationFee > MAX_FEE)) {
    return "Online consultation fee must be between 0 and 500,000 LKR";
  }
  if (fees.homeVisitFee !== undefined && (fees.homeVisitFee < 0 || fees.homeVisitFee > MAX_FEE)) {
    return "Home visit fee must be between 0 and 500,000 LKR";
  }
  return null;
}

// Bank details format validation
// Compute the doctor's cancellation fee charged to a patient who cancels.
// Returns 0 if the fee is disabled or the cancellation is outside the doctor's window.
// The fee never exceeds the consultation fee.
function computeDoctorCancellationFee(
  doctor: {
    cancellationFeeEnabled?: boolean | null;
    cancellationFeeType?: string | null;
    cancellationFeeAmount?: number | null;
    cancellationWindowHours?: number | null;
  } | undefined | null,
  consultationFee: number,
  appointmentDate: string,
  appointmentTime: string,
): number {
  if (!doctor?.cancellationFeeEnabled) return 0;
  const windowHours = doctor.cancellationWindowHours ?? 0;
  if (windowHours > 0) {
    const apptDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    const hoursUntil = (apptDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil > windowHours) return 0; // cancelled before the window → no fee
  }
  const rawAmount = doctor.cancellationFeeAmount || 0;
  const fee =
    doctor.cancellationFeeType === "percentage"
      ? Math.round((consultationFee * rawAmount) / 100)
      : rawAmount;
  return Math.max(0, Math.min(fee, consultationFee));
}

function validateBankDetails(acc?: string | null, branch?: string | null) {
  if (acc && !/^\d{6,20}$/.test(acc.replace(/\s|-/g, ''))) {
    return "Invalid bank account number format (must be 6-20 digits)";
  }
  if (branch && !/^[A-Za-z0-9\s&,-]{2,50}$/.test(branch)) {
    return "Invalid bank branch format";
  }
  return null;
}

// Format a "HH:MM" or "HH:MM:SS" time string to 12-hour form, e.g. "14:30:00" -> "2:30 PM"
function formatTime12h(time?: string | null): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 3 : 100,
  message: { error: "Too many registration attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 1000,
  message: { error: "Too many upload attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 100 : 500,
  message: { error: "Too many requests to public endpoints, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const documentAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 30 : 200,
  message: { error: "Too many document access attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

interface RegistrationSession {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  uploadedFiles: string[];
  uploadCount: number;
}

const uploadDir = path.join(process.cwd(), "uploads");

const emailToSession = new Map<string, string>();

const registrationSessions = new Map<string, RegistrationSession>();
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;
const MAX_UPLOADS_PER_SESSION = 5;
const tokenBlacklist = new Map<string, number>();

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function createRegistrationSession(email: string): string {
  const existingToken = emailToSession.get(email.toLowerCase());
  if (existingToken) {
    const existingSession = registrationSessions.get(existingToken);
    if (existingSession && Date.now() < existingSession.expiresAt) {
      return existingToken;
    }
    cleanupSession(existingToken);
  }

  const token = randomUUID() + "-" + randomUUID();
  const now = Date.now();
  registrationSessions.set(token, {
    token,
    email: email.toLowerCase(),
    createdAt: now,
    expiresAt: now + SESSION_EXPIRY_MS,
    uploadedFiles: [],
    uploadCount: 0,
  });
  emailToSession.set(email.toLowerCase(), token);
  return token;
}

function validateRegistrationSession(
  token: string,
): RegistrationSession | null {
  if (!token) return null;
  const session = registrationSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    cleanupSession(token);
    return null;
  }
  return session;
}

function cleanupSession(token: string): void {
  const session = registrationSessions.get(token);
  if (session) {
    emailToSession.delete(session.email);
    for (const filePath of session.uploadedFiles) {
      const fullPath = path.join(uploadDir, path.basename(filePath));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    registrationSessions.delete(token);
  }
}

setInterval(
  () => {
    const now = Date.now();
    for (const [token, session] of registrationSessions.entries()) {
      if (now > session.expiresAt) {
        cleanupSession(token);
      }
    }
  },
  15 * 60 * 1000,
);

setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of tokenBlacklist.entries()) {
    if (now > exp) {
      tokenBlacklist.delete(token);
    }
  }
}, 60 * 60 * 1000);

const sessionCreationLimits = new Map<
  string,
  { count: number; resetTime: number }
>();
const MAX_SESSIONS_PER_IP = 3;
const SESSION_CREATION_WINDOW_MS = 60 * 60 * 1000;

function checkSessionCreationLimit(ip: string): boolean {
  const now = Date.now();
  const limit = sessionCreationLimits.get(ip);

  if (!limit || now > limit.resetTime) {
    sessionCreationLimits.set(ip, {
      count: 1,
      resetTime: now + SESSION_CREATION_WINDOW_MS,
    });
    return true;
  }

  if (limit.count >= MAX_SESSIONS_PER_IP) {
    return false;
  }

  limit.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of sessionCreationLimits.entries()) {
    if (now > limit.resetTime) {
      sessionCreationLimits.delete(ip);
    }
  }
}, SESSION_CREATION_WINDOW_MS);

function consumeSession(token: string): string[] | null {
  const session = registrationSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    return null;
  }
  const files = [...session.uploadedFiles];
  registrationSessions.delete(token);
  return files;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    fullName: string;
  };
}

interface RequestWithFile extends Request {
  file?: MulterFile;
}

if (!process.env.SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable must be set. " +
      "Do not use hardcoded secrets in production.",
  );
}

const JWT_SECRET = process.env.SESSION_SECRET;
const REGISTRATION_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes to complete signup

type JwtPayload = {
  id: string;
  email: string;
  role?: string;
  fullName?: string;
  provider?: string;
  purpose?: string;
  exp?: number;
};

function generateToken(payload: object, ttlMs = 7 * 24 * 60 * 60 * 1000): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: Math.floor(ttlMs / 1000) });
  return { token, jti };
}

function verifyToken(token: string): { id: string; email: string; role: string; fullName: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (!decoded || !decoded.id || !decoded.email || !decoded.role || !decoded.fullName) {
      return null;
    }
    return {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role as string,
      fullName: decoded.fullName as string,
    };
  } catch (error) {
    console.error("Security Alert: Invalid Token Signature detected!", error);
    return null;
  }
}

function generateRegistrationToken(
  payload: Pick<JwtPayload, "id" | "email" | "provider">,
): { token: string; jti: string } {
  return generateToken(
    { ...payload, purpose: "complete-registration" },
    REGISTRATION_TOKEN_TTL_MS,
  );
}

function verifyRegistrationToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (decoded.purpose !== "complete-registration") return null;
    return decoded;
  } catch {
    return null;
  }
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const cookieToken = req.cookies?.token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: "Token has been revoked. Please login again." });
  }

  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = user;
  next();
}

function roleMiddleware(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Forbidden: You don't have permission to do this" });
    }
    next();
  };
}

// Sanitize doctor profile for public viewing (guests and patients)
function sanitizeForPublic(doctor: DoctorWithDetails): any {
  return {
    id: doctor.id,
    userId: doctor.userId,
    user: {
      id: doctor.user.id,
      fullName: doctor.user.fullName,
      profileImage: doctor.user.profileImage,
      gender: doctor.user.gender,
      // Excluded: email, phone, address, city, dateOfBirth
    },
    registrationNumber: doctor.registrationNumber,
    qualifications: doctor.qualifications,
    biography: doctor.biography,
    status: doctor.status,
    specializations: doctor.specializations,
    languagesSpoken: doctor.languagesSpoken,
    consultationTypes: doctor.consultationTypes,
    hospitals: doctor.hospitals
      .map(h => ({
        id: h.id,
        name: h.name,
        address: h.address,
        city: h.city,
        latitude: h.latitude,
        longitude: h.longitude,
        parkingAvailable: h.parkingAvailable,
        directions: h.directions,
        // Excluded: contactNumber, email
      })),
    clinic_locations: doctor.clinic_locations,
    averageRating: doctor.averageRating,
    totalReviews: doctor.totalReviews,
    totalAppointments: doctor.totalAppointments,
    isAvailable: doctor.isAvailable,
    maxAdvanceBookingDays: doctor.maxAdvanceBookingDays,
    minBookingNoticeHours: doctor.minBookingNoticeHours,
    slotDurationMinutes: doctor.slotDurationMinutes,
    bufferTimeMinutes: doctor.bufferTimeMinutes,
    consultationFee: doctor.consultationFee,
    onlineConsultationFee: doctor.onlineConsultationFee,
    homeVisitFee: doctor.homeVisitFee,
    // Excluded: verificationDocuments, bankName, bankAccountNumber, bankBranch,
    // user.email, user.phone, user.address, user.city, createdAt, updatedAt, currentQueueNumber
  };
}

// Sanitize array of doctors for public viewing
function sanitizeDocsForPublic(doctors: DoctorWithDetails[]): any[] {
  return doctors.map(sanitizeForPublic);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Public — no auth required, used by maintenance page to poll status
  app.get("/api/maintenance-status", (_req: Request, res: Response) => {
    res.json(getMaintenanceStatus());
  });

  app.use(passport.initialize());
  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  const getActorInfo = async (req: Request) => {
    const authUser = (req as AuthenticatedRequest).user;
    if (authUser) {
      return { actorId: authUser.id, actorRole: authUser.role };
    }

    const providedEmail = req.body?.email || req.headers["x-registration-email"];
    
    if (providedEmail && typeof providedEmail === 'string') {
      try {
        const existingUser = await storage.getUserByEmail(providedEmail.toLowerCase().trim());
        if (existingUser) {
          return { actorId: existingUser.id, actorRole: existingUser.role };
        }
      } catch (e) {
        console.error("Failed to fetch user by provided email in getActorInfo:", e);
      }
    }
    
    const GUEST_EMAIL = "guest@ayurpath.system";
    
    try {
      let guestUser = await storage.getUserByEmail(GUEST_EMAIL);
      
      if (!guestUser) {
        const dummyPassword = await hashPassword(randomUUID() + randomUUID()); 
        
        guestUser = await storage.createUser({
          fullName: "System Guest",
          email: GUEST_EMAIL,
          password: dummyPassword,
          phone: "0000000000",
          role: "patient",
        } as any);
      }
      
      return { actorId: guestUser.id, actorRole: 'guest' };
      
    } catch (error) {
      console.error("Failed to fetch/create guest user:", error);
      
      const admins = await storage.getAllUsers("admin");
      if (admins && admins.length > 0) {
         return { actorId: admins[0].id, actorRole: 'guest' };
      }
      
      return { actorId: 'system', actorRole: 'guest' };
    }
  };

  app.post(
    "/api/auth/register",
    registrationLimiter,
    async (req: Request, res: Response) => {

      const tRequestReceived = new Date().toISOString();

      try {
        const data = insertUserSchema.parse(req.body);

        // Validate password strength
        const passwordValidation = validatePasswordStrength(data.password);
        if (!passwordValidation.valid) {

          const tFailed = new Date().toISOString();

            try {
              const { ipAddress, device, location, sessionId } = getReqInfo(req);
              const { actorId, actorRole } = await getActorInfo(req);
              await storage.createAuditLog({
                actorId, actorRole,
                action: 'USER_REGISTRATION', status: 'failed',
                entityType: 'user', entityId: 'N/A',
                ipAddress, device, location, sessionId: 'N/A',
                metadata: { 
                  auditType: "AUTH",
                  method: 'Password', reason: 'password validation failed',
                  timeline: {
                    requestReceivedAt: tRequestReceived,
                    credentialsVerifiedAt: tFailed,
                    completedAt: tFailed
                  }
                }
              });
            } catch (e) { console.error(e); }

          return res.status(400).json({
            error: "Password does not meet security requirements",
            details: passwordValidation.errors,
          });
        }

        const credentialsVerified = new Date().toISOString();
        const existingUser = await storage.getUserByEmail(data.email);
        if (existingUser) {
          
          const tFailed = new Date().toISOString();

          if (existingUser.provider && existingUser.provider !== AuthProvider.LOCAL) {
            const providerName = existingUser.provider.charAt(0).toUpperCase() + existingUser.provider.slice(1);

              try {
                const { ipAddress, device, location, sessionId } = getReqInfo(req);
                const { actorId, actorRole } = await getActorInfo(req);
                await storage.createAuditLog({
                  actorId, actorRole,
                  action: 'USER_REGISTRATION', status: 'failed',
                  entityType: 'user', entityId: 'N/A',
                  ipAddress, device, location, sessionId: 'N/A',
                  metadata: {
                    method: 'Existing Email', reason: `Email already registered with ${providerName} provider`,
                    timeline: {
                      auditType: "AUTH",
                      requestReceivedAt: tRequestReceived,
                      credentialsVerifiedAt: credentialsVerified,
                      providerIdentifiedAt: tFailed,
                      completedAt: tFailed
                    }
                  }
                });
              } catch (e) { console.error(e); }

            try {
              const { ipAddress, device, location, sessionId } = getReqInfo(req);
              const { actorId, actorRole } = await getActorInfo(req);
              await storage.createAuditLog({
                actorId, actorRole,
                action: 'USER_REGISTRATION', status: 'failed',
                entityType: 'user', entityId: existingUser.id,
                ipAddress, device, location, sessionId: 'N/A',
                metadata: {
                  method: 'Existing Email', reason: `Email already registered with ${providerName} provider`,
                  timeline: {
                    auditType: "AUTH",
                    requestReceivedAt: tRequestReceived,
                    credentialsVerifiedAt: credentialsVerified,
                    exitUserAt: tFailed,
                    completedAt: tFailed
                  }
                }
              });
            } catch (e) { console.error(e); }

            return res.status(400).json({ 
              error: `This email is associated with a ${providerName} account. Please use a different email to register as a patient, or contact support.` 
            });
          }
          
          return res.status(400).json({ error: "Email already registered" });
        }

        const hashedPassword = await hashPassword(data.password);
        const user = await storage.createUser({
          ...data,
          password: hashedPassword,
        });

        const { token, jti } = generateToken({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        });

        const tAccountRegistered = new Date().toISOString();
        const tSessionCreated = new Date().toISOString();
        const tCompleted = new Date().toISOString();

        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req, jti);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'USER_REGISTERED', status: 'success',
            entityType: 'user', entityId: user.id,
            ipAddress, device, location, sessionId,
            metadata: { 
              auditType: "AUTH",
              method: 'user registration',
              tokenIssued: true,
              timeline: {
                requestReceivedAt: tRequestReceived,
                credentialsVerifiedAt: credentialsVerified,
                providerIdentifiedAt: tAccountRegistered,
                sessionCreatedAt: tSessionCreated,
                completedAt: tCompleted
              }
            }
          });
        } catch (e) { console.error("Audit log failed:", e); }

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({ user: userWithoutPassword, token });
      } catch (error) {
        const tFailed = new Date().toISOString();
        const { ipAddress, device, location } = getReqInfo(req);

        let tempActorId = "user-admin"; // Fallback ID
        let tempRole = "system";
        if (req.body && req.body.email) {
          try {
            const existingUser = await storage.getUserByEmail(req.body.email);
            if (existingUser) {
              tempActorId = existingUser.id;
              tempRole = existingUser.role;
            }
          } catch (e) { }
        }

        if (error instanceof z.ZodError) {
          try {
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'USER_REGISTRATION', status: 'failed',
              entityType: 'user', entityId: 'N/A',
              ipAddress, device, location, sessionId: 'N/A',
              metadata: {
                auditType: "AUTH",
                method: 'user registration', reason: 'validation failed (400 Bad Request)',
                providedEmail: req.body?.email || 'N/A',
                validationErrors: error.errors,
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  credentialsVerifiedAt: tFailed,
                  providerIdentifiedAt: tFailed,
                  completedAt: tFailed
                }
              }
            });
          } catch (e) { console.error("Audit log failed:", e); }
          return res.status(400).json({ error: error.errors });
        }

        try {
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'USER_REGISTRATION', status: 'failed',
            entityType: 'user', entityId: 'N/A',
            ipAddress, device, location, sessionId: 'N/A',
            metadata: {
              auditType: "AUTH",
              method: 'user registration', reason: 'server error (500)',
              providedEmail: req.body?.email || 'N/A',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) { console.error("Audit log failed:", e); }
        res.status(500).json({ error: "Registration failed" });
      }
    },
  );

  app.post(
    "/api/auth/register-doctor",
    registrationLimiter,
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();

      try {
        const registrationToken = req.headers["x-registration-token"] as string;

        if (!registrationToken) {
          return res.status(400).json({ error: "Email verification required. Please verify your email first." });
        }

        let sessionFiles: string[] = [];

        if (registrationToken) {
          const files = consumeSession(registrationToken);
          if (files) sessionFiles = files;
        }

        const { newHospitals, ...otherBodyData } = req.body;
        const userData = insertUserSchema.parse({ ...otherBodyData, role: UserRole.DOCTOR });

        const passwordValidation = validatePasswordStrength(userData.password);
        if (!passwordValidation.valid) {
          const tFailed = new Date().toISOString();
          try {
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'DOCTOR_REGISTERED', status: 'failed',
              entityType: 'user', entityId: 'N/A',
              ipAddress, device, location, sessionId: 'N/A',
              metadata: { 
                auditType: "AUTH",
                method: 'Password', reason: 'password validation failed',
                timeline: { 
                  requestReceivedAt: tRequestReceived, 
                  credentialsVerifiedAt: tFailed,
                  completedAt: tFailed 
                }
              }
            });
          } catch (e) {}
          return res.status(400).json({ error: "Password does not meet security requirements", details: passwordValidation.errors });
        }

        // 2. Validate Doctor Fees
        const feeError = validateDoctorFees({
          consultationFee: parseInt(req.body.consultationFee) || 0,
          onlineConsultationFee: req.body.onlineConsultationFee ? parseInt(req.body.onlineConsultationFee) : undefined,
          homeVisitFee: req.body.homeVisitFee ? parseInt(req.body.homeVisitFee) : undefined
        });
        if (feeError) {
          const tFailed = new Date().toISOString();
          try {
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole, 
              action: 'DOCTOR_REGISTERED', status: 'failed',
              entityType: 'user', entityId: 'N/A', ipAddress, device, location, sessionId: 'N/A',
              metadata: { 
                auditType: "AUTH",
                method: 'Validation', reason: 'Fee validation failed', 
                timeline: { 
                  requestReceivedAt: tRequestReceived, 
                  credentialsVerifiedAt: tFailed,
                  completedAt: tFailed 
                } 
              }
            });
          } catch (e) {}
          return res.status(400).json({ error: feeError });
        }

        // 3. Validate Bank Details
        const bankError = validateBankDetails(req.body.bankAccountNumber, req.body.bankBranch);
        if (bankError) return res.status(400).json({ error: bankError });

        // 4. Check Existing User
        const credentialsVerified = new Date().toISOString();
        const existingUser = await storage.getUserByEmail(userData.email);
        
        if (existingUser) {
          const tFailed = new Date().toISOString();
          if (existingUser.provider && existingUser.provider !== AuthProvider.LOCAL) {
            const providerName = existingUser.provider.charAt(0).toUpperCase() + existingUser.provider.slice(1);
            try {
              const { ipAddress, device, location, sessionId } = getReqInfo(req);
              const { actorId, actorRole } = await getActorInfo(req);
              await storage.createAuditLog({
                actorId, actorRole, 
                action: 'DOCTOR_REGISTERED', status: 'failed',
                entityType: 'user', entityId: 'N/A', ipAddress, device, location, sessionId: 'N/A',
                metadata: { 
                  auditType: "AUTH",
                  method: 'Existing Email', 
                  reason: `Email registered with ${providerName}`, 
                  timeline: { 
                    requestReceivedAt: tRequestReceived, 
                    credentialsVerifiedAt: credentialsVerified, 
                    completedAt: tFailed 
                  } 
                }
              });
            } catch (e) {}
            return res.status(400).json({ error: `This email is associated with a ${providerName} account. Please use a different email or contact support.` });
          }
          return res.status(400).json({ error: "Email already registered" });
        }

        let hospitalIds: string[] = [];
        if (req.body.consultationTypes?.includes("in_person") && newHospitals && Array.isArray(newHospitals)) {
          for (const hosp of newHospitals) {
             const validatedHosp = insertHospitalSchema.parse(hosp);
             const savedHosp = await storage.createHospital(validatedHosp);
             hospitalIds.push(savedHosp.id);
          }
        }

        const verificationDocs = sessionFiles.length > 0 ? sessionFiles : req.body.verificationDocuments || [];
        const doctorData = insertDoctorProfileSchema.parse({
          userId: "temp-id", 
          registrationNumber: req.body.registrationNumber, 
          qualifications: req.body.qualifications,
          specializationIds: req.body.specializationIds || [], 
          languagesSpoken: req.body.languagesSpoken || ["english"],
          consultationTypes: req.body.consultationTypes || ["online"], 
          hospitalIds: hospitalIds,
          consultationFee: parseInt(req.body.consultationFee) || 0,
          onlineConsultationFee: req.body.onlineConsultationFee ? parseInt(req.body.onlineConsultationFee) : undefined,
          homeVisitFee: req.body.homeVisitFee ? parseInt(req.body.homeVisitFee) : undefined,
          verificationDocuments: verificationDocs, 
          bankName: req.body.bankName || null,
          bankAccountNumber: req.body.bankAccountNumber || null, 
          bankBranch: req.body.bankBranch || null,
          status: DoctorStatus.PENDING,
        });

        // 5. Create User & Profile
        const hashedPassword = await hashPassword(userData.password);
        const user = await storage.createUser({ 
          ...userData, 
          password: hashedPassword,
          isEmailVerified: true
        });

        try {
          await storage.createDoctorProfile({ ...doctorData, userId: user.id });
        } catch (profileError) {
          try { await storage.deleteUser(user.id); } catch (e) {}
          throw profileError;
        }

        // Notify all admins about the new doctor registration awaiting verification
        try {
          const regAdmins = await storage.getAllUsers("admin");
          await Promise.all(
            regAdmins.map((a) =>
              storage.createNotification({
                userId: a.id,
                title: "New doctor registration",
                message: `${user.fullName} has registered as a doctor and is awaiting verification.`,
                type: "system",
                isRead: false,
                relatedId: user.id,
              }),
            ),
          );
        } catch (notifyError) {
          console.error("Failed to notify admins of doctor registration:", notifyError);
        }

        const { token, jti } = generateToken({
          id: user.id, email: user.email, role: user.role, fullName: user.fullName,
        });

        const tCompleted = new Date().toISOString();

        // 6. SUCCESS LOG
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req, jti);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'DOCTOR_REGISTERED', status: 'success',
            entityType: 'user', entityId: user.id, 
            ipAddress, device, location, sessionId,
            metadata: { 
              auditType: "AUTH",
              registrationNumber: doctorData.registrationNumber, 
              tokenIssued: true,
              timeline: { 
                requestReceivedAt: tRequestReceived, 
                credentialsVerifiedAt: credentialsVerified, 
                completedAt: tCompleted 
              }
            }
          });
        } catch (e) { console.error("Audit log failed:", e); }

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({ user: userWithoutPassword, token });

      } catch (error) {
        console.error("Doctor registration failed:", error);
        const tFailed = new Date().toISOString();
        const { ipAddress, device, location, sessionId } = getReqInfo(req);
        const { actorId, actorRole } = await getActorInfo(req);

        let tempActorId = "user-admin"; let tempRole = "system";
        if (req.body && req.body.email) {
          try {
            const existingUser = await storage.getUserByEmail(req.body.email);
            if (existingUser) { tempActorId = existingUser.id; tempRole = existingUser.role; }
          } catch (e) { }
        }

        if (error instanceof z.ZodError) {
          try {
            await storage.createAuditLog({
              actorId, actorRole, 
              action: 'DOCTOR_REGISTERED', status: 'failed',
              entityType: 'user', entityId: 'N/A', 
              ipAddress, device, location, sessionId: 'N/A',
              metadata: { 
                auditType: "AUTH",
                reason: 'validation failed (400 Bad Request)', 
                validationErrors: error.errors, 
                timeline: { 
                  requestReceivedAt: tRequestReceived, 
                  completedAt: tFailed 
                } 
              }
            });
          } catch (e) {}
          return res.status(400).json({ error: "Validation failed", details: error.errors });
        }

        if ((error as any)?.code === '23505' && (error as any)?.constraint === 'doctor_profiles_registration_number_unique') {
          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'DOCTOR_REGISTERED', status: 'failed',
              entityType: 'user', entityId: 'N/A',
              ipAddress, device, location, sessionId: 'N/A',
              metadata: {
                auditType: "AUTH",
                reason: 'validation failed (400 Bad Request) - duplicate registration number',
                timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
              }
            });
          } catch (e) {}
          return res.status(400).json({ error: "This registration number is already registered. Please check your registration number and try again." });
        }

        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'DOCTOR_REGISTERED', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: 'N/A',
            metadata: {
              auditType: "AUTH",
              reason: 'server error (500)',
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Doctor registration failed" });
      }
    },
  );

  app.post(
    "/api/auth/login",
    loginLimiter,
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const { email, password, rememberMe } = loginSchema.parse(req.body);

        const user = await storage.getUserByEmail(email);

        if (!user || !(await verifyPassword(password, user.password))) {

          const tFailed = new Date().toISOString();

          if (user) {
            try {
              await storage.createAuditLog({
                actorId, actorRole,
                action: 'USER_LOGIN', status: 'failed',
                entityType: 'user', entityId: user.id,
                ipAddress, device, location, sessionId: sessionId,
                metadata: { 
                  auditType: "AUTH",
                  method: 'Email & Password', reason: 'Invalid Password',
                  timeline: {
                    requestReceivedAt: tRequestReceived,
                    credentialsVerifiedAt: tFailed,
                    completedAt: tFailed
                  }
                }
              });
            } catch (e) { console.error(e); }
          }
          return res.status(401).json({ error: "Invalid email or password" });
        }

        const tCredentialsVerified = new Date().toISOString();

        // Block non-admin logins during maintenance
        const { isActive: maintenanceActive } = getMaintenanceStatus();
        if (maintenanceActive && user.role !== UserRole.ADMIN) {
          const tFailed = new Date().toISOString();

          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'USER_LOGIN', status: 'failed',
              entityType: 'user', entityId: user.id,
              ipAddress, device, location, sessionId,
              metadata: {
                auditType: "AUTH",
                method: 'Email & Password', reason: 'Platform under maintenance',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  credentialsVerifiedAt: tCredentialsVerified,
                  completedAt: tFailed
                }
              }
            });
          } catch (e) { console.error(e); }
          return res.status(503).json({ error: "Platform is currently under maintenance. Please try again later." });
        }

        if (user.provider && user.provider !== AuthProvider.LOCAL) {
          const providerName = user.provider.charAt(0).toUpperCase() + user.provider.slice(1);

          const tFailed = new Date().toISOString();

            try {
              await storage.createAuditLog({
                actorId, actorRole,
                action: 'USER_LOGIN', status: 'failed',
                entityType: 'user', entityId: user.id,
                ipAddress, device, location, sessionId,
                metadata: {
                  auditType: "AUTH",
                  method: 'Email & Password', reason: 'Account registered with social provider',
                  timeline: {
                    requestReceivedAt: tRequestReceived,
                    credentialsVerifiedAt: tCredentialsVerified,
                    providerIdentifiedAt: tFailed,
                    completedAt: tFailed
                  }
                }
              });
            } catch (e) { console.error(e); }

          return res.status(400).json({ 
            error: "Already registered with a social account. Please login with " + providerName + " or reset your password to create a local account."
          });
        }

        const tProviderIdentified = new Date().toISOString();

        if (user.role === UserRole.DOCTOR) {
          const doctorProfile = await storage.getDoctorProfileByUserId(user.id);

          if (doctorProfile) {
            if (doctorProfile.status === DoctorStatus.SUSPENDED) {

              const tFailed = new Date().toISOString();

              try {
                await storage.createAuditLog({
                  actorId, actorRole,
                  action: 'USER_LOGIN', status: 'failed',
                  entityType: 'user', entityId: user.id,
                  ipAddress, device, location, sessionId,
                  metadata: { 
                    auditType: "AUTH",
                    method: 'Doctor', reason: 'Suspended account',
                    timeline: {
                      requestReceivedAt: tRequestReceived,
                      credentialsVerifiedAt: tCredentialsVerified,
                      providerIdentifiedAt: tProviderIdentified,
                      SuspendedIdentifiedAt: tFailed,
                      completedAt: tFailed
                    }
                  }
                });
              } catch (e) { console.error(e); }

              return res
                .status(403)
                .json({
                  error:
                    "Your doctor account has been suspended by the administrator.",
                });
            }

            const tDoctorStatusChecked = new Date().toISOString();

            if (doctorProfile.status === DoctorStatus.REJECTED) {

              const tFailed = new Date().toISOString();
              try {
                await storage.createAuditLog({
                  actorId, actorRole,
                  action: 'USER_LOGIN', status: 'failed',
                  entityType: 'user', entityId: user.id,
                  ipAddress, device, location, sessionId,
                  metadata: { 
                    auditType: "AUTH",
                    method: 'Doctor', reason: 'Doctor application rejected',
                    timeline: {
                      requestReceivedAt: tRequestReceived,
                      credentialsVerifiedAt: tCredentialsVerified,
                      providerIdentifiedAt: tProviderIdentified,
                      DoctorStatusCheckedAt: tDoctorStatusChecked,
                      RejectionIdentifiedAt: tFailed,
                      completedAt: tFailed
                    }
                  }
                });
              } catch (e) { console.error(e); }

              return res
                .status(403)
                .json({
                  error: "Your doctor account application was rejected.",
                });
            }

            if (doctorProfile.status === DoctorStatus.PENDING) {
              const tFailed = new Date().toISOString();
              try {
                await storage.createAuditLog({
                  actorId, actorRole,
                  action: 'USER_LOGIN', status: 'failed',
                  entityType: 'user', entityId: user.id,
                  ipAddress, device, location, sessionId,
                  metadata: { 
                    auditType: "AUTH",
                    method: 'Doctor', reason: 'Doctor application pending',
                    timeline: {
                      requestReceivedAt: tRequestReceived,
                      credentialsVerifiedAt: tCredentialsVerified,
                      providerIdentifiedAt: tProviderIdentified,
                      DoctorStatusCheckedAt: tDoctorStatusChecked,
                      PendingIdentifiedAt: tFailed,
                      completedAt: tFailed
                    }
                  }
                });
              } catch (e) { console.error(e); }

              return res
                .status(403)
                .json({
                  error: "verification_pending",
                  message: "Your account is pending verification."
                });
            }
          }
        }

        const tDoctorProfileChecked = new Date().toISOString();

        if (user.isActive === false) {

          const tFailed = new Date().toISOString();

            try {
              await storage.createAuditLog({
                actorId, actorRole,
                action: 'USER_LOGIN', status: 'failed',
                entityType: 'user', entityId: user.id,
                ipAddress, device, location, sessionId,
                metadata: {
                  auditType: "AUTH",
                  method: 'Account Status', reason: 'Account deactivated',
                  timeline: {
                    requestReceivedAt: tRequestReceived,
                    credentialsVerifiedAt: tCredentialsVerified,
                    providerIdentifiedAt: tProviderIdentified,
                    doctorProfileCheckedAt: tDoctorProfileChecked,
                    accountActiveAt: tFailed,
                    completedAt: tFailed
                  }
                }
              });
            } catch (e) { console.error(e); }

          return res
            .status(403)
            .json({ error: "Your account has been deactivated." });
        }

        const tAccountStatusChecked = new Date().toISOString();

        if (
          !user.registrationComplete &&
          user.provider !== AuthProvider.LOCAL
        ) {

          const tFailed = new Date().toISOString();
            try {
              await storage.createAuditLog({
                actorId, actorRole,
                action: 'USER_LOGIN', status: 'failed',
                entityType: 'user', entityId: user.id,
                ipAddress, device, location, sessionId,
                metadata: { 
                  auditType: "AUTH",
                  method: 'Registration Completion', reason: 'Social account registration incomplete',
                  timeline: {
                    requestReceivedAt: tRequestReceived,
                    credentialsVerifiedAt: tCredentialsVerified,
                    providerIdentifiedAt: tProviderIdentified,
                    doctorProfileCheckedAt: tDoctorProfileChecked,
                    accountActiveAt: tAccountStatusChecked,
                    registrationCompleteAt: tFailed,
                    completedAt: tFailed
                  }
                }
              });
            } catch (e) { console.error(e); }

          return res
            .status(400)
            .json({
              error:
                "Please finish signing up with your social account before logging in.",
            });
        }

        const tokenTTL = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        const { token, jti } = generateToken({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        }, tokenTTL);

        const tAccountRegistered = new Date().toISOString();
        const tSessionCreated = new Date().toISOString();
        const tCompleted = new Date().toISOString();

        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'USER_LOGIN', status: 'success',
            entityType: 'user', entityId: user.id,
            ipAddress, device, location, sessionId,
            metadata: { 
              auditType: "AUTH",
              method: 'Email & Password',
              reason: 'Login successful',
              timeline: {
                requestReceivedAt: tRequestReceived,
                credentialsVerifiedAt: tCredentialsVerified,
                providerIdentifiedAt: tProviderIdentified,
                doctorProfileCheckedAt: tDoctorProfileChecked,
                accountActiveAt: tAccountStatusChecked,
                registrationCompleteAt: tAccountRegistered,
                sessionCreatedAt: tSessionCreated,
                completedAt: tCompleted
              }
            }
          });
        } catch (e) { console.error("Audit log failed:", e); }

        const { password: _, ...userWithoutPassword } = user;

        const dynamicCookieOptions = {
          ...cookieOptions,
          maxAge: tokenTTL,
        };
        
        res.cookie("token", token, dynamicCookieOptions).json({ user: userWithoutPassword, token });

      } catch (error) {
        const tFailed = new Date().toISOString();
        if (error instanceof z.ZodError) {
          try {
            await storage.createAuditLog({
              actorId, 
              actorRole,
              action: 'USER_LOGIN', 
              status: 'failed',
              entityType: 'user', 
              entityId: 'N/A',
              ipAddress, device, location, sessionId,
              metadata: { 
                auditType: "AUTH",
                method: 'Email & Password',
                reason: 'Validation Failed (400 Bad Request)',
                providedEmail: req.body?.email || 'N/A',
                validationErrors: error.errors,
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  credentialsVerifiedAt: tFailed,
                  completedAt: tFailed
                }
              }
            });
          } catch (e) { console.error("Audit log failed (400):", e); }

          return res.status(400).json({ error: error.errors });
        }
        
        try {
          await storage.createAuditLog({
            actorId, 
            actorRole,
            action: 'USER_LOGIN', 
            status: 'failed',
            entityType: 'system', 
            entityId: 'N/A',
            ipAddress, device, location, sessionId,
            metadata: { 
              auditType: "AUTH",
              method: 'Email & Password',
              reason: 'Internal Server Error (500)',
              providedEmail: req.body?.email || 'N/A',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) { console.error("Audit log failed (500):", e); }

        res.status(500).json({ error: "Login failed" });
      }
    },
  );

  const completeRegistrationSchema = z
    .object({
      registrationToken: z.string(),
      role: z.enum([UserRole.PATIENT, UserRole.DOCTOR]),
      fullName: z.string().min(2, "Full name is required"),
      phone: z.string().min(8, "Phone is required"),
      preferredLanguages: z
        .array(z.enum([Language.ENGLISH, Language.SINHALA, Language.TAMIL]))
        .min(1)
        .optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      gender: z.string().optional(),
      profileImage: z.string().optional(),
      registrationNumber: z.string().optional(),
      qualifications: z.string().optional(),
      specializationIds: z.array(z.string()).optional(),
      languagesSpoken: z
        .array(z.enum([Language.ENGLISH, Language.SINHALA, Language.TAMIL]))
        .optional(),
      consultationTypes: z
        .array(
          z.enum([
            ConsultationType.IN_PERSON,
            ConsultationType.ONLINE,
            ConsultationType.HOME_VISIT,
          ]),
        )
        .optional(),
      consultationFee: z.number().optional(),
      onlineConsultationFee: z.number().optional(),
      homeVisitFee: z.number().optional(),
      bankName: z.string().optional(),
      bankAccountNumber: z.string().optional(),
      bankBranch: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.role === UserRole.DOCTOR) {
        if (!data.registrationNumber)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Registration number required",
            path: ["registrationNumber"],
          });
        if (!data.qualifications)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Qualifications required",
            path: ["qualifications"],
          });
        if (!data.specializationIds || data.specializationIds.length === 0)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Specializations required",
            path: ["specializationIds"],
          });
        if (!data.consultationTypes || data.consultationTypes.length === 0)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Consultation types required",
            path: ["consultationTypes"],
          });
        if (data.consultationFee === undefined)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Consultation fee required",
            path: ["consultationFee"],
          });
      }
    }
  );

  app.post(
    "/api/auth/logout",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        const token = req.cookies?.token || req.headers.authorization?.slice(7);
        let decodedJti = 'N/A';

        if (token) {
          const decoded = jwt.decode(token) as JwtPayload;
          decodedJti = (decoded as any)?.jti || 'N/A';
          const exp = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
          tokenBlacklist.set(token, exp);
        }

        const tCompleted = new Date().toISOString();

        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req, decodedJti !== 'N/A' ? decodedJti : undefined);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'USER_LOGOUT', status: 'success',
            entityType: 'user', entityId: req.user!.id,
            ipAddress, device, location, sessionId,
            metadata: {
              auditType: "AUTH",
              method: 'manual_logout',
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tCompleted }
            }
          });
        } catch (e) { console.error("Audit log failed:", e); }

        res.clearCookie("token", { httpOnly: true, sameSite: "strict" });
        res.json({ success: true, message: "Logged out successfully" });
      } catch (error) {
        const tFailed = new Date().toISOString();
        try {
          const { ipAddress, device, location } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'USER_LOGOUT', status: 'failed',
            entityType: 'system', entityId: req.user!.id,
            ipAddress, device, location, sessionId: 'N/A',
            metadata: {
              auditType: "AUTH",
              reason: 'server error (500)', 
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed } 
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Logout failed" });
      }
    }
  );

  app.post(
    "/api/auth/complete-registration",
    async (req: Request, res: Response) => {

      const tRequestReceived = new Date().toISOString();

      try {
        const payload = completeRegistrationSchema.parse(req.body);
        const tCredentialsVerified = new Date().toISOString();
        const decoded = verifyRegistrationToken(payload.registrationToken);
        
        if (!decoded?.id) {
          const tFailed = new Date().toISOString();
          try {
            const { ipAddress, device, location } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole, action: 'COMPLETE_REGISTRATION', status: 'failed',
              entityType: 'user', entityId: 'N/A', ipAddress, device, location, sessionId: 'N/A',
              metadata: { auditType: 'AUTH', method: 'Social Auth Completion', reason: 'Invalid or expired registration token', timeline: { requestReceivedAt: tRequestReceived, credentialsVerifiedAt: tCredentialsVerified, completedAt: tFailed } }
            });
          } catch (e) {}
          return res
            .status(401)
            .json({ error: "Invalid or expired registration token" });
        }

        const user = await storage.getUser(decoded.id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (user.registrationComplete) {
          const tFailed = new Date().toISOString();
          try {
            const { ipAddress, device, location } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole, action: 'COMPLETE_REGISTRATION', status: 'failed',
              entityType: 'user', entityId: user.id, ipAddress, device, location, sessionId: 'N/A',
              metadata: { auditType: 'AUTH', method: 'Social Auth Completion', reason: 'Registration already completed', timeline: { requestReceivedAt: tRequestReceived, credentialsVerifiedAt: tCredentialsVerified, registrationCompleteAt: tFailed, completedAt: tFailed } }
            });
          } catch (e) {}
          return res
            .status(400)
            .json({ error: "Registration already completed" });
        }

        if (payload.role === UserRole.DOCTOR) {
          // Validate Fees
          const feeError = validateDoctorFees({
            consultationFee: payload.consultationFee,
            onlineConsultationFee: payload.onlineConsultationFee,
            homeVisitFee: payload.homeVisitFee
          });
          if (feeError) return res.status(400).json({ error: feeError });

          // Validate Bank Details
          const bankError = validateBankDetails(payload.bankAccountNumber, payload.bankBranch);
          if (bankError) return res.status(400).json({ error: bankError });
        }

        const updates: any = {
          fullName: payload.fullName,
          phone: payload.phone,
          role: payload.role,
          provider: user.provider || decoded.provider || AuthProvider.LOCAL,
          registrationComplete: true,
          preferredLanguages: payload.preferredLanguages ||
            user.preferredLanguages || [Language.ENGLISH],
          address: payload.address ?? user.address,
          city: payload.city ?? user.city,
          gender: payload.gender ?? user.gender,
          profileImage: payload.profileImage ?? user.profileImage,
          isEmailVerified: true,
        };

        let updatedUser = await storage.updateUser(user.id, updates);
        if (!updatedUser) {
          return res.status(500).json({ error: "Failed to update user" });
        }

        if (payload.role === UserRole.DOCTOR) {
          const doctorData = insertDoctorProfileSchema.parse({
            userId: updatedUser.id,
            registrationNumber: payload.registrationNumber,
            qualifications: payload.qualifications,
            biography: req.body.biography,
            specializationIds: payload.specializationIds || [],
            languagesSpoken: payload.languagesSpoken || [Language.ENGLISH],
            consultationTypes: payload.consultationTypes || [
              ConsultationType.IN_PERSON,
            ],
            consultationFee: payload.consultationFee || 0,
            onlineConsultationFee: payload.onlineConsultationFee,
            homeVisitFee: payload.homeVisitFee,
            verificationDocuments: req.body.verificationDocuments || [],
            bankName: payload.bankName,
            bankAccountNumber: payload.bankAccountNumber,
            bankBranch: payload.bankBranch,
            status: DoctorStatus.PENDING,
          });

          await storage.createDoctorProfile(doctorData);

          // Notify all admins about the new doctor registration awaiting verification
          try {
            const newDoctorName = updatedUser.fullName;
            const newDoctorId = updatedUser.id;
            const regAdmins = await storage.getAllUsers("admin");
            await Promise.all(
              regAdmins.map((a) =>
                storage.createNotification({
                  userId: a.id,
                  title: "New doctor registration",
                  message: `${newDoctorName} has registered as a doctor and is awaiting verification.`,
                  type: "system",
                  isRead: false,
                  relatedId: newDoctorId,
                }),
              ),
            );
          } catch (notifyError) {
            console.error("Failed to notify admins of doctor registration:", notifyError);
          }
        }

        updatedUser = (await storage.getUser(user.id)) || updatedUser;
        const token = generateToken({
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          fullName: updatedUser.fullName,
        });

        const tSessionCreated = new Date().toISOString();
        const tCompleted = new Date().toISOString();

        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole, action: 'COMPLETE_REGISTRATION', status: 'success',
            entityType: 'user', entityId: updatedUser.id, ipAddress, device, location, sessionId,
            metadata: { 
              auditType: 'AUTH', method: 'Social Auth Completion',
              timeline: {
                requestReceivedAt: tRequestReceived,
                credentialsVerifiedAt: tCredentialsVerified,
                registrationCompleteAt: tCompleted,
                sessionCreatedAt: tSessionCreated,
                completedAt: tCompleted
              }
            }
          });
        } catch (e) { console.error("Audit log failed:", e); }

        const { password: _, ...userWithoutPassword } = updatedUser;
        res.cookie("token", token, cookieOptions).json({ user: userWithoutPassword, token });
      } catch (error) {
        console.error("Failed to complete registration:", error);
        const tFailed = new Date().toISOString();
        if (error instanceof z.ZodError) {
          try {
            const { ipAddress, device, location } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole, action: 'COMPLETE_REGISTRATION', status: 'failed',
              entityType: 'user', entityId: 'N/A', ipAddress, device, location, sessionId: 'N/A',
              metadata: { auditType: 'AUTH', method: 'Social Auth Completion', reason: 'Validation Failed (400)', validationErrors: error.errors, timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed } }
            });
          } catch (e) {}
          return res.status(400).json({ error: error.errors });
        }
        try {
          const { ipAddress, device, location } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole, action: 'COMPLETE_REGISTRATION', status: 'failed',
            entityType: 'system', entityId: 'N/A', ipAddress, device, location, sessionId: 'N/A',
            metadata: { auditType: 'AUTH', method: 'Social Auth Completion', reason: 'Internal Server Error (500)', timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed } }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to complete registration" });
      }
    },
  );

  // Google OAuth Configuration
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
          scope: ["profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(
                new Error("No email found in Google profile"),
                undefined,
              );
            }

            let user = await storage.getUserByEmail(email);

            const baseUserData = {
              email,
              fullName: profile.displayName || email.split("@")[0],
              password: await hashPassword(randomUUID()),
              role: UserRole.PATIENT,
              phone: "",
              profileImage: profile.photos?.[0]?.value || null,
              googleId: profile.id,
              provider: AuthProvider.GOOGLE,
              providerId: profile.id,
              registrationComplete: false,
              isEmailVerified: true,
            };

            if (!user) {
              user = await storage.createUser(baseUserData as any);
            } else {
              const updates: any = {};
              if (!user.googleId) updates.googleId = profile.id;
              if (!user.provider) updates.provider = AuthProvider.GOOGLE;
              if (!user.providerId) updates.providerId = profile.id;
              if (user.registrationComplete === undefined)
                updates.registrationComplete = false;
              if (Object.keys(updates).length > 0) {
                user =
                  ((await storage.updateUser(user.id, updates)) as any) ?? user;
              }
            }

            done(null, user);
          } catch (error) {
            done(error as Error, undefined);
          }
        },
      ),
    );

    app.get(
      "/api/auth/google",
      passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
      }),
    );

    app.get("/api/auth/google/callback", async (req: Request, res: Response, next: NextFunction) => {

      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      passport.authenticate("google", { session: false }, async (err: any, user: any, info: any) => {
        const tProviderVerified = new Date().toISOString();
        
        let actorId = 'system';
        let actorRole = 'system';
        
        if (user && user.id) {
          actorId = user.id;
          actorRole = user.role || 'patient';
        } else {
          const fallbackInfo = await getActorInfo(req);
          actorId = fallbackInfo.actorId;
          actorRole = fallbackInfo.actorRole;
        }

        if (err || !user) {
          const tFailed = new Date().toISOString();
          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'USER_GOOGLE', status: 'failed',
              entityType: 'system', entityId: 'N/A', 
              ipAddress, device, location, sessionId,
              metadata: { 
                method: 'Google OAuth', reason: err?.message || 'Google Auth Failed / Cancelled', 
                timeline: { requestReceivedAt: tRequestReceived, 
                  providerIdentifiedAt: tProviderVerified, 
                  completedAt: tFailed 
                } 
              }
            });
          } catch (e) {}
          return res.redirect("/login?error=google_auth_failed");
        }

        const { password: _, ...userWithoutPassword } = user;

        if (!user.registrationComplete || !user.phone) {
          const regData = generateRegistrationToken({
            id: user.id, email: user.email, provider: user.provider || AuthProvider.GOOGLE,
          });
          const tCompleted = new Date().toISOString();

          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'USER_REGISTER_GOOGLE', status: 'success',
              entityType: 'user', entityId: user.id, 
              ipAddress, device, location, sessionId,
              metadata: { 
                method: 'Google OAuth', reason: 'Redirected to complete registration', 
                timeline: { 
                  requestReceivedAt: tRequestReceived, 
                  credentialsVerifiedAt: tProviderVerified, 
                  completedAt: tCompleted 
                } 
              }
            });
          } catch (e) {}

          const userJson = encodeURIComponent(JSON.stringify({ ...userWithoutPassword, registrationComplete: false }));
          return res.redirect(`/auth/callback?status=incomplete&registrationToken=${regData.token}&provider=google&user=${userJson}`);
        }
      const { token, jti } = generateToken({
          id: user.id, email: user.email, role: user.role, fullName: user.fullName,
        });
        
        const tSessionCreated = new Date().toISOString();
        const tCompleted = new Date().toISOString();

        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'USER_LOGIN_GOOGLE', status: 'success',
            entityType: 'user', entityId: user.id, 
            ipAddress, device, location, sessionId,
            metadata: { 
              method: 'Google OAuth', reason: 'Login successful',
              timeline: { 
                requestReceivedAt: tRequestReceived, 
                credentialsVerifiedAt: tProviderVerified, 
                sessionCreatedAt: tSessionCreated, 
                completedAt: tCompleted 
              } 
            }
          });
        } catch (e) {}

        const userJson = encodeURIComponent(JSON.stringify(userWithoutPassword));
        res.cookie("token", token, cookieOptions);
        res.redirect(`/auth/callback?status=ok&token=${token}&user=${userJson}`);
      })(req, res, next);
    });
  } else {

    app.get("/api/auth/google", async (_req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(_req);
      const { actorId, actorRole } = await getActorInfo(_req);
      const tFailed = new Date().toISOString();

      try {
        storage.createAuditLog({
          actorId, actorRole,
          action: 'USER_GOOGLE', status: 'failed',
          entityType: 'system', entityId: 'N/A',
          ipAddress, device, location, sessionId,
          metadata: { 
            method: 'Google OAuth', reason: 'Google OAuth not configured',
            timeline: { 
              requestReceivedAt: tRequestReceived,
              completedAt: tFailed
             }
          }
        });
      } catch (e) {}
      res
        .status(503)
        .json({ error: "Google OAuth is not configured on the server." });
    });
    app.get("/api/auth/google/callback", async (_req: Request, res: Response) => {

      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(_req);
      const { actorId, actorRole } = await getActorInfo(_req);
      const tFailed = new Date().toISOString();

      try {
        storage.createAuditLog({
        actorId, actorRole,
        action: 'USER_GOOGLE', status: 'failed',
        entityType: 'system', entityId: 'N/A',
        ipAddress, device, location, sessionId,
        metadata: { 
          method: 'Google OAuth Callback', reason: 'Google OAuth not configured server-side',
          timeline: {
            requestReceivedAt: tRequestReceived,
            completedAt: tFailed
          }
        }
      });
      } catch (e) {}
      res
        .status(503)
        .json({ error: "Google OAuth is not configured on the server." });
    });
  }

  app.get(
    "/api/auth/me",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = await storage.getUser(req.user!.id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const { password: _, ...userWithoutPassword } = user;

        let doctorProfile = null;
        if (user.role === UserRole.DOCTOR) {
          doctorProfile = await storage.getDoctorProfileByUserId(user.id);
        }

        res.json({ user: userWithoutPassword, doctorProfile });
      } catch (error) {
        res.status(500).json({ error: "Failed to get user" });
      }
    },
  );

  app.post("/api/registration/session", async (req: Request, res: Response) => {

    const tRequestReceived = new Date().toISOString();

    try {
      const { email } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res
          .status(400)
          .json({ error: "Valid email address is required" });
      }

      const clientIp = req.ip || req.socket.remoteAddress || "unknown";

      if (!checkSessionCreationLimit(clientIp)) {

        const tFailed = new Date().toISOString();

        try {
          const { ipAddress, device, location } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'REGISTRATION_SESSION', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: 'N/A',
            metadata: {
              providedEmail: email, reason: 'Rate limit exceeded',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) {}
        return res.status(429).json({
          error: "Too many registration attempts from this device. Please wait 1 hour before trying again.",
        });
      }

      const tLimitationchekedAt = new Date().toISOString();

      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        const tFailed = new Date().toISOString();

        try {
          const { ipAddress, device, location } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'REGISTRATION_SESSION', status: 'failed',
            entityType: 'user', entityId: existingUser.id,
            ipAddress, device, location, sessionId: 'N/A',
            metadata: {
              providedEmail: email, reason: 'Email already registered',
              timeline: {
                requestReceivedAt: tRequestReceived,
                limitationchekedAt: tLimitationchekedAt,
                userCheckedAt: tFailed,
                completedAt: tFailed
              }
            }
          });
        } catch (e) {}
        return res.status(400).json({
          error: "This email is already registered. Please login instead.",
        });
      }

      const tUserChecked = new Date().toISOString();

      const token = createRegistrationSession(email);

      const tCompleted = new Date().toISOString();

      try {
        const { ipAddress, device, location } = getReqInfo(req);
        const { actorId, actorRole } = await getActorInfo(req);
        await storage.createAuditLog({
          actorId, actorRole,
          action: 'REGISTRATION_SESSION', status: 'success',
          entityType: 'system', entityId: 'N/A', 
          ipAddress, device, location, sessionId: `SES-${token.substring(0, 5).toUpperCase()}`,
          metadata: { providedEmail: email, reason: 'Registration session created successfully',
            timeline: { 
              requestReceivedAt: tRequestReceived, 
              userCheckedAt: tUserChecked,
              completedAt: tCompleted 
            } 
          }
        });
      } catch (e) {}

      res.json({ token, email });
    } catch (error) {
      console.error("Failed to create registration session:", error);
      res.status(500).json({ error: "Failed to create registration session" });
    }
  });

  app.post(
    "/api/upload",
    uploadLimiter,
    upload.single("file"),
    async (req: RequestWithFile, res: Response) => {
      try {
        const token = req.headers["x-registration-token"] as string;
        const email = req.headers["x-registration-email"] as string;
        const session = validateRegistrationSession(token);

        if (!session) {
          return res
            .status(401)
            .json({ error: "Invalid or expired registration session" });
        }

        if (!email || email.toLowerCase() !== session.email) {
          return res
            .status(401)
            .json({ error: "Email mismatch with registration session" });
        }

        if (session.uploadCount >= MAX_UPLOADS_PER_SESSION) {
          return res
            .status(429)
            .json({ error: "Maximum uploads reached for this session" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // With Cloudinary, req.file.path contains the full cloud URL
        const fileUrl = req.file.path;
        session.uploadedFiles.push(fileUrl);
        session.uploadCount++;

        res.json({
          url: fileUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          cloudinary: true,
        });
      } catch (error: any) {
        console.error("[UPLOAD ERROR]", error);
        const message =
          error?.message?.includes("File too large")
            ? "File is too large. Maximum size is 10MB."
            : error?.message?.includes("Invalid file type") || error?.message?.includes("not allowed")
            ? "Invalid file type. Only PDF, JPG, and PNG are allowed."
            : error?.message?.includes("cloudinary") || error?.message?.includes("Cloudinary")
            ? "Upload service is temporarily unavailable. Please try again."
            : "Failed to upload file. Please try again.";
        res.status(500).json({ error: message });
      }
    },
  );

  // Blog featured image upload — open to all (no auth required)
  app.post(
    "/api/blog-image-upload",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file)
          return res.status(400).json({ error: "No file uploaded" });
        res.json({ url: (req.file as any).path });
      } catch (error) {
        res.status(500).json({ error: "Failed to upload image" });
      }
    },
  );

  // FIX: Added documentAccessLimiter here
  app.get(
    "/api/documents/:filename",
    documentAccessLimiter,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const authHeader = req.headers.authorization;
        const headerToken = authHeader?.startsWith("Bearer ")
          ? authHeader.split(" ")[1]
          : null;
        const queryToken =
          typeof req.query.token === "string" ? req.query.token : null;
        const token = headerToken || queryToken;
        const user = token ? verifyToken(token) : null;

        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        if (user.role !== UserRole.ADMIN) {
          const doctorProfile = await storage.getDoctorProfileByUserId(user.id);
          if (
            !doctorProfile ||
            !doctorProfile.verificationDocuments?.some((doc: string) =>
              doc.includes(req.params.filename),
            )
          ) {
            return res.status(403).json({ error: "Access denied" });
          }
        }

        const doctorProfile = await storage.getDoctorProfileByUserId(user.id);
        const documentUrl = doctorProfile?.verificationDocuments?.find(
          (doc: string) => doc.includes(req.params.filename),
        );

        if (!documentUrl) {
          return res.status(404).json({ error: "Document not found" });
        }

        res.redirect(documentUrl);
      } catch (error) {
        res.status(500).json({ error: "Failed to serve document" });
      }
    },
  );

  // ================== BLOG ROUTES ==================
  app.get("/api/blogs", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const blogs = await storage.getAllBlogs();
      res.json(blogs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blogs" });
    }
  });

  app.post(
    "/api/blogs",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        const blog = await storage.createBlog(req.body);
        try {
          const tCompleted = new Date().toISOString();
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'CREATE_BLOG', status: 'success',
            entityType: 'blog', entityId: blog.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Create Blog',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tCompleted
              }
            }
          });
        } catch (e) {}
        res.status(201).json(blog);
      } catch (error) {
        const tFailed = new Date().toISOString();
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'CREATE_BLOG', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Create Blog',
              reason: 'Server error (500)',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to create blog" });
      }
    },
  );

  app.get("/api/blogs/:id", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const result = await pool.query(
        `SELECT b.id, b.title, b.description, b.category, b.created_at as "createdAt",
                COALESCE(s.featured_image, b.featured_image) as "featuredImage",
                s.content, s.submitted_by_name as "submittedByName", s.submitted_by_email as "submittedByEmail"
         FROM blogs b
         LEFT JOIN blog_submissions s ON s.blog_id = b.id AND s.status = 'approved'
         WHERE b.id = $1`,
        [req.params.id],
      );
      if (!result.rows[0])
        return res.status(404).json({ error: "Blog not found" });
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blog" });
    }
  });

  app.delete(
    "/api/blogs/:id",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        await storage.deleteBlog(req.params.id);
        try {
          const tCompleted = new Date().toISOString();
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'DELETE_BLOG', status: 'success',
            entityType: 'blog', entityId: req.params.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Delete Blog',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tCompleted
              }
            }
          });
        } catch (e) {}

        res.json({ success: true });
      } catch (error) {
        const tFailed = new Date().toISOString();
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'DELETE_BLOG', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Delete Blog',
              reason: 'Server error (500)',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to delete blog" });
      }
    },
  );

  // ================== BLOG SUBMISSION ROUTES ==================
  app.post("/api/blog-submissions", async (req: Request, res: Response) => {
    const tRequestReceived = new Date().toISOString();
    try {
      const { submittedByName, submittedByEmail, ...rest } = req.body;
      if (!submittedByName || !submittedByEmail) {
        try {
          const tFailed = new Date().toISOString();
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'BLOG_SUBMISSION', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Submit Blog',
              reason: 'Validation failed - Name and email required',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) {}
        return res.status(400).json({ error: "Name and email are required" });
      }
      const submission = await storage.createBlogSubmission({
        ...rest,
        submittedById: "anonymous",
        submittedByName,
        submittedByEmail,
      });
      
      try {
        const tCompleted = new Date().toISOString();
        const { ipAddress, device, location, sessionId } = getReqInfo(req);
        const { actorId, actorRole } = await getActorInfo(req);
        await storage.createAuditLog({
          actorId, actorRole,
          action: 'BLOG_SUBMISSION', status: 'success',
          entityType: 'blog_submission', entityId: submission.id,
          ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: {
            auditType: 'BLOGS',
            method: 'Submit Blog',
            reason: 'Blog submission created successfully',
            timeline: {
              requestReceivedAt: tRequestReceived,
              completedAt: tCompleted
            }
          }
        });
      } catch (e) {}
      res.status(201).json(submission);
    } catch (error) {
      const tFailed = new Date().toISOString();
      try {
        const { ipAddress, device, location, sessionId } = getReqInfo(req);
        const { actorId, actorRole } = await getActorInfo(req);
        await storage.createAuditLog({
          actorId, actorRole,
          action: 'BLOG_SUBMISSION', status: 'failed',
          entityType: 'system', entityId: 'N/A',
          ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: {
            auditType: 'BLOGS',
            method: 'Submit Blog',
            reason: 'Server error (500)',
            timeline: {
              requestReceivedAt: tRequestReceived,
              completedAt: tFailed
            }
          }
        });
      } catch (e) {}
      res.status(500).json({ error: "Failed to submit blog" });
    }
  });

  app.get(
    "/api/blog-submissions",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (_req: Request, res: Response) => {
      try {
        const submissions = await storage.getAllBlogSubmissions();
        res.json(submissions);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch blog submissions" });
      }
    },
  );

  app.get(
    "/api/blog-submissions/:id",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const submission = await storage.getBlogSubmission(req.params.id);
        if (!submission)
          return res.status(404).json({ error: "Submission not found" });
        res.json(submission);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch submission" });
      }
    },
  );

  app.post(
    "/api/blog-submissions/:id/approve",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        const submission = await storage.approveBlogSubmission(req.params.id);
        if (!submission) {
          try {
            const tFailed = new Date().toISOString();
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'APPROVE_BLOG_SUBMISSION', status: 'failed',
              entityType: 'blog_submission', entityId: req.params.id,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'BLOGS',
                method: 'Approve Blog Submission',
                reason: 'Submission not found',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  completedAt: tFailed
                }
              }
            });
          } catch (e) {}
          return res.status(404).json({ error: "Submission not found" });
        }
        
        try {
          const tCompleted = new Date().toISOString();
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'APPROVE_BLOG_SUBMISSION', status: 'success',
            entityType: 'blog_submission', entityId: submission.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Approve Blog Submission',
              reason: 'Blog submission approved and published',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tCompleted
              }
            }
          });
        } catch (e) {}

        res.json(submission);
      } catch (error) {
        try {
          const tFailed = new Date().toISOString();
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'APPROVE_BLOG_SUBMISSION', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Approve Blog Submission',
              reason: 'Server error (500)',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to approve submission" });
      }
    },
  );

  app.post(
    "/api/blog-submissions/:id/reject",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        const { rejectionReason } = req.body;
        if (!rejectionReason) {
          try {
            const tFailed = new Date().toISOString();
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'REJECT_BLOG_SUBMISSION', status: 'failed',
              entityType: 'system', entityId: 'N/A',
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'BLOGS',
                method: 'Reject Blog Submission',
                reason: 'Rejection reason is required',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  completedAt: tFailed
                }
              }
            });
          } catch (e) {}
          return res
            .status(400)
            .json({ error: "Rejection reason is required" });
        }
        const submission = await storage.rejectBlogSubmission(
          req.params.id,
          rejectionReason,
        );
        if (!submission) {
          try {
            const tFailed = new Date().toISOString();
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'REJECT_BLOG_SUBMISSION', status: 'failed',
              entityType: 'blog_submission', entityId: req.params.id,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'BLOGS',
                method: 'Reject Blog Submission',
                reason: 'Submission not found',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  completedAt: tFailed
                }
              }
            });
          } catch (e) {}
          return res.status(404).json({ error: "Submission not found" });
        }

        try {
          const tCompleted = new Date().toISOString();
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'REJECT_BLOG_SUBMISSION', status: 'success',
            entityType: 'blog_submission', entityId: submission.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Reject Blog Submission',
              reason: 'Blog submission rejected',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tCompleted
              }
            }
          });
        } catch (e) {}
        res.json(submission);
      } catch (error) {
        try {
          const tFailed = new Date().toISOString();
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'REJECT_BLOG_SUBMISSION', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'BLOGS',
              method: 'Reject Blog Submission',
              reason: 'Server error (500)',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed
              }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to reject submission" });
      }
    },
  );

  app.get("/api/cities", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const cities = await storage.getActiveCities();
      res.json(cities);
    } catch (error) {
      res.status(500).json({ error: "Failed to get cities" });
    }
  });

  app.get("/api/specializations", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const specializations = await storage.getAllSpecializations();
      res.json(specializations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get specializations" });
    }
  });

  app.post(
    "/api/specializations",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const data = insertSpecializationSchema.parse(req.body);
        const specialization = await storage.createSpecialization(data);

        // Announce new specialization to all patients
        const patients = await storage.getAllUsers("patient");
        await Promise.all(
          patients.map((p) =>
            storage.createNotification({
              userId: p.id,
              title: "New specialization available",
              message: `${specialization.name} is now available on AyurvedicDoctor. Book a consultation with our specialists today.`,
              type: "system",
              isRead: false,
            }),
          ),
        );

        res.status(201).json(specialization);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create specialization" });
      }
    },
  );

  app.get("/api/hospitals", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const hospitals = await storage.getAllHospitals();
      res.json(hospitals);
    } catch (error) {
      res.status(500).json({ error: "Failed to get hospitals" });
    }
  });

  app.get("/api/hospitals/:id", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const hospital = await storage.getHospital(req.params.id);
      if (!hospital) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.json(hospital);
    } catch (error) {
      res.status(500).json({ error: "Failed to get hospital" });
    }
  });

  app.post(
    "/api/hospitals",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const data = insertHospitalSchema.parse(req.body);
        const hospital = await storage.createHospital(data);
        res.status(201).json(hospital);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create hospital" });
      }
    },
  );

  app.get("/api/doctors", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const filters: any = { status: DoctorStatus.VERIFIED };

      if (req.query.specializationId)
        filters.specializationId = req.query.specializationId as string;
      if (req.query.city) filters.city = req.query.city as string;
      if (req.query.minRating)
        filters.minRating = parseFloat(req.query.minRating as string);
      if (req.query.consultationType)
        filters.consultationType = req.query.consultationType as string;

      const doctors = await storage.getAllDoctors(filters);
      res.json(doctors);
    } catch (error) {
      res.status(500).json({ error: "Failed to get doctors" });
    }
  });

  app.get("/api/doctors/featured", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const doctors = await storage.getVerifiedDoctors();
      const featured = doctors
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 6);
      res.json(featured);
    } catch (error) {
      res.status(500).json({ error: "Failed to get featured doctors" });
    }
  });

  // Home page search endpoint - optimized for quick lookups with minimal filters
  app.get("/api/doctors/search", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const query = req.query.q?.toString().toLowerCase();

      if (!query || query.length < 2) {
        return res.json([]);
      }

      const allDoctors = await storage.getAllDoctors({
        status: DoctorStatus.VERIFIED,
      });

      const searchResults = allDoctors
        .filter(
          (d: any) =>
            d.user?.fullName.toLowerCase().includes(query) ||
            d.specializations?.some((s: any) =>
              s.name.toLowerCase().includes(query),
            ) ||
            d.hospitals?.some(
              (h: any) =>
                h.name.toLowerCase().includes(query) ||
                h.city.toLowerCase().includes(query),
            ),
        )
        .slice(0, 5);

      res.json(searchResults);
    } catch (error) {
      console.error("Search API Error:", error);
      res.status(500).json({ error: "Failed to search doctors" });
    }
  });

  app.get("/api/doctors/:id", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const doctor = await storage.getDoctorWithDetails(req.params.id);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      res.json(doctor);
    } catch (error) {
      res.status(500).json({ error: "Failed to get doctor" });
    }
  });

  app.get("/api/doctors/:id/slots", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ error: "Date is required" });
      }

      const slots = await storage.getDoctorDaySlots(
        req.params.id,
        date as string,
      );
      res.json(slots);
    } catch (error) {
      res.status(500).json({ error: "Failed to get slots" });
    }
  });

  // Fetch a slot by id (used when returning from the doctor profile booking CTA)
  app.get("/api/slots/:id", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const slot = await storage.getAppointmentSlot(req.params.id);
      if (!slot) {
        return res.status(404).json({ error: "Slot not found" });
      }
      res.json(slot);
    } catch (error) {
      res.status(500).json({ error: "Failed to get slot" });
    }
  });

  app.get("/api/doctors/:id/reviews", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const reviews = await storage.getDoctorReviews(req.params.id);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  app.get(
    "/api/doctor/profile",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const doctor = await storage.getDoctorWithDetails(profile.id);
        res.json(doctor);
      } catch (error) {
        res.status(500).json({ error: "Failed to get doctor profile" });
      }
    },
  );

  app.put(
    "/api/doctor/profile",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        // Added validations for fees and bank details
        const feeError = validateDoctorFees({
          consultationFee: req.body.consultationFee !== undefined ? parseInt(req.body.consultationFee) : undefined,
          onlineConsultationFee: req.body.onlineConsultationFee !== undefined ? parseInt(req.body.onlineConsultationFee) : undefined,
          homeVisitFee: req.body.homeVisitFee !== undefined ? parseInt(req.body.homeVisitFee) : undefined
        });
        if (feeError) return res.status(400).json({ error: feeError });

        const bankError = validateBankDetails(req.body.bankAccountNumber, req.body.bankBranch);
        if (bankError) return res.status(400).json({ error: bankError });

        const safeUpdateData = insertDoctorProfileSchema.partial().omit({
          userId: true,
          status: true,
          rejectionReason: true,
          verificationDocuments: true,
        }).parse(req.body);

        const updated = await storage.updateDoctorProfile(profile.id, safeUpdateData);
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation failed", details: error.errors });
        }
        res.status(500).json({ error: "Failed to update profile" });
      }
    },
  );

  app.post("/api/doctor/hospitals", authMiddleware, roleMiddleware(UserRole.DOCTOR), async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) return res.status(404).json({ error: "Doctor profile not found" });

        if ((profile.hospitalIds || []).length >= 5) {
          return res.status(400).json({ error: "You have reached the maximum of 5 consultation locations." });
        }

        const data = insertHospitalSchema.parse(req.body);

        const result = await storage.addDoctorHospital(profile.id, data);
        if (!result) return res.status(400).json({ error: "Could not add location." });

        res.status(201).json(result.hospital);
      } catch (error) {
        res.status(500).json({ error: "Failed to add location" });
      }
    }
  );

  app.delete(
    "/api/doctor/hospitals/:hospitalId",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }
        await storage.removeDoctorHospital(profile.id, req.params.hospitalId);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to remove location" });
      }
    },
  );

  app.get(
    "/api/doctor/schedules",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const schedules = await storage.getDoctorSchedules(profile.id);
        res.json(schedules);
      } catch (error) {
        res.status(500).json({ error: "Failed to get schedules" });
      }
    },
  );

  app.post(
    "/api/doctor/schedules",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const data = insertDoctorScheduleSchema.parse({
          ...req.body,
          doctorId: profile.id,
        });
        const schedule = await storage.createDoctorSchedule(data);
        res.status(201).json(schedule);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create schedule" });
      }
    },
  );

  app.delete(
    "/api/doctor/schedules/:id",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        await storage.deleteDoctorSchedule(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete schedule" });
      }
    },
  );

  app.get(
    "/api/doctor/slots",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
          return res
            .status(400)
            .json({ error: "Start and end dates are required" });
        }

        const slots = await storage.getDoctorSlots(
          profile.id,
          startDate as string,
          endDate as string,
        );
        res.json(slots);
      } catch (error) {
        res.status(500).json({ error: "Failed to get slots" });
      }
    },
  );

  app.post(
    "/api/doctor/slots",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          const tFailed = new Date().toISOString();
          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'SLOT_CREATED', status: 'failed',
              entityType: 'appointment_slots', entityId: req.params.id,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'APPOINTMENT',
                reason: 'Doctor profile not found',
                timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
              }
            });
          } catch (e) {}
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const data = insertAppointmentSlotSchema.parse({
          ...req.body,
          doctorId: profile.id,
        });

        const now = new Date();
        // Server time eken ada dawasa saha current time eka gannawa
        const serverToday = now.toISOString().split("T")[0];
        const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

        if (data.date === serverToday && data.startTime < currentTimeStr) {
          return res.status(400).json({ error: "Cannot schedule slots for past times today." });
        }

        const duration = profile.slotDurationMinutes || 30;
        const [h, m] = data.startTime.split(":").map(Number);
        const endD = new Date();
        endD.setHours(h, m + duration, 0, 0);

        data.endTime = `${endD.getHours().toString().padStart(2, "0")}:${endD.getMinutes().toString().padStart(2, "0")}`;

        const existingSlots = await storage.getAvailableSlots(profile.id, data.date);

        const normalizeTime = (t: string) => (t ? t.substring(0, 5) : "");
        const isOverlap = (s1: string, e1: string, s2: string, e2: string) => {
          return normalizeTime(s1) < normalizeTime(e2) && normalizeTime(s2) < normalizeTime(e1);
        };



        const hasOverlap = existingSlots.some((slot) => 
          !slot.isBlocked && 
          slot.isActive !== false &&
          isOverlap(data.startTime, data.endTime, slot.startTime, slot.endTime)
        );

        if (hasOverlap) {
          const tFailed = new Date().toISOString();
          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'SLOT_CREATED', status: 'failed',
              entityType: 'appointment_slots', entityId: 'N/A',
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'APPOINTMENT',
                date: data.date,
                time: `${data.startTime} - ${data.endTime}`,
                type: data.consultationType,
                reason: 'Overlapping slot exists',
                timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
              }
            });
          } catch (e) {}
          return res.status(400).json({ error: "A slot already exists during this time period on the selected date." });
        }

        let meetLink: string | undefined = undefined;
        if (data.consultationType === "online") {
          const startDateTime = new Date(`${data.date}T${data.startTime}:00+05:30`).toISOString();
          
          const meetData = await createGoogleMeetEvent(req.user!.email, null, startDateTime);
          
          if (meetData && meetData.meetingLink) {
            meetLink = meetData.meetingLink;
          }
        }

        const slot = await storage.createAppointmentSlot({ ...data, meetLink });

        const tCompleted = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'SLOT_CREATED', status: 'success',
            entityType: 'appointment_slots', entityId: req.params.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'APPOINTMENT',
              date: data.date,
              time: `${data.startTime} - ${data.endTime}`,
              type: data.consultationType,
              hasGoogleMeet: !!meetLink,
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tCompleted }
            }
          });
        } catch (e) {}
        res.status(201).json(slot);
      } catch (error) {
        const tFailed = new Date().toISOString();
        if (error instanceof z.ZodError) {
          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'SLOT_CREATED', status: 'failed',
              entityType: 'appointment_slots', entityId: req.params.id,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'APPOINTMENT',
                reason: 'Validation failed',
                details: error.errors,
                timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
              }
            });
          } catch (e) {}
          return res.status(400).json({ error: error.errors });
        }
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'SLOT_CREATED', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'APPOINTMENT',
              reason: 'Server error (500)',
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to create slot" });
      }
    },
  );

  app.patch(
    "/api/doctor/appointments/:id/call",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile || appointment.doctorId !== profile.id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const updated = await storage.markAppointmentAsCalled(req.params.id);

        if (updated) {
          await storage.createNotification({
            userId: updated.patientId,
            title: "You're Being Called",
            message:
              "The doctor is ready for you. Please proceed to the consultation room.",
            type: "appointment",
            isRead: false, // Make sure isRead is passed
            relatedId: updated.id,
          });

          await storage.createAuditLog({
            actorId, actorRole, action: 'APPOINTMENT_CALLED', status: 'success',
            entityType: 'appointment', entityId: updated.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: { auditType: 'APPOINTMENT', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
          });
        }

        res.status(200).json({ success: true });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        await storage.createAuditLog({
          actorId, actorRole, action: 'APPOINTMENT_CALLED', status: 'failed',
          entityType: 'appointment', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Server error (500)', timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() } }
        }).catch(()=>{});
        res.status(500).json({ error: "Failed to call appointment" });
      }
    },
  );

  app.patch(
    "/api/doctor/slots/:id/block",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const slot = await storage.blockSlot(req.params.id);

        await storage.createAuditLog({
          actorId, actorRole, action: 'SLOT_BLOCKED', status: 'success',
          entityType: 'appointment_slots', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Doctor blocked slot (likely cancelled a booking)', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
        });

        res.json(slot);
      } catch (error) {
        await storage.createAuditLog({
          actorId, actorRole, action: 'SLOT_BLOCKED', status: 'failed',
          entityType: 'appointment_slots', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Server error (500)', timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() } }
        }).catch(()=>{});
        res.status(500).json({ error: "Failed to block slot" });
      }
    },
  );

  app.post(
    "/api/appointments",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const bookingData = bookingSchema.parse(req.body);

        const doctor = await storage.getDoctorProfile(bookingData.doctorId);
        if (!doctor || doctor.status !== DoctorStatus.VERIFIED) {
          return res.status(400).json({ error: "Doctor not available" });
        }

        const checkResult = await pool.query(
          `SELECT date, start_time as "startTime" FROM appointment_slots
           WHERE id = $1 AND doctor_id = $2 AND is_booked = false AND is_blocked = false AND is_active = true`,
          [bookingData.slotId, bookingData.doctorId]
        );

        if (checkResult.rowCount === 0) {
          return res.status(409).json({ error: "Sorry, this slot is no longer available." });
        }
        
        const slotData = checkResult.rows[0];

        const appointmentData = {
          patientId: req.user!.id,
          doctorId: bookingData.doctorId,
          slotId: bookingData.slotId,
          hospitalId: bookingData.hospitalId,
          appointmentDate: slotData.date,
          appointmentTime: slotData.startTime,
          consultationType: bookingData.consultationType,
          symptoms: bookingData.symptoms,
          isForDependent: bookingData.isForDependent,
          dependentName: bookingData.dependentName,
          dependentAge: bookingData.dependentAge,
          dependentGender: bookingData.dependentGender,
          dependentContact: bookingData.dependentContact,
          isCalled: false,
          status: AppointmentStatus.PENDING,
        };

        const appointment = await storage.createAppointment(appointmentData);

        let consultationFee = doctor.consultationFee;
        if (
          bookingData.consultationType === "online" &&
          doctor.onlineConsultationFee
        ) {
          consultationFee = doctor.onlineConsultationFee;
        } else if (
          bookingData.consultationType === "home_visit" &&
          doctor.homeVisitFee
        ) {
          consultationFee = doctor.homeVisitFee;
        }

        const [platformSettings, allCustomTaxes, allFees] = await Promise.all([
          storage.getPlatformSettings(),
          storage.getTaxEntries(),
          storage.getFeeEntries(),
        ]);
        const bookingCharges = platformSettings.bookingCharges;
        const stampDutyAmt = platformSettings.stampDutyEnabled
          ? Math.round(consultationFee * 0.01)
          : 0;
        const baseTaxAmt = Math.round(consultationFee * (platformSettings.taxRate / 100));

        // Custom taxes for patients
        const patientCustomTaxes = allCustomTaxes.filter(
          (t) => t.applicableTo === "patients" || t.applicableTo === "both"
        );
        const customPatientTaxAmt = patientCustomTaxes.reduce(
          (sum, t) => sum + Math.round(consultationFee * (t.rate / 100)), 0
        );

        // Custom fees (enabled only). Amount fees are flat LKR; percentage fees scale with the consultation fee.
        const enabledFees = allFees.filter((f) => f.enabled);
        const feeAmount = (f: { feeType: string; rate: number }) =>
          f.feeType === "percentage" ? Math.round(consultationFee * (f.rate / 100)) : f.rate;
        const patientFees = enabledFees.filter(
          (f) => f.applicableTo === "patients" || f.applicableTo === "both"
        );
        const doctorFees = enabledFees.filter(
          (f) => f.applicableTo === "doctors" || f.applicableTo === "both"
        );
        const patientFeeAmt = patientFees.reduce((sum, f) => sum + feeAmount(f), 0);
        const doctorFeeAmt = doctorFees.reduce((sum, f) => sum + feeAmount(f), 0);

        const tax = baseTaxAmt + stampDutyAmt + customPatientTaxAmt;

        // Build full breakdown for patient invoice
        const taxBreakdown: { title: string; rate: number; amount: number; applicableTo: "doctors" | "patients" | "both" | "platform"; kind?: "tax" | "fee"; feeType?: "amount" | "percentage" }[] = [];
        if (baseTaxAmt > 0) taxBreakdown.push({ title: `Government Tax`, rate: platformSettings.taxRate, amount: baseTaxAmt, applicableTo: "patients", kind: "tax" });
        if (stampDutyAmt > 0) taxBreakdown.push({ title: "Stamp Duty", rate: 1, amount: stampDutyAmt, applicableTo: "patients", kind: "tax" });
        for (const t of patientCustomTaxes) {
          const amt = Math.round(consultationFee * (t.rate / 100));
          taxBreakdown.push({ title: t.title, rate: t.rate, amount: amt, applicableTo: t.applicableTo, kind: "tax" });
        }
        // Custom fees: record ALL enabled fees (patient, doctor, or both), each tagged
        // with applicableTo. Patient invoice shows patients/both; doctor earnings shows doctors/both.
        for (const f of enabledFees) {
          taxBreakdown.push({ title: f.title, rate: f.rate, amount: feeAmount(f), applicableTo: f.applicableTo, kind: "fee", feeType: f.feeType });
        }

        const platformCommission = Math.round(
          consultationFee * (platformSettings.platformCommissionRate / 100),
        );
        // Doctor-facing custom fees are deducted from the doctor's payout (never below 0)
        const doctorEarnings = Math.max(0, consultationFee - platformCommission - doctorFeeAmt);
        const totalAmount = consultationFee + bookingCharges + tax + patientFeeAmt;

        const paymentData = {
          appointmentId: appointment.id,
          patientId: req.user!.id,
          doctorId: bookingData.doctorId,
          consultationFee,
          bookingCharges,
          tax,
          taxBreakdown,
          platformCommission,
          doctorEarnings,
          totalAmount,
          status:
            bookingData.paymentMethod === PaymentMethod.ONLINE
              ? PaymentStatus.PENDING
              : PaymentStatus.UNPAID,
          method: bookingData.paymentMethod,
        };

        await storage.createPayment(paymentData);

        // Notify patient, doctor and admins for every booking (online + at-clinic)
        {
          const doctorUser = await storage.getUser(doctor.userId);
          const doctorName = doctorUser?.fullName || "your doctor";
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const dateParts = typeof slotData.date === 'string' ? slotData.date.split("-") : new Date(slotData.date).toISOString().split('T')[0].split("-");
          const formattedBookingDate = `${parseInt(dateParts[2])} ${months[parseInt(dateParts[1]) - 1]}`;
          const formattedAmount = `LKR ${totalAmount.toLocaleString("en-LK")}`;
          const formattedStartTime = formatTime12h(slotData.startTime);

          await storage.createNotification({
            userId: req.user!.id,
            title: "Appointment Booked",
            message: `Your appointment with Dr. ${doctorName} has been booked for ${formattedBookingDate} at ${formattedStartTime}. Total: ${formattedAmount}.`,
            type: "appointment",
            isRead: false,
            relatedId: appointment.id,
          });

          await storage.createNotification({
            userId: doctor.userId,
            title: "New appointment booked",
            message: `${req.user!.fullName} has booked a consultation for ${formattedBookingDate} at ${formattedStartTime}. Chief complaint: ${bookingData.symptoms.substring(0, 150)}.`,
            type: "appointment",
            isRead: false,
            relatedId: appointment.id,
          });

          // Notify all admins about the new appointment
          const bookingAdmins = await storage.getAllUsers("admin");
          await Promise.all(
            bookingAdmins.map((a) =>
              storage.createNotification({
                userId: a.id,
                title: "New appointment booked",
                message: `${req.user!.fullName} booked a consultation with Dr. ${doctorName} on ${formattedBookingDate} at ${formattedStartTime}. Total: ${formattedAmount}.`,
                type: "system",
                isRead: false,
                relatedId: appointment.id,
              }),
            ),
          );

          const today = new Date().toISOString().split("T")[0];
          const slotDateStr = Array.isArray(dateParts) ? dateParts.join("-") : String(slotData.date);
          
          if (slotDateStr > today) {
            await storage.createNotification({
              userId: doctor.userId,
              title: `Consultation on ${formattedBookingDate} at ${formattedStartTime}`,
              message: `You have an upcoming consultation with ${req.user!.fullName} on ${formattedBookingDate}. Review their case notes beforehand.`,
              type: "reminder",
              isRead: false,
              relatedId: appointment.id,
            });

            // Patient-facing reminder for the upcoming consultation
            await storage.createNotification({
              userId: req.user!.id,
              title: `Upcoming consultation on ${formattedBookingDate} at ${formattedStartTime}`,
              message: `Reminder: your consultation with Dr. ${doctorName} is on ${formattedBookingDate} at ${formattedStartTime}. Please be available on time.`,
              type: "reminder",
              isRead: false,
              relatedId: appointment.id,
            });
          }
        }

        const fullAppointment = await storage.getAppointmentWithDetails(
          appointment.id,
        );

        await storage.createAuditLog({
          actorId, actorRole, action: 'APPOINTMENT_BOOK_ATTEMPT', status: 'success',
          entityType: 'appointment_slots', entityId: req.body?.slotId || 'N/A',
          ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { 
            auditType: 'APPOINTMENT', 
            timeline: { 
              requestReceivedAt: tRequestReceived, 
              completedAt: new Date().toISOString() 
            } 
          }
        });

        res.status(201).json(fullAppointment);
      } catch (error) {
        const tFailed = new Date().toISOString();
        if (error instanceof z.ZodError) {
          try {
            await storage.createAuditLog({
              actorId, actorRole, action: 'APPOINTMENT_BOOK_ATTEMPT', status: 'failed',
              entityType: 'appointment_slots', entityId: req.body?.slotId || 'N/A',
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: { auditType: 'APPOINTMENT', reason: 'Validation failed', details: error.errors, timeline: { requestReceivedAt: tRequestReceived, failedAt: tFailed } }
            });
          } catch (e) {}
          return res.status(400).json({ error: error.errors });
        }
        try {
          await storage.createAuditLog({
            actorId, actorRole, action: 'APPOINTMENT_BOOK_ATTEMPT', status: 'failed',
            entityType: 'system', entityId: 'N/A', ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: { auditType: 'APPOINTMENT', reason: 'Internal Server Error (500)', timeline: { requestReceivedAt: tRequestReceived, failedAt: tFailed } }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to book appointment" });      }
    },
  );

  app.patch(
    "/api/slots/:id/deactivate",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const slot = await storage.getAppointmentSlot(req.params.id);
        if (!slot) {
          return res.status(404).json({ error: "Slot not found" });
        }

        if (slot.doctorId !== profile.id) {
          return res.status(403).json({ error: "Not authorized" });
        }

        if (slot.isBooked) {
          return res.status(400).json({ error: "Cannot deactivate a booked slot" });
        }

        const success = await storage.deactivateSlot(req.params.id);
        if (success) {
          await storage.createAuditLog({
            actorId, actorRole, action: 'SLOT_DEACTIVATED', status: 'success',
            entityType: 'appointment_slots', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: { auditType: 'APPOINTMENT', reason: 'Doctor deleted/deactivated slot', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
          });
          res.json({ success: true, message: "Slot deactivated successfully" });
        } else {
          await storage.createAuditLog({
            actorId, actorRole, action: 'SLOT_DEACTIVATED', status: 'failure',
            entityType: 'appointment_slots', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: { auditType: 'APPOINTMENT', reason: 'Failed to deactivate slot', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
          });
          res.status(500).json({ error: "Failed to deactivate slot" });
        }
      } catch (error) {
        await storage.createAuditLog({
          actorId, actorRole, action: 'SLOT_DEACTIVATED', status: 'failure',
          entityType: 'appointment_slots', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Failed to deactivate slot', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
        });
        res.status(500).json({ error: "Failed to deactivate slot" });
      }
    },
  );

  app.get(
    "/api/doctor/appointments",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const { date } = req.query;
        const appointments = await storage.getDoctorAppointments(
          profile.id,
          date as string | undefined,
        );
        res.json(appointments);
      } catch (error) {
        res.status(500).json({ error: "Failed to get appointments" });
      }
    },
  );

  app.get(
    "/api/doctor/dashboard",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const stats = await storage.getDoctorDashboardStats(profile.id);
        const today = new Date().toISOString().split("T")[0];
        const todayAppointments = await storage.getDoctorAppointments(
          profile.id,
          today,
        );
        const upcomingAppointments = await storage.getDoctorAppointments(
          profile.id,
        );

        res.json({
          stats,
          todayAppointments: todayAppointments.filter((a) =>
            [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(a.status as any) &&
            !(a.status === AppointmentStatus.PENDING && a.payment?.method === 'online')
          ),
          upcomingAppointments: upcomingAppointments
            .filter((a) =>
              a.appointmentDate >= today &&
              [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(a.status as any) &&
              !(a.status === AppointmentStatus.PENDING && a.payment?.method === 'online')
            )
            .slice(0, 10),
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to get dashboard stats" });
      }
    },
  );

  app.patch(
    "/api/appointments/:id/reschedule",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const { newSlotId, reason } = req.body;

        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment)
          return res.status(404).json({ error: "Appointment not found" });

        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile || appointment.doctorId !== profile.id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        // Atomic unlock and lock for rescheduling
        // 1. Lock the new slot
        const lockResult = await pool.query(
          `UPDATE appointment_slots
           SET is_booked = true
           WHERE id = $1 AND doctor_id = $2 AND is_booked = false AND is_blocked = false AND is_active = true
           RETURNING date, start_time as "startTime"`,
          [newSlotId, profile.id]
        );

        if (lockResult.rowCount === 0) {
          return res.status(409).json({ error: "New slot not available or already booked." });
        }

        const newSlot = lockResult.rows[0];

        // 2. Unlock the old slot
        await storage.updateAppointmentSlot(appointment.slotId, {
          isBooked: false,
        });

        const doctorUser = await storage.getUser(profile.userId);
        const doctorName = doctorUser?.fullName || "your doctor";

        const months = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ];
        const [, omo, ody] = appointment.appointmentDate.split("-");
        const originalDate = `${parseInt(ody)} ${months[parseInt(omo) - 1]}`;
        const newDateParts = typeof newSlot.date === 'string' ? newSlot.date.split("-") : new Date(newSlot.date).toISOString().split('T')[0].split("-");
        const newDateStr = `${parseInt(newDateParts[2])} ${months[parseInt(newDateParts[1]) - 1]}`;

        const updated = await storage.updateAppointment(req.params.id, {
          slotId: newSlotId,
          appointmentDate: newSlot.date,
          appointmentTime: newSlot.startTime,
        });

        await storage.createNotification({
          userId: appointment.patientId,
          title: "Appointment Rescheduled",
          message: `Dr. ${doctorName} has rescheduled your ${originalDate} session to ${newDateStr} at ${newSlot.startTime} due to an emergency.`,
          type: "appointment",
          isRead: false,
          relatedId: appointment.id,
        });

        await storage.createAuditLog({
          actorId, actorRole, action: 'APPOINTMENT_RESCHEDULED', status: 'success',
          entityType: 'appointment', entityId: appointment.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', oldSlotId: appointment.slotId, newSlotId, reason, timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
        });

        res.json(updated);
      } catch (error) {
        await storage.createAuditLog({
          actorId, actorRole, action: 'APPOINTMENT_RESCHEDULED', status: 'failed',
          entityType: 'appointment', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Server error (500)', timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() } }
        }).catch(()=>{});
        res.status(500).json({ error: "Failed to reschedule appointment" });
      }
    },
  );

  app.patch(
    "/api/appointments/:id/cancel",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {

        const { reason, bankName, bankAccountNumber, bankBranch } = req.body;
        const existing = await storage.getAppointment(req.params.id);

        if (!existing) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        // A cancellation reason is required for both patient- and doctor-initiated cancellations (SCRUM-58/59).
        if (!reason?.trim()) {
          return res.status(400).json({ error: "A cancellation reason is required." });
        }

        const isPatient = req.user!.role === UserRole.PATIENT;
        const PATIENT_DAILY_CANCEL_LIMIT = 5;

        if (isPatient) {
          // Patients may only cancel their own appointments.
          if (existing.patientId !== req.user!.id) {
            return res.status(403).json({ error: "You can only cancel your own appointments." });
          }
          // Enforce the daily cancellation limit.
          const cancelledToday = await storage.countPatientCancellationsToday(req.user!.id);
          if (cancelledToday >= PATIENT_DAILY_CANCEL_LIMIT) {
            return res.status(429).json({
              error: `You have reached your daily cancellation limit (${PATIENT_DAILY_CANCEL_LIMIT} per day). Please try again tomorrow.`,
            });
          }
          // Bank details are required so the refund can be paid out.
          if (!bankName?.trim() || !bankAccountNumber?.trim() || !bankBranch?.trim()) {
            return res.status(400).json({ error: "Please provide your bank name, account number and branch for the refund." });
          }
        }

        const cancellableStatuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
        if (!cancellableStatuses.includes(existing.status as AppointmentStatus)) {
          return res.status(400).json({
            error: `Cannot cancel an appointment with status: ${existing.status}`,
          });
        }

        const doctorProfile = await storage.getDoctorProfile(existing.doctorId);

        // For a patient cancellation, work out the doctor's cancellation fee (deducted from the refund).
        let patientCancellationFee = 0;
        if (isPatient) {
          const pmt = await storage.getPaymentByAppointment(existing.id);
          const consultationRefundBase = pmt
            ? pmt.totalAmount - (pmt.bookingCharges || 0) - (pmt.tax || 0)
            : (doctorProfile?.consultationFee || 0);
          patientCancellationFee = computeDoctorCancellationFee(
            doctorProfile,
            consultationRefundBase,
            existing.appointmentDate,
            existing.appointmentTime,
          );
        }

        const appointment = await storage.cancelAppointment(
          req.params.id,
          reason,
          req.user!.role,
          isPatient
            ? {
                cancellationFee: patientCancellationFee,
                refundBankName: bankName,
                refundAccountNumber: bankAccountNumber,
                refundBranch: bankBranch,
              }
            : undefined,
        );

        if (appointment && existing) {
          // When the doctor cancels, charge the flat cancellation fee from platform settings
          if (req.user!.role === UserRole.DOCTOR && doctorProfile) {
            const platformSettings = await storage.getPlatformSettings();
            const amountOwed = platformSettings.cancellationFee;
            const payment = await storage.getPaymentByAppointment(existing.id);
            const fee = payment?.consultationFee ?? doctorProfile.consultationFee;
            await storage.createDoctorCancellationCharge({
              doctorId: doctorProfile.id,
              appointmentId: existing.id,
              consultationFee: fee,
              amountOwed,
            });
          }

          const doctorUser = doctorProfile
            ? await storage.getUser(doctorProfile.userId)
            : null;
          const patientUser = await storage.getUser(existing.patientId);
          const doctorName = doctorUser?.fullName || "your doctor";
          // Strip any existing "Dr." prefix so we never render "Dr. Dr. Name".
          const doctorDisplay = doctorName.replace(/^Dr\.?\s*/i, "");
          const patientName = patientUser?.fullName || "A patient";
          const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];
          const [, mo, dy] = existing.appointmentDate.split("-");
          const formattedDate = `${parseInt(dy)} ${months[parseInt(mo) - 1]}`;
          const formattedTime = formatTime12h(existing.appointmentTime);

          // Role-aware cancellation notifications (SCRUM-65).
          // Wrapped so a notification failure can never break a successful cancellation.
          try {
            if (req.user!.role === UserRole.PATIENT) {
              // Patient cancelled -> notify the doctor.
              if (doctorProfile) {
                await storage.createNotification({
                  userId: doctorProfile.userId,
                  title: "Appointment cancelled by patient",
                  message: `${patientName} cancelled their ${formattedDate} at ${formattedTime} appointment.`,
                  type: "appointment",
                  isRead: false,
                  relatedId: appointment.id,
                });
              }
            } else if (req.user!.role === UserRole.DOCTOR) {
              // Doctor cancelled -> notify the patient.
              await storage.createNotification({
                userId: existing.patientId,
                title: "Appointment cancelled",
                message: `Dr. ${doctorDisplay} cancelled your ${formattedDate} at ${formattedTime} appointment. A full consultation-fee refund is being processed.`,
                type: "appointment",
                isRead: false,
                relatedId: appointment.id,
              });
            } else {
              // Admin cancelled -> notify the patient.
              await storage.createNotification({
                userId: existing.patientId,
                title: "Appointment cancelled",
                message: `Your ${formattedDate} at ${formattedTime} appointment with Dr. ${doctorDisplay} has been cancelled.`,
                type: "appointment",
                isRead: false,
                relatedId: appointment.id,
              });
            }

            // Always notify admins about the cancelled appointment.
            const cancelAdmins = await storage.getAllUsers("admin");
            const cancelledBy = req.user!.role === UserRole.DOCTOR ? `Dr. ${doctorDisplay}` : patientName;
            await Promise.all(
              cancelAdmins.map((a) =>
                storage.createNotification({
                  userId: a.id,
                  title: "Appointment cancelled",
                  message: `${cancelledBy} cancelled the ${formattedDate} at ${formattedTime} appointment (${patientName} with Dr. ${doctorDisplay}).`,
                  type: "system",
                  isRead: false,
                  relatedId: appointment.id,
                }),
              ),
            );
          } catch (notifyErr) {
            console.error("Cancellation notifications failed:", notifyErr);
          }
        }

        res.json(appointment);
      } catch (error) {
        await storage.createAuditLog({
          actorId, actorRole, action: 'APPOINTMENT_CANCELLED_EXPLICIT', status: 'failed',
          entityType: 'appointment', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Server error (500)', timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() } }
        }).catch(()=>{});
        res.status(500).json({ error: "Failed to cancel appointment" });
      }
    },
  );

  app.patch(
    "/api/payments/:id/fail",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);
      try {
        const { lastFourDigits } = req.body;

        const payment = await storage.getPayment(req.params.id);
        if (!payment)
          return res.status(404).json({ error: "Payment not found" });

        if (
          req.user!.role !== UserRole.ADMIN &&
          req.user!.id !== payment.patientId
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const updated = await storage.updatePayment(req.params.id, {
          status: PaymentStatus.FAILED,
          consultationFee: 0,
          bookingCharges: 0,
          tax: 0,
          platformCommission: 0,
          doctorEarnings: 0,
          totalAmount: 0,
        });

        const formattedAmount = `LKR ${payment.totalAmount.toLocaleString("en-LK")}`;
        const last4 = lastFourDigits || "0000";

        // Notify patient
        await storage.createNotification({
          userId: payment.patientId,
          title: "Payment Failed",
          message: `We were unable to charge your card ending in ${last4} for ${formattedAmount}. Please update your payment method.`,
          type: "payment",
          isRead: false,
          relatedId: payment.id,
        });

        // Notify all admins about failed high-value transaction
        const admins = await storage.getAllUsers("admin");
        const shortId = payment.appointmentId.substring(0, 8).toUpperCase();
        await Promise.all(
          admins.map((a) =>
            storage.createNotification({
              userId: a.id,
              title: "Failed transaction — high value",
              message: `${formattedAmount} payment for consultation ID #${shortId} failed twice. Card issuer declined. Patient has been notified.`,
              type: "system",
              isRead: false,
              relatedId: payment.id,
            }),
          ),
        );

        const tCompleted = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'PAYMENT_MARKED_FAILED', status: 'success',
            entityType: 'payment', entityId: payment.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              amount: payment.totalAmount,
              lastFourDigits: last4,
              patientId: payment.patientId,
              reason: 'Payment manually marked as failed.',
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tCompleted }
            }
          });
        } catch (e) {}

        res.json(updated);
      } catch (error) {
        const tFailed = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'PAYMENT_MARKED_FAILED', status: 'error',
            entityType: 'payment', entityId: req.params.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              reason: 'Internal Server Error (500)',
              timeline: { requestReceivedAt: tRequestReceived, failedAt: tFailed }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to update payment status" });
      }
    },
  );

  app.get(
    "/api/doctor/patients",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const patients = await storage.getDoctorPatients(profile.id);
        res.json(patients);
      } catch (error) {
        res.status(500).json({ error: "Failed to get patients" });
      }
    },
  );

  app.get(
    "/api/doctor/reviews",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const reviews = await storage.getDoctorReviews(profile.id);
        res.json(reviews);
      } catch (error) {
        res.status(500).json({ error: "Failed to get reviews" });
      }
    },
  );

  app.patch(
    "/api/doctor/reviews/:id/respond",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { response } = req.body;
        if (!response || typeof response !== "string") {
          return res.status(400).json({ error: "Response is required" });
        }

        const review = await storage.getReview(req.params.id);
        if (!review) {
          return res.status(404).json({ error: "Review not found" });
        }

        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile || review.doctorId !== profile.id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const updatedReview = await storage.respondToReview(
          req.params.id,
          response,
        );
        res.json(updatedReview);
      } catch (error) {
        res.status(500).json({ error: "Failed to respond to review" });
      }
    },
  );

  app.get(
    "/api/doctor/earnings",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const [summary, payments, unsettled] = await Promise.all([
          storage.getDoctorEarningsSummary(profile.id),
          storage.getDoctorPayments(profile.id),
          storage.getDoctorUnsettledCharges(profile.id),
        ]);

        res.json({ summary, payments, cancellationCharges: unsettled });
      } catch (error) {
        console.error("Failed to get doctor earnings:", error);
        res.status(500).json({ error: "Failed to get earnings" });
      }
    },
  );

  app.post(
    "/api/doctor/earnings/settle",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'DOCTOR_SETTLE_EARNINGS', status: 'error',
            entityType: 'doctor', entityId: req.user!.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              method: 'Money deducted from doctor for cancellation charges',
              reason: "Doctor profile not found",
              auditType: 'PAYMENT',
              timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() }
            }
          });
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const unsettled = await storage.getDoctorUnsettledCharges(profile.id);
        if (unsettled.totalOwed === 0) {
          return res.json({ settled: true, amountDeducted: 0 });
        }

        await storage.settleDoctorCharges(profile.id);

        const tCompleted = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'EARNINGS_SETTLED', status: 'success',
            entityType: 'doctor_profile', entityId: profile.id,
            ipAddress, device, location, sessionId: 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              settledAmount: unsettled.totalOwed,
              reason: 'Doctor settled their outstanding cancellation charges with the platform.',
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tCompleted }
            }
          });
        } catch (e) {}
        
        res.json({ settled: true, amountDeducted: unsettled.totalOwed });
      } catch (error) {
        const tFailed = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'EARNINGS_SETTLEMENT_FAILED', status: 'error',
            entityType: 'doctor_profile', entityId: req.user!.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              reason: 'Internal Server Error (500) during settlement of doctor charges.',
              timeline: { requestReceivedAt: tRequestReceived, failedAt: tFailed }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to settle charges" });
      }
    },
  );

  app.patch(
    "/api/doctor/appointments/:id/no-show",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile || appointment.doctorId !== profile.id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const updated = await storage.markAppointmentNoShow(req.params.id);
        await storage.createAuditLog({
          actorId, actorRole, action: 'APPOINTMENT_NO_SHOW', status: 'success',
          entityType: 'appointment', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Doctor marked patient as No Show', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
        });
        res.json(updated);
      } catch (error) {
        await storage.createAuditLog({
          actorId, actorRole, action: 'APPOINTMENT_NO_SHOW', status: 'failed',
          entityType: 'appointment', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'APPOINTMENT', reason: 'Server error (500)', timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() } }
        }).catch(()=>{});
        res
          .status(500)
          .json({ error: "Failed to mark appointment as no-show" });
      }
    },
  );

  app.patch(
    "/api/doctor/appointments/:id/confirm",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile || appointment.doctorId !== profile.id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        if (appointment.status !== AppointmentStatus.PENDING) {
          return res.status(400).json({ error: "Only pending appointments can be confirmed" });
        }

        const updated = await storage.updateAppointment(req.params.id, {
          status: AppointmentStatus.CONFIRMED,
        });
        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to confirm appointment" });
      }
    },
  );

  app.get(
    "/api/appointments",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        let appointments;

        if (req.user!.role === UserRole.PATIENT) {
          appointments = await storage.getPatientAppointments(req.user!.id);
        } else if (req.user!.role === UserRole.DOCTOR) {
          const profile = await storage.getDoctorProfileByUserId(req.user!.id);
          if (!profile) {
            return res.status(404).json({ error: "Doctor profile not found" });
          }
          appointments = await storage.getDoctorAppointments(profile.id);
        } else {
          return res.status(403).json({ error: "Forbidden" });
        }

        res.json(appointments);
      } catch (error) {
        res.status(500).json({ error: "Failed to get appointments" });
      }
    },
  );

  app.get(
    "/api/appointments/:id",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const appointment = await storage.getAppointmentWithDetails(
          req.params.id,
        );
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        if (
          req.user!.role === UserRole.PATIENT &&
          appointment.patientId !== req.user!.id
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }

        if (req.user!.role === UserRole.DOCTOR) {
          const profile = await storage.getDoctorProfileByUserId(req.user!.id);
          if (!profile || appointment.doctorId !== profile.id) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }

        res.json(appointment);
      } catch (error) {
        res.status(500).json({ error: "Failed to get appointment" });
      }
    },
  );

  app.patch(
    "/api/appointments/:id/complete",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);
      
      try {
        const { consultationNotes } = req.body;

        const appointment = await storage.updateAppointment(req.params.id, {
          status: AppointmentStatus.COMPLETED,
          consultationNotes,
        });

        if (!appointment) {
          await storage.createAuditLog({
            actorId, actorRole, action: 'APPOINTMENT_COMPLETED', status: 'failed',
            entityType: 'appointment', entityId: req.params.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'APPOINTMENT',
              reason: 'Appointment not found for completion.',
              timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() }
            }
          });
          return res.status(404).json({ error: "Appointment not found" });
        }

        const payment = await storage.getPaymentByAppointment(req.params.id);
        if (payment) {
          await storage.updatePayment(payment.id, {
            status: PaymentStatus.COMPLETED,
          });
        }

        if (appointment) {
          const doctorProfile = await storage.getDoctorProfile(
            appointment.doctorId,
          );
          const doctorUser = doctorProfile
            ? await storage.getUser(doctorProfile.userId)
            : null;
          const doctorName = doctorUser?.fullName || "your doctor";

          await storage.createNotification({
            userId: appointment.patientId,
            title: "Appointment Completed", // Fixed Title
            message: `Your appointment with Dr. ${doctorName} has been completed. Please leave a review!`, // Friendly message
            type: "appointment",
            isRead: false,
            relatedId: appointment.id,
          });

          if (payment) {
            const months = [
              "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            ];
            const [, mo, dy] = appointment.appointmentDate.split("-");
            const formattedDate = `${parseInt(dy)} ${months[parseInt(mo) - 1]}`;
            const formattedAmount = `LKR ${payment.totalAmount.toLocaleString("en-LK")}`;

            // Patient payment notification
            await storage.createNotification({
              userId: appointment.patientId,
              title: "Payment successful",
              message: `${formattedAmount} was successfully charged for your consultation on ${formattedDate}. Receipt has been emailed.`,
              type: "payment",
              isRead: false,
              relatedId: payment.id,
            });

            // Doctor payment received notification
            if (doctorProfile) {
              await storage.createNotification({
                userId: doctorProfile.userId,
                title: "Payment received from patient",
                message: `${formattedAmount} has been received for the consultation on ${formattedDate}. This will be included in your next payout.`,
                type: "payment",
                isRead: false,
                relatedId: payment.id,
              });
            }
          }
        }

        const tCompleted = new Date().toISOString();
        await storage.createAuditLog({
          actorId, actorRole,
          action: 'APPOINTMENT_COMPLETED', status: 'success',
          entityType: 'appointment', entityId: appointment.id,
          ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: {
            auditType: 'APPOINTMENT',
            reason: 'Doctor marked appointment as completed.',
            notesLength: consultationNotes?.length || 0,
            paymentId: payment?.id || 'N/A',
            timeline: { requestReceivedAt: tRequestReceived, completedAt: tCompleted }
          }
        });

        res.json(appointment);
      } catch (error) {

        const tFailed = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'APPOINTMENT_COMPLETED', status: 'failed',
            entityType: 'system', entityId: req.params.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'APPOINTMENT',
              reason: 'Internal Server Error (500)',
              error: String(error),
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to complete appointment" });
      }
    },
  );

  app.post(
    "/api/appointments/:id/prescription",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        const data = insertPrescriptionSchema.parse({
          ...req.body,
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
        });

        const prescription = await storage.createPrescription(data);

        await storage.createNotification({
          userId: appointment.patientId,
          title: "New Prescription",
          message: "Your doctor has created a new prescription for you",
          type: "appointment",
          relatedId: prescription.id,
          isRead: false,
        });

        res.status(201).json(prescription);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create prescription" });
      }
    },
  );

  app.post(
    "/api/appointments/:id/review",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const appointment = await storage.getAppointment(req.params.id);
        if (!appointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        if (appointment.patientId !== req.user!.id) {
          return res.status(403).json({ error: "Forbidden" });
        }

        if (appointment.status !== AppointmentStatus.COMPLETED) {
          return res
            .status(400)
            .json({ error: "Can only review completed appointments" });
        }

        const existingReview = await storage.getReviewByAppointment(
          req.params.id,
        );
        if (existingReview) {
          return res.status(400).json({ error: "Review already exists" });
        }

        const data = insertReviewSchema.parse({
          ...req.body,
          appointmentId: appointment.id,
          patientId: req.user!.id,
          doctorId: appointment.doctorId,
        });

        const review = await storage.createReview(data);
        res.status(201).json(review);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create review" });
      }
    },
  );

  app.get(
    "/api/prescriptions",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prescriptions = await storage.getPatientPrescriptions(
          req.user!.id,
        );
        res.json(prescriptions);
      } catch (error) {
        res.status(500).json({ error: "Failed to get prescriptions" });
      }
    },
  );

  app.get(
    "/api/prescriptions/:id",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const prescription = await storage.getPrescription(req.params.id);
        if (!prescription) {
          return res.status(404).json({ error: "Prescription not found" });
        }

        if (
          req.user!.role === UserRole.PATIENT &&
          prescription.patientId !== req.user!.id
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }

        res.json(prescription);
      } catch (error) {
        res.status(500).json({ error: "Failed to get prescription" });
      }
    },
  );

  // Outstanding cancellation charges the patient owes to AyurPath.
  // Drives the "Owed to AyurPath" banner on the My Appointments page.
  app.get(
    "/api/patient/owed-charges",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const owed = await storage.getPatientUnsettledCharges(req.user!.id);
        res.json(owed);
      } catch (error) {
        console.error("Failed to get patient owed charges:", error);
        res.status(500).json({ error: "Failed to get owed charges" });
      }
    },
  );

  app.get(
    "/api/patient/dashboard",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const patientId = req.user!.id;

        // 1. Get all appointments for the patient
        const allAppointments = await storage.getPatientAppointments(patientId);

        // 2. Get all payments for the patient
        const [allPayments, platformSettings] = await Promise.all([
          storage.getPatientPayments(patientId),
          storage.getPlatformSettings(),
        ]);

        const today = new Date().toISOString().split("T")[0];

        // --- Calculate Stats ---
        const upcomingList = allAppointments.filter(a => {
          const pmt = allPayments.find(p => p.appointmentId === a.id);
          const isUnpaidOnline = a.status === AppointmentStatus.PENDING && pmt?.method === "online";
          return a.appointmentDate >= today && 
                 [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(a.status as any) &&
                 !isUnpaidOnline;
        });
        const pendingCount = upcomingList.filter(a => a.status === AppointmentStatus.PENDING).length;

        const completedList = allAppointments.filter(a => a.status === AppointmentStatus.COMPLETED);
        const inPersonCompleted = completedList.filter(a => a.consultationType === "in_person").length;
        const onlineCompleted = completedList.filter(a => a.consultationType === "online").length;

        const totalPaidAmount = allPayments.filter(p => p.status === PaymentStatus.COMPLETED).reduce((sum, p) => sum + p.totalAmount, 0);
        const refundPendingCount = allPayments.filter(p => p.status === PaymentStatus.PENDING || p.status === PaymentStatus.FAILED).length; // Adjust based on your logic

        const stats = {
          upcomingAppointments: upcomingList.length,
          pendingCount,
          completedAppointments: completedList.length,
          inPersonCompleted,
          onlineCompleted,
          totalPaidAmount,
          refundPendingCount
        };

        const myDoctorIds = [...new Set(allAppointments.map(a => a.doctorId))].slice(0, 4);
        
        const recentPayments = allPayments.slice(0, 4);
        const recentPaymentDoctorIds = recentPayments
          .map(p => allAppointments.find(a => a.id === p.appointmentId)?.doctorId)
          .filter(Boolean) as string[];

        // 
        const allNeededDoctorIds = [...new Set([...myDoctorIds, ...recentPaymentDoctorIds])];

        const doctorsResults = await Promise.all(
          allNeededDoctorIds.map((id) => storage.getDoctorWithDetails(id)),
        );
        const doctorsList = doctorsResults.filter(
          (d): d is NonNullable<typeof d> => d != null,
        );

        const doctorMap = new Map(doctorsList.map(doc => [doc.id, doc]));

        // --- My Doctors ---
        const myDoctors = myDoctorIds.map(id => doctorMap.get(id)).filter(Boolean);

        // --- Recent Transactions ---
        const recentTransactions = recentPayments.map(p => {
          const appointment = allAppointments.find(a => a.id === p.appointmentId);
          const doctor = appointment ? doctorMap.get(appointment.doctorId) : null;

          // Build fallback breakdown for old payments that have no stored breakdown
          let taxBreakdown = (p as any).taxBreakdown;
          if (!taxBreakdown || (Array.isArray(taxBreakdown) && taxBreakdown.length === 0)) {
            taxBreakdown = [];
            const fee = p.consultationFee || 0;
            const baseTax = Math.round(fee * (platformSettings.taxRate / 100));
            if (baseTax > 0) taxBreakdown.push({ title: `Government Tax`, rate: platformSettings.taxRate, amount: baseTax, applicableTo: "patients" });
            if (platformSettings.stampDutyEnabled) {
              const stampAmt = Math.round(fee * 0.01);
              if (stampAmt > 0) taxBreakdown.push({ title: "Stamp Duty", rate: 1, amount: stampAmt, applicableTo: "patients" });
            }
          }

          return {
            ...p,
            taxBreakdown,
            doctorName: doctor?.user?.fullName || "Doctor",
            date: p.createdAt
          };
        });

        res.json({
          stats,
          upcomingAppointments: upcomingList.slice(0, 5),
          myDoctors,
          recentTransactions
        });
      } catch (error) {
        console.error("Dashboard Error:", error);
        res.status(500).json({ error: "Failed to get dashboard data" });
      }
    },
  );

  app.get(
    "/api/patient/reviews",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const reviews = await storage.getPatientReviews(req.user!.id);
        res.json(reviews);
      } catch (error) {
        res.status(500).json({ error: "Failed to get reviews" });
      }
    },
  );

  app.get(
    "/api/notifications",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const notifications = await storage.getUserNotifications(req.user!.id);
        res.json(notifications);
      } catch (error) {
        res.status(500).json({ error: "Failed to get notifications" });
      }
    },
  );

  app.get(
    "/api/notifications/unread",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const notifications = await storage.getUnreadNotifications(
          req.user!.id,
        );
        res.json(notifications);
      } catch (error) {
        res.status(500).json({ error: "Failed to get notifications" });
      }
    },
  );

  app.patch(
    "/api/notifications/:id/read",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const notification = await storage.markNotificationRead(req.params.id);
        res.json(notification);
      } catch (error) {
        res.status(500).json({ error: "Failed to mark notification as read" });
      }
    },
  );

  app.patch(
    "/api/notifications/read-all",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        await storage.markAllNotificationsRead(req.user!.id);
        res.json({ success: true });
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to mark all notifications as read" });
      }
    },
  );

  app.get(
    "/api/admin/dashboard",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (_req: Request, res: Response) => {
      try {
        const stats = await storage.getAdminDashboardStats();
        const pendingDoctors = await storage.getPendingDoctors();

        res.json({
          stats,
          pendingDoctors: pendingDoctors.slice(0, 5),
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to get dashboard stats" });
      }
    },
  );

  app.get(
    "/api/admin/doctors/pending",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (_req: Request, res: Response) => {
      try {
        const doctors = await storage.getPendingDoctors();
        res.json(doctors);
      } catch (error) {
        res.status(500).json({ error: "Failed to get pending doctors" });
      }
    },
  );

  app.get(
    "/api/admin/doctors/paginated",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string | undefined;
        const status = req.query.status as string | undefined;

        const result = await storage.getPaginatedDoctors(page, limit, search, status);
        res.json(result);
      } catch (error: any) {
        console.error("🔴 Backend Error in Paginated Doctors:", error);
        res.status(500).json({ error: "Failed to fetch doctors" });
      }
    }
  );

  app.patch(
    "/api/admin/doctors/:id/verify",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        await storage.updateDoctorProfile(req.params.id, {
          rejectionReason: null,
        });
        const doctor = await storage.updateDoctorStatus(
          req.params.id,
          DoctorStatus.VERIFIED,
        );

        if (doctor) {
          // 1. Send internal system notification
          await storage.createNotification({
            userId: doctor.userId,
            title: "Account Verified",
            message: "Congratulations! Your doctor account has been verified. You can now accept appointments.",
            type: "verification",
          });

          // 2. NEW: Send Email Notification to the Doctor
          const doctorUser = await storage.getUser(doctor.userId);
          if (doctorUser) {
            // Fire and forget email (Doesn't block the API response to the admin)
            sendDoctorVerifiedEmail(doctorUser.email, doctorUser.fullName)
              .catch(err => console.error("Email send error:", err));
          }
        }

        res.json(doctor);
      } catch (error) {
        res.status(500).json({ error: "Failed to verify doctor" });
      }
    },
  );

  app.patch(
    "/api/admin/doctors/:id/reject",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { reason } = req.body;
        const doctor = await storage.updateDoctorStatus(
          req.params.id,
          DoctorStatus.REJECTED,
          reason,
        );

        if (doctor) {
          await storage.createNotification({
            userId: doctor.userId,
            title: "Account Rejected",
            message:
              reason || "Your doctor account verification was not approved.",
            type: "verification",
          });
        }

        res.json(doctor);
      } catch (error) {
        res.status(500).json({ error: "Failed to reject doctor" });
      }
    },
  );

  app.patch(
    "/api/admin/doctors/:id/suspend",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        await storage.updateDoctorProfile(req.params.id, {
          rejectionReason: null,
        });
        const doctor = await storage.updateDoctorStatus(
          req.params.id,
          DoctorStatus.SUSPENDED,
        );

        if (doctor) {
          await storage.createNotification({
            userId: doctor.userId,
            title: "Account Suspended",
            message:
              "Your doctor account has been suspended. Please contact support for more information.",
            type: "verification",
          });
        }

        res.json(doctor);
      } catch (error) {
        res.status(500).json({ error: "Failed to suspend doctor" });
      }
    },
  );

  app.get(
    "/api/admin/users",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { role } = req.query;
        const users = await storage.getAllUsers(role as string | undefined);
        const usersWithoutPasswords = users.map(
          ({ password: _, ...user }) => user,
        );
        res.json(usersWithoutPasswords);
      } catch (error) {
        res.status(500).json({ error: "Failed to get users" });
      }
    },
  );

  app.patch(
    "/api/admin/users/:id/suspend",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const user = await storage.updateUserStatus(req.params.id, false);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Failed to suspend user:", error);
        res.status(500).json({ error: "Failed to suspend user" });
      }
    },
  );

  app.patch(
    "/api/admin/users/:id/reactivate",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const user = await storage.updateUserStatus(req.params.id, true);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        console.error("Failed to reactivate user:", error);
        res.status(500).json({ error: "Failed to reactivate user" });
      }
    },
  );

  app.patch(
    "/api/admin/reviews/:id/hide",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const review = await storage.hideReview(req.params.id);
        res.json(review);
      } catch (error) {
        res.status(500).json({ error: "Failed to hide review" });
      }
    },
  );

  app.get(
    "/api/admin/appointments",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { status, date, doctorId, patientId } = req.query;
        const allAppointments = await storage.getAllAppointments();

        let filtered = allAppointments;
        if (status) {
          filtered = filtered.filter((a) => a.status === status);
        }
        if (date) {
          filtered = filtered.filter((a) => a.appointmentDate === date);
        }
        if (doctorId) {
          filtered = filtered.filter((a) => a.doctorId === doctorId);
        }
        if (patientId) {
          filtered = filtered.filter((a) => a.patientId === patientId);
        }

        res.json(filtered);
      } catch (error) {
        res.status(500).json({ error: "Failed to get appointments" });
      }
    },
  );

  app.get(
    "/api/admin/payments",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        
        const result = await storage.getPaginatedPayments(page, limit);
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to get payments" });
      }
    },
  );

  // Validate Refund Amount against Original Payment
  app.patch(
    "/api/admin/payments/:id/refund",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);
      try {
        const { refundAmount, refundReason } = req.body;
        
        const payment = await storage.getPayment(req.params.id);
        if (!payment) {
          const tFailed = new Date().toISOString();
          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'PAYMENT_REFUND_ATTEMPT', status: 'error',
              entityType: 'payment', entityId: req.params.id,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'PAYMENT',
                reason: 'Payment not found',
                timeline: { requestReceivedAt: tRequestReceived, failedAt: tFailed }
              }
            });
          } catch (e) {}
          return res.status(404).json({ error: "Payment not found" });
        }

        if (refundAmount !== undefined && refundAmount > payment.totalAmount) {
          const tFailed = new Date().toISOString();
          try {
            await storage.createAuditLog({
              actorId, actorRole,
              action: 'PAYMENT_REFUND_ATTEMPT', status: 'error',
              entityType: 'payment', entityId: req.params.id,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'PAYMENT',
                reason: 'Refund amount exceeds original payment',
                originalAmount: payment.totalAmount,
                attemptedRefundAmount: refundAmount,
                timeline: { requestReceivedAt: tRequestReceived, failedAt: tFailed }
              }
            });
          } catch (e) {}
          return res.status(400).json({ error: "Refund amount cannot exceed the original payment amount" });
        }

        const updatedPayment = await storage.updatePayment(req.params.id, {
          status: PaymentStatus.REFUNDED,
          refundAmount,
          refundReason,
          refundDate: new Date().toISOString().split("T")[0],
        });

        const tCompleted = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'PAYMENT_REFUNDED', status: 'success',
            entityType: 'payment', entityId: payment.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              originalAmount: payment.totalAmount,
              refundedAmount: refundAmount,
              reason: refundReason || 'No reason provided',
              patientId: payment.patientId,
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tCompleted }
            }
          });
        } catch (e) {}
        res.json(updatedPayment);
      } catch (error) {
        const tFailed = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'PAYMENT_REFUND_ATTEMPT', status: 'error',
            entityType: 'payment', entityId: req.params.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              reason: error instanceof Error ? error.message : 'Unknown error',
              timeline: { requestReceivedAt: tRequestReceived, failedAt: tFailed }
            }
          });
        } catch (e) {}
        res.status(500).json({ error: "Failed to refund payment" });
      }
    },
  );

  app.get("/api/booking-settings", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getPlatformSettings();
      const payload = {
        bookingCharges: Number(settings.bookingCharges ?? 0),
        taxRate: Number(settings.taxRate ?? 0),
        stampDutyEnabled: settings.stampDutyEnabled ?? false,
        autoPayoutDay: Number(settings.autoPayoutDay ?? 1),
        earlyPayoutFee21Days: Number(settings.earlyPayoutFee21Days ?? 5.0),
      };

      console.log("Returning booking settings:", payload);
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.json(payload);
    } catch (error) {
      console.error("Failed to get booking settings:", error);
      res.status(500).json({ error: "Failed to get booking settings" });
    }
  });

  // Platform Settings endpoints
  app.get(
    "/api/admin/settings",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (_req: Request, res: Response) => {
      try {
        const settings = await storage.getPlatformSettings();
        res.json(settings);
      } catch (error) {
        console.error("Failed to get platform settings:", error);
        res.status(500).json({ error: "Failed to get platform settings" });
      }
    },
  );

  // ✅ Check overdue doctors (keep as-is)
  app.post(
    "/api/admin/check-overdue",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const pendingDoctors = await storage.getPendingDoctors();
        const now = Date.now();
        const threshold = 48 * 60 * 60 * 1000;
        const admins = await storage.getAllUsers("admin");
        // Fetch the admin's notifications once — the dedup check below is keyed
        // per doctor (relatedId), so a single snapshot is correct and avoids an
        // N+1 (one getUserNotifications call per pending doctor).
        const existingNotifs = await storage.getUserNotifications(req.user!.id);
        const last24h = now - 24 * 60 * 60 * 1000;

        for (const doctor of pendingDoctors) {
          const createdAt = new Date(doctor.createdAt).getTime();
          if (now - createdAt < threshold) continue;

          const daysOverdue = Math.floor(
            (now - createdAt) / (24 * 60 * 60 * 1000),
          );
          const expectedTitle = `Verification pending — ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} overdue`;

          const alreadyUpToDate = existingNotifs.some(
            (n) =>
              n.relatedId === doctor.id &&
              n.title === expectedTitle &&
              new Date(n.createdAt).getTime() > last24h,
          );
          if (alreadyUpToDate) continue;

          const d = new Date(doctor.createdAt);
          const submittedDate = `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`;

          await Promise.all(
            admins.map((a) =>
              storage.deleteNotificationsByRelatedId(a.id, doctor.id),
            ),
          );

          await Promise.all(
            admins.map((a) =>
              storage.createNotification({
                userId: a.id,
                title: expectedTitle,
                message: `Documents submitted on ${submittedDate} have not been reviewed.`,
                type: "system",
                isRead: false,
                relatedId: doctor.id,
              }),
            ),
          );
        }

        res.json({ checked: pendingDoctors.length });
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to check overdue verifications" });
      }
    },
  );

  // Merged settings endpoint
  app.put(
    "/api/admin/settings",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        console.log("Updating platform settings with:", req.body);

        const prevSettings = await storage.getPlatformSettings();
        const settings = await storage.updatePlatformSettings(req.body);

        // 🔔 Maintenance mode notification
        if (
          req.body.maintenanceMode !== undefined &&
          req.body.maintenanceMode !== prevSettings.maintenanceMode
        ) {
          const admins = await storage.getAllUsers("admin");

          const title = req.body.maintenanceMode
            ? "Maintenance mode enabled"
            : "Maintenance completed";

          const message = req.body.maintenanceMode
            ? "Platform temporarily unavailable."
            : "Platform is now fully operational.";

          await Promise.all(
            admins.map((a) =>
              storage.createNotification({
                userId: a.id,
                title,
                message,
                type: "system",
                isRead: false,
              }),
            ),
          );
        }

        // Sync in-memory maintenance cache
        updateMaintenanceCache(
          settings.maintenanceMode,
          settings.maintenanceEndTime ?? null,
        );

        console.log("Settings updated successfully:", settings);

        await storage.createAuditLog({
          actorId, actorRole, action: `UPDATE_PLATFORM_SETTINGS`, status: 'success',
          entityType: 'platform_settings', entityId: 'default', ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'SYSTEM', updatedFields: Object.keys(req.body), timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
        });

        res.json(settings);
      } catch (error) {
        await storage.createAuditLog({
          actorId, actorRole, action: `UPDATE_PLATFORM_SETTINGS`, status: 'failed',
          entityType: 'platform_settings', entityId: 'default', ipAddress, device, location, sessionId: sessionId || 'N/A',
          metadata: { auditType: 'SYSTEM', reason: 'Server error (500)', timeline: { requestReceivedAt: tRequestReceived, failedAt: new Date().toISOString() } }
        }).catch(()=>{});
        console.error("Failed to update platform settings:", error);
        res.status(500).json({ error: "Failed to update platform settings" });
      }
    },
  );

  // Tax entries (admin only)
  app.get("/api/admin/tax-entries", authMiddleware, roleMiddleware(UserRole.ADMIN), async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getTaxEntries();
      res.json(entries);
    } catch { res.status(500).json({ error: "Failed to get tax entries" }); }
  });

  // Public endpoint so book-appointment page can fetch without admin auth
  app.get("/api/tax-entries", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getTaxEntries();
      res.json(entries);
    } catch { res.status(500).json({ error: "Failed to get tax entries" }); }
  });

  app.post("/api/admin/tax-entries", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: Request, res: Response) => {
    const tRequestReceived = new Date().toISOString();
    const { ipAddress, device, location, sessionId } = getReqInfo(req);
    const { actorId, actorRole } = await getActorInfo(req);

    try {
      const { title, rate, applicableTo } = req.body;
      if (!title?.trim() || rate === undefined) return res.status(400).json({ error: "Title and rate are required" });
      if (!["doctors", "patients", "both"].includes(applicableTo)) return res.status(400).json({ error: "applicableTo must be doctors, patients, or both" });
      const entry = await storage.createTaxEntry(title.trim(), Number(rate), applicableTo);
      await storage.createAuditLog({
        actorId, actorRole, action: `CREATE_TAX_ENTRY`, status: 'success',
        entityType: 'tax_entry', entityId: entry.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
        metadata: { auditType: 'TAX', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
      });
      res.status(201).json(entry);
    } catch { res.status(500).json({ error: "Failed to create tax entry" }); }
  });

  app.delete("/api/admin/tax-entries/:id", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: Request, res: Response) => {
    const tRequestReceived = new Date().toISOString();
    const { ipAddress, device, location, sessionId } = getReqInfo(req);
    const { actorId, actorRole } = await getActorInfo(req);

    try {
      await storage.deleteTaxEntry(req.params.id);
      await storage.createAuditLog({
        actorId, actorRole, action: `DELETE_TAX_ENTRY`, status: 'success',
        entityType: 'tax_entry', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
        metadata: { auditType: 'TAX', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
      });
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to delete tax entry" }); }
  });

  // Fee entries (admin only) — mirror of tax entries. Storage, booking-price
  // calc, and both frontends already support fees; only these routes were missing.
  app.get("/api/admin/fee-entries", authMiddleware, roleMiddleware(UserRole.ADMIN), async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getFeeEntries();
      res.json(entries);
    } catch { res.status(500).json({ error: "Failed to get fee entries" }); }
  });

  // Public endpoint so the book-appointment page can fetch fees without admin auth
  app.get("/api/fee-entries", publicApiLimiter, async (_req: Request, res: Response) => {
    try {
      const entries = await storage.getFeeEntries();
      res.json(entries);
    } catch { res.status(500).json({ error: "Failed to get fee entries" }); }
  });

  // Caps for the add-fee form (max flat amount = median consultation fee; max percentage = 100%)
  app.get("/api/admin/fee-limits", authMiddleware, roleMiddleware(UserRole.ADMIN), async (_req: Request, res: Response) => {
    try {
      const maxAmount = await storage.getFeeAmountCap();
      res.json({ maxAmount, maxPercentage: 100 });
    } catch { res.status(500).json({ error: "Failed to get fee limits" }); }
  });

  app.post("/api/admin/fee-entries", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: Request, res: Response) => {
    const tRequestReceived = new Date().toISOString();
    const { ipAddress, device, location, sessionId } = getReqInfo(req);
    const { actorId, actorRole } = await getActorInfo(req);

    try {
      const { title, feeType, rate, applicableTo } = req.body;
      if (!title?.trim() || rate === undefined) return res.status(400).json({ error: "Title and rate are required" });
      if (!["amount", "percentage"].includes(feeType)) return res.status(400).json({ error: "feeType must be amount or percentage" });
      if (!["doctors", "patients", "both"].includes(applicableTo)) return res.status(400).json({ error: "applicableTo must be doctors, patients, or both" });
      const entry = await storage.createFeeEntry(title.trim(), feeType, Number(rate), applicableTo);
      await storage.createAuditLog({
        actorId, actorRole, action: `CREATE_FEE_ENTRY`, status: 'success',
        entityType: 'fee_entry', entityId: entry.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
        metadata: { auditType: 'FEE', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
      });
      res.status(201).json(entry);
    } catch { res.status(500).json({ error: "Failed to create fee entry" }); }
  });

  app.patch("/api/admin/fee-entries/:id", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled must be a boolean" });
      const entry = await storage.updateFeeEntryEnabled(req.params.id, enabled);
      if (!entry) return res.status(404).json({ error: "Fee entry not found" });
      res.json(entry);
    } catch { res.status(500).json({ error: "Failed to update fee entry" }); }
  });

  app.delete("/api/admin/fee-entries/:id", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: Request, res: Response) => {
    const tRequestReceived = new Date().toISOString();
    const { ipAddress, device, location, sessionId } = getReqInfo(req);
    const { actorId, actorRole } = await getActorInfo(req);

    try {
      await storage.deleteFeeEntry(req.params.id);
      await storage.createAuditLog({
        actorId, actorRole, action: `DELETE_FEE_ENTRY`, status: 'success',
        entityType: 'fee_entry', entityId: req.params.id, ipAddress, device, location, sessionId: sessionId || 'N/A',
        metadata: { auditType: 'FEE', timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
      });
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to delete fee entry" }); }
  });

  app.put(
    "/api/admin/specializations/:id",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const data = insertSpecializationSchema.parse(req.body);
        const specialization = await storage.updateSpecialization(
          req.params.id,
          data,
        );
        res.json(specialization);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update specialization" });
      }
    },
  );

  app.delete(
    "/api/admin/specializations/:id",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        await storage.deleteSpecialization(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete specialization" });
      }
    },
  );

  // Profile image upload endpoint (Updated to strictly catch Cloudinary URL)
  app.post(
    "/api/users/profile-image",
    authMiddleware,
    upload.single("image"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No image uploaded" });
        }

        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.",
          });
        }

        const fileObj = req.file as any;
        const imageUrl = fileObj.secure_url || fileObj.url || req.file.path;

        console.log("CLOUDINARY UPLOAD SUCCESS! URL:", imageUrl);

        if (!imageUrl) {
          console.error("❌ ERROR: Could not extract URL from Cloudinary response.", fileObj);
          return res.status(500).json({ error: "Failed to extract image URL." });
        }

        const user = await storage.updateUser(req.user!.id, {
          profileImage: imageUrl,
        });

        if (!user) {
          return res.status(404).json({ error: "User not found in DB" });
        }

        console.log("DB UPDATED SUCCESSFULLY FOR USER:", user.email);

        const { password: _, ...userWithoutPassword } = user;
        
        res.json({
          url: imageUrl,
          user: userWithoutPassword,
        });
      } catch (error) {
        console.error("❌ PROFILE IMAGE UPLOAD ERROR:", error);
        res.status(500).json({ error: "Failed to upload profile image" });
      }
    },
  );

  app.put(
    "/api/users/profile",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const allowedUpdates = [
          "fullName",
          "phone",
          "gender",
          "dateOfBirth",
          "address",
          "city",
          "preferredLanguages",
          "profileImage",
        ];
        const updates: any = {};

        for (const key of allowedUpdates) {
          if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
          }
        }

        if (updates.phone && !/^07[0-9]{8}$/.test(updates.phone)) {
            return res.status(400).json({
                error: "Please enter a valid Sri Lankan mobile number (07XXXXXXXX)"
            });
        }

        const user = await storage.updateUser(req.user!.id, updates);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } catch (error) {
        res.status(500).json({ error: "Failed to update profile" });
      }
    },
  );

  // Password update endpoint with current password verification and admin notification
  app.put(
    "/api/users/password",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { currentPassword, newPassword } = req.body;
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.valid) {
          return res.status(400).json({
            error: "Password does not meet security requirements",
            details: passwordValidation.errors,
          });
        }
        const user = await storage.getUser(req.user!.id);
        if (!user || !(await verifyPassword(currentPassword, user.password))) {
          return res
            .status(400)
            .json({ error: "Current password is incorrect" });
        }
        const hashedPassword = await hashPassword(newPassword);
        await storage.updateUser(req.user!.id, { password: hashedPassword });

        // If an admin resets their password, notify all admins
        if (req.user!.role === UserRole.ADMIN) {
          const admins = await storage.getAllUsers("admin");
          await Promise.all(
            admins.map((a) =>
              storage.createNotification({
                userId: a.id,
                title: "Admin account password reset",
                message:
                  "Password was reset from an unrecognised device. If this was not you, contact the security team immediately.",
                type: "system",
                isRead: false,
              }),
            ),
          );
        }

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to update password" });
      }
    },
  );

  // Job Application Submission Endpoint
  app.post(
    "/api/careers/apply",
    uploadLimiter,
    upload.single("cv"),
    async (req: RequestWithFile, res: Response) => {

      const tRequestReceived = new Date().toISOString();
      
      try {
        if (!req.file) {
          const tFailed = new Date().toISOString();
          try {
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            const auditLogData = {
              actorId, actorRole, 
              action: 'JOB_APPLICATION', status: 'failure',
              entityType: 'job_applications', entityId: req.body?.jobId || 'N/A',
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: { 
                auditType: 'CAREER', 
                reason: 'CV file missing', 
                timeline: { 
                  requestReceivedAt: tRequestReceived,
                  fileMissingAt: tFailed,
                  completedAt: tFailed
                } 
              }
            };
            await storage.createAuditLog(auditLogData);
          } catch (e) { }
          return res.status(400).json({ error: "CV file is required" });
        }

        const cvFileSuccessAt = new Date().toISOString();
        const cvUrl = req.file.path;
        const { jobId, jobTitle, fullName, email } = req.body;
        if (!jobId || !jobTitle || !fullName || !email) {
          try {
            const tFailed = new Date().toISOString();
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            const auditLogData = {
              actorId, actorRole,
              action: 'JOB_APPLICATION', status: 'failure',
              entityType: 'career', entityId: req.body?.jobId || 'N/A',
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'CAREER',
                reason: 'Missing required fields',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  fileMissingAt: cvFileSuccessAt,
                  fieldsMissingAt: tFailed,
                  completedAt: tFailed
                }
              }
            };
            await storage.createAuditLog(auditLogData);
          } catch (e) { }
          return res.status(400).json({ error: "Missing required fields" });
        }

        const fieldValidationAt = new Date().toISOString();
        const applicationData = {
          jobId,
          jobTitle,
          fullName,
          email,
          cvUrl,
        };
        const savedApplication = await storage.createJobApplication(applicationData);
        
        const tCompleted = new Date().toISOString();

        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const auditLogData = {
            actorId, 
            actorRole, 
            action: 'JOB_APPLICATION', 
            status: 'success',
            entityType: 'career', 
            entityId: savedApplication.id, 
            ipAddress, 
            device, 
            location, 
            sessionId: sessionId || 'N/A',
            metadata: { 
              auditType: 'CAREER', 
              applicantEmail: email, 
              jobTitle: jobTitle,
              timeline: { 
                requestReceivedAt: tRequestReceived, 
                fileMissingAt: cvFileSuccessAt,
                fieldsMissingAt: fieldValidationAt,
                completedAt: tCompleted 
              } 
            }
          };
            await storage.createAuditLog(auditLogData);
        } catch (e) {
          console.error("Audit log failed:", e);
        }

        res.status(201).json(savedApplication);
      } catch (error) {
        try {
          const { ipAddress, device, location } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const tFailed = new Date().toISOString();
          await storage.createAuditLog({
            actorId, actorRole, 
            action: 'JOB_APPLICATION', status: 'failed',
            entityType: 'system', entityId: 'N/A', 
            ipAddress, device, location, sessionId: 'N/A',
            metadata: { 
              auditType: 'CAREER', 
              reason: 'Internal Server Error (500)',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed,
              }
            }
          });
        } catch (e) {}
        res
          .status(500)
          .json({ error: "Failed to submit application. Please try again." });
      }
    },
  );

  // Admin: Get all applications
  app.get(
    "/api/admin/applications",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        // Create this in storage: getAllJobApplications()
        const applications = await storage.getAllJobApplications();
        res.json(applications);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch applications" });
      }
    },
  );

  // ==========================================
  // PUBLIC CAREERS ROUTE
  // ==========================================
  app.get("/api/careers", publicApiLimiter, async (req: Request, res: Response) => {
    try {
      const allCareers = await storage.getAllCareers();
      res.json(allCareers);
    } catch (error) {
      console.error("Fetch public careers error:", error);
      res.status(500).json({ error: "Failed to fetch careers" });
    }
  });

  // ==========================================
  // ADMIN CAREERS ROUTES
  // ==========================================

  // 1. Get all careers
  app.get(
    "/api/admin/careers",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const allCareers = await storage.getAllCareers();
        const activeCareers = allCareers.filter(
          (career) => career.isActive === true,
        );
        res.json(activeCareers);
      } catch (error) {
        console.error("Fetch careers error:", error);
        res.status(500).json({ error: "Failed to fetch careers" });
      }
    },
  );

  // 2. Create a new career
  app.post(
    "/api/admin/careers",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {

      const tRequestReceived = new Date().toISOString();
      try {
        const data = insertCareerSchema.parse(req.body);
        const newCareer = await storage.createCareer(data);

        const tCompleted = new Date().toISOString();
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const auditLogData = {
            actorId, actorRole,
            action: 'CREATE_CAREER', status: 'success',
            entityType: 'career', entityId: newCareer.id,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: 'Created new career.',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tCompleted
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) { }
        res.status(201).json(newCareer);
      } catch (error) {
        if (error instanceof z.ZodError) {
          try {
            const { ipAddress, device, location } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            const tFailed = new Date().toISOString();
            const auditLogData = {
              actorId, actorRole,
              action: 'CREATE_CAREER', status: 'failure',
              entityType: 'career', entityId: 'N/A',
              ipAddress, device, location, sessionId: 'N/A',
              metadata: {
                auditType: 'CAREER',
                reason: 'Validation failed when creating career.',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  validationFailedAt: tFailed,
                  completedAt: tFailed,
                }
              }
            };
            await storage.createAuditLog(auditLogData);
          } catch (e) {}
          return res.status(400).json({ error: error.errors });
        }

        try {
          const { ipAddress, device, location } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const tFailed = new Date().toISOString();
          const auditLogData = {
            actorId, actorRole,
            action: 'CREATE_CAREER', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: 'Internal Server Error (500) when creating career.',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed,
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) {}
        res.status(500).json({ error: "Failed to create new career" });
      }
    },
  );

  // 3. Update an existing career
  app.put(
    "/api/admin/careers/:id",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        const careerId = req.params.id;
        const data = insertCareerSchema.partial().parse(req.body);
        const updatedCareer = await storage.updateCareer(careerId, data);

        if (!updatedCareer) {
          const tFailed = new Date().toISOString();
          try {
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            const auditLogData = {
              actorId, actorRole,
              action: 'CAREER_UPDATE', status: 'failure',
              entityType: 'career', entityId: careerId,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'CAREER',
                reason: 'Career not found for update.',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  careerNotFoundAt: tFailed,
                  completedAt: tFailed,
                }
              }
            };
            await storage.createAuditLog(auditLogData);
          } catch (e) {}
          return res.status(404).json({ error: "Career not found" });
        }

        const tValidationSuccess = new Date().toISOString();
        const tCompleted = new Date().toISOString();
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const auditLogData = {
            actorId, actorRole,
            action: 'CAREER_UPDATE', status: 'success',
            entityType: 'career', entityId: careerId,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: 'Career updated successfully.',
              timeline: {
                requestReceivedAt: tRequestReceived,
                validationSuccessAt: tValidationSuccess,
                completedAt: tCompleted,
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) {}
        res.json(updatedCareer);
      } catch (error) {
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const tFailed = new Date().toISOString();
          const auditLogData = {
            actorId, actorRole,
            action: 'CAREER_UPDATE', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: 'Internal Server Error (500) when updating career.',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed,
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) {}
        res.status(500).json({ error: "Failed to update career" });
      }
    },
  );

  // 4. Soft Delete (Deactivate) a career
  app.patch(
    "/api/admin/careers/:id/deactivate",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        const careerId = req.params.id;

        const updatedCareer = await storage.updateCareer(careerId, {
          isActive: false,
        });

        if (!updatedCareer) {
          const tFailed = new Date().toISOString();
          try {
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            const auditLogData = {
              actorId, actorRole,
              action: 'CAREER_DEACTIVATE', status: 'failure',
              entityType: 'career', entityId: careerId,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'CAREER',
                reason: 'Career not found for deactivation.',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  careerNotFoundAt: tFailed,
                  completedAt: tFailed,
                }
              }
            };
            await storage.createAuditLog(auditLogData);
          } catch (e) {}
          return res.status(404).json({ error: "Career not found" });
        }

        const tDeactivationSuccess = new Date().toISOString();
        const tCompleted = new Date().toISOString();

        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const auditLogData = {
            actorId, actorRole,
            action: 'CAREER_DEACTIVATE', status: 'success',
            entityType: 'career', entityId: careerId,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: 'Career deactivated successfully.',
              timeline: {
                requestReceivedAt: tRequestReceived,
                deactivationSuccessAt: tDeactivationSuccess,
                completedAt: tCompleted,
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) {}

        res.json({ message: "Career deactivated successfully" });
      } catch (error) {
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const tFailed = new Date().toISOString();
          const auditLogData = {
            actorId, actorRole,
            action: 'CAREER_DEACTIVATE', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: 'Internal Server Error (500) when deactivating career.',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed,
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) {}
        res.status(500).json({ error: "Failed to deactivate career" });
      }
    },
  );

  // 5. Update application status (Accept / Reject) with email notification
  app.patch(
    "/api/admin/applications/:id/status",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      try {
        const { status, message } = req.body;
        const applicationId = req.params.id;

        if (!status || !["ACCEPTED", "REJECTED"].includes(status)) {
          try {
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            const tFailed = new Date().toISOString();
            const auditLogData = {
              actorId, actorRole,
              action: 'APPLICATION_STATUS_UPDATE', status: 'failure',
              entityType: 'career_application', entityId: applicationId,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'CAREER',
                reason: 'Invalid status provided for application update.',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  validationFailedAt: tFailed,
                  completedAt: tFailed,
                }
              }
            };
            await storage.createAuditLog(auditLogData);
          } catch (e) {}
          return res.status(400).json({ error: "Invalid status" });
        }

        const updatedApplication = await storage.updateApplicationStatus(
          applicationId,
          status,
        );

        const tValidationSuccessAt = new Date().toISOString();

        if (!updatedApplication) {
          try {
            const { ipAddress, device, location, sessionId } = getReqInfo(req);
            const { actorId, actorRole } = await getActorInfo(req);
            const tFailed = new Date().toISOString();
            const auditLogData = {
              actorId, actorRole,
              action: 'APPLICATION_STATUS_UPDATE', status: 'failure',
              entityType: 'career_application', entityId: applicationId,
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                auditType: 'CAREER',
                reason: 'Application not found for status update.',
                timeline: {
                  requestReceivedAt: tRequestReceived,
                  validationSuccessAt: tValidationSuccessAt,
                  applicationNotFoundAt: tFailed,
                  completedAt: tFailed,
                }
              }
            };
            await storage.createAuditLog(auditLogData);
          } catch (e) {}
          return res.status(404).json({ error: "Application not found" });
        }

        const emailResult = await sendApplicationEmail(
          updatedApplication.email,
          updatedApplication.fullName,
          updatedApplication.jobTitle,
          status as "ACCEPTED" | "REJECTED",
          message || "No additional comments provided.",
        );

        const tEmailSentAt = new Date().toISOString();
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const auditLogData = {
            actorId, actorRole,
            action: 'APPLICATION_STATUS_UPDATE',
            status: emailResult.success ? 'success' : 'failure',
            entityType: 'career_application',
            entityId: applicationId,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: emailResult.success ? 'Application status updated and email sent successfully.' : `Application status updated but failed to send email: ${emailResult.error}`,
              timeline: {
                requestReceivedAt: tRequestReceived,
                validationSuccessAt: tValidationSuccessAt,
                emailSentAt: tEmailSentAt,
                completedAt: tEmailSentAt,
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) {}
        res.json({
          ...updatedApplication,
          emailSuccess: emailResult.success,
          emailError: emailResult.error
        });

      } catch (error) {
        const tFailed = new Date().toISOString();
        try {
          const { ipAddress, device, location, sessionId } = getReqInfo(req);
          const { actorId, actorRole } = await getActorInfo(req);
          const auditLogData = {
            actorId, actorRole,
            action: 'APPLICATION_STATUS_UPDATE', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'CAREER',
              reason: 'Internal Server Error (500) when updating application status.',
              timeline: {
                requestReceivedAt: tRequestReceived,
                completedAt: tFailed,
              }
            }
          };
          await storage.createAuditLog(auditLogData);
        } catch (e) {}
        res.status(500).json({ error: "Failed to update application status" });
      }
    },
  );

  // 1. Send OTP to Email (Step 1)
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    const tRequestReceived = new Date().toISOString();
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      
      // USER GE REQUEST EKA: Email eka db eke naththam error ekak pennanna
      if (!user) {
        return res.status(404).json({ error: "No account found with this email address." });
      }

      if (user.provider && user.provider !== AuthProvider.LOCAL) {
        const providerName = user.provider.charAt(0).toUpperCase() + user.provider.slice(1);
        return res.status(400).json({ 
          error: `Your account is linked with ${providerName}. Please use "Continue with ${providerName}" to log in.` 
        });
      }

      const otp = randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      await storage.setPasswordResetOtp(user.id, otp, expiry);
      
      // Email eka send wenawada kiyala balanawa
      const emailResult = await sendPasswordResetOtpEmail(user.email, otp);

      // Email eka send wune naththam (e.g. Resend Domain Verify nati error eka)
      if (!emailResult.success) {
        return res.status(500).json({ error: "Failed to send OTP email. Please check email service status or try again later." });
      }

      res.json({ message: "OTP sent successfully." });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 2. ONLY Verify OTP (Step 2 - New Endpoint for UI step validation)
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) return res.status(404).json({ error: "User not found" });

      // Read-only check (Meke OTP eka delete karanne na, eka karanne 3 weni step ekedi)
      if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp || !user.resetPasswordOtpExpiry) {
        return res.status(400).json({ error: "Invalid verification code." });
      }

      if (new Date() > new Date(user.resetPasswordOtpExpiry)) {
        return res.status(400).json({ error: "Verification code has expired." });
      }

      res.json({ success: true, message: "OTP verified successfully." });
    } catch (error) {
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // 3. Reset Password (Step 3 - Final step)
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: "Email, OTP, and new password are required" });
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: "Password does not meet security requirements",
          details: passwordValidation.errors,
        });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) return res.status(404).json({ error: "User not found" });

      // DB storage eke thiyena 'verifyPasswordResetOtp' function eken OTP eka check karala delete karala danawa (One time use)
      const isValid = await storage.verifyPasswordResetOtp(user.id, otp);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid or expired OTP." });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // =======================================
  // Reviews Management
  // =======================================

  // Update Patient's Review
  app.patch(
    "/api/reviews/:id",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { rating, comment } = req.body;
        const review = await storage.getReview(req.params.id);
        
        if (!review || review.patientId !== req.user!.id) {
          return res.status(403).json({ error: "Forbidden or Review not found" });
        }

        const updated = await storage.updateReview(req.params.id, { rating, comment });
        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to update review" });
      }
    }
  );

  // Delete Patient's Review
  app.delete(
    "/api/reviews/:id",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const review = await storage.getReview(req.params.id);
        if (!review || review.patientId !== req.user!.id) {
          return res.status(403).json({ error: "Forbidden or Review not found" });
        }

        await storage.deleteReview(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete review" });
      }
    }
  );

  app.get(
    "/api/admin/refund-stats",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const stats = await storage.getRefundStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch refund stats" });
      }
    },
  );

  app.get(
    "/api/admin/refund-requests",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const status = req.query.status as string; // 'pending' or 'history'

        const result = await storage.getPaginatedRefundRequests(page, limit, status);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch refund requests" });
      }
    },
  );

  // PROCESS REFUND
  app.patch(
    "/api/admin/refunds/:id/process",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { status } = req.body; 
        const updatedRefund = await storage.processRefund(req.params.id, status);
        res.json(updatedRefund);
      } catch (error) {
        res.status(500).json({ error: "Failed to process refund" });
      }
    },
  );

  // REPORTS & ANALYTICS
  app.get(
    "/api/admin/reports",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (_req: Request, res: Response) => {
      try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const pctChange = (cur: number, pre: number) =>
          pre === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - pre) / pre) * 1000) / 10;

        // Revenue stats: current 30 days vs previous 30 days
        const [currentRevenue, prevRevenue] = await Promise.all([
          pool.query(
            `SELECT
               COALESCE(SUM(total_amount), 0) AS total_revenue,
               COALESCE(SUM(doctor_earnings), 0) AS payouts,
               COALESCE(SUM(platform_commission), 0) AS net_fees
             FROM payments WHERE status = 'completed' AND created_at >= $1`,
            [thirtyDaysAgo]
          ),
          pool.query(
            `SELECT
               COALESCE(SUM(total_amount), 0) AS total_revenue,
               COALESCE(SUM(doctor_earnings), 0) AS payouts,
               COALESCE(SUM(platform_commission), 0) AS net_fees
             FROM payments WHERE status = 'completed' AND created_at >= $1 AND created_at < $2`,
            [sixtyDaysAgo, thirtyDaysAgo]
          ),
        ]);

        const curr = currentRevenue.rows[0];
        const prev = prevRevenue.rows[0];
        const revenueStats = {
          totalRevenue: parseInt(curr.total_revenue),
          payouts: parseInt(curr.payouts),
          netFees: parseInt(curr.net_fees),
          totalRevenuePct: pctChange(parseInt(curr.total_revenue), parseInt(prev.total_revenue)),
          payoutsPct: pctChange(parseInt(curr.payouts), parseInt(prev.payouts)),
          netFeesPct: pctChange(parseInt(curr.net_fees), parseInt(prev.net_fees)),
        };

        // Weekly appointments: last 4 weeks
        const weeklyAppointments = [];
        const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        for (let w = 3; w >= 0; w--) {
          const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
          const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
          const result = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE status = 'completed') AS completed,
               COUNT(*) FILTER (WHERE status IN ('cancelled', 'no_show')) AS cancelled
             FROM appointments WHERE created_at >= $1 AND created_at < $2`,
            [weekStart, weekEnd]
          );
          // For current week (w=0) weekEnd=now so today IS included; past weeks use exclusive upper bound - 1
          const lastDay = w === 0 ? now : new Date(weekEnd.getTime() - 24 * 60 * 60 * 1000);
          const sDay = weekStart.getDate(), sMon = MON[weekStart.getMonth()];
          const eDay = lastDay.getDate(), eMon = MON[lastDay.getMonth()];
          const dateLabel = sMon === eMon ? `${sDay}-${eDay} ${sMon}` : `${sDay} ${sMon}-${eDay} ${eMon}`;
          weeklyAppointments.push({
            week: `W${4 - w}`,
            dateLabel,
            completed: parseInt(result.rows[0].completed),
            cancelled: parseInt(result.rows[0].cancelled),
          });
        }

        // Bookings by specialization — ALL specializations from DB, with booking count (0 if none)
        const [allSpecsResult, specBookingsResult] = await Promise.all([
          pool.query(`SELECT id, name FROM specializations ORDER BY name`),
          pool.query(
            `SELECT s.id, COUNT(a.id) AS count
             FROM appointments a
             JOIN doctor_profiles dp ON a.doctor_id = dp.id
             JOIN specializations s ON s.id = ANY(dp.specialization_ids)
             WHERE a.created_at >= $1
             GROUP BY s.id`,
            [thirtyDaysAgo]
          ),
        ]);
        const bookingCountById: Record<string, number> = {};
        for (const r of specBookingsResult.rows) {
          bookingCountById[r.id] = parseInt(r.count);
        }
        const specializationBookings = allSpecsResult.rows
          .map((r: any) => ({ name: r.name, value: bookingCountById[r.id] || 0 }))
          .sort((a, b) => b.value - a.value);

        // New patient registrations by week (last 4 weeks)
        const patientRegistrations = [];
        for (let w = 3; w >= 0; w--) {
          const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
          const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
          const result = await pool.query(
            `SELECT COUNT(*) AS count FROM users
             WHERE role = 'patient' AND created_at >= $1 AND created_at < $2`,
            [weekStart, weekEnd]
          );
          patientRegistrations.push({
            week: `W${4 - w}`,
            patients: parseInt(result.rows[0].count),
          });
        }

        const w1 = patientRegistrations[0].patients;
        const w4 = patientRegistrations[3].patients;
        const registrationGrowth = w1 === 0 ? (w4 > 0 ? 100 : 0) : Math.round(((w4 - w1) / w1) * 1000) / 10;

        // Doctor performance table (verified doctors only, by completed appointments, counted live from appointments table)
        // NOTE: returns all verified doctors; frontend handles search/scroll client-side.
        // Fine for current scale — switch to server-side pagination (LIMIT/OFFSET + search param) if doctor count grows into the thousands.
        const doctorPerf = await pool.query(
          `SELECT
             u.full_name,
             dp.id,
             dp.status,
             dp.average_rating,
             dp.total_reviews,
             COUNT(a.id) AS total_appointments,
             (SELECT array_agg(s.name) FROM specializations s WHERE s.id = ANY(dp.specialization_ids)) AS specialization_names
           FROM doctor_profiles dp
           JOIN users u ON dp.user_id = u.id
           LEFT JOIN appointments a ON a.doctor_id = dp.id AND a.status = 'completed'
           WHERE dp.status = 'verified'
           GROUP BY dp.id, u.full_name, dp.status, dp.average_rating, dp.total_reviews
           ORDER BY COUNT(a.id) DESC`
        );

        const doctorPerformance = doctorPerf.rows.map((r: any) => ({
          id: r.id,
          name: r.full_name,
          specializations: r.specialization_names || [],
          status: r.status,
          appointments: parseInt(r.total_appointments),
          rating: parseFloat(r.average_rating) || 0,
          totalReviews: parseInt(r.total_reviews) || 0,
        }));

        res.json({
          revenueStats,
          weeklyAppointments,
          specializationBookings,
          patientRegistrations,
          registrationGrowth,
          doctorPerformance,
        });
      } catch (error) {
        console.error("Failed to get reports data:", error);
        res.status(500).json({ error: "Failed to get reports data" });
      }
    },
  );

  // Generate Hash for PayHere Checkout (Frontend will call this)
  app.post(
    "/api/payhere/hash",
    authMiddleware,
    async (req: Request, res: Response) => {
      try {
        const { order_id, amount, currency } = req.body;
        const merchant_id = process.env.PAYHERE_MERCHANT_ID;
        const merchant_secret = process.env.PAYHERE_SECRET;

        if (!merchant_id || !merchant_secret) {
          return res.status(500).json({ error: "PayHere credentials missing on server" });
        }

        // CRITICAL: Amount MUST be exactly 2 decimal places as a string
        const formattedAmount = Number(amount).toFixed(2);
        
        // CRITICAL FIX: Use createHash('md5') instead of createHmac!
        const hashedSecret = createHash('md5').update(merchant_secret).digest('hex').toUpperCase();
        
        const hashString = merchant_id + order_id + formattedAmount + currency + hashedSecret;
        const hash = createHash('md5').update(hashString).digest('hex').toUpperCase();

        res.json({ hash, merchant_id, formattedAmount });
      } catch (error) {
        console.error("Failed to generate PayHere hash:", error);
        res.status(500).json({ error: "Failed to generate hash" });
      }
    }
  );

  app.post(
    "/api/payhere/notify",
    async (req: Request, res: Response) => {

      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      
      try {
        const {
          merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig, method, status_message
        } = req.body;

        const merchant_secret = process.env.PAYHERE_SECRET;
        const appointmentId = order_id ? order_id.replace('booking-', '') : 'N/A';
        const paymentMethodUsed = method || 'PayHere Gateway';

        let payment = null;
        let appt = null;
        let slot = null;

        if (appointmentId !== 'N/A') {
           payment = await storage.getPaymentByAppointment(appointmentId);
           appt = await storage.getAppointment(appointmentId);
           slot = appt ? await storage.getAppointmentSlot(appt.slotId) : null;
        }

        let safeActorId = appt?.patientId;
        let safeActorRole = "system_webhook";

        if (!safeActorId) {
          const admins = await storage.getAllUsers("admin");
          safeActorId = admins && admins.length > 0 ? admins[0].id : 'N/A';
        }

        const richMetadata = {
          auditType: 'PAYMENT',
          method: paymentMethodUsed,
          paymentDetails: {
            payhereOrderId: order_id,
            gatewayAmount: payhere_amount,
            gatewayCurrency: payhere_currency,
            statusCode: status_code,
            statusMessage: status_message || 'N/A',
            internalPaymentId: payment?.id || 'N/A',
            dbTotalAmount: payment?.totalAmount || 'N/A',
            platformCommission: payment?.platformCommission || 'N/A',
            doctorEarnings: payment?.doctorEarnings || 'N/A'
          },
          appointmentDetails: appt ? {
            appointmentId: appt.id,
            patientId: appt.patientId,
            doctorId: appt.doctorId,
            consultationType: appt.consultationType,
            statusBeforeWebhook: appt.status
          } : 'N/A',
          slotDetails: slot ? {
            slotId: slot.id,
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isOnline: !!slot.meetLink
          } : 'N/A'
        };

        const hashedSecret = createHash('md5').update(merchant_secret!).digest('hex').toUpperCase();
        const hashString = merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret;
        const generatedSig = createHash('md5').update(hashString).digest('hex').toUpperCase();

        if (generatedSig !== md5sig) {
          const tFailed = new Date().toISOString();
          try {
            await storage.createAuditLog({
              actorId: safeActorId, actorRole: safeActorRole,
              action: 'PAYHERE_WEBHOOK', status: 'failed',
              entityType: 'payment', entityId: payment?.id || 'N/A',
              ipAddress, device, location, sessionId: sessionId || 'N/A',
              metadata: {
                ...richMetadata,
                reason: 'Security Alert: Invalid signature in PayHere webhook. Possible spoofing.',
                receivedPayload: { order_id, payhere_amount, payhere_currency, status_code },
                timeline: { requestReceivedAt: tRequestReceived, signatureVerificationFailedAt: tFailed, completedAt: tFailed }
              }
            });
          } catch (e) { console.error("Audit log failed:", e); }
          return res.status(400).send("Invalid Signature");
        }

        if (status_code === "2") {          
          if (payment && appt && slot) {
            await storage.updatePayment(payment.id, { status: PaymentStatus.COMPLETED });
            await storage.updateAppointment(appointmentId, { status: AppointmentStatus.CONFIRMED });
            await pool.query(
              `UPDATE appointment_slots SET is_booked = true WHERE id = $1`,
              [(payment as any).slotId]
            );
            
            // Send Notifications & Emails
            const docProfile = await storage.getDoctorProfile(appt.doctorId);
            if(docProfile) {
              const docUser = await storage.getUser(docProfile.userId);
              const ptUser = await storage.getUser(appt.patientId);
              if(docUser && ptUser) {
                await storage.createNotification({
                  userId: ptUser.id, title: "Payment Successful",
                  message: `Your payment of LKR ${payhere_amount} for appointment with Dr. ${docUser.fullName} was successful.`,
                  type: "payment", isRead: false, relatedId: payment.id,
                });
                await storage.createNotification({
                  userId: docUser.id, title: "New Online Payment",
                  message: `${ptUser.fullName} has paid for their upcoming appointment.`,
                  type: "payment", isRead: false, relatedId: payment.id,
                });

                await sendPatientBookingReceiptEmail(
                  ptUser.email, ptUser.fullName, docUser.fullName, String(slot.date),
                  slot.startTime, payment.totalAmount, slot.consultationType,
                  slot.meetLink || "unavailable", "online"
                );
                await sendDoctorNewBookingEmail(
                  docUser.email, docUser.fullName, ptUser.fullName, appt.symptoms,
                  String(slot.date), slot.startTime, slot.consultationType,
                  slot.meetLink || "unavailable"
                ); 
              }
            }

            // SUCCESS AUDIT LOG
            const tCompleted = new Date().toISOString();
            try {
              await storage.createAuditLog({
                actorId: safeActorId, actorRole: safeActorRole,
                action: 'PAYHERE_WEBHOOK_SUCCESS', status: 'success',
                entityType: 'payment', entityId: payment.id,
                ipAddress, device, location, sessionId: sessionId || 'N/A',
                metadata: {
                  ...richMetadata,
                  reason: 'Payment completed successfully via PayHere.',
                  timeline: { requestReceivedAt: tRequestReceived, dbUpdatesAt: tCompleted, completedAt: tCompleted }
                }
              });
            } catch (auditErr) { console.error("Audit log failed (Webhook Success):", auditErr); }

          }
          
        // PAYMENT FAILED/CANCELED
        } else if (status_code === "-2" || status_code === "-1" || status_code === "0") {
          console.log(`[PAYHERE WEBHOOK] ⚠️ Payment Failed/Canceled for Appointment: ${appointmentId}`);
          if (payment && appt) {
            await storage.updatePayment(payment.id, { 
              status: PaymentStatus.FAILED,
              consultationFee: 0,
              bookingCharges: 0,
              tax: 0,
              platformCommission: 0,
              doctorEarnings: 0,
              totalAmount: 0
            });
            await storage.updateAppointment(appointmentId, { 
                status: AppointmentStatus.CANCELLED, 
                cancelReason: `PayHere Payment Failed (Code: ${status_code})` 
            });
            await pool.query(`UPDATE appointment_slots SET is_booked = false WHERE id = $1`, [(payment as any).slotId]);

            // FAILED AUDIT LOG
            const tCompleted = new Date().toISOString();
            try {
              await storage.createAuditLog({
                actorId: safeActorId, actorRole: safeActorRole,
                action: 'PAYHERE_WEBHOOK_FAILED', status: 'failed',
                entityType: 'payment', entityId: payment.id,
                ipAddress, device, location, sessionId: sessionId || 'N/A',
                metadata: {
                  ...richMetadata,
                  reason: `Payment failed or canceled. Status Code: ${status_code}`,
                  timeline: { requestReceivedAt: tRequestReceived, dbRevertAt: tCompleted, completedAt: tCompleted }
                }
              });
            } catch (auditErr) { console.error("Audit log failed (Webhook Failed):", auditErr); }
          }
        }
        
        res.status(200).send("OK");
      } catch (error) {
        
        // CATCH BLOCK AUDIT LOG
        const tFailed = new Date().toISOString();
        try {
          const admins = await storage.getAllUsers("admin");
          const fallbackActorId = admins && admins.length > 0 ? admins[0].id : 'N/A';
          
          await storage.createAuditLog({
            actorId: fallbackActorId, actorRole: 'system_webhook',
            action: 'PAYHERE_WEBHOOK_ERROR', status: 'failed',
            entityType: 'system', entityId: 'N/A',
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              method: 'PayHere Webhook',
              reason: 'Internal Server Error (500) while processing webhook.',
              errorDetail: String(error),
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed }
            }
          });
        } catch (e) { console.error("Audit log failed (Webhook Catch):", e); }

        res.status(500).send("Internal Server Error");
      }
    }
  );

  // ==========================================
  // EXPLICIT FAIL ROUTE
  // ==========================================
  app.patch(
    "/api/appointments/:id/payment-failed",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const appointmentId = req.params.id;
        
        // Appointment checking pending
        const appointment = await storage.getAppointment(appointmentId);
        if (!appointment || appointment.status !== AppointmentStatus.PENDING) {
          return res.json({ success: true });
        }

        // 1. Payment status update to faild
        const payment = await storage.getPaymentByAppointment(appointmentId);
        if (payment) {
          await storage.updatePayment(payment.id, { 
            status: PaymentStatus.FAILED,
            consultationFee: 0,
            bookingCharges: 0,
            tax: 0,
            platformCommission: 0,
            doctorEarnings: 0,
            totalAmount: 0
          });
        }

        // 2. Appointment status update to cancelled with reason
        await storage.updateAppointment(appointmentId, { 
          status: AppointmentStatus.CANCELLED,
          cancelReason: "Payment Failed or Cancelled by User"
        });

        // 3. Slot agian free
        await pool.query(
          `UPDATE appointment_slots SET is_booked = false WHERE id = $1`,
          [appointment.slotId]
        );

        const tCompleted = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole,
            action: 'EXPLICIT_PAYMENT_FAILED', status: 'success',
            entityType: 'appointment', entityId: appointmentId,
            ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: {
              auditType: 'PAYMENT',
              paymentId: payment?.id || 'N/A',
              slotId: appointment.slotId,
              reason: 'User explicitly cancelled the payment or gateway timeout occurred.',
              actionTaken: 'Appointment cancelled and slot released to the public.',
              timeline: { requestReceivedAt: tRequestReceived, completedAt: tCompleted }
            }
          });
        } catch (e) { console.error("Audit log failed (Explicit Fail Success):", e); }

        res.json({ success: true, message: "Slot released successfully" });
      } catch (error) {
       const tFailed = new Date().toISOString();
        try {
          await storage.createAuditLog({
            actorId, actorRole, action: 'EXPLICIT_PAYMENT_FAILED', status: 'failed',
            entityType: 'system', entityId: req.params.id, ipAddress, device, location, sessionId: 'N/A',
            metadata: { auditType: 'PAYMENT', reason: 'Internal Server Error (500)', timeline: { requestReceivedAt: tRequestReceived, completedAt: tFailed } }
          });
        } catch (e) { console.error("Audit log failed (Explicit Fail Error):", e); }
        res.status(500).json({ error: "Failed to release slot" });
      }
    }
  );

  // ==========================================
  // BACKGROUND CLEANUP JOB (INDUSTRY STANDARD)
  // ==========================================
  setInterval(async () => {
    try {
      // Clean up after 12 minutes to allow 10 min UI timer + 2 min buffer
      const twelveMinsAgo = new Date(Date.now() - 12 * 60 * 1000);
      
      const query = `
        SELECT a.id, a.slot_id, a.patient_id 
        FROM appointments a
        JOIN payments p ON a.id = p.appointment_id
        WHERE a.status = 'pending' AND p.method = 'online' AND a.created_at < $1
      `;
      const result = await pool.query(query, [twelveMinsAgo]);
      
      if (result.rows.length > 0) {
        console.log(`[CLEANUP JOB] Found ${result.rows.length} abandoned appointments (>12 mins). Releasing slots...`);
        
        for (const row of result.rows) {
          await pool.query(
            `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE appointment_id = $1 AND status = 'pending'`, 
            [row.id]
          );

          await pool.query(
            `UPDATE appointments SET status = 'cancelled', cancel_reason = 'Payment Timeout (Auto Cancelled by System)', cancelled_by = 'system', updated_at = NOW() WHERE id = $1`, 
            [row.id]
          );
          
          await pool.query(
            `UPDATE appointment_slots SET is_booked = false WHERE id = $1`, 
            [row.slot_id]
          );
          
          console.log(`[CLEANUP JOB] Successfully released abandoned appointment: ${row.id} and slot: ${row.slot_id}`);

          try {
            await storage.createAuditLog({
              actorId: row.patient_id || 'system',
              actorRole: 'system',
              action: 'AUTO_CANCEL_ABANDONED_BOOKING',
              status: 'success',
              entityType: 'appointment',
              entityId: row.id,
              ipAddress: '127.0.0.1',
              device: 'System Background Job',
              location: 'Server',
              sessionId: 'SYS-AUTO',
              metadata: {
                reason: 'User did not complete payment within 12 minutes',
                slotId: row.slot_id,
                auditType: 'APPOINTMENT',
                timeline: {
                  completedAt: new Date().toISOString()
                }
              }
            });
          } catch (e) {
             console.error("[CLEANUP JOB] Audit log failed:", e);
          }
        }
      }
    } catch (err) {
      console.error("[CLEANUP JOB ERROR]:", err);
    }
  }, 60 * 1000);

  app.get(
    "/api/admin/audit-logs",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        
        const type = req.query.type as string;
        const search = req.query.search as string;
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;

        const result = await storage.getPaginatedAuditLogs(page, limit, { type, search, startDate, endDate });
        res.json(result);
      } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        res.status(500).json({ error: "Failed to fetch audit logs" });
      }
    }
  );

  app.put(
    "/api/doctor/hospitals/:id",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      const tRequestReceived = new Date().toISOString();
      const { ipAddress, device, location, sessionId } = getReqInfo(req);
      const { actorId, actorRole } = await getActorInfo(req);

      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) return res.status(404).json({ error: "Doctor profile not found" });

        const hospitalId = req.params.id;
        const data = updateHospitalSchema.parse(req.body);

        const updatedHospital = await storage.updateDoctorHospital(profile.id, hospitalId, data);
        
        if (!updatedHospital) {
          return res.status(403).json({ error: "Unauthorized or Hospital not found" });
        }

        try {
          await storage.createAuditLog({
            actorId, actorRole, action: 'UPDATE_CONSULTATION_LOCATION', status: 'success',
            entityType: 'hospital', entityId: hospitalId, ipAddress, device, location, sessionId: sessionId || 'N/A',
            metadata: { auditType: "SYSTEM", locationName: data.name, timeline: { requestReceivedAt: tRequestReceived, completedAt: new Date().toISOString() } }
          });
        } catch (e) {}

        res.json(updatedHospital);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation failed", details: error.errors });
        }
        res.status(500).json({ error: "Failed to update location" });
      }
    }
  );

  app.get(
    "/api/admin/doctors/:id/analytics",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const analytics = await storage.getDoctorDetailedAnalytics(req.params.id);
        res.json(analytics);
      } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ error: "Failed to fetch detailed analytics" });
      }
    }
  );

  app.post(
    "/api/doctor/export",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { startDate, endDate, reportType, format } = req.body;
        
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) return res.status(404).json({ error: "Doctor profile not found" });

        const data = await storage.getDoctorExportData(profile.id, startDate, endDate);

        if (format === "json") {
          return res.json({
            reportGeneratedAt: new Date().toISOString(),
            dateRange: { startDate, endDate },
            data: {
              ...(reportType === "earnings" || reportType === "all" ? { payments: data.payments } : {}),
              ...(reportType === "appointments" || reportType === "all" ? { appointments: data.appointments } : {}),
            }
          });
        }

        // Generate CSV format
        if (format === "csv") {
          let csvContent = `Report Generated: ${new Date().toISOString()}\nDate Range: ${startDate} to ${endDate}\n\n`;

          if (reportType === "earnings" || reportType === "all") {
            csvContent += "--- EARNINGS REPORT ---\n";
            csvContent += "Date,Status,Method,Total Amount (LKR),Platform Commission (LKR),Your Earnings (LKR)\n";
            data.payments.forEach(p => {
              csvContent += `"${p.createdAt.split('T')[0]}","${p.status}","${p.method}","${p.totalAmount}","${p.platformCommission}","${p.doctorEarnings}"\n`;
            });
            csvContent += "\n";
          }

          if (reportType === "appointments" || reportType === "all") {
            csvContent += "--- APPOINTMENTS REPORT ---\n";
            csvContent += "Date,Time,Patient Name,Type,Status,Symptoms\n";
            data.appointments.forEach(a => {
              // Wrap strings in quotes to avoid CSV breaking on commas inside text
              const safeSymptoms = a.symptoms.replace(/"/g, '""');
              csvContent += `"${a.appointmentDate}","${a.appointmentTime}","${a.patient.fullName}","${a.consultationType}","${a.status}","${safeSymptoms}"\n`;
            });
          }

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=doctor_report_${startDate}_to_${endDate}.csv`);
          return res.status(200).send(csvContent);
        }

        res.status(400).json({ error: "Invalid format requested" });
      } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ error: "Failed to generate report" });
      }
    }
  );

  // --- GET ADVANCED EARNINGS (UPDATED FOR NEW UI) ---
  app.get("/api/doctor/earnings/advanced", authMiddleware, roleMiddleware(UserRole.DOCTOR), async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search ? (req.query.search as string).toLowerCase() : "";
        const year = req.query.year as string;
        const month = req.query.month as string;
        const day = req.query.day as string;

        // 1. LIFETIME EARNINGS BY TYPE
        const lifetimeRes = await pool.query(`
            SELECT 
                COALESCE(SUM(p.doctor_earnings), 0) as total_net,
                COALESCE(SUM(CASE WHEN a.consultation_type = 'in_person' THEN p.doctor_earnings ELSE 0 END), 0) as in_person_net,
                COALESCE(SUM(CASE WHEN a.consultation_type = 'online' THEN p.doctor_earnings ELSE 0 END), 0) as online_net
            FROM payments p
            LEFT JOIN appointments a ON p.appointment_id = a.id
            WHERE p.doctor_id = $1 AND p.status = 'completed'
        `, [profile.id]);

        // 2. TOTAL PAYOUTS (Withdrawals)
        const payoutRes = await pool.query(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_requested ELSE 0 END), 0) as pending_payouts,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_requested ELSE 0 END), 0) as completed_payouts_lifetime,
                COALESCE(SUM(CASE WHEN status = 'completed' AND requested_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC') THEN amount_requested ELSE 0 END), 0) as completed_payouts_this_month
            FROM payout_requests 
            WHERE doctor_id = $1
        `, [profile.id]);

        // 3. UNSETTLED CANCELLATIONS
        const cancelRes = await pool.query(`
            SELECT COALESCE(SUM(amount_owed), 0) as total, COUNT(*) as count 
            FROM doctor_cancellation_charges 
            WHERE doctor_id = $1 AND settled = false
        `, [profile.id]);

        const totalNet = parseInt(lifetimeRes.rows[0].total_net);
        const inPersonNet = parseInt(lifetimeRes.rows[0].in_person_net);
        const onlineNet = parseInt(lifetimeRes.rows[0].online_net);
        const unsettledCancels = parseInt(cancelRes.rows[0].total);
        const cancellationsCount = parseInt(cancelRes.rows[0].count);
        const pendingPayouts = parseInt(payoutRes.rows[0].pending_payouts);
        const completedPayoutsLifetime = parseInt(payoutRes.rows[0].completed_payouts_lifetime);
        const completedPayoutsThisMonth = parseInt(payoutRes.rows[0].completed_payouts_this_month);
        const totalPayouts = pendingPayouts + completedPayoutsLifetime;

        // 💰 VIRTUAL WALLET: Available to Withdraw (Total Net - Withdrawals - Unsettled Penalties)
        const withdrawableBalance = Math.max(0, totalNet - totalPayouts - unsettledCancels);

        // 4. THIS MONTH BREAKDOWN
        const thisMonthRes = await pool.query(`
            SELECT 
                COALESCE(SUM(p.consultation_fee), 0) as gross,
                COALESCE(SUM(p.platform_commission), 0) as platform_fee,
                COALESCE(SUM(p.tax), 0) as tax,
                COALESCE(SUM(p.doctor_earnings), 0) as net
            FROM payments p
            WHERE p.doctor_id = $1 AND p.status = 'completed'
            AND p.created_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC')
        `, [profile.id]);

        const thisMonthCancelsRes = await pool.query(`
            SELECT COALESCE(SUM(amount_owed), 0) as deducted
            FROM doctor_cancellation_charges
            WHERE doctor_id = $1 AND created_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC')
        `, [profile.id]);

        const tmGross = parseInt(thisMonthRes.rows[0].gross);
        const tmPlatform = parseInt(thisMonthRes.rows[0].platform_fee);
        const tmTax = parseInt(thisMonthRes.rows[0].tax);
        const tmNetBeforeCancel = parseInt(thisMonthRes.rows[0].net);
        const tmCancel = parseInt(thisMonthCancelsRes.rows[0].deducted);
        // Doctor-facing custom fees this month = gross - platform - net (they're baked into doctor_earnings)
        const tmCustomFees = Math.max(0, tmGross - tmPlatform - tmNetBeforeCancel);
        // Break the custom fees down BY NAME from each payment's stored breakdown, so the
        // doctor sees the actual fee titles (e.g. "nicol fee"), not just a lumped total.
        const feeItemsRes = await pool.query(`
            SELECT tax_breakdown FROM payments
            WHERE doctor_id = $1 AND status = 'completed'
            AND created_at >= date_trunc('month', CURRENT_DATE AT TIME ZONE 'UTC')
        `, [profile.id]);
        const feeTotals = new Map<string, number>();
        for (const row of feeItemsRes.rows) {
          const tb = Array.isArray(row.tax_breakdown) ? row.tax_breakdown : [];
          for (const item of tb) {
            if (item?.kind === 'fee' && (item.applicableTo === 'doctors' || item.applicableTo === 'both')) {
              feeTotals.set(item.title, (feeTotals.get(item.title) || 0) + (Number(item.amount) || 0));
            }
          }
        }
        const customFeeItems = Array.from(feeTotals.entries()).map(([title, amount]) => ({ title, amount }));
        // Fees from bookings made before per-fee breakdowns were stored can't be named — lump them.
        const namedFeeSum = customFeeItems.reduce((s, f) => s + f.amount, 0);
        const otherFees = Math.max(0, tmCustomFees - namedFeeSum);
        const thisMonthNet = Math.max(0, tmNetBeforeCancel - tmCancel);

        // 5. CHART DATA (Last 6 Months)
        const chartRes = await pool.query(`
            SELECT to_char(date_trunc('month', created_at), 'Mon') as month, COALESCE(SUM(doctor_earnings), 0) as amount
            FROM payments WHERE doctor_id = $1 AND status = 'completed'
            AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
            GROUP BY date_trunc('month', created_at)
        `, [profile.id]);

        const chartData = [];
        for(let i=5; i>=0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const mName = d.toLocaleString('en-US', { month: 'short' });
            const row = chartRes.rows.find(r => r.month.trim() === mName);
            chartData.push({ month: mName, amount: row ? parseInt(row.amount) : 0 });
        }

        // 6. PAGINATED HISTORY (Added Symptoms, Slot & Patient details for Modal)
        let queryStr = `
            SELECT 
                p.id, p.created_at as "date", p.status, p.method, p.total_amount as "grossAmount",
                p.platform_commission as "platformFee", p.tax, p.doctor_earnings as "netEarnings", p.tax_breakdown as "taxBreakdown",
                a.id as "appointmentId", a.consultation_type as "appointmentType", a.symptoms, a.status as "appointmentStatus",
                s.date as "slotDate", s.start_time as "slotStartTime", s.end_time as "slotEndTime",
                u.full_name as "patientName", u.email as "patientEmail", u.phone as "patientPhone", u.gender as "patientGender"
            FROM payments p
            LEFT JOIN appointments a ON p.appointment_id = a.id
            LEFT JOIN appointment_slots s ON a.slot_id = s.id
            LEFT JOIN users u ON p.patient_id = u.id
            WHERE p.doctor_id = $1
        `;
        const queryParams: any[] = [profile.id];
        let paramIndex = 2;

        if (search) {
            queryStr += ` AND (LOWER(p.id) LIKE $${paramIndex} OR LOWER(u.full_name) LIKE $${paramIndex} OR LOWER(u.email) LIKE $${paramIndex} OR LOWER(u.phone) LIKE $${paramIndex})`;
            queryParams.push(`%${search}%`);
            paramIndex++;
        }
        if (year && year !== "all") { queryStr += ` AND EXTRACT(YEAR FROM p.created_at) = $${paramIndex}`; queryParams.push(year); paramIndex++; }
        if (month && month !== "all") { queryStr += ` AND EXTRACT(MONTH FROM p.created_at) = $${paramIndex}`; queryParams.push(month); paramIndex++; }
        if (day && day !== "all") { queryStr += ` AND EXTRACT(DAY FROM p.created_at) = $${paramIndex}`; queryParams.push(day); paramIndex++; }

        const countQuery = `SELECT COUNT(*) as total FROM (${queryStr}) as sub`;
        const countResult = await pool.query(countQuery, queryParams);
        const totalCount = parseInt(countResult.rows[0].total);

        queryStr += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(limit, (page - 1) * limit);
        const historyResult = await pool.query(queryStr, queryParams);

        res.json({
          stats: { withdrawableBalance, thisMonthNet, inPersonNet, onlineNet, cancellationsCount, cancellationDeducted: unsettledCancels, pendingPayouts, completedPayoutsLifetime, completedPayoutsThisMonth },
          breakdown: { gross: tmGross, platformFee: tmPlatform, tax: tmTax, customFees: tmCustomFees, customFeeItems, otherFees, cancellationFee: tmCancel, net: thisMonthNet },
          chartData,
          history: { data: historyResult.rows, totalCount, totalPages: Math.ceil(totalCount / limit) || 1, currentPage: page }
        });

      } catch (error) {
        console.error("Advanced Earnings Error:", error);
        res.status(500).json({ error: "Failed to get advanced earnings" });
      }
  });

  // 2. Request Payout
  app.post("/api/doctor/payouts/request", authMiddleware, roleMiddleware(UserRole.DOCTOR), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const profile = await storage.getDoctorProfileByUserId(req.user!.id);
      if (!profile) return res.status(404).json({ error: "Doctor profile not found" });

      if (!profile.bankAccountNumber || !profile.bankName) {
        return res.status(400).json({ error: "Please update your bank details in profile settings first." });
      }

      const amount = Number(req.body.amount);
      if (!amount || amount <= 0) {
          return res.status(400).json({ error: "Invalid withdrawal amount." });
      }

      // STRICT BACKEND VALIDATION: Recalculate available balance to prevent API abuse
      const earnRes = await pool.query(`SELECT COALESCE(SUM(doctor_earnings), 0) as total FROM payments WHERE doctor_id = $1 AND status = 'completed'`, [profile.id]);
      const totalEarnings = parseInt(earnRes.rows[0].total);

      const payoutRes = await pool.query(`SELECT COALESCE(SUM(amount_requested), 0) as total FROM payout_requests WHERE doctor_id = $1 AND status IN ('pending', 'completed')`, [profile.id]);
      const totalPayouts = parseInt(payoutRes.rows[0].total);

      const cancelRes = await pool.query(`SELECT COALESCE(SUM(amount_owed), 0) as total FROM doctor_cancellation_charges WHERE doctor_id = $1 AND settled = false`, [profile.id]);
      const cancellationDeducted = parseInt(cancelRes.rows[0].total);

      // Actual available balance in the database
      const withdrawableBalance = Math.max(0, totalEarnings - totalPayouts - cancellationDeducted);

      // Block if requested amount is greater than actual balance
      if (amount > withdrawableBalance) {
          return res.status(400).json({ error: `Withdrawal failed. Requested amount (LKR ${amount}) exceeds your available balance (LKR ${withdrawableBalance}).` });
      }

      // Tiered Express Fee Calculation Logic
      const settings = await storage.getPlatformSettings();
      const today = new Date();
      const currentDay = today.getDate();
      const autoPayoutDay = settings.autoPayoutDay || 1;

      let daysUntilPayout = 0;
      if (currentDay < autoPayoutDay) {
          daysUntilPayout = autoPayoutDay - currentDay;
      } else if (currentDay > autoPayoutDay) {
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, autoPayoutDay);
          const diffTime = Math.abs(nextMonth.getTime() - today.getTime());
          daysUntilPayout = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      let feePct = 0;
      if (daysUntilPayout === 0) {
          feePct = 0;
      } else if (daysUntilPayout <= 7) {
          feePct = settings.earlyPayoutFee7Days || 1.0;
      } else if (daysUntilPayout <= 14) {
          feePct = settings.earlyPayoutFee14Days || 3.0;
      } else {
          feePct = settings.earlyPayoutFee21Days || 5.0;
      }

      const feeDeducted = Math.round((amount * feePct) / 100);
      const netAmount = amount - feeDeducted;

      // Create Payout Request
      const payoutRequest = await storage.createPayoutRequest({
        doctorId: profile.id,
        amountRequested: amount,
        feePercentage: feePct,
        feeDeducted: feeDeducted,
        netAmount: netAmount,
        status: 'pending',
        bankName: profile.bankName,
        bankAccountNumber: profile.bankAccountNumber,
        bankBranch: profile.bankBranch,
      });

      // Mark current cancellation charges as settled since they are factored into this withdrawal
      await pool.query(`UPDATE doctor_cancellation_charges SET settled = true, settled_at = NOW() WHERE doctor_id = $1 AND settled = false`, [profile.id]);

      res.status(201).json(payoutRequest);
    } catch (error) {
      console.error("Payout Error:", error);
      res.status(500).json({ error: "Failed to process withdrawal request" });
    }
  });

  // --- NEW ADMIN PAYOUT MANAGEMENT API ---
  app.get("/api/admin/payouts/management", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      const tab = (req.query.tab as string) || 'pending';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || '';

      const data = await storage.getAdminPayoutsManagement(tab, page, limit, search);
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch payouts" });
    }
  });

  app.post("/api/admin/payouts/:id/process", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action, rejectReason, adminPassword } = req.body;
      
      // 🛑 STRICT SECURITY: Verify Admin Password Before Releasing Funds
      const adminUser = await storage.getUser(req.user!.id);
      if (!adminUser || !(await verifyPassword(adminPassword, adminUser.password))) {
        return res.status(401).json({ error: "Incorrect admin password. Action denied." });
      }

      const result = await storage.processAdminPayout(req.params.id, action, req.user!.id, rejectReason);
      
      // Send Notification to Doctor
      await storage.createNotification({
        userId: result.doctor_id,
        title: action === 'approve' ? "Payout Processed" : "Payout Rejected",
        message: action === 'approve' 
          ? `Your withdrawal of LKR ${result.net_amount} has been successfully transferred to your bank.`
          : `Your withdrawal request was rejected. Reason: ${rejectReason}`,
        type: "payment",
        isRead: false
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to process payout" });
    }
  });

  app.post("/api/admin/payouts/process-free", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { doctorId, amount, adminPassword } = req.body;
      
      // 🛑 STRICT SECURITY: Verify Admin Password
      const adminUser = await storage.getUser(req.user!.id);
      if (!adminUser || !(await verifyPassword(adminPassword, adminUser.password))) {
        return res.status(401).json({ error: "Incorrect admin password. Action denied." });
      }

      const result = await storage.processFreePayout(doctorId, Number(amount), req.user!.id);
      
      await storage.createNotification({
        userId: doctorId, // Note: Need actual user_id of doctor if doctorId is profile ID. Check your schema relation. Assuming it works.
        title: "Monthly Auto Payout Processed",
        message: `Your monthly payout of LKR ${amount} has been processed with 0% fees.`,
        type: "payment",
        isRead: false
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to process free payout" });
    }
  });

  app.post(
    "/api/doctor/export",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { startDate, endDate, reportType, format } = req.body;
        
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) return res.status(404).json({ error: "Doctor profile not found" });

        const data = await storage.getDoctorExportData(profile.id, startDate, endDate);

        if (format === "json") {
          return res.json({
            reportGeneratedAt: new Date().toISOString(),
            dateRange: { startDate, endDate },
            data: {
              ...(reportType === "earnings" || reportType === "all" ? { payments: data.payments } : {}),
              ...(reportType === "appointments" || reportType === "all" ? { appointments: data.appointments } : {}),
            }
          });
        }

        // Generate CSV format
        if (format === "csv") {
          let csvContent = `Report Generated: ${new Date().toISOString()}\nDate Range: ${startDate} to ${endDate}\n\n`;
          
          if (reportType === "earnings" || reportType === "all") {
            csvContent += "--- EARNINGS REPORT ---\n";
            csvContent += "Date,Status,Method,Total Amount (LKR),Platform Commission (LKR),Your Earnings (LKR)\n";
            data.payments.forEach(p => {
              csvContent += `"${p.createdAt.split('T')[0]}","${p.status}","${p.method}","${p.totalAmount}","${p.platformCommission}","${p.doctorEarnings}"\n`;
            });
            csvContent += "\n";
          }

          if (reportType === "appointments" || reportType === "all") {
            csvContent += "--- APPOINTMENTS REPORT ---\n";
            csvContent += "Date,Time,Patient Name,Type,Status,Symptoms\n";
            data.appointments.forEach(a => {
              // Wrap strings in quotes to avoid CSV breaking on commas inside text
              const safeSymptoms = a.symptoms.replace(/"/g, '""');
              csvContent += `"${a.appointmentDate}","${a.appointmentTime}","${a.patient.fullName}","${a.consultationType}","${a.status}","${safeSymptoms}"\n`;
            });
          }

          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=doctor_report_${startDate}_to_${endDate}.csv`);
          return res.status(200).send(csvContent);
        }
        res.status(400).json({ error: "Invalid format requested" });
      } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ error: "Failed to generate report" });
      }
    }
  );

  app.get(
    "/api/admin/payment-stats",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const stats = await storage.getPaymentStats();
        res.json(stats);
      } catch (error) {
        console.error("Failed to fetch payment stats:", error);
        res.status(500).json({ error: "Failed to fetch payment stats" });
      }
    },
  );

  app.post("/api/auth/send-registration-otp", registrationLimiter, async (req: Request, res: Response) => {
    const tRequestReceived = new Date().toISOString();
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email address is required" });
      }

      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ error: "This email is already registered. Please login instead." });
      }

      const otp = randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      await storage.setRegistrationOtp(email, otp, expiry);
      const emailResult = await sendRegistrationOtpEmail(email, otp);

      if (!emailResult.success) {
        throw new Error("Failed to send OTP email via Resend");
      }

      res.json({ message: "Verification code sent successfully" });
    } catch (error) {
      console.error("Failed to send registration OTP:", error);
      res.status(500).json({ error: "Failed to send verification code. Please check email service." });
    }
  });

  app.post("/api/auth/verify-registration-otp", registrationLimiter, async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: "Email and code are required" });
      }

      const isValid = await storage.verifyRegistrationOtp(email, otp);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid or expired verification code." });
      }

      // Generate the upload/registration session token
      const token = createRegistrationSession(email);
      res.json({ success: true, token });
    } catch (error) {
      console.error("Failed to verify registration OTP:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  });
  
  return httpServer;
}