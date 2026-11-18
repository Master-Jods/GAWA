import { NextRequest } from "next/server";
import { createServerAdminClient } from "@/lib/supabase/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  businessId?: string;
}

export async function getAuthenticatedUser(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = createServerAdminClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return null;
  }

  // Check user active status
  const { data: statusData } = await supabase
    .from("account_statuses")
    .select("status")
    .eq("user_id", user.id)
    .single();

  if (statusData?.status === "suspended" || statusData?.status === "closed") {
    return null;
  }

  // Fetch roles
  const { data: roleData } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (roleData || []).map((r) => r.role);

  // If business, fetch business profile id
  let businessId: string | undefined;
  if (roles.includes("business")) {
    const { data: bData } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (bData) {
      businessId = bData.id;
    }
  }

  return {
    id: user.id,
    email: user.email || "",
    roles,
    businessId,
  };
}
