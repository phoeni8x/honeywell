import { requireAdminUser } from "@/lib/admin-auth";
import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { createServiceClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const dynamic = "force-dynamic";

type UploadKind = "location_photo_url" | "location_photo_url_2" | "location_photo_url_3" | "location_video_url";

function pickExt(fileName: string, fileType: string) {
  const safeName = fileName || "file";
  const dot = safeName.lastIndexOf(".");
  if (dot >= 0 && dot < safeName.length - 1) {
    const ext = safeName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (ext) return ext;
  }
  const slash = fileType.indexOf("/");
  if (slash >= 0 && slash < fileType.length - 1) {
    const ext = fileType.slice(slash + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (ext) return ext;
  }
  return "bin";
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file") as File | null;
    const kind = form.get("kind") as UploadKind | null;

    if (!file || !kind) {
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 400 });
    }

    const allowedKinds: UploadKind[] = [
      "location_photo_url",
      "location_photo_url_2",
      "location_photo_url_3",
      "location_video_url",
    ];
    if (!allowedKinds.includes(kind)) {
      return NextResponse.json({ error: "Invalid upload kind" }, { status: 400 });
    }

    // Practical limit to avoid huge uploads breaking the pipeline.
    // iPhone clips around ~2 minutes can easily exceed 35MB.
    const maxBytes = 100 * 1024 * 1024; // 100MB
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "File is too large. Please use a smaller file." }, { status: 400 });
    }

    if (kind === "location_video_url") {
      // Basic type guard to prevent non-video files being stored as videos.
      const ct = (file.type || "").toLowerCase();
      if (!ct.startsWith("video/")) {
        return NextResponse.json({ error: "Please upload a valid video file." }, { status: 400 });
      }
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || "";
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || "";

    // Prefer Cloudinary if configured (better for large iPhone media). Fallback to Supabase Storage otherwise.
    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
      const ext = pickExt(file.name, file.type || "");
      const rand = Math.random().toString(16).slice(2);
      const ts = Date.now();
      const publicId = `dead-drops/${kind}/${ts}-${rand}.${ext}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      const resourceType = kind === "location_video_url" ? "video" : "image";
      const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { public_id: publicId, resource_type: resourceType, overwrite: true },
          (err, result) => {
            if (err || !result?.secure_url) return reject(err || new Error("Upload failed"));
            resolve({ secure_url: result.secure_url });
          }
        );
        stream.end(bytes);
      });

      return NextResponse.json({ ok: true, url: uploaded.secure_url });
    }

    const svc = createServiceClient();
    const bucket = "products";

    const ext = pickExt(file.name, file.type || "");
    const rand = Math.random().toString(16).slice(2);
    const ts = Date.now();

    // Keep dead-drop media public and URL-storable.
    const path = `dead-drops/${kind}/${ts}-${rand}.${ext}`;

    const { error: upErr } = await svc.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || (kind === "location_video_url" ? "video/mp4" : "image/jpeg"),
    });

    if (upErr) {
      console.error("[dead-drops upload]", upErr);
      return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = svc.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: PUBLIC_ERROR_TRY_AGAIN_OR_GUEST }, { status: 500 });
  }
}

