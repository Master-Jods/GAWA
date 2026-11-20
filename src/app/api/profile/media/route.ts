import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";
import { validateEnum, jsonResponse, errorResponse } from "@/lib/server/security";
import { logAuditEvent } from "@/lib/server/audit";

const BUCKET_NAME = "gawa-avatars-banners";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates file buffer against known image magic bytes.
 */
function validateImageMagicBytes(buffer: Buffer): { valid: boolean; ext: string } {
  if (buffer.length < 12) return { valid: false, ext: "" };

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, ext: "jpg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, ext: "png" };
  }

  // WebP: RIFF .... WEBP
  const riff = buffer.toString("ascii", 0, 4);
  const webp = buffer.toString("ascii", 8, 12);
  if (riff === "RIFF" && webp === "WEBP") {
    return { valid: true, ext: "webp" };
  }

  return { valid: false, ext: "" };
}

export async function POST(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "sensitive");
    if (authErr || !caller) return authErr!;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawKind = (formData.get("kind") as string) || "avatar";

    const kind = validateEnum(rawKind, ["avatar", "banner"] as const);
    if (!kind) {
      return errorResponse("Invalid media kind", 400);
    }

    if (!file) {
      return errorResponse("No image file provided", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("Image size must be smaller than 5 MB", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Deep inspection: verify actual magic bytes, not just client header
    const { valid, ext } = validateImageMagicBytes(buffer);
    if (!valid) {
      return errorResponse(
        "File is not a valid JPEG, PNG, or WebP image",
        400
      );
    }

    const supabase = createServerAdminClient();
    // Cryptographically secure storage path isolated by auth user UUID
    const randomSuffix = crypto.randomUUID();
    const storagePath = `${caller.id}/${kind}-${Date.now()}-${randomSuffix}.${ext}`;
    const mimeType = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) {
      console.error("[Storage Upload Error]:", uploadErr);
      return errorResponse("Failed to upload image", 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    if (kind === "avatar") {
      await supabase
        .from("account_profiles")
        .update({ avatar_path: publicUrl })
        .eq("id", caller.id);

      if (caller.businessId) {
        await supabase
          .from("business_profiles")
          .update({ logo_path: publicUrl })
          .eq("id", caller.businessId);
      }
    } else {
      await supabase
        .from("account_profiles")
        .update({ banner_path: publicUrl })
        .eq("id", caller.id);
    }

    await logAuditEvent({
      actorId: caller.id,
      action: `profile.upload_${kind}`,
      entityTable: "account_profiles",
      entityId: caller.id,
      details: { storagePath, publicUrl },
    });

    return jsonResponse({
      success: true,
      kind,
      url: publicUrl,
      path: storagePath,
    });
  } catch (err: any) {
    console.error("[POST /api/profile/media error]:", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { caller, error: authErr } = await requireAuth(req, "write");
    if (authErr || !caller) return authErr!;

    const body = await req.json();
    const kind = validateEnum(body.kind, ["avatar", "banner"] as const);

    if (!kind) {
      return errorResponse("Valid kind ('avatar' or 'banner') is required", 400);
    }

    const supabase = createServerAdminClient();

    if (kind === "avatar") {
      await supabase
        .from("account_profiles")
        .update({ avatar_path: null })
        .eq("id", caller.id);

      if (caller.businessId) {
        await supabase
          .from("business_profiles")
          .update({ logo_path: null })
          .eq("id", caller.businessId);
      }
    } else {
      await supabase
        .from("account_profiles")
        .update({ banner_path: null })
        .eq("id", caller.id);
    }

    await logAuditEvent({
      actorId: caller.id,
      action: `profile.delete_${kind}`,
      entityTable: "account_profiles",
      entityId: caller.id,
    });

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/profile/media error]:", err);
    return errorResponse("Internal server error", 500);
  }
}
