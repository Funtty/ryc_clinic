"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Accessible modal built on the native <dialog> element:
 * top-layer rendering, ::backdrop, Escape-to-close, focus containment and
 * scroll-lock are handled by the browser. Backdrop click also closes.
 */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onClick = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      if (!inside) onClose();
    };

    el.addEventListener("cancel", onCancel);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("click", onClick);
    };
  }, [onClose]);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="m-auto">
      <div
        className={cn(
          "overflow-hidden rounded-3xl bg-white p-6 shadow-lift sm:p-8",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-pine-900/10 text-ink-sub transition-colors hover:bg-pine-50 hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-ink-sub">{description}</p>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}