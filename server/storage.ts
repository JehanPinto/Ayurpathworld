// storage.ts
import {
  type AdminDashboardStats,
  type Appointment,
  type AppointmentSlot,
  AppointmentStatus,
  type AppointmentWithDetails,
  type BlogSubmission,
  Career,
  type DoctorDashboardStats,
  type DoctorProfile,
  type DoctorSchedule,
  DoctorStatus,
  type DoctorWithDetails,
  type Hospital,
  type InsertAppointment,
  type InsertAppointmentSlot,
  type InsertBlogSubmission,
  InsertCareer,
  type InsertDoctorProfile,
  type InsertDoctorSchedule,
  type InsertHospital,
  InsertJobApplication,
  type InsertNotification,
  type InsertPayment,
  type InsertPlatformSettings,
  type InsertPrescription,
  type InsertReview,
  type InsertSpecialization,
  type InsertUser,
  JobApplication,
  type Notification,
  type PatientDashboardStats,
  type Payment,
  PaymentStatus,
  type PlatformSettings,
  type TaxEntry,
  type Prescription,
  type Review,
  type ReviewWithDoctor,
  type ReviewWithPatient,
  type Specialization,
  type SafeUser,
  type User,
  UserRole,
  type InsertRefund,
  type Refund,
  refunds,
  InsertRefund,
  payments,
  payments,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(
    id: string,
    updates: Partial<InsertUser>,
  ): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(role?: string): Promise<User[]>;

  getSpecialization(id: string): Promise<Specialization | undefined>;
  getAllSpecializations(): Promise<Specialization[]>;
  createSpecialization(spec: InsertSpecialization): Promise<Specialization>;
  updateSpecialization(
    id: string,
    updates: Partial<InsertSpecialization>,
  ): Promise<Specialization | undefined>;
  deleteSpecialization(id: string): Promise<boolean>;

  getHospital(id: string): Promise<Hospital | undefined>;
  getAllHospitals(): Promise<Hospital[]>;
  getHospitalsByCity(city: string): Promise<Hospital[]>;
  createHospital(hospital: InsertHospital): Promise<Hospital>;
  updateHospital(
    id: string,
    updates: Partial<InsertHospital>,
  ): Promise<Hospital | undefined>;
  deleteHospital(id: string): Promise<boolean>;

  getDoctorProfile(id: string): Promise<DoctorProfile | undefined>;
  getDoctorProfileByUserId(userId: string): Promise<DoctorProfile | undefined>;
  getDoctorWithDetails(
    doctorId: string,
  ): Promise<DoctorWithDetails | undefined>;
  getAllDoctors(filters?: {
    specializationId?: string;
    city?: string;
    status?: string;
    minRating?: number;
    consultationType?: string;
  }): Promise<DoctorWithDetails[]>;
  getVerifiedDoctors(): Promise<DoctorWithDetails[]>;
  getPendingDoctors(): Promise<DoctorWithDetails[]>;
  createDoctorProfile(profile: InsertDoctorProfile): Promise<DoctorProfile>;
  updateDoctorProfile(
    id: string,
    updates: Partial<InsertDoctorProfile>,
  ): Promise<DoctorProfile | undefined>;
  updateDoctorStatus(
    id: string,
    status: string,
    rejectionReason?: string,
  ): Promise<DoctorProfile | undefined>;
  addDoctorHospital(doctorProfileId: string, name: string, address: string): Promise<{ hospital: Hospital; hospitalIds: string[] } | null>;
  removeDoctorHospital(doctorProfileId: string, hospitalId: string): Promise<boolean>;

  getDoctorSchedules(doctorId: string): Promise<DoctorSchedule[]>;
  createDoctorSchedule(schedule: InsertDoctorSchedule): Promise<DoctorSchedule>;
  updateDoctorSchedule(
    id: string,
    updates: Partial<InsertDoctorSchedule>,
  ): Promise<DoctorSchedule | undefined>;
  deleteDoctorSchedule(id: string): Promise<boolean>;

  getAppointmentSlot(id: string): Promise<AppointmentSlot | undefined>;
  bookSlotAtomic(slotId: string): Promise<AppointmentSlot | null>;
  getAvailableSlots(doctorId: string, date: string): Promise<AppointmentSlot[]>;
  getDoctorSlots(
    doctorId: string,
    startDate: string,
    endDate: string,
  ): Promise<AppointmentSlot[]>;
  createAppointmentSlot(slot: InsertAppointmentSlot): Promise<AppointmentSlot>;
  updateAppointmentSlot(
    id: string,
    updates: Partial<InsertAppointmentSlot>,
  ): Promise<AppointmentSlot | undefined>;
  blockSlot(slotId: string): Promise<AppointmentSlot | undefined>;
  unblockSlot(slotId: string): Promise<AppointmentSlot | undefined>;
  deleteSlot(slotId: string): Promise<boolean>;

  getAppointment(id: string): Promise<Appointment | undefined>;
  getAppointmentWithDetails(
    id: string,
  ): Promise<AppointmentWithDetails | undefined>;
  getPatientAppointments(patientId: string): Promise<AppointmentWithDetails[]>;
  getDoctorAppointments(
    doctorId: string,
    date?: string,
  ): Promise<AppointmentWithDetails[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  bookAppointmentAtomic(
    appointment: InsertAppointment,
    slotId: string,
  ): Promise<Appointment | null>;
  bookAppointmentWithPaymentAtomic(
    appointment: InsertAppointment,
    paymentData: InsertPayment,
    slotId: string,
  ): Promise<{ appointment: Appointment; payment: Payment } | null>;
  updateAppointment(
    id: string,
    updates: Partial<InsertAppointment>,
  ): Promise<Appointment | undefined>;
  cancelAppointment(
    id: string,
    reason: string,
    cancelledBy: string,
  ): Promise<Appointment | undefined>;

  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByAppointment(appointmentId: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(
    id: string,
    updates: Partial<InsertPayment>,
  ): Promise<Payment | undefined>;

  getPrescription(id: string): Promise<Prescription | undefined>;
  getPrescriptionByAppointment(
    appointmentId: string,
  ): Promise<Prescription | undefined>;
  getPatientPrescriptions(patientId: string): Promise<Prescription[]>;
  createPrescription(prescription: InsertPrescription): Promise<Prescription>;
  updatePrescription(
    id: string,
    updates: Partial<InsertPrescription>,
  ): Promise<Prescription | undefined>;

  getReview(id: string): Promise<Review | undefined>;
  getReviewByAppointment(appointmentId: string): Promise<Review | undefined>;
  getDoctorReviews(doctorId: string): Promise<ReviewWithPatient[]>;
  getPatientReviews(patientId: string): Promise<ReviewWithDoctor[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(
    id: string,
    updates: Partial<InsertReview>,
  ): Promise<Review | undefined>;
  hideReview(id: string): Promise<Review | undefined>;
  deleteReview(id: string): Promise<boolean>;
  
  getUserNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotificationsByRelatedId(
    userId: string,
    relatedId: string,
  ): Promise<void>;

  getPatientDashboardStats(patientId: string): Promise<PatientDashboardStats>;
  getDoctorDashboardStats(doctorId: string): Promise<DoctorDashboardStats>;
  getAdminDashboardStats(): Promise<AdminDashboardStats>;

  getAllAppointments(): Promise<AppointmentWithDetails[]>;

  getDoctorPatients(doctorId: string): Promise<
    {
      patient: SafeUser;
      lastVisit: string;
      totalVisits: number;
      appointments: AppointmentWithDetails[];
    }[]
  >;
  getDoctorPayments(
    doctorId: string,
  ): Promise<(Payment & { appointment?: AppointmentWithDetails })[]>;
  getDoctorEarningsSummary(doctorId: string): Promise<{
    totalEarnings: number;
    pendingEarnings: number;
    completedPayments: number;
    pendingPayments: number;
    thisMonthEarnings: number;
    lastMonthEarnings: number;
  }>;
  createDoctorCancellationCharge(data: {
    doctorId: string;
    appointmentId: string;
    consultationFee: number;
    amountOwed: number;
  }): Promise<void>;
  getDoctorUnsettledCharges(doctorId: string): Promise<{
    count: number;
    totalOwed: number;
  }>;
  settleDoctorCharges(doctorId: string): Promise<void>;
  respondToReview(
    reviewId: string,
    response: string,
  ): Promise<Review | undefined>;
  markAppointmentAsCalled(
    appointmentId: string,
  ): Promise<Appointment | undefined>;
  completeAppointment(
    appointmentId: string,
    consultationNotes?: string,
  ): Promise<Appointment | undefined>;
  confirmAppointment(appointmentId: string): Promise<Appointment | undefined>;
  markAppointmentNoShow(
    appointmentId: string,
  ): Promise<Appointment | undefined>;
  updateUserStatus(id: string, isActive: boolean): Promise<User | undefined>;

  getPlatformSettings(): Promise<PlatformSettings>;
  updatePlatformSettings(
    updates: Partial<InsertPlatformSettings>,
  ): Promise<PlatformSettings>;
  getTaxEntries(): Promise<TaxEntry[]>;
  createTaxEntry(title: string, rate: number): Promise<TaxEntry>;
  deleteTaxEntry(id: string): Promise<boolean>;
  createJobApplication(
    application: InsertJobApplication,
  ): Promise<JobApplication>;
  getAllJobApplications(): Promise<JobApplication[]>;
  getAllCareers(): Promise<Career[]>;
  createCareer(career: InsertCareer): Promise<Career>;
  updateCareer(
    id: string,
    updates: Partial<InsertCareer>,
  ): Promise<Career | undefined>;
  deleteCareer(id: string): Promise<boolean>;
  updateApplicationStatus(
    id: string,
    status: string,
  ): Promise<JobApplication | undefined>;

  setPasswordResetOtp(id: string, otp: string, expiry: Date): Promise<void>;
  verifyPasswordResetOtp(id: string, otp: string): Promise<boolean>;

  createBlogSubmission(data: InsertBlogSubmission): Promise<BlogSubmission>;
  getAllBlogSubmissions(): Promise<BlogSubmission[]>;
  getPendingBlogSubmissions(): Promise<BlogSubmission[]>;
  getBlogSubmission(id: string): Promise<BlogSubmission | undefined>;
  approveBlogSubmission(id: string): Promise<BlogSubmission | undefined>;
  rejectBlogSubmission(
    id: string,
    rejectionReason: string,
  ): Promise<BlogSubmission | undefined>;
  getDoctorByRegistrationNumber(
    registrationNumber: string,
  ): Promise<DoctorProfile | undefined>;
  getPatientPayments(patientId: string): Promise<Payment[]>;
  createRefundRequest(data: InsertRefund): Promise<Refund>;
  processRefund(refundId: string, status: string): Promise<any>;
  getPaginatedPayments(page: number, limit: number): Promise<any>;
  getPaginatedRefundRequests(page: number, limit: number): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private specializations: Map<string, Specialization>;
  private hospitals: Map<string, Hospital>;
  private doctorProfiles: Map<string, DoctorProfile>;
  private doctorSchedules: Map<string, DoctorSchedule>;
  private appointmentSlots: Map<string, AppointmentSlot>;
  private appointments: Map<string, Appointment>;
  private payments: Map<string, Payment>;
  private prescriptions: Map<string, Prescription>;
  private reviews: Map<string, Review>;
  private notifications: Map<string, Notification>;
  private jobApplications: Map<string, JobApplication>;
  private careersMap = new Map<string, Career>();

  constructor() {
    this.users = new Map();
    this.specializations = new Map();
    this.hospitals = new Map();
    this.doctorProfiles = new Map();
    this.doctorSchedules = new Map();
    this.appointmentSlots = new Map();
    this.appointments = new Map();
    this.payments = new Map();
    this.prescriptions = new Map();
    this.reviews = new Map();
    this.notifications = new Map();
    this.jobApplications = new Map();
    this.careersMap = new Map();
    this.seedData();
  }

  private seedData() {
    const now = new Date().toISOString();

    const specializations: Specialization[] = [
      {
        id: "spec-1",
        name: "Panchakarma",
        description:
          "Traditional Ayurvedic detoxification and rejuvenation therapy",
        icon: "Leaf",
      },
      {
        id: "spec-2",
        name: "Kayachikitsa",
        description: "Internal medicine and general Ayurvedic treatment",
        icon: "Heart",
      },
      {
        id: "spec-3",
        name: "Rasayana",
        description: "Rejuvenation and anti-aging therapies",
        icon: "Sparkles",
      },
      {
        id: "spec-4",
        name: "Shalya Tantra",
        description: "Ayurvedic surgical procedures",
        icon: "Scissors",
      },
      {
        id: "spec-5",
        name: "Shalakya Tantra",
        description: "Treatment of eye, ear, nose, and throat diseases",
        icon: "Eye",
      },
      {
        id: "spec-6",
        name: "Kaumarbhritya",
        description: "Pediatric Ayurveda and child healthcare",
        icon: "Baby",
      },
      {
        id: "spec-7",
        name: "Prasuti Tantra",
        description: "Obstetrics and gynecology in Ayurveda",
        icon: "Users",
      },
      {
        id: "spec-8",
        name: "Mano Vigyan",
        description: "Ayurvedic psychiatry and mental health",
        icon: "Brain",
      },
    ];
    specializations.forEach((s) => this.specializations.set(s.id, s));

    const hospitals: Hospital[] = [
      {
        id: "hosp-1",
        name: "Ayurveda Central Hospital",
        address: "123 Temple Road, Fort",
        city: "Colombo",
        contactNumber: "+94112345678",
        email: "info@ayurvedacentral.lk",
        latitude: 6.9271,
        longitude: 79.8612,
        parkingAvailable: true,
        directions: "Near Fort Railway Station",
      },
      {
        id: "hosp-2",
        name: "Kandy Ayurveda Clinic",
        address: "45 Peradeniya Road",
        city: "Kandy",
        contactNumber: "+94812234567",
        email: "kandy@ayurvedacentral.lk",
        latitude: 7.2906,
        longitude: 80.6337,
        parkingAvailable: true,
        directions: "Opposite Kandy Lake",
      },
      {
        id: "hosp-3",
        name: "Galle Wellness Center",
        address: "78 Lighthouse Street",
        city: "Galle",
        contactNumber: "+94912234567",
        email: "galle@ayurvedacentral.lk",
        latitude: 6.0367,
        longitude: 80.217,
        parkingAvailable: false,
        directions: "Inside Galle Fort",
      },
    ];
    hospitals.forEach((h) => this.hospitals.set(h.id, h));

    const adminUser: User = {
      id: "user-admin",
      email: "admin@ayurvedicdoctor.lk",
      password: "$2b$10$dGYqVL.YsY0i3tOY8vUHxu4NqKQQrNqbHoI4kOSNjfCILvUwqe4IG",
      fullName: "System Administrator",
      phone: "+94771234567",
      role: UserRole.ADMIN,
      provider: "local",
      registrationComplete: true,
      preferredLanguages: ["english"],
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(adminUser.id, adminUser);

    const doctorUsers = [
      {
        id: "user-doc-1",
        email: "dr.silva@example.com",
        password:
          "$2b$10$dGYqVL.YsY0i3tOY8vUHxu4NqKQQrNqbHoI4kOSNjfCILvUwqe4IG",
        fullName: "Dr. Anura Silva",
        phone: "+94772345678",
        role: UserRole.DOCTOR,
        provider: "local",
        registrationComplete: true,
        gender: "male",
        city: "Colombo",
        preferredLanguages: ["english", "sinhala"],
        profileImage:
          "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400",
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-doc-2",
        email: "dr.fernando@example.com",
        password:
          "$2b$10$dGYqVL.YsY0i3tOY8vUHxu4NqKQQrNqbHoI4kOSNjfCILvUwqe4IG",
        fullName: "Dr. Kumari Fernando",
        phone: "+94773456789",
        role: UserRole.DOCTOR,
        provider: "local",
        registrationComplete: true,
        gender: "female",
        city: "Kandy",
        preferredLanguages: ["english", "sinhala", "tamil"],
        profileImage:
          "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400",
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "user-doc-3",
        email: "dr.perera@example.com",
        password:
          "$2b$10$dGYqVL.YsY0i3tOY8vUHxu4NqKQQrNqbHoI4kOSNjfCILvUwqe4IG",
        fullName: "Dr. Nihal Perera",
        phone: "+94774567890",
        role: UserRole.DOCTOR,
        provider: "local",
        registrationComplete: true,
        gender: "male",
        city: "Galle",
        preferredLanguages: ["english", "sinhala"],
        profileImage:
          "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400",
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    doctorUsers.forEach((u) => this.users.set(u.id, u as User));

    const doctorProfiles: DoctorProfile[] = [
      {
        id: "doc-1",
        userId: "user-doc-1",
        registrationNumber: "SLAMC-12345",
        qualifications: "BAMS (University of Colombo), MD in Panchakarma",
        biography:
          "Dr. Anura Silva is a renowned Ayurvedic physician with over 15 years of experience in Panchakarma therapy. He has treated thousands of patients and is known for his expertise in detoxification treatments.",
        specializationIds: ["spec-1", "spec-2"],
        languagesSpoken: ["english", "sinhala"],
        consultationTypes: ["in_person", "online"],
        hospitalIds: ["hosp-1"],
        consultationFee: 2500,
        onlineConsultationFee: 2000,
        status: DoctorStatus.VERIFIED,
        verificationDocuments: [],
        isAvailable: true,
        maxAdvanceBookingDays: 30,
        minBookingNoticeHours: 2,
        slotDurationMinutes: 30,
        bufferTimeMinutes: 10,
        averageRating: 4.8,
        totalReviews: 125,
        totalAppointments: 1250,
        currentQueueNumber: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "doc-2",
        userId: "user-doc-2",
        registrationNumber: "SLAMC-23456",
        qualifications: "BAMS (University of Kelaniya), Diploma in Rasayana",
        biography:
          "Dr. Kumari Fernando specializes in women's health and pediatric Ayurveda. She has a gentle approach and is particularly skilled in treating chronic conditions through Rasayana therapy.",
        specializationIds: ["spec-3", "spec-6", "spec-7"],
        languagesSpoken: ["english", "sinhala", "tamil"],
        consultationTypes: ["in_person", "online", "home_visit"],
        hospitalIds: ["hosp-2"],
        consultationFee: 2000,
        onlineConsultationFee: 1500,
        homeVisitFee: 5000,
        status: DoctorStatus.VERIFIED,
        verificationDocuments: [],
        isAvailable: true,
        maxAdvanceBookingDays: 14,
        minBookingNoticeHours: 4,
        slotDurationMinutes: 45,
        bufferTimeMinutes: 15,
        averageRating: 4.9,
        totalReviews: 89,
        totalAppointments: 890,
        currentQueueNumber: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "doc-3",
        userId: "user-doc-3",
        registrationNumber: "SLAMC-34567",
        qualifications: "BAMS (University of Jaffna), MSc in Ayurveda",
        biography:
          "Dr. Nihal Perera focuses on mental health and stress-related disorders using Ayurvedic principles. His holistic approach combines traditional therapies with modern understanding of psychological wellness.",
        specializationIds: ["spec-8", "spec-3"],
        languagesSpoken: ["english", "sinhala"],
        consultationTypes: ["in_person", "online"],
        hospitalIds: ["hosp-3"],
        consultationFee: 1800,
        onlineConsultationFee: 1500,
        status: DoctorStatus.VERIFIED,
        verificationDocuments: [],
        isAvailable: true,
        maxAdvanceBookingDays: 21,
        minBookingNoticeHours: 3,
        slotDurationMinutes: 30,
        bufferTimeMinutes: 10,
        averageRating: 4.6,
        totalReviews: 45,
        totalAppointments: 450,
        currentQueueNumber: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];
    doctorProfiles.forEach((p) => this.doctorProfiles.set(p.id, p));

    const patientUser: User = {
      id: "user-patient-1",
      email: "patient@example.com",
      password: "$2b$10$dGYqVL.YsY0i3tOY8vUHxu4NqKQQrNqbHoI4kOSNjfCILvUwqe4IG",
      fullName: "Saman Jayawardena",
      phone: "+94775678901",
      role: UserRole.PATIENT,
      gender: "male",
      city: "Colombo",
      preferredLanguages: ["english", "sinhala"],
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(patientUser.id, patientUser);

    this.generateAppointmentSlots();
  }

  private generateAppointmentSlots() {
    const doctors = Array.from(this.doctorProfiles.values());
    const today = new Date();

    doctors.forEach((doctor) => {
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(today);
        date.setDate(today.getDate() + dayOffset);
        const dateStr = date.toISOString().split("T")[0];

        const morningSlots = [
          "09:00",
          "09:30",
          "10:00",
          "10:30",
          "11:00",
          "11:30",
        ];
        const afternoonSlots = [
          "14:00",
          "14:30",
          "15:00",
          "15:30",
          "16:00",
          "16:30",
        ];

        [...morningSlots, ...afternoonSlots].forEach((startTime, index) => {
          const endMinutes =
            parseInt(startTime.split(":")[1]) + doctor.slotDurationMinutes;
          const endHour =
            parseInt(startTime.split(":")[0]) + Math.floor(endMinutes / 60);
          const endMins = endMinutes % 60;
          const endTime = `${endHour.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;

          const slot: AppointmentSlot = {
            id: `slot-${doctor.id}-${dateStr}-${index}`,
            doctorId: doctor.id,
            hospitalId: doctor.hospitalIds[0],
            date: dateStr,
            startTime,
            endTime,
            consultationType: index % 3 === 0 ? "online" : "in_person",
            isBooked: Math.random() < 0.2,
            isBlocked: false,
          };
          this.appointmentSlots.set(slot.id, slot);
        });
      }
    });
  }

  async createJobApplication(
    application: InsertJobApplication,
  ): Promise<JobApplication> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newApp: JobApplication = {
      ...application,
      id,
      status: "pending",
      createdAt: now,
    };
    this.jobApplications.set(id, newApp);
    return newApp;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const user: User = {
      provider: insertUser.provider ?? "local",
      providerId: insertUser.providerId,
      registrationComplete: insertUser.registrationComplete ?? true,
      googleId: (insertUser as any).googleId,
      ...insertUser,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(
    id: string,
    updates: Partial<InsertUser>,
  ): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(role?: string): Promise<User[]> {
    const users = Array.from(this.users.values());
    if (role) return users.filter((u) => u.role === role);
    return users;
  }

  async getSpecialization(id: string): Promise<Specialization | undefined> {
    return this.specializations.get(id);
  }

  async getAllSpecializations(): Promise<Specialization[]> {
    return Array.from(this.specializations.values());
  }

  async createSpecialization(
    spec: InsertSpecialization,
  ): Promise<Specialization> {
    const id = randomUUID();
    const specialization: Specialization = { ...spec, id };
    this.specializations.set(id, specialization);
    return specialization;
  }

  async updateSpecialization(
    id: string,
    updates: Partial<InsertSpecialization>,
  ): Promise<Specialization | undefined> {
    const spec = this.specializations.get(id);
    if (!spec) return undefined;
    const updated = { ...spec, ...updates };
    this.specializations.set(id, updated);
    return updated;
  }

  async deleteSpecialization(id: string): Promise<boolean> {
    return this.specializations.delete(id);
  }

  async getHospital(id: string): Promise<Hospital | undefined> {
    return this.hospitals.get(id);
  }

  async getAllHospitals(): Promise<Hospital[]> {
    return Array.from(this.hospitals.values());
  }

  async getHospitalsByCity(city: string): Promise<Hospital[]> {
    return Array.from(this.hospitals.values()).filter((h) =>
      h.city.toLowerCase().includes(city.toLowerCase()),
    );
  }

  async createHospital(hospital: InsertHospital): Promise<Hospital> {
    const id = randomUUID();
    const h: Hospital = { ...hospital, id };
    this.hospitals.set(id, h);
    return h;
  }

  async updateHospital(
    id: string,
    updates: Partial<InsertHospital>,
  ): Promise<Hospital | undefined> {
    const hospital = this.hospitals.get(id);
    if (!hospital) return undefined;
    const updated = { ...hospital, ...updates };
    this.hospitals.set(id, updated);
    return updated;
  }

  async deleteHospital(id: string): Promise<boolean> {
    return this.hospitals.delete(id);
  }

  async getDoctorProfile(id: string): Promise<DoctorProfile | undefined> {
    return this.doctorProfiles.get(id);
  }

  async getDoctorProfileByUserId(
    userId: string,
  ): Promise<DoctorProfile | undefined> {
    return Array.from(this.doctorProfiles.values()).find(
      (p) => p.userId === userId,
    );
  }

  async getDoctorWithDetails(
    doctorId: string,
  ): Promise<DoctorWithDetails | undefined> {
    const profile = this.doctorProfiles.get(doctorId);
    if (!profile) return undefined;

    const user = await this.getUser(profile.userId);
    if (!user) return undefined;

    const specializations = profile.specializationIds
      .map((id) => this.specializations.get(id))
      .filter((s): s is Specialization => s !== undefined);

    const hospitals = profile.hospitalIds
      .map((id) => this.hospitals.get(id))
      .filter((h): h is Hospital => h !== undefined);

    return { ...profile, user, specializations, hospitals };
  }

  async getAllDoctors(filters?: {
    specializationId?: string;
    city?: string;
    status?: string;
    minRating?: number;
    consultationType?: string;
  }): Promise<DoctorWithDetails[]> {
    let profiles = Array.from(this.doctorProfiles.values());

    if (filters?.status) {
      profiles = profiles.filter((p) => p.status === filters.status);
    }

    if (filters?.specializationId) {
      profiles = profiles.filter((p) =>
        p.specializationIds.includes(filters.specializationId!),
      );
    }

    if (filters?.minRating) {
      profiles = profiles.filter((p) => p.averageRating >= filters.minRating!);
    }

    if (filters?.consultationType) {
      profiles = profiles.filter((p) =>
        p.consultationTypes.includes(filters.consultationType as any),
      );
    }

    const doctors: DoctorWithDetails[] = [];
    for (const profile of profiles) {
      const doctor = await this.getDoctorWithDetails(profile.id);
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
    const id = randomUUID();
    const now = new Date().toISOString();
    const p: DoctorProfile = {
      ...profile,
      id,
      averageRating: 0,
      totalReviews: 0,
      totalAppointments: 0,
      currentQueueNumber: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.doctorProfiles.set(id, p);
    return p;
  }

  async updateDoctorProfile(
    id: string,
    updates: Partial<InsertDoctorProfile>,
  ): Promise<DoctorProfile | undefined> {
    const profile = this.doctorProfiles.get(id);
    if (!profile) return undefined;
    const updated = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.doctorProfiles.set(id, updated);
    return updated;
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

  async addDoctorHospital(doctorProfileId: string, name: string, address: string): Promise<{ hospital: Hospital; hospitalIds: string[] } | null> {
    const profile = this.doctorProfiles.get(doctorProfileId);
    if (!profile) return null;
    const currentIds: string[] = (profile as any).hospitalIds || [];
    if (currentIds.length >= 5) return null;
    const hospId = randomUUID();
    const hospital: Hospital = { id: hospId, name, address, city: "", contactNumber: "N/A", parkingAvailable: false };
    this.hospitals.set(hospId, hospital);
    const newIds = [...currentIds, hospId];
    const updated = { ...profile, hospitalIds: newIds, updatedAt: new Date().toISOString() };
    this.doctorProfiles.set(doctorProfileId, updated as any);
    return { hospital, hospitalIds: newIds };
  }

  async removeDoctorHospital(doctorProfileId: string, hospitalId: string): Promise<boolean> {
    const profile = this.doctorProfiles.get(doctorProfileId);
    if (!profile) return false;
    const currentIds: string[] = (profile as any).hospitalIds || [];
    const newIds = currentIds.filter((id) => id !== hospitalId);
    const updated = { ...profile, hospitalIds: newIds, updatedAt: new Date().toISOString() };
    this.doctorProfiles.set(doctorProfileId, updated as any);
    return true;
  }

  async getDoctorSchedules(doctorId: string): Promise<DoctorSchedule[]> {
    return Array.from(this.doctorSchedules.values()).filter(
      (s) => s.doctorId === doctorId,
    );
  }

  async createDoctorSchedule(
    schedule: InsertDoctorSchedule,
  ): Promise<DoctorSchedule> {
    const id = randomUUID();
    const s: DoctorSchedule = { ...schedule, id };
    this.doctorSchedules.set(id, s);
    return s;
  }

  async updateDoctorSchedule(
    id: string,
    updates: Partial<InsertDoctorSchedule>,
  ): Promise<DoctorSchedule | undefined> {
    const schedule = this.doctorSchedules.get(id);
    if (!schedule) return undefined;
    const updated = { ...schedule, ...updates };
    this.doctorSchedules.set(id, updated);
    return updated;
  }

  async deleteDoctorSchedule(id: string): Promise<boolean> {
    return this.doctorSchedules.delete(id);
  }

  async getAppointmentSlot(id: string): Promise<AppointmentSlot | undefined> {
    return this.appointmentSlots.get(id);
  }

  async getAvailableSlots(
    doctorId: string,
    date: string,
  ): Promise<AppointmentSlot[]> {
    return Array.from(this.appointmentSlots.values()).filter(
      (s) =>
        s.doctorId === doctorId &&
        s.date === date &&
        !s.isBooked &&
        !s.isBlocked,
    );
  }

  async getDoctorSlots(
    doctorId: string,
    startDate: string,
    endDate: string,
  ): Promise<AppointmentSlot[]> {
    return Array.from(this.appointmentSlots.values()).filter(
      (s) =>
        s.doctorId === doctorId && s.date >= startDate && s.date <= endDate,
    );
  }

  async createAppointmentSlot(
    slot: InsertAppointmentSlot,
  ): Promise<AppointmentSlot> {
    const id = randomUUID();
    const s: AppointmentSlot = { ...slot, id };
    this.appointmentSlots.set(id, s);
    return s;
  }

  async updateAppointmentSlot(
    id: string,
    updates: Partial<InsertAppointmentSlot>,
  ): Promise<AppointmentSlot | undefined> {
    const slot = this.appointmentSlots.get(id);
    if (!slot) return undefined;
    const updated = { ...slot, ...updates };
    this.appointmentSlots.set(id, updated);
    return updated;
  }

  async blockSlot(slotId: string): Promise<AppointmentSlot | undefined> {
    return this.updateAppointmentSlot(slotId, { isBlocked: true });
  }

  async unblockSlot(slotId: string): Promise<AppointmentSlot | undefined> {
    return this.updateAppointmentSlot(slotId, { isBlocked: false });
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async getAppointmentWithDetails(
    id: string,
  ): Promise<AppointmentWithDetails | undefined> {
    const appointment = this.appointments.get(id);
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

  async getPatientAppointments(
    patientId: string,
  ): Promise<AppointmentWithDetails[]> {
    const appointments = Array.from(this.appointments.values())
      .filter((a) => a.patientId === patientId)
      .sort(
        (a, b) =>
          new Date(b.appointmentDate).getTime() -
          new Date(a.appointmentDate).getTime(),
      );

    const detailed: AppointmentWithDetails[] = [];
    for (const apt of appointments) {
      const details = await this.getAppointmentWithDetails(apt.id);
      if (details) detailed.push(details);
    }
    return detailed;
  }

  async getDoctorAppointments(
    doctorId: string,
    date?: string,
  ): Promise<AppointmentWithDetails[]> {
    let appointments = Array.from(this.appointments.values()).filter(
      (a) => a.doctorId === doctorId,
    );

    if (date) {
      appointments = appointments.filter((a) => a.appointmentDate === date);
    }

    appointments.sort((a, b) => {
      const dateCompare = a.appointmentDate.localeCompare(b.appointmentDate);
      if (dateCompare !== 0) return dateCompare;
      return a.appointmentTime.localeCompare(b.appointmentTime);
    });

    const detailed: AppointmentWithDetails[] = [];
    for (const apt of appointments) {
      const details = await this.getAppointmentWithDetails(apt.id);
      if (details) detailed.push(details);
    }
    return detailed;
  }

  async createAppointment(
    appointment: InsertAppointment,
  ): Promise<Appointment> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const a: Appointment = {
      ...appointment,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.appointments.set(id, a);

    await this.updateAppointmentSlot(appointment.slotId, { isBooked: true });

    const profile = await this.getDoctorProfile(appointment.doctorId);
    if (profile) {
      await this.updateDoctorProfile(profile.id, {
        totalAppointments: profile.totalAppointments + 1,
        currentQueueNumber: profile.currentQueueNumber + 1,
      });
    }

    return a;
  }

  async bookAppointmentAtomic(
    appointment: InsertAppointment,
    slotId: string,
  ): Promise<Appointment | null> {
    // In-memory version: check slot availability "atomically"
    const slot = this.appointmentSlots.get(slotId);
    if (!slot || slot.isBooked || slot.isBlocked) {
      return null;
    }

    // "Lock" the slot
    const updatedSlot = { ...slot, isBooked: true };
    this.appointmentSlots.set(slotId, updatedSlot);

    // Create appointment
    const id = randomUUID();
    const now = new Date().toISOString();
    const a: Appointment = {
      ...appointment,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.appointments.set(id, a);

    // Update doctor profile stats
    const profile = await this.getDoctorProfile(appointment.doctorId);
    if (profile) {
      await this.updateDoctorProfile(profile.id, {
        totalAppointments: profile.totalAppointments + 1,
        currentQueueNumber: profile.currentQueueNumber + 1,
      });
    }

    return a;
  }

  async bookAppointmentWithPaymentAtomic(
    appointment: InsertAppointment,
    paymentData: InsertPayment,
    slotId: string,
  ): Promise<{ appointment: Appointment; payment: Payment } | null> {
    // In-memory version: simulate atomic transaction
    const slot = this.appointmentSlots.get(slotId);
    if (!slot || slot.isBooked || slot.isBlocked) {
      return null;
    }

    // "Lock" the slot
    const updatedSlot = { ...slot, isBooked: true };
    this.appointmentSlots.set(slotId, updatedSlot);

    // Create appointment
    const appointmentId = randomUUID();
    const now = new Date().toISOString();
    const a: Appointment = {
      ...appointment,
      id: appointmentId,
      createdAt: now,
      updatedAt: now,
    };
    this.appointments.set(appointmentId, a);

    // Create payment record
    const paymentId = randomUUID();
    const p: Payment = {
      ...paymentData,
      id: paymentId,
      appointmentId: appointmentId,
      createdAt: now,
      updatedAt: now,
    };
    this.payments.set(paymentId, p);

    // Update doctor profile stats
    const profile = await this.getDoctorProfile(appointment.doctorId);
    if (profile) {
      await this.updateDoctorProfile(profile.id, {
        totalAppointments: profile.totalAppointments + 1,
        currentQueueNumber: profile.currentQueueNumber + 1,
      });
    }

    return { appointment: a, payment: p };
  }

  async updateAppointment(
    id: string,
    updates: Partial<InsertAppointment>,
  ): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    const updated = {
      ...appointment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.appointments.set(id, updated);
    return updated;
  }

  async cancelAppointment(
    id: string,
    reason: string,
    cancelledBy: string,
  ): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;

    const updated = await this.updateAppointment(id, {
      status: AppointmentStatus.CANCELLED,
      cancelReason: reason,
      cancelledBy: cancelledBy as any,
    });

    if (updated) {
      await db
        .update(appointmentSlots)
        .set({ isBooked: false })
        .where(eq(appointmentSlots.id, updated.slotId));

      // Create a Pending Refund Record automatically when cancelled
      const payment = await this.getPaymentByAppointment(existing.id);
      if (payment && payment.status === PaymentStatus.COMPLETED) {
        const amountToRefund = payment.totalAmount - (payment.bookingCharges || 0) - (payment.tax || 0);
        if (amountToRefund > 0) {
          await this.createRefundRequest({
            paymentId: payment.id,
            appointmentId: existing.id,
            patientId: existing.patientId,
            amount: amountToRefund,
            reason: reason || `Cancelled by ${cancelledBy}`,
            status: "pending"
          });
        }
      }
    }

    return updated;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    return this.payments.get(id);
  }

  async getPaymentByAppointment(
    appointmentId: string,
  ): Promise<Payment | undefined> {
    return Array.from(this.payments.values()).find(
      (p) => p.appointmentId === appointmentId,
    );
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const p: Payment = { ...payment, id, createdAt: now, updatedAt: now };
    this.payments.set(id, p);
    return p;
  }

  async updatePayment(
    id: string,
    updates: Partial<InsertPayment>,
  ): Promise<Payment | undefined> {
    const payment = this.payments.get(id);
    if (!payment) return undefined;
    const updated = {
      ...payment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.payments.set(id, updated);
    return updated;
  }

  async getPrescription(id: string): Promise<Prescription | undefined> {
    return this.prescriptions.get(id);
  }

  async getPrescriptionByAppointment(
    appointmentId: string,
  ): Promise<Prescription | undefined> {
    return Array.from(this.prescriptions.values()).find(
      (p) => p.appointmentId === appointmentId,
    );
  }

  async getPatientPrescriptions(patientId: string): Promise<Prescription[]> {
    return Array.from(this.prescriptions.values())
      .filter((p) => p.patientId === patientId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async createPrescription(
    prescription: InsertPrescription,
  ): Promise<Prescription> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const p: Prescription = { ...prescription, id, createdAt: now };
    this.prescriptions.set(id, p);
    return p;
  }

  async updatePrescription(
    id: string,
    updates: Partial<InsertPrescription>,
  ): Promise<Prescription | undefined> {
    const prescription = this.prescriptions.get(id);
    if (!prescription) return undefined;
    const updated = { ...prescription, ...updates };
    this.prescriptions.set(id, updated);
    return updated;
  }

  async getReview(id: string): Promise<Review | undefined> {
    return this.reviews.get(id);
  }

  async getReviewByAppointment(
    appointmentId: string,
  ): Promise<Review | undefined> {
    return Array.from(this.reviews.values()).find(
      (r) => r.appointmentId === appointmentId,
    );
  }

  async getDoctorReviews(doctorId: string): Promise<ReviewWithPatient[]> {
    const reviews = Array.from(this.reviews.values())
      .filter((r) => r.doctorId === doctorId && !r.isHidden)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const detailed: ReviewWithPatient[] = [];
    for (const review of reviews) {
      const patient = await this.getUser(review.patientId);
      if (patient) {
        detailed.push({ ...review, patient });
      }
    }
    return detailed;
  }

  async getPatientReviews(patientId: string): Promise<ReviewWithDoctor[]> {
    const reviews = Array.from(this.reviews.values())
      .filter((r) => r.patientId === patientId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const detailed: ReviewWithDoctor[] = [];
    for (const review of reviews) {
      const doctor = await this.getDoctorWithDetails(review.doctorId);
      if (doctor) {
        detailed.push({ ...review, doctor });
      }
    }
    return detailed;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const r: Review = { ...review, id, createdAt: now, updatedAt: now };
    this.reviews.set(id, r);

    const profile = await this.getDoctorProfile(review.doctorId);
    if (profile) {
      const totalRating =
        profile.averageRating * profile.totalReviews + review.rating;
      const newTotalReviews = profile.totalReviews + 1;
      await this.updateDoctorProfile(profile.id, {
        averageRating: totalRating / newTotalReviews,
        totalReviews: newTotalReviews,
      });
    }

    return r;
  }

  async updateReview(
    id: string,
    updates: Partial<InsertReview>,
  ): Promise<Review | undefined> {
    const review = this.reviews.get(id);
    if (!review) return undefined;
    const updated = {
      ...review,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.reviews.set(id, updated);
    return updated;
  }

  async hideReview(id: string): Promise<Review | undefined> {
    return this.updateReview(id, { isHidden: true });
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return (await this.getUserNotifications(userId)).filter((n) => !n.isRead);
  }

  async createNotification(
    notification: InsertNotification,
  ): Promise<Notification> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const n: Notification = { ...notification, id, createdAt: now };
    this.notifications.set(id, n);
    return n;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    const updated = { ...notification, isRead: true };
    this.notifications.set(id, updated);
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    const userNotifications = await this.getUserNotifications(userId);
    for (const n of userNotifications) {
      await this.markNotificationRead(n.id);
    }
  }

  async deleteNotificationsByRelatedId(
    userId: string,
    relatedId: string,
  ): Promise<void> {
    const all = await this.getUserNotifications(userId);
    for (const n of all.filter((n) => n.relatedId === relatedId)) {
      this.notifications.delete(n.id);
    }
  }

  async getPatientDashboardStats(
    patientId: string,
  ): Promise<PatientDashboardStats> {
    const appointments = Array.from(this.appointments.values()).filter(
      (a) => a.patientId === patientId,
    );
    const today = new Date().toISOString().split("T")[0];

    const upcoming = appointments.filter(
      (a) =>
        a.appointmentDate >= today &&
        [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
          a.status as any,
        ),
    ).length;

    const completed = appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;

    const payments = Array.from(this.payments.values()).filter(
      (p) => p.patientId === patientId && p.status === PaymentStatus.COMPLETED,
    );
    const totalSpent = payments.reduce((sum, p) => sum + p.totalAmount, 0);

    const prescriptions = Array.from(this.prescriptions.values()).filter(
      (p) => p.patientId === patientId,
    ).length;

    return {
      upcomingAppointments: upcoming,
      completedAppointments: completed,
      totalSpent,
      prescriptionsCount: prescriptions,
    };
  }

  async getDoctorDashboardStats(
    doctorId: string,
  ): Promise<DoctorDashboardStats> {
    const appointments = Array.from(this.appointments.values()).filter(
      (a) => a.doctorId === doctorId,
    );
    const today = new Date().toISOString().split("T")[0];

    const todayApts = appointments.filter(
      (a) => a.appointmentDate === today,
    ).length;
    const upcoming = appointments.filter(
      (a) =>
        a.appointmentDate >= today &&
        [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(
          a.status as any,
        ),
    ).length;
    const completed = appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;

    const payments = Array.from(this.payments.values()).filter(
      (p) => p.doctorId === doctorId,
    );
    const completedPayments = payments.filter(
      (p) => p.status === PaymentStatus.COMPLETED,
    );
    const pendingPayments = payments.filter(
      (p) => p.status === PaymentStatus.PENDING,
    );

    const totalEarnings = completedPayments.reduce(
      (sum, p) => sum + p.doctorEarnings,
      0,
    );
    const pendingEarnings = pendingPayments.reduce(
      (sum, p) => sum + p.doctorEarnings,
      0,
    );

    const profile = await this.getDoctorProfile(doctorId);

    return {
      todayAppointments: todayApts,
      upcomingAppointments: upcoming,
      completedAppointments: completed,
      totalEarnings,
      pendingEarnings,
      averageRating: profile?.averageRating || 0,
      totalReviews: profile?.totalReviews || 0,
      currentQueueNumber: profile?.currentQueueNumber || 0,
    };
  }

  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const patients = Array.from(this.users.values()).filter(
      (u) => u.role === UserRole.PATIENT,
    ).length;
    const allDoctors = Array.from(this.doctorProfiles.values());
    const verified = allDoctors.filter(
      (d) => d.status === DoctorStatus.VERIFIED,
    ).length;
    const pending = allDoctors.filter(
      (d) => d.status === DoctorStatus.PENDING,
    ).length;

    const appointments = Array.from(this.appointments.values());
    const today = new Date().toISOString().split("T")[0];
    const todayApts = appointments.filter(
      (a) => a.appointmentDate === today,
    ).length;

    const payments = Array.from(this.payments.values()).filter(
      (p) => p.status === PaymentStatus.COMPLETED,
    );
    const totalRevenue = payments.reduce((sum, p) => sum + p.totalAmount, 0);
    const platformEarnings = payments.reduce(
      (sum, p) => sum + p.platformCommission,
      0,
    );

    return {
      totalPatients: patients,
      totalDoctors: allDoctors.length,
      verifiedDoctors: verified,
      pendingDoctors: pending,
      totalAppointments: appointments.length,
      todayAppointments: todayApts,
      totalRevenue,
      platformEarnings,
    };
  }

  async updateUserStatus(
    id: string,
    isActive: boolean,
  ): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, isActive, updatedAt: new Date().toISOString() };
    this.users.set(id, updated);
    return updated;
  }

  async respondToReview(
    _reviewId: string,
    _response: string,
  ): Promise<Review | undefined> {
    return undefined;
  }

  async markAppointmentAsCalled(
    _appointmentId: string,
  ): Promise<Appointment | undefined> {
    return undefined;
  }

  async completeAppointment(
    _appointmentId: string,
    _consultationNotes?: string,
  ): Promise<Appointment | undefined> {
    return undefined;
  }

  async confirmAppointment(
    _appointmentId: string,
  ): Promise<Appointment | undefined> {
    return undefined;
  }

  async markAppointmentNoShow(
    appointmentId: string,
  ): Promise<Appointment | undefined> {
    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.NO_SHOW,
    });
  }

  private platformSettings: PlatformSettings = {
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
    updatedAt: new Date().toISOString(),
  };

  async getPlatformSettings(): Promise<PlatformSettings> {
    return this.platformSettings;
  }

  async updatePlatformSettings(
    updates: Partial<InsertPlatformSettings>,
  ): Promise<PlatformSettings> {
    this.platformSettings = {
      ...this.platformSettings,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return this.platformSettings;
  }

  private taxEntries: TaxEntry[] = [];

  async getTaxEntries(): Promise<TaxEntry[]> {
    return this.taxEntries;
  }

  async createTaxEntry(title: string, rate: number): Promise<TaxEntry> {
    const entry: TaxEntry = { id: randomUUID(), title, rate, createdAt: new Date().toISOString() };
    this.taxEntries.push(entry);
    return entry;
  }

  async deleteTaxEntry(id: string): Promise<boolean> {
    const idx = this.taxEntries.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    this.taxEntries.splice(idx, 1);
    return true;
  }

  async getDoctorByRegistrationNumber(
    registrationNumber: string,
  ): Promise<DoctorProfile | undefined> {
    return Array.from(this.doctorProfiles.values()).find(
      (profile) => profile.registrationNumber === registrationNumber,
    );
  }
  async getAllCareers(): Promise<Career[]> {
    return Array.from(this.careersMap.values()).sort(
      (a, b) =>
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime(),
    );
  }

  async createCareer(career: InsertCareer): Promise<Career> {
    const id = randomUUID();
    const now = new Date();
    const newCareer: Career = {
      ...career,
      id,
      createdAt: now,
      updatedAt: now,
    } as Career;
    this.careersMap.set(id, newCareer);
    return newCareer;
  }

  async updateCareer(
    id: string,
    updates: Partial<InsertCareer>,
  ): Promise<Career | undefined> {
    const existing = this.careersMap.get(id);
    if (!existing) return undefined;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    } as Career;
    this.careersMap.set(id, updated);
    return updated;
  }

  async deleteCareer(id: string): Promise<boolean> {
    return this.careersMap.delete(id);
  }

  async setPasswordResetOtp(
    id: string,
    otp: string,
    expiry: Date,
  ): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.resetPasswordOtp = otp;
      user.resetPasswordOtpExpiry = expiry.toISOString();
    }
  }

  async verifyPasswordResetOtp(id: string, otp: string): Promise<boolean> {
    const user = this.users.get(id);
    if (
      !user ||
      user.resetPasswordOtp !== otp ||
      !user.resetPasswordOtpExpiry
    ) {
      return false;
    }
    if (new Date() > new Date(user.resetPasswordOtpExpiry)) {
      return false;
    }
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpiry = undefined;
    return true;
  }

  async createRefundRequest(data: InsertRefund): Promise<Refund> {
    const result = await db.insert(refunds).values(data).returning();
    return result[0] as Refund;
  }

  async getRefundRequests(): Promise<any[]> {
    // 1. Get all cancelled appointments
    const cancelledApts = await db
      .select()
      .from(appointments)
      .where(eq(appointments.status, AppointmentStatus.CANCELLED));

    if (cancelledApts.length === 0) return [];

    const aptIds = cancelledApts.map((a) => a.id);

    // 2. Get the corresponding payments for these appointments
    const relatedPayments = await db
      .select()
      .from(payments)
      .where(inArray(payments.appointmentId, aptIds));

    // 3. Get the refund records
    const allRefunds = await db
      .select()
      .from(refunds)
      .where(inArray(refunds.appointmentId, aptIds));

    const results = [];
    
    // Combine them with full patient/doctor details
    for (const r of allRefunds) {
      const app = await this.getAppointmentWithDetails(r.appointmentId);
      const payment = relatedPayments.find(p => p.id === r.paymentId);
      if (app && payment) {
        results.push({ 
          refund: r,
          payment: {
            ...payment,
            createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: payment.updatedAt ? new Date(payment.updatedAt).toISOString() : new Date().toISOString(),
          }, 
          appointment: app 
        });
      }
    }

    // Sort by pending first, then by date
    return results.sort((a, b) => {
      if (a.refund.status === 'pending' && b.refund.status !== 'pending') return -1;
      if (a.refund.status !== 'pending' && b.refund.status === 'pending') return 1;
      return new Date(b.refund.createdAt).getTime() - new Date(a.refund.createdAt).getTime();
    });
  }

  async processRefund(refundId: string, status: string): Promise<any> {
    const result = await db.update(refunds)
      .set({ status, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(refunds.id, refundId))
      .returning();
      
    // If approved, update the original payment table too
    if (result[0] && status === 'completed') {
      await db.update(payments)
        .set({ 
          status: PaymentStatus.REFUNDED, 
          refundAmount: result[0].amount, 
          refundReason: result[0].reason, 
          refundDate: new Date().toISOString().split('T')[0] 
        })
        .where(eq(payments.id, result[0].paymentId));
    }
    
    return result[0];
  }
}

import { db } from "./db";
import { dbStorage } from "./db-storage";
import { inArray } from "drizzle-orm";

// Use database storage instead of in-memory storage
export const storage = dbStorage;