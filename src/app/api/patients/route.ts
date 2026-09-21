import { NextRequest } from "next/server";
import { withAuth, ok, readJson } from "@/lib/server/route-helpers";
import { listPatients, createPatient } from "@/lib/server/patients";

export const runtime = "nodejs";

export const GET = withAuth(async (user, req: NextRequest) => {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  return ok({ patients: await listPatients(user, q) });
});

export const POST = withAuth(async (user, req: NextRequest) => {
  const patient = await createPatient(user, await readJson(req));
  return ok({ patient }, 201);
});