import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { site } from "../src/lib/site";
import {
  dayKeyFromNow,
  dayKeyLocal,
  localTimeToUTC,
  weekdayOfDateKey,
} from "../src/lib/datetime";

const prisma = new PrismaClient();

type ServiceSeed = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  durationMinutes: number;
  price?: number;
  priceLabel?: string;
  imageUrl?: string;
  sortOrder: number;
};

const SERVICES: ServiceSeed[] = [
  {
    slug: "dentures",
    name: "Dentures (Teeth Replacement)",
    shortDescription:
      "Comfortable, natural-looking partial and full dentures that restore your smile and chewing confidence.",
    description:
      "Partial and full dentures crafted to fit comfortably and look natural. Whether you are replacing a single tooth or several, we take precise impressions and match the shape and shade of your remaining teeth so you can eat, speak and smile with confidence.",
    durationMinutes: 60,
    price: 15000,
    priceLabel: "from ₦15,000",
    imageUrl: "/images/services/crowns-bridges.jpg",
    sortOrder: 1,
  },
  {
    slug: "scaling-polishing",
    name: "Scaling & Polishing (Teeth Washing)",
    shortDescription:
      "A thorough scale and polish that removes plaque, tartar and stain for a cleaner, fresher smile.",
    description:
      "Professional teeth cleaning removes tartar and stains that brushing cannot shift. We scale every tooth above and below the gumline, then polish to leave your mouth fresh, your gums healthier and your smile visibly brighter.",
    durationMinutes: 45,
    price: 15000,
    priceLabel: "from ₦15,000",
    imageUrl: "/images/services/check-up-cleaning.jpg",
    sortOrder: 2,
  },
  {
    slug: "teeth-whitening-care",
    name: "Teeth Whitening & Care",
    shortDescription:
      "Safe, supervised whitening that safely brightens your smile by several shades.",
    description:
      "Our supervised whitening treatments use clinically proven gels to lift years of coffee, tea and tobacco staining. We assess your enamel first, tailor the treatment to your sensitivity levels, and give you daily care advice to keep your new shade at its best for as long as possible.",
    durationMinutes: 60,
    price: 90000,
    priceLabel: "₦90,000",
    imageUrl: "/images/services/teeth-whitening.jpg",
    sortOrder: 3,
  },
  {
    slug: "orthodontic-appliance",
    name: "Orthodontic Appliance (Teeth Replacement)",
    shortDescription:
      "Modern braces and aligners that straighten misaligned teeth — priced after examination.",
    description:
      "From fixed metal braces to discreet ceramic brackets and clear aligner systems, we design a plan that fits your lifestyle and budget. Because every case differs, the final price is provided after a complete clinical examination of your teeth and bite.",
    durationMinutes: 60,
    priceLabel: "Price after examination",
    imageUrl: "/images/services/braces.jpg",
    sortOrder: 4,
  },
  {
    slug: "crowns-bridges",
    name: "Crown & Bridge (Teeth Replacement)",
    shortDescription:
      "Porcelain crowns and bridges that restore broken or missing teeth with a natural look — priced after examination.",
    description:
      "Our ceramic crowns and bridges are crafted to match the shape, shade and translucency of your surrounding teeth — bringing back chewing function and a seamless smile after damage or tooth loss. The final price depends on your case and is given after a full examination.",
    durationMinutes: 60,
    priceLabel: "Price after examination",
    imageUrl: "/images/services/crowns-bridges.svg",
    sortOrder: 5,
  },
];

type DentistSeed = {
  slug: string;
  name: string;
  title: string;
  bio: string;
  specialties: string;
  photoUrl?: string;
  sortOrder: number;
  serviceSlugs: string[];
  schedule: { dayOfWeek: number; startMinutes: number; endMinutes: number }[];
};

const DENTISTS: DentistSeed[] = [
  {
    slug: "dr-oduntan-rahimat-olamide",
    name: "ODUNTAN RAHIMAT OLAMIDE RDT",
    title: "Lead Dentist · BDS, MSc (Restorative Dentistry)",
    bio: "ODUNTAN RAHIMAT OLAMIDE RDT leads the clinical team at RYC with over 15 years of experience in restorative and cosmetic dentistry. Known for a meticulous approach to smile design and a calm, reassuring chairside manner.",
    specialties: "Smile design, veneers, crowns, implants",
    photoUrl: "/images/team/dr-oduntan-rahimat-olamide.jpg",
    sortOrder: 1,
    serviceSlugs: [
      "dentures",
      "scaling-polishing",
      "teeth-whitening-care",
      "orthodontic-appliance",
      "crowns-bridges",
    ],
    schedule: [
      { dayOfWeek: 1, startMinutes: 480, endMinutes: 1020 }, // Mon
      { dayOfWeek: 2, startMinutes: 480, endMinutes: 1020 }, // Tue
      { dayOfWeek: 3, startMinutes: 480, endMinutes: 1020 }, // Wed
      { dayOfWeek: 4, startMinutes: 480, endMinutes: 1020 }, // Thu
      { dayOfWeek: 5, startMinutes: 480, endMinutes: 1020 }, // Fri
      { dayOfWeek: 6, startMinutes: 480, endMinutes: 840 }, // Sat
    ],
  },
];

// Clinic-wide weekly opening hours (minutes since local midnight).
const CLINIC_HOURS = [
  { dayOfWeek: 1, openMinutes: 480, closeMinutes: 1020 }, // Mon 08:00–17:00
  { dayOfWeek: 2, openMinutes: 480, closeMinutes: 1020 }, // Tue
  { dayOfWeek: 3, openMinutes: 480, closeMinutes: 1020 }, // Wed
  { dayOfWeek: 4, openMinutes: 480, closeMinutes: 1020 }, // Thu
  { dayOfWeek: 5, openMinutes: 480, closeMinutes: 1020 }, // Fri
  { dayOfWeek: 6, openMinutes: 480, closeMinutes: 840 }, // Sat 08:00–14:00
  { dayOfWeek: 0, isClosed: true }, // Sun
];

// Known future public closures (clinic local dates).
const BLOCKED_DATES = [
  { date: "2026-12-25", reason: "Christmas holiday — clinic closed" },
  { date: "2026-12-26", reason: "Public holiday — clinic closed" },
  { date: "2027-01-01", reason: "New Year — clinic closed" },
];

async function main() {
  // ── Production guard ───────────────────────────────────────────────────────
  // This seed writes development/test-friendly data (fake patients, sample
  // appointments, demo accounts). It must never run against production.
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping seed — NODE_ENV=production. Run it locally only.");
    return;
  }

  // ── Admin user ────────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminUsername = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase() || null;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.warn(
      "⚠ ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin account. Set them in .env and re-run the seed.",
    );
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash,
        username: adminUsername,
        isActive: true,
        role: "ADMIN",
      },
      create: {
        email: adminEmail,
        username: adminUsername,
        name: adminUsername ? `Admin · ${adminUsername}` : "Clinic Administrator",
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(
      `✓ Admin account ready (${adminEmail}${adminUsername ? ` / username "${adminUsername}"` : ""})`,
    );
  }

  // ── Receptionist dev account ──────────────────────────────────────────────
  const staffEmail = process.env.STAFF_EMAIL ?? "staff@ryc-dental.example";
  const staffPassword = process.env.STAFF_PASSWORD ?? "ChangeMe-4567";
  const staffHash = await bcrypt.hash(staffPassword, 12);
  await prisma.user.upsert({
    where: { email: staffEmail },
    update: { passwordHash: staffHash, isActive: true, role: "STAFF" },
    create: {
      email: staffEmail,
      name: "Front Desk Receptionist",
      passwordHash: staffHash,
      role: "STAFF",
    },
  });
  console.log(`✓ Receptionist account ready (${staffEmail})`);

  // ── Services ──────────────────────────────────────────────────────────────
  const serviceIds = new Map<string, string>();
  // Deactivate anything not in the list below, so removed services drop off the
  // public site while historical appointments keep their snapshot.
  await prisma.service.updateMany({
    data: { isActive: false },
  });
  for (const s of SERVICES) {
    const svc = await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        shortDescription: s.shortDescription,
        description: s.description,
        durationMinutes: s.durationMinutes,
        price: s.price ?? null,
        priceLabel: s.priceLabel ?? null,
        imageUrl: s.imageUrl ?? null,
        isActive: true,
        sortOrder: s.sortOrder,
      },
      create: {
        slug: s.slug,
        name: s.name,
        shortDescription: s.shortDescription,
        description: s.description,
        durationMinutes: s.durationMinutes,
        price: s.price ?? null,
        priceLabel: s.priceLabel ?? null,
        imageUrl: s.imageUrl ?? null,
        sortOrder: s.sortOrder,
      },
    });
    serviceIds.set(s.slug, svc.id);
  }
  console.log(`✓ ${SERVICES.length} services`);

  // ── Dentists + schedules + service links ──────────────────────────────────
  // Deactivate anything not in the list below, so removed dentists drop off the
  // public site and availability while historical appointments keep their link.
  await prisma.dentist.updateMany({
    data: { isActive: false },
  });
  for (const d of DENTISTS) {
    const dentist = await prisma.dentist.upsert({
      where: { slug: d.slug },
      update: {
        name: d.name,
        title: d.title,
        bio: d.bio,
        specialties: d.specialties,
        photoUrl: d.photoUrl ?? null,
        isActive: true,
        sortOrder: d.sortOrder,
      },
      create: {
        slug: d.slug,
        name: d.name,
        title: d.title,
        bio: d.bio,
        specialties: d.specialties,
        photoUrl: d.photoUrl ?? null,
        sortOrder: d.sortOrder,
      },
    });

    // Weekly schedule (replace whole set for idempotency)
    await prisma.dentistSchedule.deleteMany({ where: { dentistId: dentist.id } });
    await prisma.dentistSchedule.createMany({
      data: d.schedule.map((s) => ({
        dentistId: dentist.id,
        dayOfWeek: s.dayOfWeek,
        startMinutes: s.startMinutes,
        endMinutes: s.endMinutes,
      })),
    });

    // Link services (additive — safe on re-run)
    const svcIds = d.serviceSlugs
      .map((slug) => serviceIds.get(slug))
      .filter((id): id is string => Boolean(id));
    for (const sid of svcIds) {
      await prisma.service.update({
        where: { id: sid },
        data: { dentists: { connect: [{ id: dentist.id }] } },
      });
    }
  }
  console.log(`✓ ${DENTISTS.length} dentists + schedules`);

  // ── Clinic hours (replace whole set) ──────────────────────────────────────
  await prisma.clinicHours.deleteMany();
  await prisma.clinicHours.createMany({
    data: CLINIC_HOURS.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openMinutes: h.openMinutes ?? 0,
      closeMinutes: h.closeMinutes ?? 0,
      isClosed: Boolean(h.isClosed),
    })),
  });
  console.log(`✓ Clinic hours (${CLINIC_HOURS.length} days)`);

  // ── Blocked dates ─────────────────────────────────────────────────────────
  for (const b of BLOCKED_DATES) {
    const existing = await prisma.blockedDate.findFirst({
      where: { date: b.date, dentistId: null },
    });
    if (existing) {
      await prisma.blockedDate.update({
        where: { id: existing.id },
        data: { reason: b.reason },
      });
    } else {
      await prisma.blockedDate.create({ data: { date: b.date, reason: b.reason } });
    }
  }
  console.log(`✓ Blocked dates (${BLOCKED_DATES.length})`);

  // ── DEV data: patients + sample appointments ──────────────────────────────
  // Fake-but-plausible records so the admin dashboard, calendar and booking
  // engine have realistic data to work with. Never used in production.
  const devPatients = [
    {
      email: "dev.patient@ryc.example",
      firstName: "Tolu",
      lastName: "Adebayo",
      phone: "+234 800 000 0000",
      notes: "Dev sample patient",
    },
    {
      email: "nneka.dev@ryc.example",
      firstName: "Nneka",
      lastName: "Okafor",
      phone: "+234 801 111 1111",
      notes: "",
    },
    {
      email: "sade.dev@ryc.example",
      firstName: "Sade",
      lastName: "Balogun",
      phone: "+234 802 222 2222",
      notes: "",
    },
    {
      email: "chidi.dev@ryc.example",
      firstName: "Chidi",
      lastName: "Eze",
      phone: "+234 803 333 3333",
      notes: "",
    },
    {
      email: "funke.dev@ryc.example",
      firstName: "Funke",
      lastName: "Olawale",
      phone: "+234 804 444 4444",
      notes: "",
    },
  ];

  const patientMap = new Map<string, string>();
  for (const p of devPatients) {
    const rec = await prisma.patient.upsert({
      where: { email: p.email },
      update: {},
      create: p,
    });
    patientMap.set(p.email, rec.id);
  }

  const services = await prisma.service.findMany({
    select: { id: true, slug: true, durationMinutes: true },
  });
  const serviceBySlug = new Map(services.map((s) => [s.slug, s]));
  const dentists = await prisma.dentist.findMany({
    select: { id: true, slug: true },
  });
  const dentistBySlug = new Map(dentists.map((d) => [d.slug, d]));

  // Past outcomes (cancellations / no-shows / completions) so the dashboard's
  // 30-day cohort has numbers to show. Times are clinic-local start times.
  const pastOutcomes = [
    { ref: "RYC-DEV003", email: "nneka.dev@ryc.example", service: "scaling-polishing", dentist: "dr-oduntan-rahimat-olamide", daysAgo: 20, minutesOfDay: 600, status: "COMPLETED" as const },
    { ref: "RYC-DEV004", email: "sade.dev@ryc.example", service: "dentures", dentist: "dr-oduntan-rahimat-olamide", daysAgo: 17, minutesOfDay: 660, status: "COMPLETED" as const },
    { ref: "RYC-DEV005", email: "chidi.dev@ryc.example", service: "teeth-whitening-care", dentist: "dr-oduntan-rahimat-olamide", daysAgo: 13, minutesOfDay: 540, status: "CANCELLED" as const },
    { ref: "RYC-DEV006", email: "funke.dev@ryc.example", service: "scaling-polishing", dentist: "dr-oduntan-rahimat-olamide", daysAgo: 11, minutesOfDay: 600, status: "NO_SHOW" as const },
    { ref: "RYC-DEV007", email: "nneka.dev@ryc.example", service: "crowns-bridges", dentist: "dr-oduntan-rahimat-olamide", daysAgo: 8, minutesOfDay: 660, status: "COMPLETED" as const },
    { ref: "RYC-DEV008", email: "sade.dev@ryc.example", service: "scaling-polishing", dentist: "dr-oduntan-rahimat-olamide", daysAgo: 5, minutesOfDay: 600, status: "NO_SHOW" as const },
    { ref: "RYC-DEV009", email: "funke.dev@ryc.example", service: "teeth-whitening-care", dentist: "dr-oduntan-rahimat-olamide", daysAgo: 2, minutesOfDay: 540, status: "COMPLETED" as const },
  ];

  for (const o of pastOutcomes) {
    const service = serviceBySlug.get(o.service);
    const dentist = dentistBySlug.get(o.dentist);
    const patientId = patientMap.get(o.email);
    if (!service || !dentist || !patientId) continue;

    const dateKey = dayKeyFromNow(-o.daysAgo, site.timeZone);
    const startsAt = localTimeToUTC(dateKey, o.minutesOfDay, site.timeZone);
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const patient = devPatients.find((p) => p.email === o.email)!;

    await prisma.appointment.upsert({
      where: { reference: o.ref },
      update: {},
      create: {
        reference: o.ref,
        patientId,
        serviceId: service.id,
        dentistId: dentist.id,
        startsAt,
        endsAt,
        durationMinutes: service.durationMinutes,
        status: o.status,
        ...(o.status === "COMPLETED"
          ? { completedAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000) }
          : {}),
        ...(o.status === "CANCELLED"
          ? { cancelledAt: new Date(startsAt.getTime() - 24 * 60 * 60_000), cancellationReason: "Patient cancelled before visit" }
          : {}),
        contactName: `${patient.firstName} ${patient.lastName}`,
        contactEmail: patient.email,
        contactPhone: patient.phone,
      },
    });
  }

  const cleaning = await prisma.service.findUnique({
    where: { slug: "scaling-polishing" },
  });
  const leadDentist = await prisma.dentist.findFirst({
    where: { slug: "dr-oduntan-rahimat-olamide" },
  });
  const devPatientId = patientMap.get("dev.patient@ryc.example");
  if (cleaning && leadDentist && devPatientId) {
    const devPatient = devPatients[0]!;
    // A completed visit yesterday (10:00 clinic time) — historical record.
    const yesterdayKey = dayKeyLocal(
      new Date(Date.now() - 24 * 60 * 60_000),
      site.timeZone,
    );
    await prisma.appointment.upsert({
      where: { reference: "RYC-DEV001" },
      update: {},
      create: {
        reference: "RYC-DEV001",
        patientId: devPatientId,
        serviceId: cleaning.id,
        dentistId: leadDentist.id,
        startsAt: localTimeToUTC(yesterdayKey, 600, site.timeZone),
        endsAt: localTimeToUTC(yesterdayKey, 645, site.timeZone),
        durationMinutes: 45,
        status: "COMPLETED",
        completedAt: new Date(Date.now() - 12 * 60 * 60_000),
        contactName: `${devPatient.firstName} ${devPatient.lastName}`,
        contactEmail: devPatient.email,
        contactPhone: devPatient.phone,
      },
    });

    // An upcoming CONFIRMED appointment on the next bookable weekday 10:00.
    let next10 = null;
    for (let i = 0; i < 14; i += 1) {
      const key = dayKeyFromNow(i, site.timeZone);
      if (weekdayOfDateKey(key, site.timeZone) >= 1) {
        const t = localTimeToUTC(key, 600, site.timeZone);
        if (t.getTime() > Date.now() + 15 * 60_000) {
          next10 = { t, key };
          break;
        }
      }
    }
    if (next10) {
      await prisma.appointment.upsert({
        where: { reference: "RYC-DEV002" },
        update: {
          startsAt: next10.t,
          endsAt: new Date(next10.t.getTime() + 45 * 60_000),
          status: "CONFIRMED",
        },
        create: {
          reference: "RYC-DEV002",
          patientId: devPatientId,
          serviceId: cleaning.id,
          dentistId: leadDentist.id,
          startsAt: next10.t,
          endsAt: new Date(next10.t.getTime() + 45 * 60_000),
          durationMinutes: 45,
          status: "CONFIRMED",
          contactName: `${devPatient.firstName} ${devPatient.lastName}`,
          contactEmail: devPatient.email,
          contactPhone: devPatient.phone,
        },
      });
    }

    // Fresh upcoming appointments (one pending, one confirmed) for next week,
    // spread across patients and dentists like a real day ahead.
    const upcoming = [
      { email: "nneka.dev@ryc.example", service: "scaling-polishing", dentist: "dr-oduntan-rahimat-olamide", minutesOfDay: 600, status: "PENDING" as const },
      { email: "sade.dev@ryc.example", service: "crowns-bridges", dentist: "dr-oduntan-rahimat-olamide", minutesOfDay: 690, status: "CONFIRMED" as const },
      { email: "chidi.dev@ryc.example", service: "orthodontic-appliance", dentist: "dr-oduntan-rahimat-olamide", minutesOfDay: 600, status: "CONFIRMED" as const },
    ];
    let upIdx = 1;
    for (const u of upcoming) {
      const service = serviceBySlug.get(u.service);
      const dentist = dentistBySlug.get(u.dentist);
      const patientId = patientMap.get(u.email);
      if (!service || !dentist || !patientId) continue;
      let slot: { t: Date; key: string } | null = null;
      for (let i = upIdx; i < upIdx + 10; i += 1) {
        const key = dayKeyFromNow(i, site.timeZone);
        if (weekdayOfDateKey(key, site.timeZone) >= 1) {
          const t = localTimeToUTC(key, u.minutesOfDay, site.timeZone);
          if (t.getTime() > Date.now() + 60 * 60_000) {
            slot = { t, key };
            break;
          }
        }
      }
      if (!slot) continue;
      upIdx += 1;
      const patient = devPatients.find((p) => p.email === u.email)!;
      const ref = `RYC-DEV0${10 + upIdx}`;
      await prisma.appointment.upsert({
        where: { reference: ref },
        update: {
          startsAt: slot.t,
          endsAt: new Date(slot.t.getTime() + service.durationMinutes * 60_000),
          status: u.status,
        },
        create: {
          reference: ref,
          patientId,
          serviceId: service.id,
          dentistId: dentist.id,
          startsAt: slot.t,
          endsAt: new Date(slot.t.getTime() + service.durationMinutes * 60_000),
          durationMinutes: service.durationMinutes,
          status: u.status,
          contactName: `${patient.firstName} ${patient.lastName}`,
          contactEmail: patient.email,
          contactPhone: patient.phone,
        },
      });
    }
    console.log(
      `  DEV: ${devPatients.length} patients + sample appointments across statuses (dev/test only)`,
    );
  }

  console.log("\nSeed complete ✓");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });