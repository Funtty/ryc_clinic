"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  const onLogout = async () => {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setPending(false);
      window.location.assign("/ryc_login");
    }
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-pine-900/20 px-4 py-2 text-sm font-semibold text-pine-900 transition-colors hover:bg-pine-900 hover:text-cream disabled:opacity-60"
    >
      <LogOut className="size-4" aria-hidden="true" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}