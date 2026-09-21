import type { Metadata } from "next";
import { authorizeAdminPage } from "@/lib/server/access";
import { listServicesAdmin } from "@/lib/server/services";
import { ServicesManager } from "@/components/admin/services-manager";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { NotAuthorized } from "@/components/admin/not-authorized";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesAdminPage() {
  const user = await authorizeAdminPage();
  if (!user) return <NotAuthorized />;
  const services = await listServicesAdmin(user);

  return (
    <>
      <AdminPageHeader
        title="Services"
        description="Create treatments, set their duration/price and decide what is bookable on the public site."
      />
      <ServicesManager services={services} />
    </>
  );
}