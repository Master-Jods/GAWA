import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { createServerAdminClient } from "@/lib/supabase/server";

const BUCKET_NAME = "gawa-avatars-banners";

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const kind = (formData.get("kind") as string) || "avatar";

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (!["avatar", "banner"].includes(kind)) {
      return NextResponse.json({ error: "Invalid media kind" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Please upload a valid JPEG, PNG, WebP, or GIF image." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be smaller than 10 MB." },
        { status: 400 }
      );
    }

    const supabase = createServerAdminClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const storagePath = `${caller.id}/${kind}-${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return NextResponse.json(
        { error: uploadErr.message || "Failed to upload image" },
        { status: 500 }
      );
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

    return NextResponse.json({
      success: true,
      kind,
      url: publicUrl,
      path: storagePath,
    });
  } catch (err: any) {
    console.error("Error in POST /api/profile/media:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { kind } = await req.json();
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
    } else if (kind === "banner") {
      await supabase
        .from("account_profiles")
        .update({ banner_path: null })
        .eq("id", caller.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
