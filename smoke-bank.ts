import { prisma } from "./src/lib/prisma";

const BASE = "http://localhost:3000";

type Service = { id: string; name: string; price: number | null };
type Dentist = { id: string; slug: string };

async function probe() {
  const base = await prisma.service.findMany({
    where: { isActive: true },
    select: { id: true, name: true, price: true },
    orderBy: { sortOrder: "asc" },
  });
  const dentists = await prisma.dentist.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  });
  console.log("SERVICES", JSON.stringify(base));
  console.log("DENTISTS", JSON.stringify(dentists));
  return { base, dentists };
}

async function main() {
  const { base, dentists } = await probe();
  const svc = base.find((s) => typeof s.price === "number" && s.price! > 0)!;
  const slotIso = await findSlot(svc.id, dentists[0].id);
  console.log("SLOT", slotIso);

  // 1) Book
  const bookRes = await fetch(`${BASE}/api/public/booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: svc.id,
      dentistId: dentists[0].id,
      startsAt: slotIso,
      firstName: "Smoke",
      lastName: "Test",
      email: "smoke.test@ryc.example",
      phone: "+2348012345678",
    }),
  });
  const book = (await bookRes.json()) as {
    booking?: { reference: string; deposit?: { paymentId: string; paymentRef: string; checkoutUrl: string; bankAccount?: Record<string, string | null> | null } };
    error?: { message?: string; code?: string };
  };
  console.log("BOOK", bookRes.status, JSON.stringify(book));

  if (!book.booking?.deposit) throw new Error("no deposit");

  // 2) GET the bank checkout page
  const payRes = await fetch(`${BASE}${book.booking.deposit.checkoutUrl}`, { redirect: "manual" });
  const payHtml = await payRes.text();
  console.log("PAY_PAGE", payRes.status, "hasAccount=", payHtml.includes("Account number"), "hasBank=", payHtml.includes("Transfer to this account"));

  // 3) I've made payment
  const reportRes = await fetch(`${BASE}/api/payments/${book.booking.deposit.paymentId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  console.log("REPORT", reportRes.status, await reportRes.text());

  // 4) Admin login
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Funtty", password: "OlamideAdele@57" }),
  });
  const cookies = loginRes.headers.getSetCookie?.() ?? [];
  console.log("LOGIN", loginRes.status);
  if (cookies.length === 0) throw new Error("no session cookie");
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");

  // 5) Admin confirm
  const confRes = await fetch(`${BASE}/api/admin/payments/${book.booking.deposit.paymentId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: "{}",
  });
  console.log("CONFIRM", confRes.status, await confRes.text());

  // 6) Done — email/outbox feature retired (no automated client mail).
  console.log("CONFIRM_DONE");
  await prisma.$disconnect();
}

async function findSlot(serviceId: string, dentistId: string): Promise<string> {
  for (let i = 1; i <= 10; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateKey = d.toISOString().slice(0, 10);
    const slotsRes = await fetch(
      `${BASE}/api/booking/slots?service=${serviceId}&date=${dateKey}&dentist=${dentistId}`,
    );
    const slots = (await slotsRes.json()) as { slots?: Array<{ startIso?: string }> };
    if (slots.slots?.length) return slots.slots[0].startIso!;
  }
  throw new Error("no slots found");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
