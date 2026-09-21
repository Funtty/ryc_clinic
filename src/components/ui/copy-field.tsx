"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Click-to-copy text field. Clicking the rendered value copies it to the
 * clipboard and briefly shows a checkmark + "Copied" feedback.
 */
export function CopyField({
  value,
  className,
  copiedLabel = "Copied",
}: {
  value: string;
  className?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash() {
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  function fallbackCopy(text: string) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function handleCopy() {
    const text = value ?? "";
    if (!text || copied) return;
    void navigator.clipboard
      .writeText(text)
      .catch(() => {
        fallbackCopy(text);
      })
      .finally(flash);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy to clipboard"
      aria-label={`Copy ${value}`}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-lg py-0.5 text-left underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-pine-600",
        className,
      )}
    >
      <span>{value}</span>
      {copied ? (
        <>
          <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
          <span className="text-xs font-normal text-success">{copiedLabel}</span>
        </>
      ) : (
        <Copy className="size-4 shrink-0 text-ink-faint opacity-60 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      )}
    </button>
  );
}