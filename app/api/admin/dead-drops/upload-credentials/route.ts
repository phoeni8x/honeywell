import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Returns Cloudinary unsigned upload preset + cloud name so the browser can upload
 * directly to Cloudinary (iPhone → Cloudinary), skipping the Vercel body buffer.
 *
 * Create an **unsigned** upload preset in Cloudinary:
 * - Folder: e.g. `dead-drops` (recommended)
 * - Allowed formats: image + video as needed
 * - Max file size per your plan
 *
 * Set `CLOUDINARY_UPLOAD_PRESET_DEAD_DROPS` to that preset name.
 */
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET_DEAD_DROPS?.trim() || "";

  if (cloudName && uploadPreset) {
    return NextResponse.json({ direct: true as const, cloudName, uploadPreset });
  }

  return NextResponse.json({ direct: false as const });
}
