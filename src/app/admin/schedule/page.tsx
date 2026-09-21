import type { Metadata } from "next";
import { authorizeAdminPage } from "@/lib/server/access";
import {
  getClinicHoursAdmin,
  getSchedules,
  listBlockedDates,
} from "@/lib/server/admin";
import { listDentistsAdmin } from "@/lib/server/dentists";
import { ScheduleManager } from "@/components/admin/schedule-manager";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { NotAuthorized } from "@/components/admin/not-authorized";

export const metadata: Metadata = { title: "Schedule" };

export default async function ScheduleAdminPage() {
  const user = await authorizeAdminPage();
  if (!user) return <NotAuthorized />;
  const [clinicHours, schedules, blockedDates, dentists] = await Promise.all([
    getClinicHoursAdmin(),
    getSchedules(user),
    listBlockedDates(user),
    listDentistsAdmin(user),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Schedule"
        description="Opening hours, dentist availability and closures. The booking form reflects these instantly."
      />
      <ScheduleManager
        clinicHours={clinicHours}
        schedules={schedules}
        blockedDates={blockedDates}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
      />
    </>
  );
}