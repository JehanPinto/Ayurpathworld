import { db } from "./db";
import { users, specializations, hospitals, doctorProfiles, appointmentSlots } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  const existingSpecs = await db.select().from(specializations);
  if (existingSpecs.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  const hashedPassword = await bcrypt.hash("password123", 10);

  const specData = [
    { id: "spec-1", name: "Panchakarma", description: "Traditional Ayurvedic detoxification and rejuvenation therapy", icon: "Leaf" },
    { id: "spec-2", name: "Kayachikitsa", description: "Internal medicine and general Ayurvedic treatment", icon: "Heart" },
    { id: "spec-3", name: "Rasayana", description: "Rejuvenation and anti-aging therapies", icon: "Sparkles" },
    { id: "spec-4", name: "Shalya Tantra", description: "Ayurvedic surgical procedures", icon: "Scissors" },
    { id: "spec-5", name: "Shalakya Tantra", description: "Treatment of eye, ear, nose, and throat diseases", icon: "Eye" },
    { id: "spec-6", name: "Kaumarbhritya", description: "Pediatric Ayurveda and child healthcare", icon: "Baby" },
    { id: "spec-7", name: "Prasuti Tantra", description: "Obstetrics and gynecology in Ayurveda", icon: "Users" },
    { id: "spec-8", name: "Mano Vigyan", description: "Ayurvedic psychiatry and mental health", icon: "Brain" },
  ];
  await db.insert(specializations).values(specData);
  console.log("Specializations seeded");

  const hospitalData = [
    { id: "hosp-1", name: "Ayurveda Central Hospital", address: "123 Temple Road, Fort", city: "Colombo", contactNumber: "+94112345678", email: "info@ayurvedacentral.lk", latitude: 6.9271, longitude: 79.8612, parkingAvailable: true, directions: "Near Fort Railway Station" },
    { id: "hosp-2", name: "Kandy Ayurveda Clinic", address: "45 Peradeniya Road", city: "Kandy", contactNumber: "+94812234567", email: "kandy@ayurvedacentral.lk", latitude: 7.2906, longitude: 80.6337, parkingAvailable: true, directions: "Opposite Kandy Lake" },
    { id: "hosp-3", name: "Galle Wellness Center", address: "78 Lighthouse Street", city: "Galle", contactNumber: "+94912234567", email: "galle@ayurvedacentral.lk", latitude: 6.0367, longitude: 80.217, parkingAvailable: false, directions: "Inside Galle Fort" },
  ];
  await db.insert(hospitals).values(hospitalData);
  console.log("Hospitals seeded");

  await db.insert(users).values({
    id: "user-admin",
    email: "admin@ayurvedicdoctor.lk",
    password: hashedPassword,
    fullName: "System Administrator",
    phone: "+94771234567",
    role: "admin",
    preferredLanguages: ["english"],
    isEmailVerified: true,
    isPhoneVerified: true,
  });
  console.log("Admin user seeded");

  const doctorUsers = [
    {
      id: "user-doc-1",
      email: "dr.silva@example.com",
      password: hashedPassword,
      fullName: "Dr. Anura Silva",
      phone: "+94772345678",
      role: "doctor",
      gender: "male",
      city: "Colombo",
      preferredLanguages: ["english", "sinhala"],
      profileImage: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400",
      isEmailVerified: true,
      isPhoneVerified: true,
    },
    {
      id: "user-doc-2",
      email: "dr.fernando@example.com",
      password: hashedPassword,
      fullName: "Dr. Kumari Fernando",
      phone: "+94773456789",
      role: "doctor",
      gender: "female",
      city: "Kandy",
      preferredLanguages: ["english", "sinhala", "tamil"],
      profileImage: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400",
      isEmailVerified: true,
      isPhoneVerified: true,
    },
    {
      id: "user-doc-3",
      email: "dr.perera@example.com",
      password: hashedPassword,
      fullName: "Dr. Nihal Perera",
      phone: "+94774567890",
      role: "doctor",
      gender: "male",
      city: "Galle",
      preferredLanguages: ["english", "sinhala"],
      profileImage: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400",
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  ];
  await db.insert(users).values(doctorUsers);
  console.log("Doctor users seeded");

  const doctorProfileData = [
    {
      id: "doc-1",
      userId: "user-doc-1",
      registrationNumber: "SLAMC-12345",
      qualifications: "BAMS (University of Colombo), MD in Panchakarma",
      biography: "Dr. Anura Silva is a renowned Ayurvedic physician with over 15 years of experience in Panchakarma therapy. He has treated thousands of patients and is known for his expertise in detoxification treatments.",
      specializationIds: ["spec-1", "spec-2"],
      languagesSpoken: ["english", "sinhala"],
      consultationTypes: ["in_person", "online"],
      hospitalIds: ["hosp-1"],
      consultationFee: 2500,
      onlineConsultationFee: 2000,
      status: "verified",
      isAvailable: true,
      averageRating: 4.8,
      totalReviews: 125,
      totalAppointments: 1250,
    },
    {
      id: "doc-2",
      userId: "user-doc-2",
      registrationNumber: "SLAMC-23456",
      qualifications: "BAMS (University of Kelaniya), Diploma in Rasayana",
      biography: "Dr. Kumari Fernando specializes in women's health and pediatric Ayurveda. She has a gentle approach and is particularly skilled in treating chronic conditions through Rasayana therapy.",
      specializationIds: ["spec-3", "spec-6", "spec-7"],
      languagesSpoken: ["english", "sinhala", "tamil"],
      consultationTypes: ["in_person", "online", "home_visit"],
      hospitalIds: ["hosp-2"],
      consultationFee: 2000,
      onlineConsultationFee: 1500,
      homeVisitFee: 5000,
      status: "verified",
      isAvailable: true,
      averageRating: 4.9,
      totalReviews: 89,
      totalAppointments: 890,
    },
    {
      id: "doc-3",
      userId: "user-doc-3",
      registrationNumber: "SLAMC-34567",
      qualifications: "BAMS (University of Jaffna), MSc in Ayurveda",
      biography: "Dr. Nihal Perera focuses on mental health and stress-related disorders using Ayurvedic principles. His holistic approach combines traditional therapies with modern understanding of psychological wellness.",
      specializationIds: ["spec-8", "spec-3"],
      languagesSpoken: ["english", "sinhala"],
      consultationTypes: ["in_person", "online"],
      hospitalIds: ["hosp-3"],
      consultationFee: 1800,
      onlineConsultationFee: 1500,
      status: "verified",
      isAvailable: true,
      averageRating: 4.6,
      totalReviews: 45,
      totalAppointments: 450,
    },
  ];
  await db.insert(doctorProfiles).values(doctorProfileData);
  console.log("Doctor profiles seeded");

  await db.insert(users).values({
    id: "user-patient-1",
    email: "patient@example.com",
    password: hashedPassword,
    fullName: "Saman Jayawardena",
    phone: "+94775678901",
    role: "patient",
    gender: "male",
    city: "Colombo",
    preferredLanguages: ["english", "sinhala"],
    isEmailVerified: true,
    isPhoneVerified: true,
  });
  console.log("Patient user seeded");

  const today = new Date();
  const slotsToInsert: any[] = [];
  
  for (const doctorId of ["doc-1", "doc-2", "doc-3"]) {
    const doctor = doctorProfileData.find(d => d.id === doctorId)!;
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      
      const morningSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
      const afternoonSlots = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
      
      [...morningSlots, ...afternoonSlots].forEach((startTime, index) => {
        const slotDuration = 30;
        const endMinutes = parseInt(startTime.split(':')[1]) + slotDuration;
        const endHour = parseInt(startTime.split(':')[0]) + Math.floor(endMinutes / 60);
        const endMins = endMinutes % 60;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        
        slotsToInsert.push({
          id: `slot-${doctorId}-${dateStr}-${index}`,
          doctorId,
          hospitalId: doctor.hospitalIds[0],
          date: dateStr,
          startTime,
          endTime,
          consultationType: index % 3 === 0 ? "online" : "in_person",
          isBooked: false,
          isBlocked: false,
        });
      });
    }
  }
  
  for (let i = 0; i < slotsToInsert.length; i += 100) {
    const batch = slotsToInsert.slice(i, i + 100);
    await db.insert(appointmentSlots).values(batch);
  }
  console.log(`${slotsToInsert.length} appointment slots seeded`);

  console.log("Database seeding completed!");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
