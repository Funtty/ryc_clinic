import type { Metadata } from "next";
import { MapPin, Phone, Mail, Clock, MessageCircle, Ambulance } from "lucide-react";
import { site } from "@/lib/site";
import { getPresentableHours } from "@/lib/availability";
import { Container } from "@/components/ui/container";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/contact/contact-form";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact & Location",
  description:
    "RYC Dental Service in Abeokuta — address, phone, WhatsApp and opening hours. Emergency same-day care available. Find us at samfiget bus stop, 3 okiki alayo Street, odo-eran, opposite Aminat College, gbonogun, Abeokuta 110121, Ogun State, Nigeria.",
  alternates: { canonical: "/contact" },
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const hours = await getPresentableHours();
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
    site.address.mapsQuery,
  )}&output=embed`;

  return (
    <>
      <JsonLd
        data={buildBreadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <section className="bg-pine-950 text-cream">
        <Container className="section-pad pt-14 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gold-400">
            Contact us
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-medium leading-tight sm:text-5xl">
            We&rsquo;re here to help — talk to us
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-cream/70">
            Questions about a treatment, a bill, or booking an appointment?
            Reach us by phone, WhatsApp or email during opening hours.
          </p>
        </Container>
      </section>

      <section className="section-pad">
        <Container>
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Address */}
            <Card variant="panel-lg" className="p-7">
              <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine-800">
                <MapPin className="size-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-lg font-semibold text-ink">
                Visit the clinic
              </h2>
              <address className="mt-2 text-sm not-italic leading-relaxed text-ink-sub">
                {site.address.line1}
                <br />
                {site.address.line2}
                <br />
                {site.address.city}, {site.address.region} {site.address.postalCode}
                <br />
                {site.address.country}
              </address>
            </Card>

            {/* Phone / WhatsApp */}
            <Card variant="panel-lg" className="p-7">
              <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine-800">
                <Phone className="size-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-lg font-semibold text-ink">
                Call or WhatsApp
              </h2>
              <p className="mt-2 text-sm text-ink-sub">
                Fastest for bookings, rescheduling and emergencies.
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <a
                  href={`tel:${site.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 text-sm font-bold text-pine-900 transition-colors hover:text-pine-700"
                >
                  <Phone className="size-4 text-gold-700" aria-hidden="true" />
                  {site.phoneDisplay}
                </a>
                <a
                  href={`tel:${site.phoneAlt.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 text-sm font-bold text-pine-900 transition-colors hover:text-pine-700"
                >
                  <Phone className="size-4 text-gold-700" aria-hidden="true" />
                  {site.phoneAltDisplay}
                  <span className="font-medium text-ink-faint">(alternate)</span>
                </a>
                <a
                  href={`https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
                    "Hello RYC Dental Service, I have a question.",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-bold text-pine-900 transition-colors hover:text-pine-700"
                >
                  <MessageCircle className="size-4 text-gold-700" aria-hidden="true" />
                  Start a WhatsApp chat
                </a>
              </div>
            </Card>

            {/* Email + emergency */}
            <Card variant="panel-lg" className="p-7">
              <span className="grid size-12 place-items-center rounded-2xl bg-pine-50 text-pine-800">
                <Mail className="size-6" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-lg font-semibold text-ink">
                Email us
              </h2>
              <a
                href={`mailto:${site.email}`}
                className="mt-2 inline-block text-sm font-bold text-pine-900 transition-colors hover:text-pine-700"
              >
                {site.email}
              </a>
              <p className="mt-4 flex items-start gap-2 rounded-2xl bg-gold-400/15 p-4 text-xs leading-relaxed text-gold-700">
                <Ambulance className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Severe pain, swelling or dental trauma? Call{" "}
                {site.phoneDisplay} — we keep same-day emergency slots.
              </p>
            </Card>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            {/* Message form */}
            <Card variant="panel-lg" className="p-7">
              <h2 className="flex items-center gap-3 font-display text-lg font-semibold text-ink">
                <MessageCircle className="size-5 text-pine-800" aria-hidden="true" />
                Send us a message
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-sub">
                Fill in the form and we&rsquo;ll get back to you. For anything
                urgent, please call instead.
              </p>
              <div className="mt-5">
                <ContactForm />
              </div>
            </Card>

            {/* Hours */}
            <Card variant="panel-lg" className="p-7">
              <h2 className="flex items-center gap-3 font-display text-lg font-semibold text-ink">
                <Clock className="size-5 text-pine-800" aria-hidden="true" />
                Opening hours
              </h2>
              <ul className="mt-5 space-y-3">
                {hours.map((h) => (
                  <li
                    key={h.dayOfWeek}
                    className="flex items-center justify-between border-b border-pine-900/5 pb-2.5 text-sm last:border-0"
                  >
                    <span className="font-semibold text-ink">
                      {h.dayOfWeek === 0
                        ? "Sunday"
                        : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][h.dayOfWeek - 1]}
                    </span>
                    <span className={h.isClosed ? "font-medium text-ink-faint" : "font-medium text-ink-sub"}>
                      {h.isClosed ? "Closed" : `${h.open} – ${h.close}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                Hours may change on public holidays — check our booking page or
                call ahead on holidays.
              </p>
            </Card>

            {/* Map */}
            <Card variant="panel-lg">
              <iframe
                title={`Map showing ${site.name} location`}
                src={mapsEmbedUrl}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-80 w-full border-0"
              />
            </Card>
          </div>

          <div className="mt-10 rounded-3xl bg-pine-950 p-8 text-center text-cream sm:p-10">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Prefer to book online?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-cream/70">
              Our booking page shows real, live availability — no waiting on the
              phone, no back-and-forth.
            </p>
            <div className="mt-6">
              <a
                href="/booking"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gold-500 px-7 text-base font-bold text-ink transition-colors hover:bg-gold-400"
              >
                Go to booking
              </a>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}