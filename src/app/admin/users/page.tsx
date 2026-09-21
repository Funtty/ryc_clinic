import type { Metadata } from "next";
import { authorizeAdminPage } from "@/lib/server/access";
import { listStaffUsers } from "@/lib/server/admin";
import { UsersManager } from "@/components/admin/users-manager";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { NotAuthorized } from "@/components/admin/not-authorized";

export const metadata: Metadata = { title: "Staff users" };

export default async function UsersAdminPage() {
  const user = await authorizeAdminPage();
  if (!user) return <NotAuthorized />;
  const users = await listStaffUsers(user);

  return (
    <>
      <AdminPageHeader
        title="Staff users"
        description="Create staff sign-ins and control who can reach the dashboard. Passwords are hashed and never stored in plain text."
      />
      <UsersManager users={users} />
    </>
  );
}