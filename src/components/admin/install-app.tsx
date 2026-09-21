"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

const DISMISS_KEY = "ryc-admin-install-dismissed";
const INSTALLED_KEY = "ryc-admin-install-installed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Admin-only install entry point for the /admin-scoped PWA.
 * - Auto-asks once via `beforeinstallprompt` (Chromium) or iOS instructions
 *   shortly after the admin lands in the dashboard.
 * - Always exposes an "Install app" button in the header so the dialog can be
 *   reopened manually even if the browser-level prompt was missed or dismissed.
 * - Renders nothing once the app is installed or running standalone.
 */
export function InstallApp({ isAdmin }: { isAdmin: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chrome" | "ios">("chrome");
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const shownRef = useRef(false);

  const openOnce = () => {
    if (shownRef.current) return;
    shownRef.current = true;
    setOpen(true);
  };

  useEffect(() => {
    if (!isAdmin) return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    if (window.localStorage.getItem(INSTALLED_KEY) === "1") setInstalled(true);

    if ("serviceWorker" in navigator && window.location.pathname.startsWith("/admin")) {
      navigator.serviceWorker.register("/admin/sw.js").catch(() => {});
    }

    let timer: number | undefined;
    if (isIOS() && window.localStorage.getItem(DISMISS_KEY) !== "1") {
      setMode("ios");
      timer = window.setTimeout(openOnce, 900);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (window.localStorage.getItem(DISMISS_KEY) !== "1" && !isIOS()) openOnce();
    };
    const onInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      window.localStorage.setItem(DISMISS_KEY, "1");
      setInstalled(true);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isAdmin]);

  const handleInstall = async () => {
    if (!deferred) return;
    const event = deferred;
    setDeferred(null);
    setBusy(true);
    await event.prompt();
    const choice = await event.userChoice.catch(() => null);
    setBusy(false);
    if (choice?.outcome === "accepted") {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      window.localStorage.setItem(DISMISS_KEY, "1");
      setInstalled(true);
    }
    setOpen(false);
  };

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const handleOpen = () => {
    setMode(isIOS() ? "ios" : "chrome");
    setOpen(true);
  };

  if (!isAdmin || installed || isStandalone()) return null;

  return (
    <>
      <Button onClick={handleOpen} variant="outline" size="sm" className="shrink-0">
        <Download className="size-4" aria-hidden="true" />
        <span className="hidden md:inline">Install app</span>
      </Button>

      <Dialog
        open={open}
        onClose={handleDismiss}
        title={
          <span className="inline-flex items-center gap-3">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-xl shadow-soft"
            />
            Install RYC Admin
          </span>
        }
        description="Open the admin dashboard as its own app window from your home screen — no browser tabs or address bar. It's a private app for the RYC dashboard only."
      >
        {mode === "ios" ? (
          <div className="space-y-3 text-sm text-ink-sub">
            <p>Safari doesn&apos;t support one-tap install, but you can add it manually:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Tap the <strong className="text-ink">Share</strong> icon at the bottom of the
                browser.
              </li>
              <li>
                Choose <strong className="text-ink">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="text-ink">Add</strong>.
              </li>
            </ol>
            <div className="pt-2">
              <Button onClick={handleDismiss} variant="primary">
                Got it
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button onClick={handleDismiss} variant="outline">
                Not now
              </Button>
              <Button
                onClick={handleInstall}
                disabled={busy || !deferred}
                className="sm:min-w-40"
              >
                {busy ? "Installing…" : "Install app"}
              </Button>
            </div>
            {!deferred && (
              <p className="mt-3 text-xs text-ink-faint">
                If the Install button is greyed out, use your browser&rsquo;s menu
                &rarr; &ldquo;Install app&rdquo; / &ldquo;Add to Home Screen&rdquo;.
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}