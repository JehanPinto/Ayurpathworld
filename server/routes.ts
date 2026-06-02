// import { createHmac, randomInt, randomUUID } from "crypto";
import { createHash, randomInt, randomUUID } from "crypto";
import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { pool } from "./db";
import { storage } from "./storage";
import { sendApplicationEmail, sendPasswordResetOtpEmail } from "./util/email";

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
import { sendPatientBookingReceiptEmail, sendDoctorNewBookingEmail } from "./util/email";

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
function validateBankDetails(acc?: string | null, branch?: string | null) {
  if (acc && !/^\d{6,20}$/.test(acc.replace(/\s|-/g, ''))) {
    return "Invalid bank account number format (must be 6-20 digits)";
  }
  if (branch && !/^[A-Za-z0-9\s&,-]{2,50}$/.test(branch)) {
    return "Invalid bank branch format";
  }
  return null;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 5 : 100,
  message: { error: "Too many login attempts, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
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

function generateToken(payload: object, ttlMs = 7 * 24 * 60 * 60 * 1000): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: Math.floor(ttlMs / 1000) });
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
) {
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
  app.use(passport.initialize());
  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  app.post(
    "/api/auth/register",
    registrationLimiter,
    async (req: Request, res: Response) => {
      try {
        const data = insertUserSchema.parse(req.body);

        // Validate password strength
        const passwordValidation = validatePasswordStrength(data.password);
        if (!passwordValidation.valid) {
          return res.status(400).json({
            error: "Password does not meet security requirements",
            details: passwordValidation.errors,
          });
        }

        const existingUser = await storage.getUserByEmail(data.email);
        if (existingUser) {
          if (existingUser.provider && existingUser.provider !== AuthProvider.LOCAL) {
            const providerName = existingUser.provider.charAt(0).toUpperCase() + existingUser.provider.slice(1);
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

        const token = generateToken({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        });

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({ user: userWithoutPassword, token });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Registration failed" });
      }
    },
  );

  app.post(
    "/api/auth/register-doctor",
    registrationLimiter,
    async (req: Request, res: Response) => {
      try {
        const registrationToken = req.headers["x-registration-token"] as string;
        let sessionFiles: string[] = [];

        if (registrationToken) {
          const files = consumeSession(registrationToken);
          if (files) {
            sessionFiles = files;
          }
        }

        const userData = insertUserSchema.parse({
          ...req.body,
          role: UserRole.DOCTOR,
        });

        // Validate password strength
        const passwordValidation = validatePasswordStrength(userData.password);
        if (!passwordValidation.valid) {
          return res.status(400).json({
            error: "Password does not meet security requirements",
            details: passwordValidation.errors,
          });
        }

        const feeError = validateDoctorFees({
          consultationFee: parseInt(req.body.consultationFee) || 0,
          onlineConsultationFee: req.body.onlineConsultationFee ? parseInt(req.body.onlineConsultationFee) : undefined,
          homeVisitFee: req.body.homeVisitFee ? parseInt(req.body.homeVisitFee) : undefined
        });
        if (feeError) return res.status(400).json({ error: feeError });

        // Validate Bank Details
        const bankError = validateBankDetails(req.body.bankAccountNumber, req.body.bankBranch);
        if (bankError) return res.status(400).json({ error: bankError });

        const existingUser = await storage.getUserByEmail(userData.email);
        if (existingUser) {
          if (existingUser.provider && existingUser.provider !== AuthProvider.LOCAL) {
            const providerName = existingUser.provider.charAt(0).toUpperCase() + existingUser.provider.slice(1);
            return res.status(400).json({ 
              error: `This email is associated with a ${providerName} account. Please use a different email to register as a doctor, or contact support.` 
            });
          }
          
          return res.status(400).json({ error: "Email already registered" });
        }

        // VALIDATE DOCTOR DATA BEFORE CREATING USER
        const verificationDocs =
          sessionFiles.length > 0
            ? sessionFiles
            : req.body.verificationDocuments || [];

        const doctorData = insertDoctorProfileSchema.parse({
          userId: "temp-id", // Placeholder, will be replaced with actual user ID
          registrationNumber: req.body.registrationNumber,
          qualifications: req.body.qualifications,
          specializationIds: req.body.specializationIds || [],
          languagesSpoken: req.body.languagesSpoken || ["english"],
          consultationTypes: req.body.consultationTypes || ["in_person"],
          clinic_locations: req.body.clinic_locations || [],
          consultationFee: parseInt(req.body.consultationFee) || 0,
          onlineConsultationFee: req.body.onlineConsultationFee
            ? parseInt(req.body.onlineConsultationFee)
            : undefined,
          homeVisitFee: req.body.homeVisitFee
            ? parseInt(req.body.homeVisitFee)
            : undefined,
          verificationDocuments: verificationDocs,
          bankName: req.body.bankName || null,
          bankAccountNumber: req.body.bankAccountNumber || null,
          bankBranch: req.body.bankBranch || null,
          status: DoctorStatus.PENDING,
        });

        // Now create the user (validation passed)
        const hashedPassword = await hashPassword(userData.password);
        const user = await storage.createUser({
          ...userData,
          password: hashedPassword,
        });

        try {
          // Try to create doctor profile with actual user ID
          await storage.createDoctorProfile({
            ...doctorData,
            userId: user.id,
          });
        } catch (profileError) {
          // ROLLBACK: Delete the user if doctor profile creation fails
          try {
            await storage.deleteUser(user.id);
          } catch (deleteError) {
            console.error("Failed to rollback user creation:", deleteError);
          }
          // Re-throw the original error to be handled by the outer catch block
          throw profileError;
        }

        const token = generateToken({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        });

        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({ user: userWithoutPassword, token });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Validation failed",
            details: error.errors,
          });
        }
        res.status(500).json({ error: "Doctor registration failed" });
      }
    },
  );

  app.post(
    "/api/auth/login",
    loginLimiter,
    async (req: Request, res: Response) => {
      try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await storage.getUserByEmail(email);

        if (!user || !(await verifyPassword(password, user.password))) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        if (user.provider && user.provider !== AuthProvider.LOCAL) {
          const providerName = user.provider.charAt(0).toUpperCase() + user.provider.slice(1);
          return res.status(400).json({ 
            error: "Already registered with a social account. Please login with " + providerName + " or reset your password to create a local account."
          });
        }

        if (user.role === UserRole.DOCTOR) {
          const doctorProfile = await storage.getDoctorProfileByUserId(user.id);

          if (doctorProfile) {
            if (doctorProfile.status === DoctorStatus.SUSPENDED) {
              return res
                .status(403)
                .json({
                  error:
                    "Your doctor account has been suspended by the administrator.",
                });
            }

            if (doctorProfile.status === DoctorStatus.REJECTED) {
              return res
                .status(403)
                .json({
                  error: "Your doctor account application was rejected.",
                });
            }
          }
        }

        if (user.isActive === false) {
          return res
            .status(403)
            .json({ error: "Your account has been deactivated." });
        }

        if (
          !user.registrationComplete &&
          user.provider !== AuthProvider.LOCAL
        ) {
          return res
            .status(400)
            .json({
              error:
                "Please finish signing up with your social account before logging in.",
            });
        }

        const token = generateToken({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        });

        const { password: _, ...userWithoutPassword } = user;
        res.cookie("token", token, cookieOptions).json({ user: userWithoutPassword, token });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
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
      try {
        const token = req.cookies?.token;

        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
          const exp = decoded?.exp ? decoded.exp * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000;
          tokenBlacklist.set(token, exp);
        }

        res.clearCookie("token", { httpOnly: true, sameSite: "strict" });
        res.json({ success: true, message: "Logged out successfully" });
      } catch (error) {
        res.status(500).json({ error: "Logout failed" });
      }
    }
  );

  app.post(
    "/api/auth/complete-registration",
    async (req: Request, res: Response) => {
      try {
        const payload = completeRegistrationSchema.parse(req.body);
        const decoded = verifyRegistrationToken(payload.registrationToken);
        if (!decoded?.id) {
          return res
            .status(401)
            .json({ error: "Invalid or expired registration token" });
        }

        const user = await storage.getUser(decoded.id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        if (user.registrationComplete) {
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
        }

        updatedUser = (await storage.getUser(user.id)) || updatedUser;
        const token = generateToken({
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          fullName: updatedUser.fullName,
        });
        const { password: _, ...userWithoutPassword } = updatedUser;

        res.cookie("token", token, cookieOptions).json({ user: userWithoutPassword, token });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to complete registration" });
      }
    },
  );

  app.post(
    "/api/auth/login",
    loginLimiter,
    async (req: Request, res: Response) => {
      try {
        const { email, password } = loginSchema.parse(req.body);

        const user = await storage.getUserByEmail(email);
        if (!user || !(await verifyPassword(password, user.password))) {
          return res.status(401).json({ error: "Invalid email or password" });
        }

        if (
          !user.registrationComplete &&
          user.provider !== AuthProvider.LOCAL
        ) {
          return res.status(400).json({
            error:
              "Please finish signing up with your social account before logging in.",
          });
        }

        const token = generateToken({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        });

        const { password: _, ...userWithoutPassword } = user;
        res.cookie("token", token, cookieOptions).json({ user: userWithoutPassword, token });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Login failed" });
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
          callbackURL: "/api/auth/google/callback",
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

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", {
        failureRedirect: "/login?error=google_auth_failed",
        session: false,
      }),
      (req: Request, res: Response) => {
        const user = req.user as any;
        if (!user) {
          return res.redirect("/login?error=google_auth_failed");
        }

        const { password: _, ...userWithoutPassword } = user;

        if (!user.registrationComplete || !user.phone) {
          const registrationToken = generateRegistrationToken({
            id: user.id,
            email: user.email,
            provider: user.provider || AuthProvider.GOOGLE,
          });
          const userJson = encodeURIComponent(
            JSON.stringify({
              ...userWithoutPassword,
              registrationComplete: false,
            }),
          );
          return res.redirect(
            `/auth/callback?status=incomplete&registrationToken=${registrationToken}&provider=google&user=${userJson}`,
          );
        }

        const token = generateToken({
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        });

        const userJson = encodeURIComponent(
          JSON.stringify(userWithoutPassword),
        );
        res.cookie("token", token, cookieOptions);
        res.redirect(
          `/auth/callback?status=ok&token=${token}&user=${userJson}`,
        );
      },
    );
  } else {
    app.get("/api/auth/google", (_req: Request, res: Response) => {
      res
        .status(503)
        .json({ error: "Google OAuth is not configured on the server." });
    });
    app.get("/api/auth/google/callback", (_req: Request, res: Response) => {
      res
        .status(503)
        .json({ error: "Google OAuth is not configured on the server." });
    });
  }

  const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
  const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
  const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
  const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;

  if (APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY) {
    try {
      const { Strategy: AppleStrategy } = await import("passport-apple");

      passport.use(
        new AppleStrategy(
          {
            clientID: APPLE_CLIENT_ID,
            teamID: APPLE_TEAM_ID,
            keyID: APPLE_KEY_ID,
            key: APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            callbackURL: "/api/auth/apple/callback",
            scope: ["name", "email"],
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              const email = profile.email;
              if (!email) {
                return done(
                  new Error("No email found in Apple profile"),
                  undefined,
                );
              }

              let user = await storage.getUserByEmail(email);
              const baseUserData = {
                email,
                fullName: profile.name?.firstName
                  ? `${profile.name.firstName} ${profile.name?.lastName || ""}`.trim()
                  : email.split("@")[0],
                password: await hashPassword(randomUUID()),
                role: UserRole.PATIENT,
                phone: "",
                profileImage: null,
                provider: AuthProvider.APPLE,
                providerId: profile.id || profile.user,
                registrationComplete: false,
                isEmailVerified: true,
              };

              if (!user) {
                user = await storage.createUser(baseUserData as any);
              } else {
                const updates: any = {};
                if (!user.providerId)
                  updates.providerId = profile.id || profile.user;
                if (!user.provider) updates.provider = AuthProvider.APPLE;
                if (user.registrationComplete === undefined)
                  updates.registrationComplete = false;
                if (Object.keys(updates).length > 0) {
                  user =
                    ((await storage.updateUser(user.id, updates)) as any) ??
                    user;
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
        "/api/auth/apple",
        passport.authenticate("apple", { session: false }),
      );

      app.post(
        "/api/auth/apple/callback",
        passport.authenticate("apple", {
          failureRedirect: "/login?error=apple_auth_failed",
          session: false,
        }),
        (req: Request, res: Response) => {
          const user = req.user as any;
          if (!user) {
            return res.redirect("/login?error=apple_auth_failed");
          }

          const { password: _, ...userWithoutPassword } = user;

          if (!user.registrationComplete || !user.phone) {
            const registrationToken = generateRegistrationToken({
              id: user.id,
              email: user.email,
              provider: user.provider || AuthProvider.APPLE,
            });
            const userJson = encodeURIComponent(
              JSON.stringify({
                ...userWithoutPassword,
                registrationComplete: false,
              }),
            );
            return res.redirect(
              `/auth/callback?status=incomplete&registrationToken=${registrationToken}&provider=apple&user=${userJson}`,
            );
          }

          const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
          });

          const userJson = encodeURIComponent(
            JSON.stringify(userWithoutPassword),
          );
          res.cookie("token", token, cookieOptions);
          res.redirect(
            `/auth/callback?status=ok&token=${token}&user=${userJson}`,
          );
        },
      );
    } catch (err) {
      console.warn(
        "Apple auth disabled: passport-apple not installed or failed to load.",
      );
    }
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
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res
          .status(400)
          .json({ error: "Valid email address is required" });
      }

      const clientIp = req.ip || req.socket.remoteAddress || "unknown";

      if (!checkSessionCreationLimit(clientIp)) {
        return res.status(429).json({
          error: "Too many registration attempts. Please try again later.",
        });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: "This email is already registered. Please login instead.",
        });
      }

      const token = createRegistrationSession(email);
      res.json({ token, email });
    } catch (error) {
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
      } catch (error) {
        res.status(500).json({ error: "Failed to upload file" });
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

  // 🟢 FIX: Added documentAccessLimiter here
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
      try {
        const blog = await storage.createBlog(req.body);
        res.status(201).json(blog);
      } catch (error) {
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
      try {
        await storage.deleteBlog(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete blog" });
      }
    },
  );

  // ================== BLOG SUBMISSION ROUTES ==================
  app.post("/api/blog-submissions", async (req: Request, res: Response) => {
    try {
      const { submittedByName, submittedByEmail, ...rest } = req.body;
      if (!submittedByName || !submittedByEmail) {
        return res.status(400).json({ error: "Name and email are required" });
      }
      const submission = await storage.createBlogSubmission({
        ...rest,
        submittedById: "anonymous",
        submittedByName,
        submittedByEmail,
      });
      res.status(201).json(submission);
    } catch (error) {
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
      try {
        const submission = await storage.approveBlogSubmission(req.params.id);
        if (!submission)
          return res.status(404).json({ error: "Submission not found" });
        res.json(submission);
      } catch (error) {
        res.status(500).json({ error: "Failed to approve submission" });
      }
    },
  );

  app.post(
    "/api/blog-submissions/:id/reject",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const { rejectionReason } = req.body;
        if (!rejectionReason)
          return res
            .status(400)
            .json({ error: "Rejection reason is required" });
        const submission = await storage.rejectBlogSubmission(
          req.params.id,
          rejectionReason,
        );
        if (!submission)
          return res.status(404).json({ error: "Submission not found" });
        res.json(submission);
      } catch (error) {
        res.status(500).json({ error: "Failed to reject submission" });
      }
    },
  );

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

  app.post(
    "/api/doctor/hospitals",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        if ((profile.hospitalIds || []).length >= 5) {
          return res.status(400).json({ error: "You have reached the maximum of 5 consultation locations." });
        }

        const { name, address } = req.body;
        if (!name?.trim() || !address?.trim()) {
          return res.status(400).json({ error: "Hospital name and address are required." });
        }

        const result = await storage.addDoctorHospital(profile.id, name.trim(), address.trim());
        if (!result) {
          return res.status(400).json({ error: "Could not add location. Limit may have been reached." });
        }

        res.status(201).json(result.hospital);
      } catch (error) {
        res.status(500).json({ error: "Failed to add location" });
      }
    },
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
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const data = insertAppointmentSlotSchema.parse({
          ...req.body,
          doctorId: profile.id,
        });

        const existingSlots = await storage.getAvailableSlots(profile.id, data.date);
        
        const isOverlap = (s1: string, e1: string, s2: string, e2: string) => {
          return s1 < e2 && s2 < e1;
        };

        const hasOverlap = existingSlots.some((slot) => 
          !slot.isBlocked && 
          slot.isActive !== false &&
          isOverlap(data.startTime, data.endTime, slot.startTime, slot.endTime)
        );

        if (hasOverlap) {
          return res.status(400).json({ error: "A slot already exists during this time period on the selected date." });
        }

        // 🟢 අලුතෙන් ADD කරපු කෑල්ල (Online නම් විතරක් Google Meet Link එක හදනවා)
        let meetLink: string | undefined = undefined;
        if (data.consultationType === "online") {
          // ලංකාවේ Timezone එකට අදාලව ISO Date string එකක් හදාගන්නවා
          const startDateTime = new Date(`${data.date}T${data.startTime}:00+05:30`).toISOString();
          
          // Slot එක හදද්දී patient කෙනෙක් නැති නිසා null යවනවා
          const meetData = await createGoogleMeetEvent(req.user!.email, null, startDateTime);
          
          if (meetData && meetData.meetingLink) {
            meetLink = meetData.meetingLink;
          }
        }

        // meetLink එකත් එක්කම DB එකට save කරනවා
        const slot = await storage.createAppointmentSlot({ ...data, meetLink });
        res.status(201).json(slot);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create slot" });
      }
    },
  );

  app.patch(
    "/api/doctor/appointments/:id/call",
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
        }

        res.status(200).json({ success: true });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to call appointment" });
      }
    },
  );

  app.patch(
    "/api/doctor/slots/:id/block",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const slot = await storage.blockSlot(req.params.id);
        res.json(slot);
      } catch (error) {
        res.status(500).json({ error: "Failed to block slot" });
      }
    },
  );

  app.post(
    "/api/appointments",
    authMiddleware,
    roleMiddleware(UserRole.PATIENT),
    async (req: AuthenticatedRequest, res: Response) => {
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
          id: randomUUID(),
          patientId: req.user!.id,
          doctorId: bookingData.doctorId,
          slotId: bookingData.slotId,
          hospitalId: bookingData.hospitalId,
          appointmentDate: new Date().toISOString().split('T')[0],
          appointmentTime: "",
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

        // Calculate fees
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

        const platformSettings = await storage.getPlatformSettings();
        const bookingCharges = platformSettings.bookingCharges;
        const stampDuty = platformSettings.stampDutyEnabled
          ? Math.round(consultationFee * 0.01)
          : 0;
        const tax = Math.round(consultationFee * (platformSettings.taxRate / 100)) + stampDuty;
        const platformCommission = Math.round(
          consultationFee * (platformSettings.platformCommissionRate / 100),
        );
        const doctorEarnings = consultationFee - platformCommission;
        const totalAmount = consultationFee + bookingCharges + tax;

        const paymentData = {
          appointmentId: appointmentData.id,
          patientId: req.user!.id,
          doctorId: bookingData.doctorId,
          consultationFee,
          bookingCharges,
          tax,
          platformCommission,
          doctorEarnings,
          totalAmount,
          status:
            bookingData.paymentMethod === PaymentMethod.ONLINE
              ? PaymentStatus.PENDING
              : PaymentStatus.UNPAID,
          method: bookingData.paymentMethod,
        };

        // =====================================================
        // ATOMIC BOOKING WITH PAYMENT: Single transaction
        // If ANY step fails (slot lock, appointment creation, payment creation),
        // entire transaction rolls back and nothing is persisted
        // =====================================================
        const result = await storage.bookAppointmentWithPaymentAtomic(
          appointmentData,
          paymentData,
          bookingData.slotId,
        );

        if (bookingData.paymentMethod === PaymentMethod.AT_CLINIC) {
          const doctorUser = await storage.getUser(doctor.userId);
          const doctorName = doctorUser?.fullName || "your doctor";
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const dateParts = typeof slotData.date === 'string' ? slotData.date.split("-") : new Date(slotData.date).toISOString().split('T')[0].split("-");
          const formattedBookingDate = `${parseInt(dateParts[2])} ${months[parseInt(dateParts[1]) - 1]}`;
          const formattedAmount = `LKR ${totalAmount.toLocaleString("en-LK")}`;

          await storage.createNotification({
            userId: req.user!.id,
            title: "Appointment Booked",
            message: `Your appointment with Dr. ${doctorName} has been booked for ${formattedBookingDate} at ${slotData.startTime}. Total: ${formattedAmount}.`,
            type: "appointment",
            isRead: false,
            relatedId: appointment.id,
          });

          await storage.createNotification({
            userId: doctor.userId,
            title: "New appointment booked",
            message: `${req.user!.fullName} has booked a consultation for ${formattedBookingDate} at ${slotData.startTime}. Chief complaint: ${bookingData.symptoms.substring(0, 150)}.`,
            type: "appointment",
            isRead: false,
            relatedId: appointment.id,
          });

          const today = new Date().toISOString().split("T")[0];
          const slotDateStr = Array.isArray(dateParts) ? dateParts.join("-") : String(slotData.date);
          
          if (slotDateStr > today) {
            await storage.createNotification({
              userId: doctor.userId,
              title: `Consultation on ${formattedBookingDate} at ${slotData.startTime}`,
              message: `You have an upcoming consultation with ${req.user!.fullName} on ${formattedBookingDate}. Review their case notes beforehand.`,
              type: "reminder",
              isRead: false,
              relatedId: appointment.id,
            });
          }
        }

        const fullAppointment = await storage.getAppointmentWithDetails(
          appointment.id,
        );
        res.status(201).json(fullAppointment);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to book appointment" });
      }
    },
  );

  app.patch(
    "/api/slots/:id/deactivate",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
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
          res.json({ success: true, message: "Slot deactivated successfully" });
        } else {
          res.status(500).json({ error: "Failed to deactivate slot" });
        }
      } catch (error) {
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

  app.patch(
    "/api/appointments/:id/confirm",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const existingAppointment = await storage.getAppointment(req.params.id);
        if (!existingAppointment) {
          return res.status(404).json({ error: "Appointment not found" });
        }

        const profile = await storage.getDoctorProfileByUserId(req.user!.id);

        if (!profile || existingAppointment.doctorId !== profile.id) {
          return res.status(403).json({ error: "Forbidden: You can only confirm your own appointments." });
        }

        const appointment = await storage.updateAppointment(req.params.id, {
          status: AppointmentStatus.CONFIRMED,
        });

        if (appointment) {
          const doctorUser = await storage.getUser(profile.userId);
          const doctorName = doctorUser?.fullName || "your doctor";
          const [yr, mo, dy] = appointment.appointmentDate.split("-");
          const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];
          const formattedDate = `${parseInt(dy)} ${months[parseInt(mo) - 1]}`;

          await storage.createNotification({
            userId: appointment.patientId,
            title: "Appointment Confirmed",
            message: `Your appointment with Dr. ${doctorName} for ${formattedDate} at ${appointment.appointmentTime} has been confirmed.`,
            type: "appointment",
            isRead: false,
            relatedId: appointment.id,
          });
        }

        res.json(appointment);
      } catch (error) {
        res.status(500).json({ error: "Failed to confirm appointment" });
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
            [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
              a.status as any,
            ),
          ),
          upcomingAppointments: upcomingAppointments
            .filter(
              (a) =>
                a.appointmentDate >= today &&
                [
                  AppointmentStatus.PENDING,
                  AppointmentStatus.CONFIRMED,
                ].includes(a.status as any),
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

        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to reschedule appointment" });
      }
    },
  );

  app.patch(
    "/api/appointments/:id/cancel",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {

        if (req.user!.role === UserRole.PATIENT) {
          return res.status(403).json({ error: "Patients are not allowed to cancel appointments directly." });
        }

        const { reason } = req.body;
        const existing = await storage.getAppointment(req.params.id);

        if (!existing) {
          return res.status(404).json({ error: "Appointment not found" });
        }
        
        const cancellableStatuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
        if (!cancellableStatuses.includes(existing.status as AppointmentStatus)) {
          return res.status(400).json({
            error: `Cannot cancel an appointment with status: ${existing.status}`,
          });
        }

        const appointment = await storage.cancelAppointment(
          req.params.id,
          reason,
          req.user!.role,
        );

        if (appointment && existing) {
          const doctorProfile = await storage.getDoctorProfile(
            existing.doctorId,
          );

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
          const patientName = patientUser?.fullName || "A patient";
          const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];
          const [, mo, dy] = existing.appointmentDate.split("-");
          const formattedDate = `${parseInt(dy)} ${months[parseInt(mo) - 1]}`;
          const formattedTime = existing.appointmentTime;

          // Notify patient
          await storage.createNotification({
            userId: existing.patientId,
            title: "Appointment cancelled",
            message: `Your ${formattedDate} at ${formattedTime} appointment with Dr. ${doctorName} has been cancelled. You may rebook at your convenience.`,
            type: "appointment",
            isRead: false,
            relatedId: appointment.id,
          });

          // Notify doctor
          if (doctorProfile) {
            await storage.createNotification({
              userId: doctorProfile.userId,
              title: "Appointment Cancellation Notice",
              message: `${patientName} has cancelled their ${formattedDate} at ${formattedTime} appointment.`,
              type: "appointment",
              isRead: false,
              relatedId: appointment.id,
            });
          }
        }

        res.json(appointment);
      } catch (error) {
        res.status(500).json({ error: "Failed to cancel appointment" });
      }
    },
  );

  app.patch(
    "/api/payments/:id/fail",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
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

        res.json(updated);
      } catch (error) {
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
        res.status(500).json({ error: "Failed to get earnings" });
      }
    },
  );

  app.post(
    "/api/doctor/earnings/settle",
    authMiddleware,
    roleMiddleware(UserRole.DOCTOR),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const profile = await storage.getDoctorProfileByUserId(req.user!.id);
        if (!profile) {
          return res.status(404).json({ error: "Doctor profile not found" });
        }

        const unsettled = await storage.getDoctorUnsettledCharges(profile.id);
        if (unsettled.totalOwed === 0) {
          return res.json({ settled: true, amountDeducted: 0 });
        }

        await storage.settleDoctorCharges(profile.id);
        res.json({ settled: true, amountDeducted: unsettled.totalOwed });
      } catch (error) {
        res.status(500).json({ error: "Failed to settle charges" });
      }
    },
  );

  app.patch(
    "/api/doctor/appointments/:id/no-show",
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

        const updated = await storage.markAppointmentNoShow(req.params.id);
        res.json(updated);
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to mark appointment as no-show" });
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
      try {
        const { consultationNotes } = req.body;
        const appointment = await storage.updateAppointment(req.params.id, {
          status: AppointmentStatus.COMPLETED,
          consultationNotes,
        });

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

        res.json(appointment);
      } catch (error) {
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
        const allPayments = await storage.getPatientPayments(patientId);

        const today = new Date().toISOString().split("T")[0];

        // --- Calculate Stats ---
        const upcomingList = allAppointments.filter(a => a.appointmentDate >= today && [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(a.status as any));
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

        const doctorsList = allNeededDoctorIds.length > 0 
          ? await storage.getDoctorsWithDetailsByIds(allNeededDoctorIds) 
          : [];

        const doctorMap = new Map(doctorsList.map(doc => [doc.id, doc]));

        // --- My Doctors ---
        const myDoctors = myDoctorIds.map(id => doctorMap.get(id)).filter(Boolean);

        // --- Recent Transactions ---
        const recentTransactions = recentPayments.map(p => {
           const appointment = allAppointments.find(a => a.id === p.appointmentId);
           const doctor = appointment ? doctorMap.get(appointment.doctorId) : null;
           
           return {
             ...p,
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
          await storage.createNotification({
            userId: doctor.userId,
            title: "Account Verified",
            message:
              "Congratulations! Your doctor account has been verified. You can now accept appointments.",
            type: "verification",
          });
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
      try {
        const { refundAmount, refundReason } = req.body;
        
        const payment = await storage.getPayment(req.params.id);
        if (!payment) {
          return res.status(404).json({ error: "Payment not found" });
        }

        if (refundAmount !== undefined && refundAmount > payment.totalAmount) {
          return res.status(400).json({ error: "Refund amount cannot exceed the original payment amount" });
        }

        const updatedPayment = await storage.updatePayment(req.params.id, {
          status: PaymentStatus.REFUNDED,
          refundAmount,
          refundReason,
          refundDate: new Date().toISOString().split("T")[0],
        });
        res.json(updatedPayment);
      } catch (error) {
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

        for (const doctor of pendingDoctors) {
          const createdAt = new Date(doctor.createdAt).getTime();
          if (now - createdAt < threshold) continue;

          const daysOverdue = Math.floor(
            (now - createdAt) / (24 * 60 * 60 * 1000),
          );
          const expectedTitle = `Verification pending — ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} overdue`;

          const existingNotifs = await storage.getUserNotifications(
            req.user!.id,
          );
          const last24h = now - 24 * 60 * 60 * 1000;

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

        console.log("Settings updated successfully:", settings);

        res.json(settings);
      } catch (error) {
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
    try {
      const { title, rate } = req.body;
      if (!title?.trim() || rate === undefined) return res.status(400).json({ error: "Title and rate are required" });
      const entry = await storage.createTaxEntry(title.trim(), Number(rate));
      res.status(201).json(entry);
    } catch { res.status(500).json({ error: "Failed to create tax entry" }); }
  });

  app.delete("/api/admin/tax-entries/:id", authMiddleware, roleMiddleware(UserRole.ADMIN), async (req: Request, res: Response) => {
    try {
      await storage.deleteTaxEntry(req.params.id);
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Failed to delete tax entry" }); }
  });

  // Payout Dashboard
  app.get(
    "/api/admin/payouts",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (_req: Request, res: Response) => {
      try {
        const [settings, doctors] = await Promise.all([
          storage.getPlatformSettings(),
          storage.getVerifiedDoctors(),
        ]);

        const commissionRate = settings.platformCommissionRate / 100;
        const totalTaxRate =
          (settings.vatEnabled ? 0.18 : 0) +
          (settings.withholdingTaxEnabled ? 0.05 : 0);
        const vatEnabled = settings.vatEnabled ?? true;
        const withholdingTaxEnabled = settings.withholdingTaxEnabled ?? true;
        const stampDutyEnabled = settings.stampDutyEnabled ?? false;

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // Last Friday of current month
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysBack = (lastDay.getDay() + 2) % 7;
        const lastFriday = new Date(lastDay);
        lastFriday.setDate(lastDay.getDate() - daysBack);

        const doctorPayouts = [];

        for (const doctor of doctors) {
          const [paymentsResult, apptResult, chargesResult] = await Promise.all([
            pool.query(
              `SELECT consultation_fee, platform_commission, doctor_earnings
               FROM payments WHERE doctor_id = $1 AND status = 'completed'
               AND created_at >= $2 AND created_at < $3`,
              [doctor.id, thisMonthStart, nextMonthStart]
            ),
            pool.query(
              `SELECT status, cancelled_by FROM appointments
               WHERE doctor_id = $1 AND created_at >= $2 AND created_at < $3`,
              [doctor.id, thisMonthStart, nextMonthStart]
            ),
            pool.query(
              `SELECT amount_owed FROM doctor_cancellation_charges
               WHERE doctor_id = $1 AND settled = false`,
              [doctor.id]
            ),
          ]);

          const earnAmount = paymentsResult.rows.reduce((sum: number, p: any) => sum + (p.consultation_fee || 0), 0);
          const platformFees = Math.round(earnAmount * commissionRate);
          const totalAppts = apptResult.rows.length;
          const completedAppts = apptResult.rows.filter((a: any) => a.status === "completed").length;
          const cancellationRate = totalAppts > 0 ? Math.round(((totalAppts - completedAppts) / totalAppts) * 100) : 0;
          const cancellationFees = chargesResult.rows.reduce((sum: number, c: any) => sum + (c.amount_owed || 0), 0);
          const applicableTax = Math.round(earnAmount * totalTaxRate);
          const payoutAmount = Math.max(0, earnAmount - platformFees - cancellationFees - applicableTax);

          const vatAmount = vatEnabled ? Math.round(earnAmount * 0.18) : 0;
          const withholdingAmount = withholdingTaxEnabled ? Math.round(earnAmount * 0.05) : 0;
          const stampDutyAmount = stampDutyEnabled ? Math.round(earnAmount * 0.01) : 0;

          doctorPayouts.push({
            doctorId: doctor.id,
            doctorName: doctor.user.fullName,
            registrationNumber: doctor.registrationNumber,
            bankName: doctor.bankName || null,
            bankAccountNumber: doctor.bankAccountNumber || null,
            earnAmount,
            completedSessions: completedAppts,
            totalSessions: totalAppts,
            platformFees,
            platformCommissionRate: settings.platformCommissionRate,
            cancellationRate,
            cancellationFees,
            applicableTax,
            vatEnabled,
            withholdingTaxEnabled,
            stampDutyEnabled,
            vatAmount,
            withholdingAmount,
            stampDutyAmount,
            payoutAmount,
          });
        }

        const pendingPayouts = doctorPayouts.filter(d => d.payoutAmount > 0);

        const lastMonthResult = await pool.query(
          `SELECT COALESCE(SUM(doctor_earnings), 0) as total, COUNT(*) as count
           FROM payments WHERE status = 'completed'
           AND created_at >= $1 AND created_at < $2`,
          [lastMonthStart, thisMonthStart]
        );

        res.json({
          doctors: doctorPayouts,
          stats: {
            pendingPayoutsCount: pendingPayouts.length,
            totalOutstanding: pendingPayouts.reduce((sum, d) => sum + d.payoutAmount, 0),
            completedLastMonthAmount: parseInt(lastMonthResult.rows[0]?.total || "0"),
            completedLastMonthCount: parseInt(lastMonthResult.rows[0]?.count || "0"),
            nextPayoutDate: lastFriday.toISOString(),
          },
        });
      } catch (error) {
        console.error("Failed to get payout data:", error);
        res.status(500).json({ error: "Failed to get payout data" });
      }
    }
  );

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
          return res.status(400).json({ error: "Please enter a valid Sri Lankan mobile number (07XXXXXXXX)" });
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
      try {
        if (!req.file) {
          return res.status(400).json({ error: "CV file is required" });
        }
        // Cloudinary එකෙන් එන URL එක
        const cvUrl = req.file.path;
        const { jobId, jobTitle, fullName, email } = req.body;
        if (!jobId || !jobTitle || !fullName || !email) {
          return res.status(400).json({ error: "Missing required fields" });
        }
        const applicationData = {
          jobId,
          jobTitle,
          fullName,
          email,
          cvUrl,
        };
        const savedApplication =
          await storage.createJobApplication(applicationData);
        res.status(201).json(savedApplication);
      } catch (error) {
        console.error("Career application error:", error);
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
      try {
        const data = insertCareerSchema.parse(req.body);
        const newCareer = await storage.createCareer(data);

        console.log("Career Saved:", newCareer.careerTitle);
        res.status(201).json(newCareer);
      } catch (error) {
        console.error("Create career error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
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
      try {
        const careerId = req.params.id;
        const data = insertCareerSchema.partial().parse(req.body);
        const updatedCareer = await storage.updateCareer(careerId, data);

        if (!updatedCareer) {
          return res.status(404).json({ error: "Career not found" });
        }

        res.json(updatedCareer);
      } catch (error) {
        console.error("Update career error:", error);
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
      try {
        const careerId = req.params.id;

        const updatedCareer = await storage.updateCareer(careerId, {
          isActive: false,
        });

        if (!updatedCareer) {
          return res.status(404).json({ error: "Career not found" });
        }

        res.json({ message: "Career deactivated successfully" });
      } catch (error) {
        console.error("Deactivate career error:", error);
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
      try {
        const { status, message } = req.body;
        const applicationId = req.params.id;

        if (!status || !["ACCEPTED", "REJECTED"].includes(status)) {
          return res.status(400).json({ error: "Invalid status" });
        }

        // 1. Database Status Update
        const updatedApplication = await storage.updateApplicationStatus(
          applicationId,
          status,
        );

        if (!updatedApplication) {
          return res.status(404).json({ error: "Application not found" });
        }

        // 2. Email send (මෙතන තමයි අපි Result එක අල්ලගන්නේ)
        const emailResult = await sendApplicationEmail(
          updatedApplication.email,
          updatedApplication.fullName,
          updatedApplication.jobTitle,
          status as "ACCEPTED" | "REJECTED",
          message || "No additional comments provided.",
        );

        // 🟢 Frontend එකට emailSuccess එකයි emailError එකයි යවනවා
        res.json({
          ...updatedApplication,
          emailSuccess: emailResult.success,
          emailError: emailResult.error
        });

      } catch (error) {
        console.error("Failed to update application status:", error);
        res.status(500).json({ error: "Failed to update application status" });
      }
    },
  );

  // Forgot Password: Send OTP to email (unauthenticated)
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      
      if (user && user.provider && user.provider !== AuthProvider.LOCAL) {
         const providerName = user.provider.charAt(0).toUpperCase() + user.provider.slice(1);
         return res.status(400).json({ 
           error: `Your account is linked with ${providerName}. Please use "Continue with ${providerName}" to log in. Password reset is not required.` 
         });
      }

      if (!user) {
        return res.json({ message: "If that email is registered, an OTP has been sent." });
      }

      const otp = randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);

      await storage.setPasswordResetOtp(user.id, otp, expiry);
      await sendPasswordResetOtpEmail(user.email, otp);

      res.json({ message: "If that email is registered, an OTP has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Add password strength validation to unauthenticated password reset route
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
      if (!user) {
        return res.status(400).json({ error: "Invalid OTP or email" });
      }

      const isValid = await storage.verifyPasswordResetOtp(user.id, otp);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // 1. Send OTP to Email
  app.post("/api/users/send-password-otp", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const otp = randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      await storage.setPasswordResetOtp(req.user!.id, otp, expiry);

      const emailResult = await sendPasswordResetOtpEmail(req.user!.email, otp);

      if (!emailResult.success) {
        throw new Error("Failed to send email via Nodemailer");
      }

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("❌ OTP Send Error:", error);
      res.status(500).json({ error: "Failed to send OTP email" });
    }
  });

  // 2. Verify OTP and Reset Password
  app.post(
    "/api/users/reset-password-with-otp", 
    authMiddleware, 
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { otp, newPassword } = req.body;

        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.valid) {
          return res.status(400).json({
            error: "Password does not meet security requirements",
            details: passwordValidation.errors,
          });
        }

        const isValid = await storage.verifyPasswordResetOtp(req.user!.id, otp);
        if (!isValid) {
          return res.status(400).json({ error: "Invalid or expired OTP." });
        }

        const hashedPassword = await hashPassword(newPassword);
        await storage.updateUser(req.user!.id, { password: hashedPassword });

        res.json({ message: "Password updated successfully" });
      } catch (error) {
        res.status(500).json({ error: "Failed to reset password" });
      }
    }
  );

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
    "/api/admin/refund-requests",
    authMiddleware,
    roleMiddleware(UserRole.ADMIN),
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await storage.getPaginatedRefundRequests(page, limit);
        res.json(result);
      } catch (error) {
        console.error(error);
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
        const { status } = req.body; // 'completed' or 'rejected'
        const updatedRefund = await storage.processRefund(req.params.id, status);
        res.json(updatedRefund);
      } catch (error) {
        res.status(500).json({ error: "Failed to process refund" });
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
      console.log("\n[PAYHERE WEBHOOK] 📥 Received notification:", req.body);
      
      try {
        const {
          merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig
        } = req.body;

        const merchant_secret = process.env.PAYHERE_SECRET;
        
        // 1. Verify the signature
        const hashedSecret = createHash('md5').update(merchant_secret!).digest('hex').toUpperCase();
        const hashString = merchant_id + order_id + payhere_amount + payhere_currency + status_code + hashedSecret;
        const generatedSig = createHash('md5').update(hashString).digest('hex').toUpperCase();

        if (generatedSig !== md5sig) {
          console.error("[PAYHERE WEBHOOK] ❌ Security Alert: Invalid Signature!");
          return res.status(400).send("Invalid Signature");
        }

        console.log(`[PAYHERE WEBHOOK] ✅ Signature Valid. Status Code: ${status_code}`);

        const appointmentId = order_id.replace('booking-', '');

        if (status_code === "2") {
          console.log(`[PAYHERE WEBHOOK] 💰 Payment Success for Appointment: ${appointmentId}`);
          
          // Payment record
          const payment = await storage.getPaymentByAppointment(appointmentId);
          
          if (payment) {
            // 1. Payment status එක 'COMPLETED'
            await storage.updatePayment(payment.id, { status: PaymentStatus.COMPLETED });
            
            // 2. Appointment status එක 'CONFIRMED'
            await storage.updateAppointment(appointmentId, { status: AppointmentStatus.CONFIRMED });
            
            // 3. Slot එක 'is_booked = true'
            await pool.query(
              `UPDATE appointment_slots SET is_booked = true WHERE id = $1`,
              [(payment as any).slotId]
            );
            
            console.log(`[PAYHERE WEBHOOK] ✅ DB Updated & Slot Locked Successfully.`);
            
            // Send Success Notifications
            const appt = await storage.getAppointment(appointmentId);
            if(appt){
              const docProfile = await storage.getDoctorProfile(appt.doctorId);
              const slot = await storage.getAppointmentSlot(appt.slotId);
              if(docProfile && slot) {
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

                  console.log(`[PAYHERE WEBHOOK] 📧 Triggering Resend Emails...`);

                  await sendPatientBookingReceiptEmail(
                    ptUser.email,
                    ptUser.fullName,
                    docUser.fullName,
                    slot.date as unknown as string,
                    slot.startTime,
                    payment.totalAmount,
                    slot.consultationType,
                    slot.meetLink || "unavailable for online consultations without video, please check your notifications for details",
                    "online"
                  );

                  await sendDoctorNewBookingEmail(
                    docUser.email,
                    docUser.fullName,
                    ptUser.fullName,
                    appt.symptoms,
                    slot.date as unknown as string,
                    slot.startTime,
                    slot.consultationType,
                    slot.meetLink || "unavailable for online consultations without video, please check your notifications for details"
                  ); 
                  console.log(`[PAYHERE WEBHOOK] ✅ Email sending process completed.`);
                }
              }
            }
          } else {
             console.error(`[PAYHERE WEBHOOK] ❌ Payment record not found for Appointment: ${appointmentId}`);
          }
        } else if (status_code === "-2" || status_code === "-1" || status_code === "0") {
          // Canceled or Failed Payment
          console.log(`[PAYHERE WEBHOOK] ⚠️ Payment Failed/Canceled for Appointment: ${appointmentId}`);
          const payment = await storage.getPaymentByAppointment(appointmentId);
          if (payment) {
            await storage.updatePayment(payment.id, { status: PaymentStatus.FAILED });
            await storage.updateAppointment(appointmentId, { 
                status: AppointmentStatus.CANCELLED, 
                cancelReason: "Payment Failed or Canceled by User" 
            });
            await pool.query(
              `UPDATE appointment_slots SET is_booked = false WHERE id = $1`,
              [(payment as any).slotId]
            );
          }
        }
        
        res.status(200).send("OK");
      } catch (error) {
        console.error("[PAYHERE WEBHOOK] ❌ Processing error:", error);
        res.status(500).send("Internal Server Error");
      }
    }
  );

  //  =========================================
  // EXPLICIT FAIL ROUTE
  // ==========================================
  app.patch(
    "/api/appointments/:id/payment-failed",
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
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
          await storage.updatePayment(payment.id, { status: PaymentStatus.FAILED });
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

        res.json({ success: true, message: "Slot released successfully" });
      } catch (error) {
        console.error("Payment Fail Error:", error);
        res.status(500).json({ error: "Failed to release slot" });
      }
    }
  );

  // ==========================================
  // BACKGROUND CLEANUP JOB (INDUSTRY STANDARD)
  // ==========================================
  // setInterval(async () => {
  //   try {
  //     const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      
  //     const query = `
  //       SELECT id, slot_id 
  //       FROM appointments 
  //       WHERE status = 'pending' AND created_at < $1
  //     `;
  //     const result = await pool.query(query, [fifteenMinsAgo]);
      
  //     if (result.rows.length > 0) {
  //       console.log(`[CLEANUP JOB] Found ${result.rows.length} abandoned appointments. Releasing slots...`);
        
  //       for (const row of result.rows) {
  //         // 1. Appointment cancelled
  //         await pool.query(
  //           `UPDATE appointments SET status = 'cancelled', cancel_reason = 'Payment Timeout (Auto Cancelled)' WHERE id = $1`, 
  //           [row.id]
  //         );
          
  //         // 2. Payment faied
  //         await pool.query(
  //           `UPDATE payments SET status = 'failed' WHERE appointment_id = $1`, 
  //           [row.id]
  //         );
          
  //         // 3. Slot free
  //         await pool.query(
  //           `UPDATE appointment_slots SET is_booked = false WHERE id = $1`, 
  //           [row.slot_id]
  //         );
          
  //         console.log(`[CLEANUP JOB] Successfully released appointment: ${row.id} and slot: ${row.slot_id}`);
  //       }
  //     }
  //   } catch (err) {
  //     console.error("[CLEANUP JOB ERROR]:", err);
  //   }
  // }, 5 * 60 * 1000); // 5 * 60 * 1000 = 5 minutes

  return httpServer;
}