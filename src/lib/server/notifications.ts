import "server-only";
import { prisma } from "@/lib/prisma";

type NotificationInput = {
  userId?: string | null;
  title: string;
  body: string;
};

/** Queue an in-app notification for a user (delivery/emails come in a later phase). */
export async function createNotification(input: NotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      title: input.title,
      body: input.body,
    },
  });
}