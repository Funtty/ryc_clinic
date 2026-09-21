"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
const ACCEPT_STRING = ACCEPTED_TYPES.join(",");
const MAX_BYTES = 8 * 1024 * 1024;

type ImageUploaderProps = {
  id?: string;
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
};

/**
 * Upload a dentist/service image straight from the admin panel. The file is
 * POSTed to /api/admin/images (stored in the database) and `onChange` receives
 * the public /api/files/:id URL to save with the record.
 */
export function ImageUploader({
  id,
  label,
  hint,
  value,
  onChange,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP, AVIF or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image must be 8 MB or smaller.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/images", { method: "POST", body });
      const data = (await res.json()) as {
        url?: string;
        error?: { message?: string };
      };
      if (!res.ok || !data.url) {
        setError(data.error?.message ?? "Upload failed.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label} hint={error ? undefined : hint} error={error ?? undefined} htmlFor={id}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-pine-900/10 bg-pine-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="size-8 text-pine-800/40" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPT_STRING}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            {busy ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </Button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-error"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Remove image
            </button>
          )}
        </div>
      </div>
    </Field>
  );
}