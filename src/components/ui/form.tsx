import { forwardRef } from "react";
import { CircleAlert } from "lucide-react";
import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/* ─── Field wrapper (label + control + hint/error) ──────────────────────── */

type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
} & Pick<LabelHTMLAttributes<HTMLLabelElement>, "htmlFor">;

export function Field({
  label,
  hint,
  error,
  required,
  className,
  htmlFor,
  children,
}: FieldProps) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
          {required && (
            <span className="ml-0.5 text-error" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          className="field-error-text"
          role="alert"
        >
          <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
}

/* ─── Inputs ─────────────────────────────────────────────────────────────── */

type InputProps = InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn("input-field", hasError && "input-error", className)}
      aria-invalid={hasError || undefined}
      {...props}
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, hasError, ...props }, ref) {
    return (
      <textarea
        ref={ref}
      className={cn("input-field min-h-28 resize-y", hasError && "input-error", className)}
      aria-invalid={hasError || undefined}
      {...props}
    />
    );
  },
);

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, hasError, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn("input-field appearance-none", hasError && "input-error", className)}
      aria-invalid={hasError || undefined}
      {...props}
    >
      {children}
    </select>
  );
});