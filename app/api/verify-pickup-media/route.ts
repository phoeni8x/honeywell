import { NextResponse } from "next/server";

/**
 * Part 2: EXIF / ffprobe verification — stub stores metadata result for admin review.
 * Install `exifr` on server and parse buffers in production.
 */
export async function POST() {
  return NextResponse.json({
    ok: true,
    flagged: false,
    message: "Pickup media verification stub — wire exifr + GPS checks for production.",
  });
}
