import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/server/access";
import { listPatients } from "@/lib/server/patients";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Patients" };

type SearchParams = Promise<{ q?: string }>;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireStaffPage();
  const { q } = await searchParams;
  const patients = await listPatients(user, q);

  return (
    <>
      <AdminPageHeader
        title="Patients"
        description="Find a patient to view their visit history."
      />

      <form method="get" className="mb-6 flex max-w-xl gap-3">
        <input
          type="search"
          name="q"
          placeholder="Search by name, email or phone…"
          defaultValue={q ?? ""}
          className="input-field h-12 w-full"
          aria-label="Search patients"
        />
        <Button
          type="submit"
          className="h-12 shrink-0 px-6"
        >
          Search
        </Button>
      </form>

      {patients.length === 0 ? (
        <EmptyState compact title={q ? `No patients match “${q}”` : "No patients on file yet"} />
      ) : (
        <Card as="ul" variant="table">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/patients/${p.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-pine-900/5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {p.email} · {p.phone}
                  </span>
                </span>
                <span className="text-xs font-bold text-ink-faint">
                  {p._count.appointments}{" "}
                  {p._count.appointments === 1 ? "visit" : "visits"}
                </span>
              </Link>
            </li>
          ))}
        </Card>
      )}
    </>
  );
}