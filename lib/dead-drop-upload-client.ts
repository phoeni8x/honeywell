/**
 * Client-only helpers for admin media uploads (legacy storage paths; Telegram mini app / mobile).
 */

const MAX_EDGE_PX = 1920;
const JPEG_QUALITY = 0.82;
/** Skip work entirely for tiny images (saves CPU in the mini app). */
const SKIP_DECODE_BELOW_BYTES = 220 * 1024;
/** If dimensions fit and file is under this size, keep original (no re-encode). */
const SKIP_REENCODE_BELOW_BYTES = 520 * 1024;

/**
 * Downscales large photos and re-encodes as JPEG to cut upload time on cellular.
 * HEIC/WebP/etc.: uses createImageBitmap when the browser can decode; otherwise returns the original file.
 */
export async function compressImageFileForUpload(file: File): Promise<File> {
  const ct = (file.type || "").toLowerCase();
  if (!ct.startsWith("image/")) return file;
  if (file.size < SKIP_DECODE_BELOW_BYTES) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const { width, height } = bitmap;
    if (width <= MAX_EDGE_PX && height <= MAX_EDGE_PX && file.size < SKIP_REENCODE_BELOW_BYTES) {
      return file;
    }

    let w = width;
    let h = height;
    if (width > MAX_EDGE_PX || height > MAX_EDGE_PX) {
      if (width >= height) {
        h = Math.round((height * MAX_EDGE_PX) / width);
        w = MAX_EDGE_PX;
      } else {
        w = Math.round((width * MAX_EDGE_PX) / height);
        h = MAX_EDGE_PX;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) return file;
    if (blob.size >= file.size * 0.92) return file;

    const base = file.name.replace(/\.[^.]+$/i, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    try {
      bitmap?.close();
    } catch {
      // ignore
    }
  }
}

export type CloudinaryDirectUploadResponse = {
  secure_url?: string;
  error?: { message?: string } | string;
};
