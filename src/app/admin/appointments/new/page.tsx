import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaffPage } from "@/lib/server/access";
import { listPatients } from "@/lib/server/patients";
import { listDentistsAdmin } from "@/lib/server/dentists";
import { listServicesAdmin } from "@/lib/server/services";
import { AppointmentForm } from "@/components/admin/appointment-form";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "New appointment" };

export default async function NewAppointmentPage() {
  const user = await requireStaffPage();
  const [patients, services, dentists] = await Promise.all([
    listPatients(user),
    listServicesAdmin(user),
    listDentistsAdmin(user),
  ]);

  return (
    <>
      <AdminPageHeader
        title="New appointment"
        description="Match the patient to a service and time. The clinic calendar checks availability automatically."
        actions={
          <Link
            href="/admin/appointments"
            className="inline-flex h-11 items-center gap-2 text-sm font-bold text-pine-800 underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to appointments
          </Link>
        }
      />

      <Card className="max-w-2xl p-6 sm:p-8">
        <AppointmentForm
          patients={patients}
          services={services}
          dentists={dentists}
        />
      </Card>
    </>
  );
}