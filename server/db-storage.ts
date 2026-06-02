// db-storage.ts
import {
  AppointmentStatus,
  DoctorStatus,
  PaymentStatus,
  UserRole,
  appointmentSlots,
  appointments,
  blogSubmissions,
  blogs,
  careers,
  doctorCancellationCharges,
  doctorProfiles,
  doctorSchedules,
  hospitals,
  jobApplications,
  notifications,
  payments,
  platformSettings,
  prescriptions,
  reviews,
  specializations,
  // Tables
  users,
  type AdminDashboardStats,
  type Appointment,
  type AppointmentSlot,
  type AppointmentWithDetails,
  type Blog,
  type BlogSubmission,
  type Career,
  type DoctorDashboardStats,
  type DoctorProfile,
  type DoctorSchedule,
  type DoctorWithDetails,
  type Hospital,
  type InsertAppointment,
  type InsertAppointmentSlot,
  type InsertBlog,
  type InsertBlogSubmission,
  type InsertCareer,
  type InsertDoctorProfile,
  type InsertDoctorSchedule,
  type InsertHospital,
  type InsertJobApplication,
  type InsertNotification,
  type InsertPayment,
  type InsertPlatformSettings,
  type InsertPrescription,
  type InsertReview,
  type InsertSpecialization,
  type InsertUser,
  type JobApplication,
  type Notification,
  type PatientDashboardStats,
  type Payment,
  type PlatformSettings,
  type TaxEntry,
  type Prescription,
  type Review,
  type ReviewWithDoctor,
  type ReviewWithPatient,
  type Specialization,
  // Types
  type User,
  type SafeUser,
  refunds,
  type Refund,
  InsertRefund,
} from "@shared/schema";
import { and, desc, eq, gte, ilike, inArray, lte, sql, or } from "drizzle-orm";
import { db, pool } from "./db";

import type { IStorage } from "./storage";

function toISOString(date: Date | null): string {
  return date ? date.toISOString() : new Date().toISOString();
}

function mapUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    fullName: row.fullName,
    phone: row.phone,
    role: row.role,
    nic: row.nic || undefined,
    gender: row.gender || undefined,
    dateOfBirth: row.dateOfBirth || undefined,
    preferredLanguages: row.preferredLanguages || ["english"],
    profileImage: row.profileImage || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    isEmailVerified: row.isEmailVerified || false,
    isPhoneVerified: row.isPhoneVerified || false,
    isActive: row.isActive ?? true,
    provider: row.provider || "local",
    providerId: row.providerId || undefined,
    registrationComplete: row.registrationComplete ?? true,
    googleId: row.googleId || undefined,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
    resetPasswordOtp: row.resetPasswordOtp ?? null,
    resetPasswordOtpExpiry: row.resetPasswordOtpExpiry
      ? toISOString(row.resetPasswordOtpExpiry)
      : null,
  };
}

function mapSafeUser(row: any): SafeUser {
  const { password: _password, ...safe } = mapUser(row);
  return safe as SafeUser;
}

function mapDoctorProfile(row: any): DoctorProfile {
  return {
    id: row.id,
    userId: row.userId,
    registrationNumber: row.registrationNumber,
    qualifications: row.qualifications,
    biography: row.biography || undefined,
    specializationIds: row.specializationIds || [],
    languagesSpoken: row.languagesSpoken || ["english"],
    consultationTypes: row.consultationTypes || ["in_person"],
    hospitalIds: row.hospitalIds || [],
    clinic_locations: row.clinic_locations || [],
    consultationFee: row.consultationFee || 0,
    onlineConsultationFee: row.onlineConsultationFee || undefined,
    homeVisitFee: row.homeVisitFee || undefined,
    status: row.status || "pending",
    verificationDocuments: row.verificationDocuments || [],
    bankName: row.bankName || undefined,
    bankAccountNumber: row.bankAccountNumber || undefined,
    bankBranch: row.bankBranch || undefined,
    isAvailable: row.isAvailable ?? true,
    maxAdvanceBookingDays: row.maxAdvanceBookingDays || 30,
    minBookingNoticeHours: row.minBookingNoticeHours || 2,
    slotDurationMinutes: row.slotDurationMinutes || 30,
    bufferTimeMinutes: row.bufferTimeMinutes || 10,
    averageRating: row.averageRating || 0,
    totalReviews: row.totalReviews || 0,
    totalAppointments: row.totalAppointments || 0,
    currentQueueNumber: row.currentQueueNumber || 0,
    createdAt: toISOString(row.createdAt),
    updatedAt: toISOString(row.updatedAt),
    qrCode: row.qrCode || undefined,
  };
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] ? mapUser(result[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0] ? mapUser(result[0]) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values({
        email: insertUser.email,
        password: insertUser.password,
        fullName: insertUser.fullName,
        phone: insertUser.phone,
        role: insertUser.role,
        nic: insertUser.nic,
        gender: insertUser.gender,
        dateOfBirth: insertUser.dateOfBirth,
        preferredLanguages: insertUser.preferredLanguages,
        profileImage: insertUser.profileImage,
        address: insertUser.address,
        city: insertUser.city,
        isEmailVerified: insertUser.isEmailVerified,
        isPhoneVerified: insertUser.isPhoneVerified,
        provider: insertUser.provider,
        providerId: insertUser.providerId,
        registrationComplete: insertUser.registrationComplete,
        googleId: (insertUser as any).googleId,
      })
      .returning();
    return mapUser(result[0]);
  }

  async updateUser(
    id: string,
    updates: Partial<InsertUser>,
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0] ? mapUser(result[0]) : undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllUsers(role?: string): Promise<User[]> {
    let query = db.select().from(users);
    if (role) {
      query = query.where(eq(users.role, role)) as any;
    }
    const result = await query;
    return result.map(mapUser);
  }

  async getSpecialization(id: string): Promise<Specialization | undefined> {
    const result = await db
      .select()
      .from(specializations)
      .where(eq(specializations.id, id))
      .limit(1);
    return result[0] as Specialization | undefined;
  }

  async getAllSpecializations(): Promise<Specialization[]> {
    const result = await db.select().from(specializations);
    return result as Specialization[];
  }

  async createSpecialization(
    spec: InsertSpecialization,
  ): Promise<Specialization> {
    const result = await db.insert(specializations).values(spec).returning();
    return result[0] as Specialization;
  }

  async updateSpecialization(
    id: string,
    updates: Partial<InsertSpecialization>,
  ): Promise<Specialization | undefined> {
    const result = await db
      .update(specializations)
      .set(updates)
      .where(eq(specializations.id, id))
      .returning();
    return result[0] as Specialization | undefined;
  }

  async deleteSpecialization(id: string): Promise<boolean> {
    const result = await db
      .delete(specializations)
      .where(eq(specializations.id, id))
      .returning();
    return result.length > 0;
  }

  async getAllBlogs(): Promise<Blog[]> {
    const result = await db.select().from(blogs).orderBy(desc(blogs.createdAt));
    return result as Blog[];
  }

  async createBlog(data: InsertBlog): Promise<Blog> {
    const result = await db.insert(blogs).values(data).returning();
    return result[0] as Blog;
  }

  async deleteBlog(id: string): Promise<boolean> {
    const result = await db.delete(blogs).where(eq(blogs.id, id)).returning();
    return result.length > 0;
  }

  async getHospital(id: string): Promise<Hospital | undefined> {
    const result = await db
      .select()
      .from(hospitals)
      .where(eq(hospitals.id, id))
      .limit(1);
    return result[0] as Hospital | undefined;
  }

  async getAllHospitals(): Promise<Hospital[]> {
    const result = await db.select().from(hospitals);
    return result as Hospital[];
  }

  async getHospitalsByCity(city: string): Promise<Hospital[]> {
    const result = await db
      .select()
      .from(hospitals)
      .where(ilike(hospitals.city, `%${city}%`));
    return result as Hospital[];
  }

  async createHospital(hospital: InsertHospital): Promise<Hospital> {
    const result = await db.insert(hospitals).values(hospital).returning();
    return result[0] as Hospital;
  }

  async updateHospital(
    id: string,
    updates: Partial<InsertHospital>,
  ): Promise<Hospital | undefined> {
    const result = await db
      .update(hospitals)
      .set(updates)
      .where(eq(hospitals.id, id))
      .returning();
    return result[0] as Hospital | undefined;
  }

  async deleteHospital(id: string): Promise<boolean> {
    const result = await db
      .delete(hospitals)
      .where(eq(hospitals.id, id))
      .returning();
    return result.length > 0;
  }

  async getDoctorProfile(id: string): Promise<DoctorProfile | undefined> {
    const result = await db
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.id, id))
      .limit(1);
    return result[0] ? mapDoctorProfile(result[0]) : undefined;
  }

  async getDoctorProfileByUserId(
    userId: string,
  ): Promise<DoctorProfile | undefined> {
    const result = await db
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, userId))
      .limit(1);
    return result[0] ? mapDoctorProfile(result[0]) : undefined;
  }

  async getDoctorWithDetails(
    doctorId: string,
  ): Promise<DoctorWithDetails | undefined> {
    const profile = await this.getDoctorProfile(doctorId);
    if (!profile) return undefined;

    const fullUser = await this.getUser(profile.userId);
    if (!fullUser) return undefined;
    const { password: _pw, ...safeUser } = fullUser;

    const allSpecs = await this.getAllSpecializations();
    const specializationsData = allSpecs.filter((s) =>
      profile.specializationIds.includes(s.id),
    );

    const allHospitals = await this.getAllHospitals();
    const hospitalsData = allHospitals.filter((h) =>
      profile.hospitalIds.includes(h.id),
    );

    return {
      ...profile,
      user: safeUser as SafeUser,
      specializations: specializationsData,
      hospitals: hospitalsData,
    };
  }

  async getAllDoctors(filters?: {
    specializationId?: string;
    city?: string;
    status?: string;
    minRating?: number;
    consultationType?: string;
  }): Promise<DoctorWithDetails[]> {
    let query = db.select().from(doctorProfiles);

    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(doctorProfiles.status, filters.status));
    }
    if (filters?.minRating) {
      conditions.push(gte(doctorProfiles.averageRating, filters.minRating));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const profiles = await query;
    const doctors: DoctorWithDetails[] = [];

    for (const profile of profiles) {
      const mappedProfile = mapDoctorProfile(profile);

      if (
        filters?.specializationId &&
        !mappedProfile.specializationIds.includes(filters.specializationId)
      ) {
        continue;
      }
      if (
        filters?.consultationType &&
        !mappedProfile.consultationTypes.includes(
          filters.consultationType as any,
        )
      ) {
        continue;
      }

      const doctor = await this.getDoctorWithDetails(mappedProfile.id);
      if (doctor) {
        if (filters?.city) {
          if (
            doctor.user.city
              ?.toLowerCase()
              .includes(filters.city.toLowerCase()) ||
            doctor.hospitals.some((h) =>
              h.city.toLowerCase().includes(filters.city!.toLowerCase()),
            )
          ) {
            doctors.push(doctor);
          }
        } else {
          doctors.push(doctor);
        }
      }
    }

    return doctors;
  }

  async getVerifiedDoctors(): Promise<DoctorWithDetails[]> {
    return this.getAllDoctors({ status: DoctorStatus.VERIFIED });
  }

  async getPendingDoctors(): Promise<DoctorWithDetails[]> {
    return this.getAllDoctors({ status: DoctorStatus.PENDING });
  }

  async createDoctorProfile(
    profile: InsertDoctorProfile,
  ): Promise<DoctorProfile> {
    const result = await db
      .insert(doctorProfiles)
      .values({
        userId: profile.userId,
        registrationNumber: profile.registrationNumber,
        qualifications: profile.qualifications,
        biography: profile.biography,
        specializationIds: profile.specializationIds,
        languagesSpoken: profile.languagesSpoken,
        consultationTypes: profile.consultationTypes,
        hospitalIds: profile.hospitalIds,
        clinic_locations: profile.clinic_locations,
        consultationFee: profile.consultationFee,
        onlineConsultationFee: profile.onlineConsultationFee,
        homeVisitFee: profile.homeVisitFee,
        status: profile.status,
        verificationDocuments: profile.verificationDocuments,
        bankName: profile.bankName,
        bankAccountNumber: profile.bankAccountNumber,
        bankBranch: profile.bankBranch,
        isAvailable: profile.isAvailable,
        maxAdvanceBookingDays: profile.maxAdvanceBookingDays,
        minBookingNoticeHours: profile.minBookingNoticeHours,
        slotDurationMinutes: profile.slotDurationMinutes,
        bufferTimeMinutes: profile.bufferTimeMinutes,
      })
      .returning();
    return mapDoctorProfile(result[0]);
  }

  async updateDoctorProfile(
    id: string,
    updates: Partial<InsertDoctorProfile>,
  ): Promise<DoctorProfile | undefined> {
    const result = await db
      .update(doctorProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(doctorProfiles.id, id))
      .returning();
    return result[0] ? mapDoctorProfile(result[0]) : undefined;
  }

  async updateDoctorStatus(
    id: string,
    status: string,
    rejectionReason?: string,
  ): Promise<DoctorProfile | undefined> {
    const updates: any = { status: status as any };
    if (rejectionReason) {
      updates.rejectionReason = rejectionReason;
    }
    return this.updateDoctorProfile(id, updates);
  }

  async addDoctorHospital(
    doctorProfileId: string,
    name: string,
    address: string,
  ): Promise<{ hospital: Hospital; hospitalIds: string[] } | null> {
    const profile = await this.getDoctorProfile(doctorProfileId);
    if (!profile) return null;
    const currentIds: string[] = profile.hospitalIds || [];
    if (currentIds.length >= 5) return null;

    const hospResult = await db
      .insert(hospitals)
      .values({
        name,
        address,
        city: "",
        contactNumber: "N/A",
      })
      .returning();
    const hospital = hospResult[0] as Hospital;

    await pool.query(
      `UPDATE doctor_profiles SET hospital_ids = array_append(hospital_ids, $1), updated_at = NOW() WHERE id = $2`,
      [hospital.id, doctorProfileId],
    );

    const newIds = [...currentIds, hospital.id];
    return { hospital, hospitalIds: newIds };
  }

  async removeDoctorHospital(
    doctorProfileId: string,
    hospitalId: string,
  ): Promise<boolean> {
    await pool.query(
      `UPDATE doctor_profiles SET hospital_ids = array_remove(hospital_ids, $1), updated_at = NOW() WHERE id = $2`,
      [hospitalId, doctorProfileId],
    );
    return true;
  }

  async getDoctorSchedules(doctorId: string): Promise<DoctorSchedule[]> {
    const result = await db
      .select()
      .from(doctorSchedules)
      .where(eq(doctorSchedules.doctorId, doctorId));
    return result as DoctorSchedule[];
  }

  async createDoctorSchedule(
    schedule: InsertDoctorSchedule,
  ): Promise<DoctorSchedule> {
    const result = await db
      .insert(doctorSchedules)
      .values(schedule)
      .returning();
    return result[0] as DoctorSchedule;
  }

  async updateDoctorSchedule(
    id: string,
    updates: Partial<InsertDoctorSchedule>,
  ): Promise<DoctorSchedule | undefined> {
    const result = await db
      .update(doctorSchedules)
      .set(updates)
      .where(eq(doctorSchedules.id, id))
      .returning();
    return result[0] as DoctorSchedule | undefined;
  }

  async deleteDoctorSchedule(id: string): Promise<boolean> {
    const result = await db
      .delete(doctorSchedules)
      .where(eq(doctorSchedules.id, id))
      .returning();
    return result.length > 0;
  }

  async getAppointmentSlot(id: string): Promise<AppointmentSlot | undefined> {
    const result = await db
      .select()
      .from(appointmentSlots)
      .where(eq(appointmentSlots.id, id))
      .limit(1);
    return result[0] as AppointmentSlot | undefined;
  }

  async bookSlotAtomic(slotId: string): Promise<AppointmentSlot | null> {
    // Atomically set isBooked=true only if the slot is currently free and not blocked.
    // If two concurrent requests race, only one UPDATE will match the WHERE clause
    // and get a row back — the other gets an empty result and is rejected.
    const result = await db
      .update(appointmentSlots)
      .set({ isBooked: true })
      .where(
        and(
          eq(appointmentSlots.id, slotId),
          eq(appointmentSlots.isBooked, false),
          eq(appointmentSlots.isBlocked, false),
        ),
      )
      .returning();
    return (result[0] as AppointmentSlot) ?? null;
  }

  async getAvailableSlots(
    doctorId: string,
    date: string,
  ): Promise<AppointmentSlot[]> {
    const result = await db
      .select()
      .from(appointmentSlots)
      .where(
        and(
          eq(appointmentSlots.doctorId, doctorId),
          eq(appointmentSlots.date, date),
          eq(appointmentSlots.isBooked, false),
          eq(appointmentSlots.isBlocked, false),
        ),
      );
    return result as AppointmentSlot[];
  }

  async getDoctorDaySlots(
    doctorId: string,
    date: string,
  ): Promise<AppointmentSlot[]> {
    const result = await db
      .select()
      .from(appointmentSlots)
      .where(
        and(
          eq(appointmentSlots.doctorId, doctorId),
          eq(appointmentSlots.date, date),
        ),
      )
      .orderBy(appointmentSlots.startTime);
    return result as AppointmentSlot[];
  }

  async getDoctorSlots(
    doctorId: string,
    startDate: string,
    endDate: string,
  ): Promise<AppointmentSlot[]> {
    const result = await db
      .select()
      .from(appointmentSlots)
      .where(
        and(
          eq(appointmentSlots.doctorId, doctorId),
          gte(appointmentSlots.date, startDate),
          lte(appointmentSlots.date, endDate),
          eq(appointmentSlots.isActive, true),
        ),
      );
    return result as AppointmentSlot[];
  }

  async createAppointmentSlot(
    slot: InsertAppointmentSlot,
  ): Promise<AppointmentSlot> {
    const result = await db.insert(appointmentSlots).values(slot).returning();
    return result[0] as AppointmentSlot;
  }

  async updateAppointmentSlot(
    id: string,
    updates: Partial<InsertAppointmentSlot>,
  ): Promise<AppointmentSlot | undefined> {
    const result = await db
      .update(appointmentSlots)
      .set(updates)
      .where(eq(appointmentSlots.id, id))
      .returning();
    return result[0] as AppointmentSlot | undefined;
  }

  async blockSlot(slotId: string): Promise<AppointmentSlot | undefined> {
    return this.updateAppointmentSlot(slotId, { isBlocked: true });
  }

  async unblockSlot(slotId: string): Promise<AppointmentSlot | undefined> {
    return this.updateAppointmentSlot(slotId, { isBlocked: false });
  }

  async deactivateSlot(slotId: string): Promise<boolean> {
    const result = await db
      .update(appointmentSlots)
      .set({ isActive: false })
      .where(eq(appointmentSlots.id, slotId))
      .returning();
    return result.length > 0;
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const result = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, id))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
    } as Appointment;
  }

  async getAppointmentWithDetails(
    id: string,
  ): Promise<AppointmentWithDetails | undefined> {
    const appointment = await this.getAppointment(id);
    if (!appointment) return undefined;

    const patient = await this.getUser(appointment.patientId);
    const doctor = await this.getDoctorWithDetails(appointment.doctorId);
    const slot = await this.getAppointmentSlot(appointment.slotId);
    const hospital = appointment.hospitalId
      ? await this.getHospital(appointment.hospitalId)
      : undefined;
    const payment = await this.getPaymentByAppointment(id);
    const prescription = await this.getPrescriptionByAppointment(id);
    const review = await this.getReviewByAppointment(id);

    if (!patient || !doctor || !slot) return undefined;

    return {
      ...appointment,
      patient,
      doctor,
      slot,
      hospital,
      payment,
      prescription,
      review,
    };
  }

  // Batch-fetch all related data in ~10 parallel queries instead of N×8 sequential ones
  private async buildAppointmentsWithDetails(
    rows: any[],
  ): Promise<AppointmentWithDetails[]> {
    if (rows.length === 0) return [];

    const apts = rows.map((r) => ({
      ...r,
      createdAt: toISOString(r.createdAt),
      updatedAt: toISOString(r.updatedAt),
    })) as Appointment[];

    const patientIds = [...new Set(apts.map((a) => a.patientId))];
    const doctorIds = [...new Set(apts.map((a) => a.doctorId))];
    const slotIds = [...new Set(apts.map((a) => a.slotId))];
    const hospitalIds = [
      ...new Set(apts.filter((a) => a.hospitalId).map((a) => a.hospitalId!)),
    ];
    const aptIds = apts.map((a) => a.id);

    const [
      patientRows,
      profileRows,
      slotRows,
      hospitalRows,
      paymentRows,
      prescriptionRows,
      reviewRows,
      allSpecs,
      allHosp,
    ] = await Promise.all([
      db.select().from(users).where(inArray(users.id, patientIds)),
      db
        .select()
        .from(doctorProfiles)
        .where(inArray(doctorProfiles.id, doctorIds)),
      db
        .select()
        .from(appointmentSlots)
        .where(inArray(appointmentSlots.id, slotIds)),
      hospitalIds.length
        ? db.select().from(hospitals).where(inArray(hospitals.id, hospitalIds))
        : [],
      db.select().from(payments).where(inArray(payments.appointmentId, aptIds)),
      db
        .select()
        .from(prescriptions)
        .where(inArray(prescriptions.appointmentId, aptIds)),
      db.select().from(reviews).where(inArray(reviews.appointmentId, aptIds)),
      this.getAllSpecializations(),
      this.getAllHospitals(),
    ]);

    const doctorUserIds = [
      ...new Set((profileRows as any[]).map((p) => p.userId)),
    ];
    const doctorUserRows = doctorUserIds.length
      ? await db.select().from(users).where(inArray(users.id, doctorUserIds))
      : [];

    const patientMap = new Map(
      (patientRows as any[]).map((r) => [r.id, mapSafeUser(r)]),
    );
    const doctorUserMap = new Map(
      (doctorUserRows as any[]).map((r) => [r.id, mapSafeUser(r)]),
    );
    const slotMap = new Map(
      (slotRows as any[]).map((r) => [r.id, r as AppointmentSlot]),
    );
    const paymentMap = new Map(
      (paymentRows as any[]).map((r) => [
        r.appointmentId,
        {
          ...r,
          createdAt: toISOString(r.createdAt),
          updatedAt: toISOString(r.updatedAt),
        } as Payment,
      ]),
    );
    const prescMap = new Map(
      (prescriptionRows as any[]).map((r) => [
        r.appointmentId,
        { ...r, createdAt: toISOString(r.createdAt) },
      ]),
    );
    const reviewMap = new Map(
      (reviewRows as any[]).map((r) => [
        r.appointmentId,
        {
          ...r,
          createdAt: toISOString(r.createdAt),
          updatedAt: toISOString(r.updatedAt),
        },
      ]),
    );
    const hospitalMap = new Map(allHosp.map((h) => [h.id, h]));

    const doctorMap = new Map<string, DoctorWithDetails>();
    for (const profileRow of profileRows as any[]) {
      const profile = mapDoctorProfile(profileRow);
      const user = doctorUserMap.get(profile.userId);
      if (!user) continue;
      const specs = allSpecs.filter((s) =>
        profile.specializationIds.includes(s.id),
      );
      const hosps = allHosp.filter((h) => profile.hospitalIds.includes(h.id));
      doctorMap.set(profile.id, {
        ...profile,
        user,
        specializations: specs,
        hospitals: hosps,
      });
    }

    const result: AppointmentWithDetails[] = [];
    for (const apt of apts) {
      const patient = patientMap.get(apt.patientId);
      const doctor = doctorMap.get(apt.doctorId);
      const slot = slotMap.get(apt.slotId);
      if (!patient || !doctor || !slot) continue;
      result.push({
        ...apt,
        patient,
        doctor,
        slot,
        hospital: apt.hospitalId ? hospitalMap.get(apt.hospitalId) : undefined,
        payment: paymentMap.get(apt.id) as any,
        prescription: prescMap.get(apt.id) as any,
        review: reviewMap.get(apt.id) as any,
      });
    }
    return result;
  }

  async getPatientAppointments(
    patientId: string,
  ): Promise<AppointmentWithDetails[]> {
    const rows = await db
      .select()
      .from(appointments)
      .where(eq(appointments.patientId, patientId))
      .orderBy(desc(appointments.appointmentDate));
    return this.buildAppointmentsWithDetails(rows);
  }

  async getDoctorAppointments(
    doctorId: string,
    date?: string,
  ): Promise<AppointmentWithDetails[]> {
    const condition = date
      ? and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.appointmentDate, date),
        )
      : eq(appointments.doctorId, doctorId);
    const rows = await db
      .select()
      .from(appointments)
      .where(condition)
      .orderBy(appointments.appointmentTime);
    return this.buildAppointmentsWithDetails(rows);
  }

  /**
   * @deprecated Use bookAppointmentAtomic() instead. This function is unsafe as it
   * creates the appointment and then separately marks the slot as booked.
   * If the second operation fails, the slot becomes orphaned with a dangling appointment.
   * 
   * This method now delegates to bookAppointmentAtomic for safety.
   */
  async createAppointment(
    appointment: InsertAppointment,
  ): Promise<Appointment> {
    // Safely delegate to atomic booking to maintain compatibility
    const atomicAppt = await this.bookAppointmentAtomic(appointment, appointment.slotId);
    if (!atomicAppt) {
      throw new Error(`Failed to create appointment: slot ${appointment.slotId} is already booked or unavailable`);
    }
    return atomicAppt;
  }

  /**
   * ATOMIC BOOKING: Locks slot and creates appointment in a single transaction.
   * If either step fails, the entire transaction rolls back.
   * This prevents the race condition where slot is locked but appointment creation fails.
   * 
   * Returns:
   *   - Appointment object if success
   *   - null if slot was already booked or unavailable
   *   - throws error if other database issues occur
   */
  async bookAppointmentAtomic(
    appointment: InsertAppointment,
    slotId: string,
  ): Promise<Appointment | null> {
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query("BEGIN");

      // Step 1: ATOMICALLY lock the slot - only succeeds if slot is free
      const lockResult = await client.query(
        `UPDATE appointment_slots 
         SET is_booked = true, updated_at = NOW()
         WHERE id = $1 AND is_booked = false AND is_blocked = false AND is_active = true
         RETURNING id, date, start_time`,
        [slotId],
      );

      // If slot was already booked, rollback and return null
      if (lockResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      // Step 2: Create appointment record (within same transaction)
      const appointmentResult = await client.query(
        `INSERT INTO appointments 
         (id, patient_id, doctor_id, slot_id, hospital_id, appointment_date, 
          appointment_time, consultation_type, symptoms, is_for_dependent, 
          dependent_name, dependent_age, dependent_gender, dependent_contact, 
          status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
         RETURNING *`,
        [
          appointment.id,
          appointment.patientId,
          appointment.doctorId,
          appointment.slotId,
          appointment.hospitalId,
          appointment.appointmentDate,
          appointment.appointmentTime,
          appointment.consultationType,
          appointment.symptoms,
          appointment.isForDependent,
          appointment.dependentName,
          appointment.dependentAge,
          appointment.dependentGender,
          appointment.dependentContact,
          appointment.status,
        ],
      );

      // Commit transaction - both slot lock and appointment are now permanent
      await client.query("COMMIT");

      const result = appointmentResult.rows[0];
      return {
        ...result,
        createdAt: toISOString(result.created_at),
        updatedAt: toISOString(result.updated_at),
      } as Appointment;
    } catch (error) {
      // Rollback on ANY error to prevent partial state
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * COMPLETE BOOKING TRANSACTION: Locks slot + creates appointment + creates payment
   * ALL in a single atomic transaction. No partial states possible.
   * 
   * If ANY step fails, entire transaction rolls back:
   *   - Appointment is not created
   *   - Slot remains free
   *   - Payment is not recorded
   * 
   * Returns: { appointment, payment } on success
   * Throws: error if transaction fails (client code should handle rollback/retry)
   * Returns null: if slot was already booked/unavailable
   */
  async bookAppointmentWithPaymentAtomic(
    appointment: InsertAppointment,
    paymentData: InsertPayment,
    slotId: string,
  ): Promise<{ appointment: Appointment; payment: Payment } | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Step 1: ATOMICALLY lock the slot
      const lockResult = await client.query(
        `UPDATE appointment_slots 
         SET is_booked = true, updated_at = NOW()
         WHERE id = $1 AND is_booked = false AND is_blocked = false AND is_active = true
         RETURNING id, date, start_time`,
        [slotId],
      );

      if (lockResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      // Step 2: Create appointment record (within same transaction)
      const appointmentResult = await client.query(
        `INSERT INTO appointments 
         (id, patient_id, doctor_id, slot_id, hospital_id, appointment_date, 
          appointment_time, consultation_type, symptoms, is_for_dependent, 
          dependent_name, dependent_age, dependent_gender, dependent_contact, 
          status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
         RETURNING *`,
        [
          appointment.id,
          appointment.patientId,
          appointment.doctorId,
          appointment.slotId,
          appointment.hospitalId,
          appointment.appointmentDate,
          appointment.appointmentTime,
          appointment.consultationType,
          appointment.symptoms,
          appointment.isForDependent,
          appointment.dependentName,
          appointment.dependentAge,
          appointment.dependentGender,
          appointment.dependentContact,
          appointment.status,
        ],
      );

      const createdAppointment = appointmentResult.rows[0];

      // Step 3: Create payment record (within same transaction)
      const paymentResult = await client.query(
        `INSERT INTO payments 
         (id, appointment_id, patient_id, doctor_id, consultation_fee, booking_charges,
          tax, platform_commission, doctor_earnings, total_amount, status, method, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         RETURNING *`,
        [
          randomUUID(),
          paymentData.appointmentId,
          paymentData.patientId,
          paymentData.doctorId,
          paymentData.consultationFee,
          paymentData.bookingCharges,
          paymentData.tax,
          paymentData.platformCommission,
          paymentData.doctorEarnings,
          paymentData.totalAmount,
          paymentData.status,
          paymentData.method,
        ],
      );

      const createdPayment = paymentResult.rows[0];

      // COMMIT: All three operations are now permanent and consistent
      await client.query("COMMIT");

      return {
        appointment: {
          ...createdAppointment,
          createdAt: toISOString(createdAppointment.created_at),
          updatedAt: toISOString(createdAppointment.updated_at),
        } as Appointment,
        payment: {
          ...createdPayment,
          createdAt: toISOString(createdPayment.created_at),
          updatedAt: toISOString(createdPayment.updated_at),
        } as Payment,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async updateAppointment(
    id: string,
    updates: Partial<InsertAppointment>,
  ): Promise<Appointment | undefined> {
    const result = await db
      .update(appointments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
    } as Appointment;
  }

  // server/storage.ts - DbStorage class එක ඇතුළට මේක මාරු කරන්න
  async cancelAppointment(
    id: string,
    reason: string,
    cancelledBy: string,
  ): Promise<Appointment | undefined> {
    console.log(`[DB-STORAGE] 🛑 Cancelling appointment ID: ${id} by ${cancelledBy}`);
    
    // 1. Update Appointment Status
    const [updated] = await db
      .update(appointments)
      .set({ 
        status: AppointmentStatus.CANCELLED, 
        cancelReason: reason, 
        cancelledBy: cancelledBy as any,
        updatedAt: new Date() 
      })
      .where(eq(appointments.id, id))
      .returning();

    if (!updated) return undefined;

    // 2. Unlock the Slot
    await db
      .update(appointmentSlots)
      .set({ isBooked: false })
      .where(eq(appointmentSlots.id, updated.slotId));

    console.log(`[DB-STORAGE] ✅ Appointment cancelled & slot unlocked.`);
    
    // 3. Create Refund Request if Payment exists
    const payment = await this.getPaymentByAppointment(id);
    if (payment && payment.status === PaymentStatus.COMPLETED) {
      console.log(`[DB-STORAGE] 💰 Payment found for refund. Status: ${payment.status}`);
      const amountToRefund = payment.totalAmount - (payment.bookingCharges || 0) - (payment.tax || 0);
      
      if (amountToRefund > 0) {
        await this.createRefundRequest({
          paymentId: payment.id,
          appointmentId: id,
          patientId: updated.patientId,
          amount: amountToRefund,
          reason: reason || `Cancelled by ${cancelledBy}`,
          status: "pending"
        });
        console.log(`[DB-STORAGE] 📝 Pending refund record created: LKR ${amountToRefund}`);
      }
    }

    return {
      ...updated,
      createdAt: toISOString(updated.createdAt),
      updatedAt: toISOString(updated.updatedAt),
    } as Appointment;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
    } as Payment;
  }

  async getPaymentByAppointment(
    appointmentId: string,
  ): Promise<Payment | undefined> {
    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.appointmentId, appointmentId))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
    } as Payment;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(payment).returning();
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
    } as Payment;
  }

  async updatePayment(
    id: string,
    updates: Partial<InsertPayment>,
  ): Promise<Payment | undefined> {
    const result = await db
      .update(payments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
    } as Payment;
  }

  async getPrescription(id: string): Promise<Prescription | undefined> {
    const result = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.id, id))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      medications: result[0].medications as any,
      treatments: result[0].treatments || [],
      createdAt: toISOString(result[0].createdAt),
    } as Prescription;
  }

  async getPrescriptionByAppointment(
    appointmentId: string,
  ): Promise<Prescription | undefined> {
    const result = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.appointmentId, appointmentId))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      medications: result[0].medications as any,
      treatments: result[0].treatments || [],
      createdAt: toISOString(result[0].createdAt),
    } as Prescription;
  }

  async getPatientPrescriptions(patientId: string): Promise<Prescription[]> {
    const result = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.patientId, patientId))
      .orderBy(desc(prescriptions.createdAt));
    return result.map((p) => ({
      ...p,
      medications: p.medications as any,
      treatments: p.treatments || [],
      createdAt: toISOString(p.createdAt),
    })) as Prescription[];
  }

  async createPrescription(
    prescription: InsertPrescription,
  ): Promise<Prescription> {
    const result = await db
      .insert(prescriptions)
      .values({
        ...prescription,
        medications: prescription.medications as any,
      })
      .returning();
    return {
      ...result[0],
      medications: result[0].medications as any,
      treatments: result[0].treatments || [],
      createdAt: toISOString(result[0].createdAt),
    } as Prescription;
  }

  async updatePrescription(
    id: string,
    updates: Partial<InsertPrescription>,
  ): Promise<Prescription | undefined> {
    const result = await db
      .update(prescriptions)
      .set(updates as any)
      .where(eq(prescriptions.id, id))
      .returning();
    if (!result[0]) return undefined;
    return {
      ...result[0],
      medications: result[0].medications as any,
      treatments: result[0].treatments || [],
      createdAt: toISOString(result[0].createdAt),
    } as Prescription;
  }

  async getReview(id: string): Promise<Review | undefined> {
    const result = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
      doctorRespondedAt: result[0].doctorRespondedAt
        ? toISOString(result[0].doctorRespondedAt)
        : undefined,
    } as Review;
  }

  async getReviewByAppointment(
    appointmentId: string,
  ): Promise<Review | undefined> {
    const result = await db
      .select()
      .from(reviews)
      .where(eq(reviews.appointmentId, appointmentId))
      .limit(1);
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
      doctorRespondedAt: result[0].doctorRespondedAt
        ? toISOString(result[0].doctorRespondedAt)
        : undefined,
    } as Review;
  }

  async getDoctorReviews(doctorId: string): Promise<ReviewWithPatient[]> {
    const result = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.doctorId, doctorId), eq(reviews.isHidden, false)))
      .orderBy(desc(reviews.createdAt));

    const reviewsWithPatient: ReviewWithPatient[] = [];
    for (const r of result) {
      const patient = await this.getUser(r.patientId);
      if (patient) {
        const { password: _pw, ...safePatient } = patient;
        reviewsWithPatient.push({
          ...r,
          createdAt: toISOString(r.createdAt),
          updatedAt: toISOString(r.updatedAt),
          doctorRespondedAt: r.doctorRespondedAt
            ? toISOString(r.doctorRespondedAt)
            : undefined,
          patient: safePatient as SafeUser,

        } as ReviewWithPatient);
      }
    }
    return reviewsWithPatient;
  }

  async getPatientReviews(patientId: string): Promise<ReviewWithDoctor[]> {
    const result = await db
      .select()
      .from(reviews)
      .where(eq(reviews.patientId, patientId))
      .orderBy(desc(reviews.createdAt));

    const reviewsWithDoctor: ReviewWithDoctor[] = [];
    for (const r of result) {
      const doctor = await this.getDoctorWithDetails(r.doctorId);
      if (doctor) {
        reviewsWithDoctor.push({
          ...r,
          createdAt: toISOString(r.createdAt),
          updatedAt: toISOString(r.updatedAt),
          doctorRespondedAt: r.doctorRespondedAt
            ? toISOString(r.doctorRespondedAt)
            : undefined,
          doctor,
        } as ReviewWithDoctor);
      }
    }
    return reviewsWithDoctor;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const result = await db.insert(reviews).values(review).returning();

    const doctorReviews = await db
      .select()
      .from(reviews)
      .where(
        and(eq(reviews.doctorId, review.doctorId), eq(reviews.isHidden, false)),
      );
    const totalRating = doctorReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating =
      doctorReviews.length > 0 ? totalRating / doctorReviews.length : 0;

    await db
      .update(doctorProfiles)
      .set({ averageRating: avgRating, totalReviews: doctorReviews.length })
      .where(eq(doctorProfiles.id, review.doctorId));

    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
      doctorRespondedAt: result[0].doctorRespondedAt
        ? toISOString(result[0].doctorRespondedAt)
        : undefined,
    } as Review;
  }

  async updateReview(
    id: string,
    updates: Partial<InsertReview>,
  ): Promise<Review | undefined> {
    const result = await db
      .update(reviews)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reviews.id, id))
      .returning();
    if (!result[0]) return undefined;

    const doctorReviews = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.doctorId, result[0].doctorId),
          eq(reviews.isHidden, false),
        ),
      );
    const totalRating = doctorReviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating =
      doctorReviews.length > 0 ? totalRating / doctorReviews.length : 0;

    await db
      .update(doctorProfiles)
      .set({
        averageRating: parseFloat(avgRating.toFixed(1)),
        totalReviews: doctorReviews.length,
      })
      .where(eq(doctorProfiles.id, result[0].doctorId));

    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
      doctorRespondedAt: result[0].doctorRespondedAt
        ? toISOString(result[0].doctorRespondedAt)
        : undefined,
    } as Review;
  }

  async hideReview(id: string): Promise<Review | undefined> {
    return this.updateReview(id, { isHidden: true });
  }
  
  async deleteReview(id: string): Promise<boolean> {
    const existing = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!existing[0]) return false;
    const doctorId = existing[0].doctorId;

    const result = await db.delete(reviews).where(eq(reviews.id, id)).returning();
    
    if (result.length > 0) {
      const doctorReviews = await db.select().from(reviews).where(and(eq(reviews.doctorId, doctorId), eq(reviews.isHidden, false)));
      const totalRating = doctorReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = doctorReviews.length > 0 ? totalRating / doctorReviews.length : 0;
      
      await db.update(doctorProfiles)
        .set({ averageRating: parseFloat(avgRating.toFixed(1)), totalReviews: doctorReviews.length })
        .where(eq(doctorProfiles.id, doctorId));
      return true;
    }
    return false;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    const result = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
    return result.map((n) => ({
      ...n,
      createdAt: toISOString(n.createdAt),
    })) as Notification[];
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    const result = await db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      )
      .orderBy(desc(notifications.createdAt));
    return result.map((n) => ({
      ...n,
      createdAt: toISOString(n.createdAt),
    })) as Notification[];
  }

  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const result = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
    } as Notification;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    if (!result[0]) return undefined;
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
    } as Notification;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotificationsByRelatedId(
    userId: string,
    relatedId: string,
  ): Promise<void> {
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.relatedId, relatedId),
        ),
      );
  }

  async getPatientDashboardStats(
    patientId: string,
  ): Promise<PatientDashboardStats> {
    const today = new Date().toISOString().split("T")[0];

    const allAppointments = await db
      .select()
      .from(appointments)
      .where(eq(appointments.patientId, patientId));

    const upcomingCount = allAppointments.filter(
      (a) =>
        a.appointmentDate >= today &&
        [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
          a.status as any,
        ),
    ).length;

    const completedCount = allAppointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;

    const patientPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.patientId, patientId),
          eq(payments.status, PaymentStatus.COMPLETED),
        ),
      );
    const totalSpent = patientPayments.reduce(
      (sum, p) => sum + p.totalAmount,
      0,
    );

    const patientPrescriptions = await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.patientId, patientId));

    return {
      upcomingAppointments: upcomingCount,
      completedAppointments: completedCount,
      totalSpent,
      prescriptionsCount: patientPrescriptions.length,
    };
  }

  async getDoctorDashboardStats(
    doctorId: string,
  ): Promise<DoctorDashboardStats> {
    const today = new Date().toISOString().split("T")[0];

    const allAppointments = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId));

    const todayApts = allAppointments.filter(
      (a) => a.appointmentDate === today,
    ).length;
    const upcomingCount = allAppointments.filter(
      (a) =>
        a.appointmentDate >= today &&
        [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
          a.status as any,
        ),
    ).length;
    const completedCount = allAppointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;

    const doctorPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.doctorId, doctorId));
    const totalEarnings = doctorPayments
      .filter((p) => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + p.doctorEarnings, 0);
    const pendingEarnings = doctorPayments
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + p.doctorEarnings, 0);

    const profile = await this.getDoctorProfile(doctorId);

    const currentTodayApts = allAppointments.filter(
      (a) =>
        a.appointmentDate === today &&
        a.status === AppointmentStatus.CONFIRMED &&
        !a.isCalled,
    ).length;

    return {
      todayAppointments: todayApts,
      upcomingAppointments: upcomingCount,
      completedAppointments: completedCount,
      totalEarnings,
      pendingEarnings,
      averageRating: profile?.averageRating || 0,
      totalReviews: profile?.totalReviews || 0,
      currentQueueNumber: currentTodayApts,
    };
  }

  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const today = new Date().toISOString().split("T")[0];

    const allUsers = await db.select().from(users);
    const patients = allUsers.filter((u) => u.role === UserRole.PATIENT).length;

    const allDoctors = await db.select().from(doctorProfiles);
    const verified = allDoctors.filter(
      (d) => d.status === DoctorStatus.VERIFIED,
    ).length;
    const pending = allDoctors.filter(
      (d) => d.status === DoctorStatus.PENDING,
    ).length;

    const allAppointments = await db.select().from(appointments);
    const todayApts = allAppointments.filter(
      (a) => a.appointmentDate === today,
    ).length;

    const allPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.status, PaymentStatus.COMPLETED));
    const totalRevenue = allPayments.reduce((sum, p) => sum + p.totalAmount, 0);
    const platformEarnings = allPayments.reduce(
      (sum, p) => sum + (p.platformCommission || 0),
      0,
    );

    return {
      totalPatients: patients,
      totalDoctors: allDoctors.length,
      verifiedDoctors: verified,
      pendingDoctors: pending,
      totalAppointments: allAppointments.length,
      todayAppointments: todayApts,
      totalRevenue,
      platformEarnings,
    };
  }

  async getAllAppointments(): Promise<AppointmentWithDetails[]> {
    const rows = await db
      .select()
      .from(appointments)
      .orderBy(
        desc(appointments.appointmentDate),
        desc(appointments.appointmentTime),
      );
    return this.buildAppointmentsWithDetails(rows);
  }

  async getPaginatedPayments(page: number, limit: number): Promise<any> {
    const offset = (page - 1) * limit;

    try {
      // 1. තත්පරයකින් සියලු දත්ත Join කරලා ගන්නවා
      const rawData = await db
        .select({
          payment: payments,
          appointment: appointments,
          patient: {
            id: users.id,
            fullName: users.fullName,
            profileImage: users.profileImage,
          },
          doctorProfile: {
            id: doctorProfiles.id,
            userId: doctorProfiles.userId,
          },
        })
        .from(payments)
        .leftJoin(appointments, eq(payments.appointmentId, appointments.id))
        .leftJoin(users, eq(payments.patientId, users.id))
        .leftJoin(doctorProfiles, eq(payments.doctorId, doctorProfiles.id))
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset);

      // 2. Doctor ගේ නම ගන්නවා
      const doctorUserIds = [...new Set(rawData.map(r => r.doctorProfile?.userId).filter(Boolean))];
      const doctorUsers = doctorUserIds.length > 0 
        ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, doctorUserIds as string[]))
        : [];
      const doctorUserMap = new Map(doctorUsers.map(u => [u.id, u.fullName]));

      // 3. Frontend එකට ඕනේ විදිහට හදනවා
      const formattedData = rawData.map(row => {
        const docFullName = row.doctorProfile ? doctorUserMap.get(row.doctorProfile.userId) : "Unknown Doctor";
        return {
          ...row.payment,
          createdAt: toISOString(row.payment.createdAt as any),
          updatedAt: toISOString(row.payment.updatedAt as any),
          appointment: row.appointment ? {
            ...row.appointment,
            patient: row.patient,
            doctor: {
              user: { fullName: docFullName }
            }
          } : undefined
        };
      });

      // 4. මුළු ගණන (Total Count)
      const allRecords = await db.select({ id: payments.id }).from(payments);
      const count = allRecords.length;

      return {
        data: formattedData,
        totalCount: count,
        totalPages: Math.ceil(count / limit) || 1,
        currentPage: page
      };
    } catch (error) {
      console.error("[DB] Error in getPaginatedPayments:", error);
      throw error;
    }
  }

  async getDoctorPatients(doctorId: string): Promise<
    {
      patient: SafeUser;
      lastVisit: string;
      totalVisits: number;
      appointments: AppointmentWithDetails[];
    }[]
  > {
    const doctorAppointments = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId))
      .orderBy(desc(appointments.appointmentDate));

    const patientMap = new Map<
      string,
      {
        patient: SafeUser;
        lastVisit: string;
        totalVisits: number;
        appointments: AppointmentWithDetails[];
      }
    >();

    for (const apt of doctorAppointments) {
      const patientId = apt.patientId;

      if (!patientMap.has(patientId)) {
        const patient = await this.getUser(patientId);
        if (patient) {
          const { password: _pw, ...safePatient } = patient;
          patientMap.set(patientId, {
            patient: safePatient as SafeUser,
            lastVisit: apt.appointmentDate,
            totalVisits: 0,
            appointments: [],
          });
        }
      }

      const patientData = patientMap.get(patientId);
      if (patientData) {
        patientData.totalVisits++;
        const fullApt = await this.getAppointmentWithDetails(apt.id);
        if (fullApt) {
          patientData.appointments.push(fullApt);
        }
      }
    }

    return Array.from(patientMap.values());
  }

  async getDoctorPayments(
    doctorId: string,
  ): Promise<(Payment & { appointment?: AppointmentWithDetails })[]> {
    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.doctorId, doctorId))
      .orderBy(desc(payments.createdAt));

    const paymentsWithDetails: (Payment & {
      appointment?: AppointmentWithDetails;
    })[] = [];
    for (const p of result) {
      const payment = {
        ...p,
        createdAt: toISOString(p.createdAt),
        updatedAt: toISOString(p.updatedAt),
      } as Payment;

      const appointment = await this.getAppointmentWithDetails(p.appointmentId);
      paymentsWithDetails.push({
        ...payment,
        appointment: appointment || undefined,
      });
    }
    return paymentsWithDetails;
  }

  async getDoctorEarningsSummary(doctorId: string): Promise<{
    totalEarnings: number;
    pendingEarnings: number;
    completedPayments: number;
    pendingPayments: number;
    thisMonthEarnings: number;
    lastMonthEarnings: number;
  }> {
    const doctorPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.doctorId, doctorId));

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;

    const completedPayments = doctorPayments.filter(
      (p) => p.status === PaymentStatus.COMPLETED,
    );
    const pendingPaymentsList = doctorPayments.filter(
      (p) => p.status === PaymentStatus.PENDING,
    );

    const totalEarnings = completedPayments.reduce(
      (sum, p) => sum + p.doctorEarnings,
      0,
    );
    const pendingEarnings = pendingPaymentsList.reduce(
      (sum, p) => sum + p.doctorEarnings,
      0,
    );

    const thisMonthPayments = completedPayments.filter((p) =>
      toISOString(p.createdAt).startsWith(thisMonth),
    );
    const lastMonthPayments = completedPayments.filter((p) =>
      toISOString(p.createdAt).startsWith(lastMonthStr),
    );

    // Subtract settled cancellation charges from total earnings
    const settledCharges = await db
      .select()
      .from(doctorCancellationCharges)
      .where(
        and(
          eq(doctorCancellationCharges.doctorId, doctorId),
          eq(doctorCancellationCharges.settled, true),
        ),
      );
    const totalDeductions = settledCharges.reduce((sum, c) => sum + c.amountOwed, 0);

    return {
      totalEarnings: Math.max(0, totalEarnings - totalDeductions),
      pendingEarnings,
      completedPayments: completedPayments.length,
      pendingPayments: pendingPaymentsList.length,
      thisMonthEarnings: thisMonthPayments.reduce(
        (sum, p) => sum + p.doctorEarnings,
        0,
      ),
      lastMonthEarnings: lastMonthPayments.reduce(
        (sum, p) => sum + p.doctorEarnings,
        0,
      ),
    };
  }

  async respondToReview(
    reviewId: string,
    response: string,
  ): Promise<Review | undefined> {
    const result = await db
      .update(reviews)
      .set({
        doctorResponse: response,
        doctorRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    if (!result[0]) return undefined;
    return {
      ...result[0],
      doctorResponse: result[0].doctorResponse || undefined,
      doctorRespondedAt: result[0].doctorRespondedAt
        ? toISOString(result[0].doctorRespondedAt)
        : undefined,
      createdAt: toISOString(result[0].createdAt),
      updatedAt: toISOString(result[0].updatedAt),
    } as Review;
  }

  async markAppointmentAsCalled(
    appointmentId: string,
  ): Promise<Appointment | undefined> {
    return this.updateAppointment(appointmentId, { isCalled: true });
  }

  async completeAppointment(
    appointmentId: string,
    consultationNotes?: string,
  ): Promise<Appointment | undefined> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.COMPLETED,
      consultationNotes,
    });
  }

  async confirmAppointment(
    appointmentId: string,
  ): Promise<Appointment | undefined> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.CONFIRMED,
    });
  }

  async markAppointmentNoShow(
    appointmentId: string,
  ): Promise<Appointment | undefined> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.NO_SHOW,
    });
  }

  async updateUserStatus(
    id: string,
    isActive: boolean,
  ): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0] ? mapUser(result[0]) : undefined;
  }

  async getPlatformSettings(): Promise<PlatformSettings> {
    const result = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, "default"));

    if (result[0]) {
      return {
        id: result[0].id,
        platformCommissionRate: result[0].platformCommissionRate,
        bookingCharges: result[0].bookingCharges,
        taxRate: result[0].taxRate,
        maxAdvanceBookingDays: result[0].maxAdvanceBookingDays,
        minBookingNoticeHours: result[0].minBookingNoticeHours,
        defaultSlotDuration: result[0].defaultSlotDuration,
        defaultBufferTime: result[0].defaultBufferTime,
        emailNotifications: result[0].emailNotifications ?? true,
        smsNotifications: result[0].smsNotifications ?? true,
        pushNotifications: result[0].pushNotifications ?? false,
        autoConfirmAppointments: result[0].autoConfirmAppointments ?? false,
        requireDoctorVerification: result[0].requireDoctorVerification ?? true,
        allowOnlinePayments: result[0].allowOnlinePayments ?? true,
        allowClinicPayments: result[0].allowClinicPayments ?? false,
        defaultLanguage: result[0].defaultLanguage ?? "english",
        maintenanceMode: result[0].maintenanceMode ?? false,
        cancellationFee: result[0].cancellationFee ?? 300,
        stampDutyEnabled: result[0].stampDutyEnabled ?? false,
        vatEnabled: result[0].vatEnabled ?? true,
        withholdingTaxEnabled: result[0].withholdingTaxEnabled ?? true,
        updatedAt: toISOString(result[0].updatedAt),
      };
    }

    // Create default settings if not exists
    const defaultSettings = {
      id: "default",
      platformCommissionRate: 10,
      bookingCharges: 100,
      taxRate: 4,
      maxAdvanceBookingDays: 30,
      minBookingNoticeHours: 2,
      defaultSlotDuration: 30,
      defaultBufferTime: 10,
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: false,
      autoConfirmAppointments: false,
      requireDoctorVerification: true,
      allowOnlinePayments: true,
      allowClinicPayments: false,
      defaultLanguage: "english",
      maintenanceMode: false,
      cancellationFee: 300,
      stampDutyEnabled: false,
      vatEnabled: true,
      withholdingTaxEnabled: true,
    };

    const inserted = await db
      .insert(platformSettings)
      .values(defaultSettings)
      .returning();
    return {
      ...defaultSettings,
      updatedAt: toISOString(inserted[0].updatedAt),
    };
  }

  async updatePlatformSettings(
    updates: Partial<InsertPlatformSettings>,
  ): Promise<PlatformSettings> {
    // Ensure settings exist first
    await this.getPlatformSettings();

    const result = await db
      .update(platformSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(platformSettings.id, "default"))
      .returning();

    return {
      id: result[0].id,
      platformCommissionRate: result[0].platformCommissionRate,
      bookingCharges: result[0].bookingCharges,
      taxRate: result[0].taxRate,
      maxAdvanceBookingDays: result[0].maxAdvanceBookingDays,
      minBookingNoticeHours: result[0].minBookingNoticeHours,
      defaultSlotDuration: result[0].defaultSlotDuration,
      defaultBufferTime: result[0].defaultBufferTime,
      emailNotifications: result[0].emailNotifications ?? true,
      smsNotifications: result[0].smsNotifications ?? true,
      pushNotifications: result[0].pushNotifications ?? false,
      autoConfirmAppointments: result[0].autoConfirmAppointments ?? false,
      requireDoctorVerification: result[0].requireDoctorVerification ?? true,
      allowOnlinePayments: result[0].allowOnlinePayments ?? true,
      allowClinicPayments: result[0].allowClinicPayments ?? false,
      defaultLanguage: result[0].defaultLanguage ?? "english",
      maintenanceMode: result[0].maintenanceMode ?? false,
      cancellationFee: result[0].cancellationFee ?? 300,
      stampDutyEnabled: result[0].stampDutyEnabled ?? false,
      vatEnabled: result[0].vatEnabled ?? true,
      withholdingTaxEnabled: result[0].withholdingTaxEnabled ?? true,
      updatedAt: toISOString(result[0].updatedAt),
    };
  }

  async getTaxEntries(): Promise<TaxEntry[]> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tax_entries (
        id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title VARCHAR(255) NOT NULL,
        rate INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const result = await pool.query(`SELECT id, title, rate, created_at FROM tax_entries ORDER BY created_at ASC`);
    return result.rows.map((r: any) => ({ id: r.id, title: r.title, rate: r.rate, createdAt: r.created_at }));
  }

  async createTaxEntry(title: string, rate: number): Promise<TaxEntry> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tax_entries (
        id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title VARCHAR(255) NOT NULL,
        rate INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const result = await pool.query(
      `INSERT INTO tax_entries (title, rate) VALUES ($1, $2) RETURNING id, title, rate, created_at`,
      [title, rate]
    );
    const r = result.rows[0];
    return { id: r.id, title: r.title, rate: r.rate, createdAt: r.created_at };
  }

  async deleteTaxEntry(id: string): Promise<boolean> {
    const result = await pool.query(`DELETE FROM tax_entries WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createBlogSubmission(
    data: InsertBlogSubmission,
  ): Promise<BlogSubmission> {
    const result = await db.insert(blogSubmissions).values(data).returning();
    return result[0] as BlogSubmission;
  }

  async getAllBlogSubmissions(): Promise<BlogSubmission[]> {
    const result = await db
      .select()
      .from(blogSubmissions)
      .orderBy(desc(blogSubmissions.createdAt));
    return result as BlogSubmission[];
  }

  async getPendingBlogSubmissions(): Promise<BlogSubmission[]> {
    const result = await db
      .select()
      .from(blogSubmissions)
      .where(eq(blogSubmissions.status, "pending"))
      .orderBy(desc(blogSubmissions.createdAt));
    return result as BlogSubmission[];
  }

  async getBlogSubmission(id: string): Promise<BlogSubmission | undefined> {
    const result = await db
      .select()
      .from(blogSubmissions)
      .where(eq(blogSubmissions.id, id))
      .limit(1);
    return result[0] as BlogSubmission | undefined;
  }

  async approveBlogSubmission(id: string): Promise<BlogSubmission | undefined> {
    const submission = await this.getBlogSubmission(id);
    if (!submission) return undefined;
    const shortDesc =
      submission.content.length > 200
        ? submission.content.slice(0, 200) + "..."
        : submission.content;
    const blogResult = await pool.query(
      `INSERT INTO blogs (title, description, category) VALUES ($1, $2, $3) RETURNING id`,
      [submission.title, shortDesc, submission.category],
    );
    const blogId = blogResult.rows[0].id;
    await pool.query(
      `UPDATE blog_submissions SET status = 'approved', blog_id = $1, updated_at = NOW() WHERE id = $2`,
      [blogId, id],
    );
    return this.getBlogSubmission(id);
  }

  async rejectBlogSubmission(
    id: string,
    rejectionReason: string,
  ): Promise<BlogSubmission | undefined> {
    const result = await db
      .update(blogSubmissions)
      .set({ status: "rejected", rejectionReason, updatedAt: new Date() })
      .where(eq(blogSubmissions.id, id))
      .returning();
    return result[0] as BlogSubmission | undefined;
  }

  async createJobApplication(
    application: InsertJobApplication,
  ): Promise<JobApplication> {
    const result = await db
      .insert(jobApplications)
      .values(application)
      .returning();
    return {
      ...result[0],
      createdAt: toISOString(result[0].createdAt),
    } as JobApplication;
  }

  // Admin: Get all job applications
  async getAllJobApplications(): Promise<JobApplication[]> {
    const result = await db
      .select()
      .from(jobApplications)
      .orderBy(desc(jobApplications.createdAt));

    return result.map((app) => ({
      ...app,
      createdAt: toISOString(app.createdAt),
    })) as JobApplication[];
  }

  async getAllCareers(): Promise<Career[]> {
    const result = await db
      .select()
      .from(careers)
      .orderBy(desc(careers.createdAt));
    return result as Career[];
  }

  async createCareer(career: InsertCareer): Promise<Career> {
    const result = await db.insert(careers).values(career).returning();
    return result[0] as Career;
  }

  async updateCareer(
    id: string,
    updates: Partial<InsertCareer>,
  ): Promise<Career | undefined> {
    const result = await db
      .update(careers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(careers.id, id))
      .returning();

    if (!result[0]) return undefined;
    return result[0] as Career;
  }

  async deleteCareer(id: string): Promise<boolean> {
    const result = await db
      .delete(careers)
      .where(eq(careers.id, id))
      .returning();
    return result.length > 0;
  }

  async updateApplicationStatus(
    id: string,
    status: string,
  ): Promise<JobApplication | undefined> {
    const [updatedApp] = await db
      .update(jobApplications)
      .set({ status })
      .where(eq(jobApplications.id, id))
      .returning();

    if (!updatedApp) return undefined;

    return {
      ...updatedApp,
      createdAt: updatedApp.createdAt.toISOString(),
    } as JobApplication;
  }

  async getDoctorByRegistrationNumber(
    registrationNumber: string,
  ): Promise<DoctorProfile | undefined> {
    const [doctor] = await db
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.registrationNumber, registrationNumber));
    return doctor ? mapDoctorProfile(doctor) : undefined;
  }

  async getPatientPayments(patientId: string): Promise<Payment[]> {
    const records = await db
      .select()
      .from(payments)
      .where(eq(payments.patientId, patientId))
      .orderBy(desc(payments.createdAt));

    return records.map((record) => ({
      ...record,
      createdAt: record.createdAt
        ? new Date(record.createdAt).toISOString()
        : new Date().toISOString(),
      updatedAt: record.updatedAt
        ? new Date(record.updatedAt).toISOString()
        : new Date().toISOString(),
    })) as unknown as Payment[];
  }

  async setPasswordResetOtp(
    id: string,
    otp: string,
    expiry: Date,
  ): Promise<void> {
    await db
      .update(users)
      .set({
        resetPasswordOtp: otp,
        resetPasswordOtpExpiry: expiry,
      })
      .where(eq(users.id, id));
  }

  async verifyPasswordResetOtp(id: string, otp: string): Promise<boolean> {
    const userList = await db.select().from(users).where(eq(users.id, id));
    const user = userList[0];

    if (
      !user ||
      user.resetPasswordOtp !== otp ||
      !user.resetPasswordOtpExpiry
    ) {
      return false;
    }

    if (new Date() > user.resetPasswordOtpExpiry) {
      return false;
    }

    await db
      .update(users)
      .set({
        resetPasswordOtp: null,
        resetPasswordOtpExpiry: null,
      })
      .where(eq(users.id, id));

    return true;
  }

  async getPaginatedDoctors(page: number, limit: number, search?: string, status?: string): Promise<any> {
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (status && status !== "all") {
        conditions.push(eq(doctorProfiles.status, status));
      }
      if (search) {
        conditions.push(
          or(
            ilike(users.fullName, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(doctorProfiles.registrationNumber, `%${search}%`)
          )
        );
      }

      let query = db
        .select({
          profile: doctorProfiles,
          user: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
            city: users.city,
            profileImage: users.profileImage,
          }
        })
        .from(doctorProfiles)
        .leftJoin(users, eq(doctorProfiles.userId, users.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const rawData = await query
        .orderBy(desc(doctorProfiles.createdAt))
        .limit(limit)
        .offset(offset);

      const allSpecs = await this.getAllSpecializations();
      const allHospitals = await this.getAllHospitals();

      const formattedData = rawData.map(row => {
        const specList = allSpecs.filter(s => row.profile.specializationIds?.includes(s.id));
        const hospList = allHospitals.filter(h => row.profile.hospitalIds?.includes(h.id));

        return {
          ...row.profile,
          createdAt: toISOString(row.profile.createdAt as any),
          updatedAt: toISOString(row.profile.updatedAt as any),
          user: row.user,
          specializations: specList,
          hospitals: hospList
        };
      });

      let countQuery = db.select({ count: sql`count(*)`.mapWith(Number) })
                         .from(doctorProfiles)
                         .leftJoin(users, eq(doctorProfiles.userId, users.id));
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as any;
      }
      const [{ count }] = await countQuery;

      const statsRaw = await db.select({
        status: doctorProfiles.status,
        count: sql`count(*)`.mapWith(Number)
      }).from(doctorProfiles).groupBy(doctorProfiles.status);

      const stats = { all: 0, pending: 0, verified: 0, rejected: 0, suspended: 0 };
      statsRaw.forEach(s => {
        if (s.status in stats) {
          (stats as any)[s.status] = s.count;
        }
        stats.all += s.count;
      });

      return {
        data: formattedData,
        totalCount: count,
        totalPages: Math.ceil(count / limit) || 1,
        currentPage: page,
        stats
      };
    } catch (error) {
      console.error("[DB] Error in getPaginatedDoctors:", error);
      throw error;
    }
  }

  async createDoctorCancellationCharge(data: {
    doctorId: string;
    appointmentId: string;
    consultationFee: number;
    amountOwed: number;
  }): Promise<void> {
    await db.insert(doctorCancellationCharges).values({
      doctorId: data.doctorId,
      appointmentId: data.appointmentId,
      consultationFee: data.consultationFee,
      amountOwed: data.amountOwed,
      settled: false,
    });
  }

  async getDoctorUnsettledCharges(doctorId: string): Promise<{ count: number; totalOwed: number }> {
    const rows = await db
      .select()
      .from(doctorCancellationCharges)
      .where(
        and(
          eq(doctorCancellationCharges.doctorId, doctorId),
          eq(doctorCancellationCharges.settled, false),
        ),
      );
    return {
      count: rows.length,
      totalOwed: rows.reduce((sum, r) => sum + r.amountOwed, 0),
    };
  }

  async settleDoctorCharges(doctorId: string): Promise<void> {
    await db
      .update(doctorCancellationCharges)
      .set({ settled: true, settledAt: new Date() })
      .where(
        and(
          eq(doctorCancellationCharges.doctorId, doctorId),
          eq(doctorCancellationCharges.settled, false),
        ),
      );
  }

  async createRefundRequest(data: InsertRefund): Promise<Refund> {
    const result = await db.insert(refunds).values(data).returning();
    return result[0] as Refund;
  }

  async getPaginatedRefundRequests(page: number, limit: number): Promise<any> {
    const offset = (page - 1) * limit;

    // single query to get refunds with payment, appointment, and patient details
    const rawData = await db
      .select({
        refund: refunds,
        payment: payments,
        appointment: appointments,
        patient: {
          id: users.id,
          fullName: users.fullName,
        },
      })
      .from(refunds)
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(appointments, eq(refunds.appointmentId, appointments.id))
      .leftJoin(users, eq(refunds.patientId, users.id))
      .orderBy(sql`CASE WHEN ${refunds.status} = 'pending' THEN 0 ELSE 1 END`, desc(refunds.createdAt))
      .limit(limit)
      .offset(offset);

    const formattedData = rawData.map(row => ({
      refund: row.refund,
      payment: {
        ...row.payment,
        createdAt: row.payment?.createdAt ? toISOString(row.payment.createdAt) : null,
      },
      appointment: row.appointment ? {
        ...row.appointment,
        patient: row.patient
      } : null
    }));

    const [{ count }] = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(refunds);

    return {
      data: formattedData,
      totalCount: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    };
  }

  async processRefund(refundId: string, status: string): Promise<any> {
    console.log(`\n[DB-STORAGE] ⚙️ Processing refund ID: ${refundId} with status: ${status}`);

    let refundRecord;

    // 1. Check if this is a "virtual" (legacy) refund request
    if (refundId.startsWith('virtual-')) {
      const originalAptId = refundId.replace('virtual-', '');

      // Fetch source data to create the permanent record
      const [apt] = await db.select().from(appointments).where(eq(appointments.id, originalAptId));
      const [pay] = await db.select().from(payments).where(eq(payments.appointmentId, originalAptId));

      if (!apt || !pay) {
        throw new Error("Could not find appointment or payment data for this virtual refund.");
      }

      // Calculate the original amount
      const amount = pay.totalAmount - (pay.bookingCharges || 0) - (pay.tax || 0);

      // Insert into DB
      const [inserted] = await db.insert(refunds).values({
        paymentId: pay.id,
        appointmentId: apt.id,
        patientId: apt.patientId,
        amount: amount,
        reason: apt.cancelReason || "Legacy cancellation (Auto-processed)",
        status: status, 
        processedAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      refundRecord = inserted;
    } else {
      // 2. Normal flow for existing DB records
      const [updated] = await db.update(refunds)
        .set({ status, processedAt: new Date(), updatedAt: new Date() })
        .where(eq(refunds.id, refundId))
        .returning();
      refundRecord = updated;
    }
      
    // 3. Sync Payments table if status is completed
    if (refundRecord && status === 'completed') {
      
      await db.update(payments)
        .set({ 
          status: PaymentStatus.REFUNDED, 
          refundAmount: refundRecord.amount, 
          refundReason: refundRecord.reason, 
          refundDate: new Date().toISOString().split('T')[0] 
        })
        .where(eq(payments.id, refundRecord.paymentId));
    }
    
    return refundRecord;
  }
}

export const dbStorage = new DbStorage();