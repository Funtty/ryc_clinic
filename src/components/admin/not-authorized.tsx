import { ShieldX } from "lucide-react";
import { Card } from "@/components/ui/card";

export function NotAuthorized() {
  return (
    <Card className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-error/10 text-error">
        <ShieldX className="size-7" aria-hidden="true" />
      </span>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">
          You don&apos;t have access to this area
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-faint">
          This section is restricted to administrators. Ask an administrator to
          upgrade your role if you need it.
        </p>
      </div>
    </Card>
  );
}