"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type UserRole = "talent" | "business" | "admin";

export interface AccountProfile {
  id: string;
  display_name: string;
  bio?: string | null;
  avatar_path?: string | null;
  banner_path?: string | null;
  avatar_color?: string | null;
  location?: string | null;
  profile_visible: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AccountProfile | null;
  role: UserRole;
  loading: boolean;
  mfaVerified: boolean;
  signIn: (
    email: string,
    password: string,
    expectedRole?: "talent" | "business"
  ) => Promise<{ error?: string; role?: UserRole }>;
  signUp: (params: {
    email: string;
    password: string;
    displayName: string;
    role: "talent" | "business";
    businessName?: string;
  }) => Promise<{ error?: string; requiresEmailConfirmation?: boolean; role?: UserRole }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [role, setRole] = useState<UserRole>("talent");
  const [loading, setLoading] = useState(true);
  const [mfaVerified, setMfaVerified] = useState(false);

  const fetchUserData = async (currentUser: User): Promise<UserRole> => {
    let resolvedRole: UserRole = "talent";
    try {
      // 1. Fetch role from account_roles
      const { data: roleData, error: roleError } = await supabase
        .from("account_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (!roleError && roleData && roleData.length > 0) {
        // If user has admin role, give priority to admin
        const roles = roleData.map((r) => r.role as UserRole);
        if (roles.includes("admin")) {
          resolvedRole = "admin";
        } else if (roles.includes("business")) {
          resolvedRole = "business";
        } else {
          resolvedRole = "talent";
        }
      }
      setRole(resolvedRole);

      // 2. Fetch profile from account_profiles
      const { data: profileData } = await supabase
        .from("account_profiles")
        .select("id, display_name, bio, avatar_path, banner_path, avatar_color, location, profile_visible")
        .eq("id", currentUser.id)
        .single();

      if (profileData) {
        setProfile(profileData as AccountProfile);
      }
    } catch (err) {
      console.error("Error fetching user profile/roles:", err);
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setMfaVerified(!assuranceError && assurance?.currentLevel === "aal2");
    return resolvedRole;
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setMfaVerified(false);
        // Avoid holding the Auth event lock while issuing more Auth requests.
        setTimeout(() => { fetchUserData(newSession.user).finally(() => setLoading(false)); }, 0);
        return;
      } else {
        setProfile(null);
        setRole("talent");
        setMfaVerified(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string,
    expectedRole?: "talent" | "business"
  ) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Unable to establish your account identity." };
    const { data: status, error: statusError } = await supabase.from("account_statuses")
      .select("status").eq("user_id", data.user.id).single();
    if (statusError || status?.status !== "active") {
      await supabase.auth.signOut();
      return { error: "Your account is not active or could not be checked." };
    }
    const actualRole = await fetchUserData(data.user);
    if (expectedRole && actualRole !== "admin" && expectedRole !== actualRole) {
      await supabase.auth.signOut();
      return { error: `Please use the ${actualRole} login tab for this account.` };
    }
    // An AAL1 session can only proceed through the mandatory Authenticator gate.
    return { role: actualRole };
  };

  const signUp = async ({
    email,
    password,
    displayName,
    role: chosenRole,
    businessName,
  }: {
    email: string;
    password: string;
    displayName: string;
    role: "talent" | "business";
    businessName?: string;
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined"
          ? new URL("/", window.location.origin).toString()
          : undefined,
        data: {
          display_name: displayName,
          role: chosenRole,
          business_name: chosenRole === "business" ? businessName || `${displayName}'s Business` : undefined,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.session && data.user) {
      await supabase.auth.signOut();
      return { error: "Signup email confirmation must be enabled in Supabase before registration can continue." };
    }

    // Email confirmation required
    return { requiresEmailConfirmation: true, role: chosenRole };
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore logout API errors
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole("talent");
    setMfaVerified(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user);
    }
  };

  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    try {
      const res = await fetch("/api/auth/google");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: data.error || "Failed to initiate Google sign-in" };
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return {};
      }
      return { error: "No redirect URL received" };
    } catch (err: any) {
      return { error: err?.message || "Network error" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        mfaVerified,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
