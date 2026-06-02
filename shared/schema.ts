import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  varchar,
  date,
  time,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ================== ENUMS ==================
export const UserRole = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  ADMIN: "admin",
} as const;

export const DoctorStatus = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
} as const;

export const AppointmentStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

export const PaymentStatus = {
  PENDING: "pending",
  COMPLETED: "completed",
  REFUNDED: "refunded",
  FAILED: "failed",
  UNPAID: "unpaid",
} as const;

export const PaymentMethod = {
  ONLINE: "online",
  AT_CLINIC: "at_clinic",
} as const;

export const ConsultationType = {
  IN_PERSON: "in_person",
  ONLINE: "online",
  HOME_VISIT: "home_visit",
} as const;

export const DayOfWeek = {
  SUNDAY: "sunday",
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
} as const;

export const Gender = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
} as const;

export const Language = {
  ENGLISH: "english",
  SINHALA: "sinhala",
  TAMIL: "tamil",
} as const;

export const AuthProvider = {
  LOCAL: "local",
  GOOGLE: "google",
  APPLE: "apple",
} as const;

// ================== DRIZZLE TABLES ==================

export const users = pgTable("users", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("patient"),
  nic: varchar("nic", { length: 20 }),
  gender: varchar("gender", { length: 10 }),
  dateOfBirth: varchar("date_of_birth", { length: 10 }),
  preferredLanguages: text("preferred_languages")
    .array()
    .default(sql`ARRAY['english']::text[]`),
  profileImage: text("profile_image"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  isEmailVerified: boolean("is_email_verified").default(false),
  isPhoneVerified: boolean("is_phone_verified").default(false),
  isActive: boolean("is_active").default(true),
  googleId: varchar("google_id", { length: 100 }),
  provider: varchar("provider", { length: 20 }).notNull().default("local"),
  providerId: varchar("provider_id", { length: 120 }),
  registrationComplete: boolean("registration_complete").default(true),
  resetPasswordOtp: varchar("reset_password_otp", { length: 10 }),
  resetPasswordOtpExpiry: timestamp("reset_password_otp_expiry"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const specializations = pgTable("specializations", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
});

export const hospitals = pgTable("hospitals", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address").notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  contactNumber: varchar("contact_number", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  latitude: real("latitude"),
  longitude: real("longitude"),
  parkingAvailable: boolean("parking_available").default(false),
  directions: text("directions"),
});

export const doctorProfiles = pgTable("doctor_profiles", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 50 })
    .notNull()
    .references(() => users.id),
  registrationNumber: varchar("registration_number", { length: 50 })
    .notNull()
    .unique(),
  qualifications: text("qualifications").notNull(),
  biography: text("biography"),
  specializationIds: text("specialization_ids")
    .array()
    .default(sql`ARRAY[]::text[]`),
  languagesSpoken: text("languages_spoken")
    .array()
    .default(sql`ARRAY['english']::text[]`),
  consultationTypes: text("consultation_types")
    .array()
    .default(sql`ARRAY['in_person']::text[]`),
  hospitalIds: text("hospital_ids")
    .array()
    .default(sql`ARRAY[]::text[]`),
  clinic_locations: text("clinic_locations").array().default(sql`ARRAY[]::text[]`),  consultationFee: integer("consultation_fee").notNull().default(0),
  onlineConsultationFee: integer("online_consultation_fee"),
  homeVisitFee: integer("home_visit_fee"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  verificationDocuments: text("verification_documents")
    .array()
    .default(sql`ARRAY[]::text[]`),
  bankName: varchar("bank_name", { length: 100 }),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }),
  bankBranch: varchar("bank_branch", { length: 100 }),
  isAvailable: boolean("is_available").default(true),
  maxAdvanceBookingDays: integer("max_advance_booking_days").default(30),
  minBookingNoticeHours: integer("min_booking_notice_hours").default(2),
  slotDurationMinutes: integer("slot_duration_minutes").default(30),
  bufferTimeMinutes: integer("buffer_time_minutes").default(10),
  averageRating: real("average_rating").default(0),
  totalReviews: integer("total_reviews").default(0),
  totalAppointments: integer("total_appointments").default(0),
  currentQueueNumber: integer("current_queue_number").default(0),
  qrCode: text("qr_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const doctorSchedules = pgTable("doctor_schedules", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 50 })
    .notNull()
    .references(() => doctorProfiles.id),
  hospitalId: varchar("hospital_id", { length: 50 }),
  dayOfWeek: varchar("day_of_week", { length: 10 }).notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  consultationType: varchar("consultation_type", { length: 20 }).notNull(),
  isActive: boolean("is_active").default(true),
});

export const appointmentSlots = pgTable("appointment_slots", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 50 })
    .notNull()
    .references(() => doctorProfiles.id),
  hospitalId: varchar("hospital_id", { length: 50 }),
  clinicLocation: text("clinic_location"),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  consultationType: varchar("consultation_type", { length: 20 }).notNull(),
  isBooked: boolean("is_booked").default(false),
  isBlocked: boolean("is_blocked").default(false),
  isActive: boolean("is_active").default(true),
  meetLink: varchar("meet_link", { length: 255 }),
});

export const appointments = pgTable("appointments", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id", { length: 50 })
    .notNull()
    .references(() => users.id),
  doctorId: varchar("doctor_id", { length: 50 })
    .notNull()
    .references(() => doctorProfiles.id),
  slotId: varchar("slot_id", { length: 50 })
    .notNull()
    .references(() => appointmentSlots.id),
  hospitalId: varchar("hospital_id", { length: 50 }),
  appointmentDate: date("appointment_date").notNull(),
  appointmentTime: time("appointment_time").notNull(),
  consultationType: varchar("consultation_type", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  symptoms: text("symptoms").notNull(),
  queueNumber: integer("queue_number"),
  isCalled: boolean("is_called").default(false),
  isForDependent: boolean("is_for_dependent").default(false),
  dependentName: varchar("dependent_name", { length: 255 }),
  dependentAge: integer("dependent_age"),
  dependentGender: varchar("dependent_gender", { length: 10 }),
  dependentContact: varchar("dependent_contact", { length: 20 }),
  consultationNotes: text("consultation_notes"),
  videoSessionId: varchar("video_session_id", { length: 100 }),
  cancelReason: text("cancel_reason"),
  cancelledBy: varchar("cancelled_by", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  patientIdx: index("appointment_patient_idx").on(table.patientId),
  doctorIdx: index("appointment_doctor_idx").on(table.doctorId),
  statusIdx: index("appointment_status_idx").on(table.status),
  dateIdx: index("appointment_date_idx").on(table.appointmentDate),
}));

export const payments = pgTable("payments", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id", { length: 50 })
    .notNull()
    .references(() => appointments.id),
  patientId: varchar("patient_id", { length: 50 })
    .notNull()
    .references(() => users.id),
  doctorId: varchar("doctor_id", { length: 50 })
    .notNull()
    .references(() => doctorProfiles.id),
  consultationFee: integer("consultation_fee").notNull(),
  bookingCharges: integer("booking_charges").default(0),
  tax: integer("tax").default(0),
  platformCommission: integer("platform_commission").default(0),
  doctorEarnings: integer("doctor_earnings").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  method: varchar("method", { length: 20 }).notNull(),
  transactionId: varchar("transaction_id", { length: 100 }),
  refundAmount: integer("refund_amount"),
  refundReason: text("refund_reason"),
  refundDate: varchar("refund_date", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  aptIdx: index("payment_apt_idx").on(table.appointmentId),
  patientIdx: index("payment_patient_idx").on(table.patientId),
  doctorIdx: index("payment_doctor_idx").on(table.doctorId),
  statusIdx: index("payment_status_idx").on(table.status),
}));

export const prescriptions = pgTable("prescriptions", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id", { length: 50 })
    .notNull()
    .references(() => appointments.id),
  patientId: varchar("patient_id", { length: 50 })
    .notNull()
    .references(() => users.id),
  doctorId: varchar("doctor_id", { length: 50 })
    .notNull()
    .references(() => doctorProfiles.id),
  diagnosis: text("diagnosis").notNull(),
  medications: jsonb("medications")
    .notNull()
    .default(sql`'[]'::jsonb`),
  treatments: text("treatments")
    .array()
    .default(sql`ARRAY[]::text[]`),
  dietaryAdvice: text("dietary_advice"),
  lifestyleAdvice: text("lifestyle_advice"),
  followUpDate: varchar("follow_up_date", { length: 10 }),
  additionalNotes: text("additional_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  appointmentId: varchar("appointment_id", { length: 50 })
    .notNull()
    .references(() => appointments.id)
    .unique(),
  patientId: varchar("patient_id", { length: 50 })
    .notNull()
    .references(() => users.id),
  doctorId: varchar("doctor_id", { length: 50 })
    .notNull()
    .references(() => doctorProfiles.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  doctorResponse: text("doctor_response"),
  doctorRespondedAt: timestamp("doctor_responded_at"),
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationTypeEnum = pgEnum("notification_type", [
  "appointment",
  "payment",
  "reminder",
  "system",
  "verification",
]);

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 50 })
    .notNull()
    .references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull(),
  isRead: boolean("is_read").default(false),
  relatedId: varchar("related_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blogSubmissions = pgTable("blog_submissions", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  featuredImage: text("featured_image"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  submittedById: varchar("submitted_by_id", { length: 50 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  submittedByName: varchar("submitted_by_name", { length: 255 }).notNull(),
  submittedByEmail: varchar("submitted_by_email", { length: 255 }).notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBlogSubmissionSchema = createInsertSchema(
  blogSubmissions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  rejectionReason: true,
});
export type BlogSubmission = typeof blogSubmissions.$inferSelect;
export type InsertBlogSubmission = z.infer<typeof insertBlogSubmissionSchema>;

export const doctorCancellationCharges = pgTable("doctor_cancellation_charges", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 50 })
    .notNull()
    .references(() => doctorProfiles.id),
  appointmentId: varchar("appointment_id", { length: 50 })
    .notNull()
    .references(() => appointments.id),
  consultationFee: integer("consultation_fee").notNull(),
  amountOwed: integer("amount_owed").notNull(),
  settled: boolean("settled").default(false),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDoctorCancellationChargeSchemaDb = createInsertSchema(
  doctorCancellationCharges,
).omit({ id: true, createdAt: true });

export type DoctorCancellationCharge = typeof doctorCancellationCharges.$inferSelect;
export type InsertDoctorCancellationCharge = z.infer<typeof insertDoctorCancellationChargeSchemaDb>;

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`'default'`),
  platformCommissionRate: integer("platform_commission_rate")
    .notNull()
    .default(10),
  bookingCharges: integer("booking_charges").notNull().default(100),
  taxRate: integer("tax_rate").notNull().default(5),
  maxAdvanceBookingDays: integer("max_advance_booking_days")
    .notNull()
    .default(30),
  minBookingNoticeHours: integer("min_booking_notice_hours")
    .notNull()
    .default(2),
  defaultSlotDuration: integer("default_slot_duration").notNull().default(30),
  defaultBufferTime: integer("default_buffer_time").notNull().default(10),
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(false),
  autoConfirmAppointments: boolean("auto_confirm_appointments").default(false),
  requireDoctorVerification: boolean("require_doctor_verification").default(
    true,
  ),
  allowOnlinePayments: boolean("allow_online_payments").default(true),
  allowClinicPayments: boolean("allow_clinic_payments").default(false),
  defaultLanguage: varchar("default_language", { length: 20 }).default(
    "english",
  ),
  maintenanceMode: boolean("maintenance_mode").default(false),
  cancellationFee: integer("cancellation_fee").notNull().default(300),
  stampDutyEnabled: boolean("stamp_duty_enabled").default(false),
  vatEnabled: boolean("vat_enabled").default(true),
  withholdingTaxEnabled: boolean("withholding_tax_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ================== DRIZZLE INSERT SCHEMAS ==================

export const insertUserSchemaDb = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSpecializationSchemaDb = createInsertSchema(
  specializations,
).omit({
  id: true,
});

export const insertHospitalSchemaDb = createInsertSchema(hospitals).omit({
  id: true,
});

export const insertDoctorProfileSchemaDb = createInsertSchema(
  doctorProfiles,
).omit({
  id: true,
  averageRating: true,
  totalReviews: true,
  totalAppointments: true,
  currentQueueNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDoctorScheduleSchemaDb = createInsertSchema(
  doctorSchedules,
).omit({
  id: true,
});

export const insertAppointmentSlotSchemaDb = createInsertSchema(
  appointmentSlots,
).omit({
  id: true,
});

export const insertAppointmentSchemaDb = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPaymentSchemaDb = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPrescriptionSchemaDb = createInsertSchema(
  prescriptions,
).omit({
  id: true,
  createdAt: true,
});

export const insertReviewSchemaDb = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchemaDb = createInsertSchema(
  notifications,
).omit({
  id: true,
  createdAt: true,
});

export const insertPlatformSettingsSchemaDb = createInsertSchema(
  platformSettings,
).omit({
  updatedAt: true,
});

// ================== ZOD VALIDATION SCHEMAS (for API) ==================

export const insertUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Password must contain at least one special character"),
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().regex(/^07[0-9]{8}$/, "Please enter a valid Sri Lankan mobile number (07XXXXXXXX)"),
  role: z.enum([UserRole.PATIENT, UserRole.DOCTOR]),
  nic: z.string().optional(),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional(),
  dateOfBirth: z.string().optional(),
  preferredLanguages: z
    .array(z.enum([Language.ENGLISH, Language.SINHALA, Language.TAMIL]))
    .default([Language.ENGLISH]),
  profileImage: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  isEmailVerified: z.boolean().default(false),
  isPhoneVerified: z.boolean().default(false),
  isActive: z.boolean().default(true),
  googleId: z.string().optional(),
  provider: z
    .enum([AuthProvider.LOCAL, AuthProvider.GOOGLE, AuthProvider.APPLE])
    .default(AuthProvider.LOCAL),
  providerId: z.string().optional(),
  registrationComplete: z.boolean().default(true),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export interface User extends InsertUser {
  id: string;
  createdAt: string;
  updatedAt: string;
  resetPasswordOtp?: string | null;
  resetPasswordOtpExpiry?: string | null;
}

export type SafeUser = Omit<User, "password" | "resetPasswordOtp" | "resetPasswordOtpExpiry">;

export const insertSpecializationSchema = z.object({
  name: z.string().min(2, "Specialization name required"),
  description: z.string().optional(),
  icon: z.string().optional(),
});

export type InsertSpecialization = z.infer<typeof insertSpecializationSchema>;

export interface Specialization extends InsertSpecialization {
  id: string;
}

export const insertHospitalSchema = z.object({
  name: z.string().min(2, "Hospital name required"),
  address: z.string().min(5, "Address required"),
  city: z.string().min(2, "City required"),
  contactNumber: z.string().min(10, "Contact number required"),
  email: z.string().email().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  parkingAvailable: z.boolean().default(false),
  directions: z.string().optional(),
});

export type InsertHospital = z.infer<typeof insertHospitalSchema>;

export interface Hospital extends InsertHospital {
  id: string;
}

export const insertDoctorProfileSchema = z.object({
  userId: z.string(),
  registrationNumber: z.string().min(5, "Registration number required"),
  qualifications: z.string().min(10, "Qualifications required"),
  biography: z.string().optional(),
  specializationIds: z
    .array(z.string())
    .min(1, "At least one specialization required"),
  languagesSpoken: z
    .array(z.enum([Language.ENGLISH, Language.SINHALA, Language.TAMIL]))
    .min(1, "At least one language required"),
  consultationTypes: z
    .array(
      z.enum([
        ConsultationType.IN_PERSON,
        ConsultationType.ONLINE,
        ConsultationType.HOME_VISIT,
      ]),
    )
    .min(1),
  clinic_locations: z.array(z.string()).default([]),
  hospitalIds: z.array(z.string()).default([]),
  consultationFee: z.number().min(0, "Fee must be positive"),
  onlineConsultationFee: z.number().min(0).optional(),
  homeVisitFee: z.number().min(0).optional(),
  status: z
    .enum([
      DoctorStatus.PENDING,
      DoctorStatus.VERIFIED,
      DoctorStatus.REJECTED,
      DoctorStatus.SUSPENDED,
    ])
    .default(DoctorStatus.PENDING),
  verificationDocuments: z.array(z.string()).default([]),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankBranch: z.string().optional(),
  isAvailable: z.boolean().default(true),
  maxAdvanceBookingDays: z.number().default(30),
  minBookingNoticeHours: z.number().default(2),
  slotDurationMinutes: z.number().default(30),
  bufferTimeMinutes: z.number().default(10),
  qrCode: z.string().optional(),
});

export type InsertDoctorProfile = z.infer<typeof insertDoctorProfileSchema>;

export interface DoctorProfile extends InsertDoctorProfile {
  id: string;
  averageRating: number;
  totalReviews: number;
  totalAppointments: number;
  currentQueueNumber: number;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorWithDetails extends DoctorProfile {
  user: SafeUser;
  specializations: Specialization[];
  hospitals: Hospital[];
}

export const insertDoctorScheduleSchema = z.object({
  doctorId: z.string(),
  hospitalId: z.string().optional(),
  dayOfWeek: z.enum([
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
  ]),
  startTime: z.string(),
  endTime: z.string(),
  consultationType: z.enum([
    ConsultationType.IN_PERSON,
    ConsultationType.ONLINE,
    ConsultationType.HOME_VISIT,
  ]),
  isActive: z.boolean().default(true),
});

export type InsertDoctorSchedule = z.infer<typeof insertDoctorScheduleSchema>;

export interface DoctorSchedule extends InsertDoctorSchedule {
  id: string;
}

export const insertAppointmentSlotSchema = z.object({
  doctorId: z.string(),
  hospitalId: z.string().optional(),
  clinicLocation: z.string().optional(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  consultationType: z.enum([
    ConsultationType.IN_PERSON,
    ConsultationType.ONLINE,
    ConsultationType.HOME_VISIT,
  ]),
  isBooked: z.boolean().default(false),
  isBlocked: z.boolean().default(false),
  isActive: z.boolean().default(true),
  meetLink: z.string().optional(),
});

export type InsertAppointmentSlot = z.infer<typeof insertAppointmentSlotSchema>;

export interface AppointmentSlot extends InsertAppointmentSlot {
  id: string;
}

export const insertAppointmentSchema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  slotId: z.string(),
  hospitalId: z.string().optional(),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  consultationType: z.enum([
    ConsultationType.IN_PERSON,
    ConsultationType.ONLINE,
    ConsultationType.HOME_VISIT,
  ]),
  status: z
    .enum([
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ])
    .default(AppointmentStatus.PENDING),
  symptoms: z.string().min(10, "Please describe your symptoms"),
  queueNumber: z.number().optional(),
  isCalled: z.boolean().default(false),
  isForDependent: z.boolean().default(false),
  dependentName: z.string().optional(),
  dependentAge: z.number().optional(),
  dependentGender: z
    .enum([Gender.MALE, Gender.FEMALE, Gender.OTHER])
    .optional(),
  dependentContact: z.string().optional(),
  consultationNotes: z.string().optional(),
  videoSessionId: z.string().optional(),
  cancelReason: z.string().optional(),
  cancelledBy: z
    .enum([UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN])
    .optional(),
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export interface Appointment extends InsertAppointment {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentWithDetails extends Appointment {
  patient: SafeUser;
  doctor: DoctorWithDetails;
  slot: AppointmentSlot;
  hospital?: Hospital;
  payment?: Payment;
  prescription?: Prescription;
  review?: Review;
}

export const insertPaymentSchema = z.object({
  appointmentId: z.string(),
  patientId: z.string(),
  doctorId: z.string(),
  consultationFee: z.number().min(0),
  bookingCharges: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  platformCommission: z.number().min(0).default(0),
  doctorEarnings: z.number().min(0),
  totalAmount: z.number().min(0),
  status: z
    .enum([
      PaymentStatus.PENDING,
      PaymentStatus.COMPLETED,
      PaymentStatus.REFUNDED,
      PaymentStatus.FAILED,
      PaymentStatus.UNPAID,
    ])
    .default(PaymentStatus.PENDING),
  method: z.enum([PaymentMethod.ONLINE, PaymentMethod.AT_CLINIC]),
  transactionId: z.string().optional(),
  refundAmount: z.number().optional(),
  refundReason: z.string().optional(),
  refundDate: z.string().optional(),
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export interface Payment extends InsertPayment {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const insertPrescriptionSchema = z.object({
  appointmentId: z.string(),
  patientId: z.string(),
  doctorId: z.string(),
  diagnosis: z.string(),
  medications: z.array(
    z.object({
      name: z.string(),
      dosage: z.string(),
      frequency: z.string(),
      duration: z.string(),
      instructions: z.string().optional(),
    }),
  ),
  treatments: z.array(z.string()).default([]),
  dietaryAdvice: z.string().optional(),
  lifestyleAdvice: z.string().optional(),
  followUpDate: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;

export interface Prescription extends InsertPrescription {
  id: string;
  createdAt: string;
}

export const insertReviewSchema = z.object({
  appointmentId: z.string(),
  patientId: z.string(),
  doctorId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  isHidden: z.boolean().default(false),
});

export type InsertReview = z.infer<typeof insertReviewSchema>;

export interface Review extends InsertReview {
  id: string;
  doctorResponse?: string;
  doctorRespondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewWithPatient extends Review {
  patient: SafeUser;
}

export interface ReviewWithDoctor extends Review {
  doctor: DoctorWithDetails;
}

export const insertNotificationSchema = z.object({
  userId: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.enum([
    "appointment",
    "payment",
    "reminder",
    "system",
    "verification",
  ]),
  isRead: z.boolean().default(false),
  relatedId: z.string().optional(),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export interface Notification extends InsertNotification {
  id: string;
  createdAt: string;
}

export const insertPlatformSettingsSchema = z.object({
  id: z.string().default("default"),
  platformCommissionRate: z.number().min(0).max(100).default(10),
  bookingCharges: z.number().min(0).default(100),
  taxRate: z.number().min(0).max(100).default(5),
  maxAdvanceBookingDays: z.number().min(1).default(30),
  minBookingNoticeHours: z.number().min(0).default(2),
  defaultSlotDuration: z.number().min(5).default(30),
  defaultBufferTime: z.number().min(0).default(10),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(false),
  autoConfirmAppointments: z.boolean().default(false),
  requireDoctorVerification: z.boolean().default(true),
  allowOnlinePayments: z.boolean().default(true),
  allowClinicPayments: z.boolean().default(false),
  defaultLanguage: z.string().default("english"),
  maintenanceMode: z.boolean().default(false),
  cancellationFee: z.number().min(0).default(300),
  stampDutyEnabled: z.boolean().default(false),
  vatEnabled: z.boolean().default(true),
  withholdingTaxEnabled: z.boolean().default(true),
});

export type InsertPlatformSettings = z.infer<
  typeof insertPlatformSettingsSchema
>;

export interface PlatformSettings extends InsertPlatformSettings {
  updatedAt: string;
}

export interface TaxEntry {
  id: string;
  title: string;
  rate: number;
  createdAt: string;
}

// ================== AUTH SCHEMAS ==================
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerPatientSchema = insertUserSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.role === UserRole.PATIENT, {
    message: "Invalid role for patient registration",
    path: ["role"],
  });

export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;

export const registerDoctorSchema = insertUserSchema
  .extend({
    confirmPassword: z.string(),
    registrationNumber: z.string().min(5, "Registration number required"),
    qualifications: z.string().min(10, "Qualifications required"),
    specializationIds: z.array(z.string()).min(1),
    consultationTypes: z
      .array(
        z.enum([
          ConsultationType.IN_PERSON,
          ConsultationType.ONLINE,
          ConsultationType.HOME_VISIT,
        ]),
      )
      .min(1),
    clinic_locations: z.array(z.string()).default([]),
    consultationFee: z.number().min(0),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.role === UserRole.DOCTOR, {
    message: "Invalid role for doctor registration",
    path: ["role"],
  });

export type RegisterDoctorInput = z.infer<typeof registerDoctorSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ================== SEARCH & FILTER SCHEMAS ==================
export const doctorSearchSchema = z.object({
  query: z.string().optional(),
  specializationIds: z.array(z.string()).optional(),
  city: z.string().optional(),
  languages: z
    .array(z.enum([Language.ENGLISH, Language.SINHALA, Language.TAMIL]))
    .optional(),
  consultationType: z
    .enum([
      ConsultationType.IN_PERSON,
      ConsultationType.ONLINE,
      ConsultationType.HOME_VISIT,
    ])
    .optional(),
  minRating: z.number().min(0).max(5).optional(),
  maxFee: z.number().optional(),
  minFee: z.number().optional(),
  sortBy: z.enum(["rating", "fee_asc", "fee_desc", "experience"]).optional(),
  page: z.number().default(1),
  limit: z.number().default(10),
});

export type DoctorSearchInput = z.infer<typeof doctorSearchSchema>;

// ================== BOOKING SCHEMA ==================
export const bookingSchema = z.object({
  doctorId: z.string(),
  slotId: z.string(),
  hospitalId: z.string().optional(),
  symptoms: z.string().min(10, "Please describe your symptoms"),
  consultationType: z.enum([
    ConsultationType.IN_PERSON,
    ConsultationType.ONLINE,
    ConsultationType.HOME_VISIT,
  ]),
  paymentMethod: z.enum([PaymentMethod.ONLINE, PaymentMethod.AT_CLINIC]),
  isForDependent: z.boolean().default(false),
  dependentName: z.string().optional(),
  dependentAge: z.number().optional(),
  dependentGender: z
    .enum([Gender.MALE, Gender.FEMALE, Gender.OTHER])
    .optional(),
  dependentContact: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.isForDependent) {
    if (!data.dependentName || data.dependentName.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dependent name is required when booking for a dependent",
        path: ["dependentName"],
      });
    }
    if (data.dependentAge === undefined || data.dependentAge === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dependent age is required when booking for a dependent",
        path: ["dependentAge"],
      });
    }
  }
});

export type BookingInput = z.infer<typeof bookingSchema>;

// ================== DASHBOARD STATS ==================
export interface PatientDashboardStats {
  upcomingAppointments: number;
  completedAppointments: number;
  totalSpent: number;
  prescriptionsCount: number;
}

export interface DoctorDashboardStats {
  todayAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
  totalEarnings: number;
  pendingEarnings: number;
  averageRating: number;
  totalReviews: number;
  currentQueueNumber: number;
}

export interface AdminDashboardStats {
  totalPatients: number;
  totalDoctors: number;
  verifiedDoctors: number;
  pendingDoctors: number;
  totalAppointments: number;
  todayAppointments: number;
  totalRevenue: number;
  platformEarnings: number;
}

// ================== CAREERS / JOB APPLICATIONS ==================
export const jobApplications = pgTable("job_applications", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 50 }).notNull(),
  jobTitle: varchar("job_title", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  cvUrl: text("cv_url").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobApplicationSchemaDb = createInsertSchema(
  jobApplications,
).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertJobApplicationSchema = z.object({
  jobId: z.string(),
  jobTitle: z.string(),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  cvUrl: z.string().url("Invalid CV URL"),
});

export type InsertJobApplication = z.infer<typeof insertJobApplicationSchema>;

export interface JobApplication extends InsertJobApplication {
  id: string;
  status: string;
  createdAt: string;
}

export const careers = pgTable("careers", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  careerTitle: varchar("career_title", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  employmentType: varchar("employment_type", { length: 100 }).notNull(),
  salaryRange: varchar("salary_range", { length: 100 }),
  description: text("description").notNull(),
  keyResponsibilities: text("key_responsibilities"),
  requiredQualifications: text("required_qualifications"),
  benefits: text("benefits"),
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blogs = pgTable("blogs", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  featuredImage: text("featured_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCareerSchema = createInsertSchema(careers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Career = typeof careers.$inferSelect;
export type InsertCareer = z.infer<typeof insertCareerSchema>;
export const insertBlogSchema = createInsertSchema(blogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Blog = typeof blogs.$inferSelect;
export type InsertBlog = z.infer<typeof insertBlogSchema>;

// Refunds Table
export const refunds = pgTable("refunds", {
  id: varchar("id", { length: 50 }).primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id", { length: 50 }).notNull().references(() => payments.id),
  appointmentId: varchar("appointment_id", { length: 50 }).notNull().references(() => appointments.id),
  patientId: varchar("patient_id", { length: 50 }).notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, completed, rejected
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  paymentIdx: index("refund_payment_idx").on(table.paymentId),
  statusIdx: index("refund_status_idx").on(table.status),
}));

export const insertRefundSchemaDb = createInsertSchema(refunds).omit({ id: true, createdAt: true, updatedAt: true, processedAt: true });
export type Refund = typeof refunds.$inferSelect;
export type InsertRefund = z.infer<typeof insertRefundSchemaDb>;