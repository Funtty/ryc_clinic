import type { Metadata } from "next";
import { authorizeAdminPage } from "@/lib/server/access";
import { listDentistsAdmin } from "@/lib/server/dentists";
import { DentistsManager } from "@/components/admin/dentists-manager";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { NotAuthorized } from "@/components/admin/not-authorized";

export const metadata: Metadata = { title: "Technologists" };

export default async function DentistsAdminPage() {
  const user = await authorizeAdminPage();
  if (!user) return <NotAuthorized />;
  const dentists = await listDentistsAdmin(user);

  return (
    <>
      <AdminPageHeader
        title="Technologists"
        description="Add team members and control who is currently offering appointments. Set their weekly hours on the Schedule page."
      />
      <DentistsManager dentists={dentists} />
    </>
  );
}