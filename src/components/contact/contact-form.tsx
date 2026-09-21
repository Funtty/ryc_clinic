"use client";

import { useState } from "react";
import { z } from "zod";
import { PhoneCall, Send } from "lucide-react";
import { site } from "@/lib/site";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

const messageSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().email("Please enter a valid email address"),
  topic: z.string().trim().min(1, "Please choose a topic"),
  message: z.string().trim().min(10, "Please give us a few more details").max(2000),
});

type MessageInput = z.infer<typeof messageSchema>;

const initialValues: MessageInput = { name: "", email: "", topic: "", message: "" };

export function ContactForm() {
  const [values, setValues] = useState<MessageInput>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof MessageInput, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof MessageInput) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = messageSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof MessageInput, string>> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] && !next[issue.path[0] as keyof MessageInput]) {
          next[issue.path[0] as keyof MessageInput] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Alert tone="info" title="Message received — thank you">
        <p>
          Online messaging arrives in the next build phase. For now, the fastest
          way to reach us is a quick call or WhatsApp — we&rsquo;d love to help.
        </p>
        <a
          href={`tel:${site.phone.replace(/\s/g, "")}`}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-pine-900 px-5 text-sm font-bold text-cream transition-colors hover:bg-pine-700"
        >
          <PhoneCall className="size-4" aria-hidden="true" />
          {site.phoneDisplay}
        </a>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="contact-name" required error={errors.name}>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            placeholder="e.g. Ada Johnson"
            value={values.name}
            onChange={set("name")}
            hasError={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            aria-required="true"
          />
        </Field>
        <Field label="Email address" htmlFor="contact-email" required error={errors.email}>
          <Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={set("email")}
            hasError={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            aria-required="true"
          />
        </Field>
      </div>

      <Field label="What can we help with?" htmlFor="contact-topic" required error={errors.topic}>
        <Select
          id="contact-topic"
          name="topic"
          value={values.topic}
          onChange={set("topic")}
          hasError={Boolean(errors.topic)}
          aria-describedby={errors.topic ? "contact-topic-error" : undefined}
          aria-required="true"
        >
          <option value="">Choose a topic…</option>
          <option value="appointment">Booking or rescheduling</option>
          <option value="prices">Prices and payment</option>
          <option value="treatment">A treatment question</option>
          <option value="emergency">Emergency — please call us instead</option>
          <option value="other">Something else</option>
        </Select>
      </Field>

      <Field label="Your message" htmlFor="contact-message" required error={errors.message}>
        <Textarea
          id="contact-message"
          name="message"
          rows={5}
          placeholder="How can we help?"
          value={values.message}
          onChange={set("message")}
          hasError={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          aria-required="true"
        />
      </Field>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-pine-900 px-7 text-base font-bold text-cream transition-all duration-200 hover:-translate-y-0.5 hover:bg-pine-700 hover:shadow-card"
        >
          <Send className="size-4" aria-hidden="true" />
          Send message
        </button>
        <p className="text-xs leading-relaxed text-ink-faint">
          Prefer to talk now? Call {site.phoneDisplay}.
        </p>
      </div>
    </form>
  );
}