"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  Info,
  LoaderCircle,
  PhoneCall,
  RefreshCw,
  Stethoscope,
} from "lucide-react";
import { site } from "@/lib/site";
import { dayKeyFromNow, weekdayOfDateKey } from "@/lib/datetime";
import { formatMoney } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";

export type WizardService = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  durationMinutes: number;
  price: number | null;
  priceLabel: string | null;
};

export type WizardDentist = {
  id: string;
  name: string;
  title: string | null;
  slug: string;
  services: string[];
};

type SlotGroup = {
  startIso: string;
  endIso: string;
  dentist: { id: string; name: string };
};

type DateOption = {
  dateKey: string;
  label: string;
  sub: string;
};

type BookingConfirmation = {
  reference: string;
  status: string;
  serviceName: string;
  dentistName: string;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  deposit?: {
    paymentRef: string;
    checkoutUrl: string;
    amountCents: number;
    currency: string;
    bankAccount?: {
      accountName: string | null;
      accountNumber: string | null;
      bankName: string | null;
    } | null;
  } | null;
};

const STEP_TITLES = [
  "Service",
  "Dentist",
  "Date",
  "Time",
  "Your details",
  "Review",
];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  notes: "",
};

export function BookingWizard({
  services,
  dentists,
}: {
  services: WizardService[];
  dentists: WizardDentist[];
}) {
  // ── wizard state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [service, setService] = useState<WizardService | null>(null);
  const [dentistId, setDentistId] = useState(""); // "" = no preference
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotGroup[]>([]);
  const [slotsStatus, setSlotsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitErrorCode, setSubmitErrorCode] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef(step);
  const radiogroupRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (previousStepRef.current !== step) {
      previousStepRef.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (confirmation) headingRef.current?.focus();
  }, [confirmation]);

  const selectedDentist = useMemo(
    () => dentists.find((d) => d.id === dentistId) ?? null,
    [dentists, dentistId],
  );

  const offeringDentists = useMemo(() => {
    if (!service) return [];
    return dentists.filter((d) => d.services.includes(service.slug));
  }, [dentists, service]);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.startIso === selectedStart) ?? null,
    [slots, selectedStart],
  );

  // Date chips are relative to "today in clinic time", so they only exist on
  // the client after mount (keeps SSR output identical for hydration).
  useEffect(() => {
    const opts: DateOption[] = [];
    for (let i = 0; i < 14; i += 1) {
      const key = dayKeyFromNow(i, site.timeZone);
      const [y, m, d] = key.split("-").map(Number);
      const wd = weekdayOfDateKey(key, site.timeZone);
      const month = new Intl.DateTimeFormat(site.locale, {
        timeZone: site.timeZone,
        month: "short",
      }).format(new Date(Date.UTC(y, m - 1, 1)));
      opts.push({
        dateKey: key,
        label: `${d} ${month}`,
        sub: i === 0 ? "Today" : i === 1 ? "Tomorrow" : DAY_LABEL[wd],
      });
    }
    setDateOptions(opts);
  }, []);

  // ── slot loading ─────────────────────────────────────────────────────────
  async function loadSlots(targetKey: string) {
    if (!service) return;
    setSlotsStatus("loading");
    setSlotsError(null);
    setSelectedStart(null);
    setSlots([]);
    try {
      const qs = new URLSearchParams({
        service: service.id,
        date: targetKey,
      });
      if (dentistId) qs.set("dentist", dentistId);
      const res = await fetch(`/api/booking/slots?${qs.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "We couldn't load availability.");
      }
      setSlots(body.slots as SlotGroup[]);
      setSlotsStatus("ready");
    } catch (e) {
      setSlotsError(
        e instanceof Error && e.message
          ? e.message
          : "We couldn't reach the clinic right now. Check your connection and try again.",
      );
      setSlotsStatus("error");
    }
  }

  function pickDate(key: string) {
    setDateKey(key);
    setStep(3);
    void loadSlots(key);
  }

  function handleDentistKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    index: number,
  ) {
    const ids = ["", ...offeringDentists.map((d) => d.id)];
    const { key } = event;
    if (
      key !== "ArrowDown" &&
      key !== "ArrowRight" &&
      key !== "ArrowUp" &&
      key !== "ArrowLeft" &&
      key !== "Home" &&
      key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const count = ids.length;
    let next = index;
    if (key === "ArrowDown" || key === "ArrowRight") next = (index + 1) % count;
    else if (key === "ArrowUp" || key === "ArrowLeft") next = (index - 1 + count) % count;
    else if (key === "Home") next = 0;
    else next = count - 1;
    setDentistId(ids[next]);
    radiogroupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  }

  async function refreshSlots() {
    if (!dateKey) return;
    await loadSlots(dateKey);
  }

  // ── submit ───────────────────────────────────────────────────────────────
  function validateDetails(): boolean {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = "Please enter a valid email address";
    if (form.phone.trim().length < 7) errs.phone = "A valid phone number is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submitBooking() {
    if (!service || !selectedStart || !dateKey) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitErrorCode(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          startsAt: selectedStart,
          ...(dentistId ? { dentistId } : {}),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          dateOfBirth: form.dateOfBirth || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const code = body?.error?.code ?? "SERVER_ERROR";
        const message = friendlyError(code, body?.error?.message, body?.error?.details);
        if (code === "VALIDATION" && body?.error?.details?.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const [key, list] of Object.entries(body.error.details.fieldErrors as Record<string, string[]>)) {
            if (Array.isArray(list) && list.length > 0) flat[key] = list[0];
          }
          setFieldErrors(flat);
          setStep(4);
          setSubmitError(message);
        } else {
          setSubmitErrorCode(code);
          setSubmitError(message);
        }
        return;
      }
      const b = body.booking;
      setConfirmation({
        reference: b.reference,
        status: b.status,
        serviceName: b.service.name,
        dentistName: b.dentist?.name ?? "First available dentist",
        startIso: b.startsAt,
        endIso: b.endsAt,
        durationMinutes: b.durationMinutes,
        deposit: b.deposit ?? null,
      });
    } catch {
      setSubmitErrorCode("NETWORK");
      setSubmitError(
        "We couldn't reach the clinic just now. Please check your internet connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    setStep(0);
    setService(null);
    setDentistId("");
    setDateKey(null);
    setSlots([]);
    setSlotsStatus("idle");
    setSelectedStart(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setSubmitError(null);
    setSubmitErrorCode(null);
    setConfirmation(null);
  }

  // ── confirmation screen ──────────────────────────────────────────────────
  if (confirmation) {
    return (
      <Card as="section" variant="panel-lg" className="p-6 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-5 font-display text-2xl font-semibold text-ink"
          >
            Booking confirmed
          </h2>
          <p className="mt-1 text-sm text-ink-sub">
            Your reference is{" "}
            <span className="font-mono font-bold text-pine-900">
              {confirmation.reference}
            </span>
          </p>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <SummaryRow label="Service" value={confirmation.serviceName} />
          <SummaryRow label="Dentist" value={confirmation.dentistName} />
          <SummaryRow label="When" value={displayStart(confirmation.startIso)} />
          <SummaryRow
            label="Duration"
            value={`${confirmation.durationMinutes} minutes`}
          />
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl bg-pine-900 p-5 text-cream">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Info className="size-4 text-gold-400" aria-hidden="true" />
            What happens next
          </p>
          <p className="mt-2 text-sm leading-relaxed text-cream/75">
            Your visit is logged as{" "}
            <span className="font-semibold text-cream">pending confirmation</span>.
            Our front desk will confirm shortly. Need to change or cancel it?
            Call us using the number below — we&rsquo;ll have your details under{" "}
            {confirmation.reference}.
          </p>
          <a
            href={`tel:${site.phone.replace(/\s/g, "")}`}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-gold-400"
          >
            <PhoneCall className="size-4" aria-hidden="true" />
            {site.phoneDisplay}
          </a>
        </div>

        {confirmation.deposit && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-gold-500/40 bg-gold-400/10 p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-ink">
              <CreditCard className="size-4 text-pine-800" aria-hidden="true" />
              Secure your visit with a deposit
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-sub">
              Pay{" "}
              <span className="font-bold text-ink">
                {formatMoney(
                  confirmation.deposit.amountCents / 100,
                  confirmation.deposit.currency,
                )}
              </span>{" "}
              now to hold your slot. Unpaid deposits are refunded in full if the
              clinic reschedules or you cancel before confirmation. Reference:{" "}
              <span className="font-mono font-bold">{confirmation.deposit.paymentRef}</span>.
            </p>
            {confirmation.deposit.bankAccount?.accountNumber &&
            confirmation.deposit.bankAccount.bankName ? (
              <div className="mt-4 rounded-xl border border-pine-900/10 bg-cream p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-sub">
                  Pay by bank transfer
                </p>
                <dl className="mt-2 grid gap-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-sub">Bank</dt>
                    <dd className="font-bold text-ink">{confirmation.deposit.bankAccount.bankName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-sub">Account</dt>
                    <dd className="font-bold tabular-nums text-ink">{confirmation.deposit.bankAccount.accountNumber}</dd>
                  </div>
                  {confirmation.deposit.bankAccount.accountName && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-sub">Account name</dt>
                      <dd className="font-bold text-ink">{confirmation.deposit.bankAccount.accountName}</dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-ink-faint">
              After transferring, tap &ldquo;Continue to payment&rdquo; to let us know
              you&rsquo;ve paid — our team will confirm it against the bank and email you.
            </p>
            <Button
              href={confirmation.deposit.checkoutUrl}
              variant="gold"
              showArrow
              className="mt-4 w-full"
            >
              Continue to payment
            </Button>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={startOver} variant="outline" showArrow>
            Book another appointment
          </Button>
        </div>
      </Card>
    );
  }

  // ── wizard shell ─────────────────────────────────────────────────────────
  return (
    <Card as="section" variant="panel-lg" className="p-5 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <h2
          id="booking-form-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-xl font-semibold text-ink"
        >
          {STEP_TITLES[step]}
        </h2>
        <p className="text-sm font-semibold text-ink-sub" aria-live="polite">
          Step {step + 1} of {STEP_TITLES.length}
        </p>
      </div>

      <ol className="mt-4 flex items-center gap-1.5" aria-hidden="true">
        {STEP_TITLES.map((t, i) => (
          <li
            key={t}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < step ? "bg-success" : i === step ? "bg-gold-500" : "bg-pine-900/10"
            }`}
            title={t}
          />
        ))}
      </ol>

      <div className="mt-6">
        {submitError && !confirmation && (
          <Alert
            tone={submitErrorCode === "CONFLICT" ? "warning" : "error"}
            title={submitErrorCode === "NETWORK" ? "No connection" : "We hit a snag"}
            className="mb-6"
          >
            {submitError}
            {submitErrorCode === "CONFLICT" && dateKey && (
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  setSubmitErrorCode(null);
                  setStep(2);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pine-900 px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-pine-700"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Show updated availability
              </button>
            )}
          </Alert>
        )}

        {step === 0 && renderStepService()}
        {step === 1 && renderStepDentist()}
        {step === 2 && renderStepDate()}
        {step === 3 && renderStepTime()}
        {step === 4 && renderStepDetails()}
        {step === 5 && renderStepReview()}
      </div>
    </Card>
  );

  // ══ step renderers below (keep JSX in component scope for closures) ══════

  function renderStepService() {
    return (
      <ul className="space-y-3">
        {services.map((s) => (
          <li key={s.id}>
            <Card
              as="button"
              type="button"
              onClick={() => {
                setService(s);
                setStep(1);
              }}
              hover="gentle"
              className="group w-full cursor-pointer p-5 text-left"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-semibold text-ink group-hover:text-pine-800">
                      {s.name}
                    </h3>
                    <Badge tone="soft">{s.durationMinutes} min</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 max-w-xl text-sm text-ink-sub">
                    {s.shortDescription}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-bold text-pine-800">
                    {s.priceLabel ??
                      (s.price != null
                        ? `from ${formatMoney(s.price, site.currency)}`
                        : "On consultation")}
                  </span>
                  <span className="grid size-9 place-items-center rounded-full bg-pine-50 text-pine-800 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  function renderStepDentist() {
    const none = dentistId === "";
    return (
      <>
        {offeringDentists.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No dentist available for this service"
            message="Please go back and choose a different service, or call us and we'll arrange it for you."
            action={
              <Button onClick={() => setStep(0)} variant="outline">
                <ChevronLeft className="size-4" aria-hidden="true" />
                Choose a service
              </Button>
            }
          />
        ) : (
          <>
            <ul
              ref={radiogroupRef}
              className="space-y-3"
              role="radiogroup"
              aria-label="Choose a dentist"
            >
              <li role="presentation">
                <Card
                  as="button"
                  type="button"
                  role="radio"
                  aria-checked={none}
                  tabIndex={none ? 0 : -1}
                  onKeyDown={(e) => handleDentistKeyDown(e, 0)}
                  onClick={() => setDentistId("")}
                  className={`w-full cursor-pointer p-5 text-left ${
                    none ? "border-pine-800 ring-2 ring-pine-800/15" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <RadioMark checked={none} />
                    <div>
                      <p className="font-display text-base font-semibold text-ink">
                        No preference
                      </p>
                      <p className="mt-0.5 text-sm text-ink-sub">
                        We&rsquo;ll book you the first dentist free at your chosen
                        time.
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
              {offeringDentists.map((d, i) => {
                const checked = dentistId === d.id;
                return (
                  <li key={d.id} role="presentation">
                    <Card
                      as="button"
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      tabIndex={checked ? 0 : -1}
                      onKeyDown={(e) => handleDentistKeyDown(e, i + 1)}
                      onClick={() => setDentistId(d.id)}
                      className={`w-full cursor-pointer p-5 text-left ${
                        checked ? "border-pine-800 ring-2 ring-pine-800/15" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <RadioMark checked={checked} />
                        <div>
                          <p className="font-display text-base font-semibold text-ink">
                            {d.name}
                          </p>
                          {d.title && (
                            <p className="mt-0.5 text-sm text-ink-sub">{d.title}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {renderStepNav({ onBack: () => setStep(0), onNext: () => setStep(2) })}
          </>
        )}
      </>
    );
  }

  function renderStepDate() {
    if (dateOptions.length === 0) {
      return (
        <EmptyState
          icon={CalendarDays}
          title="Preparing the calendar…"
          message="Just a moment while we load the next two weeks."
          compact
        />
      );
    }
    return (
      <>
        <p className="text-sm text-ink-sub">
          Pick a day. We&rsquo;ll show you the free times that day — the clinic
          closes on some days, so a few dates may be unavailable.
        </p>
        <ul
          aria-label="Available dates"
          className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7"
        >
          {dateOptions.map((d) => {
            const active = dateKey === d.dateKey;
            return (
              <li key={d.dateKey}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickDate(d.dateKey)}
                  className={`flex w-full flex-col items-center gap-0.5 rounded-2xl border px-2 py-3 text-center transition-all ${
                    active
                      ? "border-pine-800 bg-pine-900 text-cream"
                      : "border-pine-900/10 bg-cream text-ink hover:border-pine-800/40"
                  }`}
                >
                  <span className={active ? "text-xs text-cream/80" : "text-xs text-ink-sub"}>
                    {d.sub}
                  </span>
                  <span className="font-display text-lg font-semibold">{d.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-sm text-ink-sub">
          Availability spans the next two weeks in clinic time.
        </p>
        {renderStepNav({ onBack: () => setStep(1), onNext: null })}
      </>
    );
  }

  function renderStepTime() {
    if (slotsStatus === "idle") {
      return (
        <p className="py-6 text-sm leading-relaxed text-ink-sub">
          Choose a date first and we&rsquo;ll show the free times for that day.
        </p>
      );
    }
    if (slotsStatus === "loading") {
      return (
        <div className="flex items-center justify-center gap-3 py-12 text-ink-sub">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium">Checking live availability…</p>
        </div>
      );
    }
    if (slotsStatus === "error") {
      return (
        <>
          <Alert tone="error" title="Couldn't load times" className="mb-5">
            {slotsError}
          </Alert>
          <Button onClick={() => void refreshSlots()} variant="outline">
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </>
      );
    }
    if (slotsStatus === "ready" && slots.length === 0) {
      return (
        <>
          <EmptyState
            icon={CalendarCheck2}
            title={dentistId ? "No free times with this dentist" : "No free times that day"}
            message={
              dentistId
                ? `${dateLabel()}: ${selectedDentist?.name ?? "This dentist"} has no free slots. Try another day or dentist.`
                : "The clinic may be closed or fully booked that day. Pick another date or call us and we'll fit you in."
            }
            action={
              <Button onClick={() => setStep(2)} variant="outline" showArrow>
                Choose another date
              </Button>
            }
          />
        </>
      );
    }
    return (
      <>
        <p className="text-sm text-ink-sub">
          {dateLabel()}
          {dentistId && selectedDentist
            ? ` with ${selectedDentist.name}`
            : " — the first available dentist is shown for each time"}
          .
        </p>
        <ul
          aria-label="Available times"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {slots.map((s) => {
            const active = selectedStart === s.startIso;
            return (
              <li key={s.startIso}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedStart(s.startIso)}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-3.5 text-base font-bold transition-all ${
                    active
                      ? "border-pine-800 bg-pine-900 text-cream"
                      : "border-pine-900/10 bg-cream text-ink hover:border-pine-800/40"
                  }`}
                >
                  <Clock className="size-4 opacity-70" aria-hidden="true" />
                  {shortTime(s.startIso)}
                </button>
              </li>
            );
          })}
        </ul>
        {renderStepNav({
          onBack: () => setStep(2),
          onNext: () => setStep(4),
          nextDisabled: !selectedStart,
        })}
      </>
    );
  }

  function renderStepDetails() {
    const set = (key: keyof typeof EMPTY_FORM) => (value: string) => {
      setForm((f) => ({ ...f, [key]: value }));
      setFieldErrors((e) => {
        if (!e[key]) return e;
        const next = { ...e };
        delete next[key];
        return next;
      });
    };
    return (
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (validateDetails()) setStep(5);
        }}
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            required
            htmlFor="bk-first-name"
            error={fieldErrors.firstName}
          >
            <Input
              id="bk-first-name"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              hasError={Boolean(fieldErrors.firstName)}
              aria-describedby={fieldErrors.firstName ? "bk-first-name-error" : undefined}
              required
            />
          </Field>
          <Field
            label="Last name"
            required
            htmlFor="bk-last-name"
            error={fieldErrors.lastName}
          >
            <Input
              id="bk-last-name"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              hasError={Boolean(fieldErrors.lastName)}
              aria-describedby={fieldErrors.lastName ? "bk-last-name-error" : undefined}
              required
            />
          </Field>
          <Field
            label="Email"
            required
            htmlFor="bk-email"
            hint="We'll use this to reach you about the visit."
            error={fieldErrors.email}
          >
            <Input
              id="bk-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              hasError={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "bk-email-error" : undefined}
              required
            />
          </Field>
          <Field
            label="Phone"
            required
            htmlFor="bk-phone"
            hint="For short-notice changes on the day."
            error={fieldErrors.phone}
          >
            <Input
              id="bk-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              hasError={Boolean(fieldErrors.phone)}
              aria-describedby={fieldErrors.phone ? "bk-phone-error" : undefined}
              required
            />
          </Field>
          <Field label="Date of birth" htmlFor="bk-dob" hint="Optional — helps us tailor your care.">
            <Input
              id="bk-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth")(e.target.value)}
            />
          </Field>
          <Field
            label="Notes for the team"
            htmlFor="bk-notes"
            hint="Optional — anything we should know."
          >
            <Textarea
              id="bk-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes")(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6">
          {renderStepNav({
            onBack: () => setStep(3),
            submit: true,
            submitLabel: "Continue to review",
          })}
        </div>
      </form>
    );
  }

  function renderStepReview() {
    if (!service || !selectedSlot) return null;
    const summary: Array<{ label: string; value: string }> = [
      { label: "Service", value: service.name },
      {
        label: "Dentist",
        value: selectedDentist ? selectedDentist.name : "First available dentist",
      },
      { label: "When", value: displayStart(selectedSlot.startIso) },
      { label: "Duration", value: `${service.durationMinutes} minutes` },
      {
        label: "Cost",
        value:
          service.priceLabel ??
          (service.price != null
            ? `from ${formatMoney(service.price, site.currency)}`
            : "On consultation"),
      },
      {
        label: "Contact",
        value: `${form.firstName} ${form.lastName} · ${form.email} · ${form.phone}`,
      },
      ...(form.notes.trim()
        ? [{ label: "Notes for the team", value: form.notes.trim() }]
        : []),
    ];
    return (
      <>
        <dl className="divide-y divide-pine-900/8 rounded-2xl border border-pine-900/8 bg-cream">
          {summary.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-6 p-4">
              <dt className="shrink-0 text-sm font-semibold text-ink-sub">{row.label}</dt>
              <dd className="text-right text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={() => setStep(4)} variant="ghost">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Edit details
          </Button>
          <Button
            onClick={() => void submitBooking()}
            disabled={submitting}
            showArrow
            size="lg"
            className="sm:px-8"
          >
            {submitting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Recording your visit…
              </>
            ) : (
              "Confirm booking"
            )}
          </Button>
        </div>
      </>
    );
  }

  function renderStepNav({
    onBack,
    onNext,
    nextDisabled = false,
    submit = false,
    submitLabel,
  }: {
    onBack?: () => void;
    onNext?: (() => void) | null;
    nextDisabled?: boolean;
    submit?: boolean;
    submitLabel?: string;
  }) {
    return (
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onBack ? (
          <Button onClick={onBack} variant="ghost">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
        ) : (
          <span />
        )}
        {submit ? (
          <Button type="submit" disabled={nextDisabled} showArrow className="sm:px-8">
            {submitLabel ?? "Continue"}
          </Button>
        ) : onNext ? (
          <Button onClick={onNext} disabled={nextDisabled} showArrow className="sm:px-8">
            {submitLabel ?? "Continue"}
          </Button>
        ) : null}
      </div>
    );
  }

  function dateLabel(): string {
    if (!dateKey) return "Your chosen date";
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Intl.DateTimeFormat(site.locale, {
      timeZone: site.timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  }

  function displayStart(iso: string): string {
    return new Intl.DateTimeFormat(site.locale, {
      timeZone: site.timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  function shortTime(iso: string): string {
    return new Intl.DateTimeFormat(site.locale, {
      timeZone: site.timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }

  function friendlyError(
    code: string,
    message: string | undefined,
    details: unknown,
  ): string {
    if (code === "CONFLICT" && message) return message;
    if (code === "NOT_FOUND") return "That option is no longer available — please pick another.";
    if (code === "NETWORK") return message ?? "Connection failed.";
    if (code === "VALIDATION") return message ?? "Please fix the highlighted fields.";
    void details;
    return message ?? "Something went wrong while booking. Please try again.";
  }
}

function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
        checked ? "border-pine-800 bg-pine-800" : "border-pine-900/25 bg-white"
      }`}
    >
      {checked && <Check className="size-3 text-cream" strokeWidth={3} />}
    </span>
  );
}

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-pine-900/8 bg-cream p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-sub">{label}</p>
      <p className="mt-1 font-display text-base font-semibold text-ink">{value}</p>
    </div>
  );
}