import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params;
  const asset = await prisma.fileAsset.findUnique({ where: { id } });
  if (!asset) return new Response(null, { status: 404 });

  const body = asset.data as unknown as BodyInit;
  return new Response(body, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.size),
      // Uploads get a fresh /api/files/:id URL per upload, so images are
      // immutable across the CDN/browser cache.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}