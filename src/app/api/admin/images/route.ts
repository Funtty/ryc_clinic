import { withAuth, ok } from "@/lib/server/route-helpers";
import { errors } from "@/lib/server/errors";
import { assertValidImage, createImageAsset } from "@/lib/server/files";

export const runtime = "nodejs";

export const POST = withAuth(async (user, req) => {
  const formData = await req.formData();
  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    throw errors.validation({ file: "Attach an image file in the 'file' field." });
  }
  assertValidImage(entry);
  const data = Buffer.from(await entry.arrayBuffer());
  const url = await createImageAsset(user, {
    name: entry.name,
    type: entry.type,
    size: entry.size,
    data,
  });
  return ok({ url });
});