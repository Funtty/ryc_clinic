import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// One-time migration helper: snapshot the current SQLite database to
// scripts/_sqlite-dump.json (must be run while the prisma client is still the
// sqlite build) so it can be rehydrated into Supabase Postgres afterwards.
// Seeded/dev sample rows (RYC-DEV* appointments, @ryc.example patients/users)
// are filtered out — only real records are migrated.

const prisma = new PrismaClient();

const DEV_APPOINTMENT_RE = /^RYC-DEV/i;
const EXAMPLE_USER_RE = /@ryc\.example$/i;
const EXAMPLE_PATIENT_RE = /@ryc\.example$/i;

async function main() {
  console.log("Reading SQLite via", process.env.DATABASE_URL);

  const appointments = await prisma.appointment.findMany();
  const keptAppointments = appointments.filter((a) => !DEV_APPOINTMENT_RE.test(a.reference));
  const keptAppointmentIds = new Set(keptAppointments.map((a) => a.id));
  const skippedApptRefs = appointments
    .filter((a) => !keptAppointmentIds.has(a.id))
    .map((a) => a.reference);

  const patients = await prisma.patient.findMany();
  const keptPatients = patients.filter((p) => !EXAMPLE_PATIENT_RE.test((p.email ?? "").toLowerCase()));
  const keptPatientIds = new Set(keptPatients.map((p) => p.id));
  const skippedPatEmails = patients
    .filter((p) => !keptPatientIds.has(p.id))
    .map((p) => p.email);

  const users = (await prisma.user.findMany()).filter(
    (u) => !EXAMPLE_USER_RE.test((u.email ?? "").toLowerCase()),
  );
  const keptUserIds = new Set(users.map((u) => u.id));

  const sessions = (await prisma.session.findMany()).filter((s) => keptUserIds.has(s.userId));
  const dentists = await prisma.dentist.findMany();
  const services = await prisma.service.findMany({ include: { dentists: { select: { id: true } } } });
  const serviceDentistPairs = services.flatMap((s) =>
    s.dentists.map((d) => ({ serviceId: s.id, dentistId: d.id })),
  );
  const clinicHours = await prisma.clinicHours.findMany();
  const dentistSchedules = await prisma.dentistSchedule.findMany();
  const blockedDates = await prisma.blockedDate.findMany();
  const payments = (await prisma.payment.findMany()).filter((p) =>
    keptAppointmentIds.has(p.appointmentId),
  );
  const enquiries = await prisma.enquiry.findMany();
  const notifications = (await prisma.notification.findMany()).filter((n) =>
    !n.userId || keptUserIds.has(n.userId),
  );
  const auditLogs = await prisma.auditLog.findMany();

  const dump = {
    version: 1,
    dumpedAt: new Date().toISOString(),
    skipped: {
      appointmentReferences: skippedApptRefs,
      patientEmails: skippedPatEmails,
    },
    users,
    sessions,
    patients: keptPatients,
    dentists,
    services: services.map(({ dentists: _d, ...rest }) => rest),
    serviceDentistPairs,
    clinicHours,
    dentistSchedules,
    blockedDates,
    appointments: keptAppointments,
    payments,
    enquiries,
    notifications,
    auditLogs,
  };

  const outDir = path.join(process.cwd(), "scripts");
  const outFile = path.join(outDir, "_sqlite-dump.json");
  fs.writeFileSync(outFile, JSON.stringify(dump, null, 2), "utf-8");
  console.log(
    `Dumped ${dump.users.length} users, ${dump.patients.length} patients, ` +
      `${dump.appointments.length} appointments, ${dump.payments.length} payments → ${outFile}`,
  );
  console.log(
    `Skipped ${skippedApptRefs.length} DEV appointments and ${skippedPatEmails.length} example patients.`,
  );
}

main()
  .catch((e) => {
    console.error("Dump failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });