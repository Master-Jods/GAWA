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

interface PendingMfaChallenge {
  challengeId: string;
  userId: string;
  channel: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AccountProfile | null;
  role: UserRole;
  loading: boolean;
  pendingMfaChallenge: PendingMfaChallenge | null;
  signIn: (
    email: string,
    password: string,
    expectedRole?: "talent" | "business"
  ) => Promise<{
    error?: string;
    role?: UserRole;
    mfaRequired?: boolean;
    challengeId?: string;
    userId?: string;
    channel?: string;
    method?: string;
  }>;
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
  verifyOtp: (
    challengeId: string,
    code: string,
    userId: string
  ) => Promise<{ error?: string; role?: string }>;
  resendOtp: (challengeId: string) => Promise<{ error?: string; challengeId?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [role, setRole] = useState<UserRole>("talent");
  const [loading, setLoading] = useState(true);
  const [pendingMfaChallenge, setPendingMfaChallenge] =
    useState<PendingMfaChallenge | null>(null);

  const fetchUserData = async (currentUser: User): Promise<UserRole> => {
    let resolvedRole: UserRole =
      currentUser.user_metadata?.role === "business" ? "business" : "talent";
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
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchUserData(newSession.user);
      } else {
        setProfile(null);
        setRole("talent");
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
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expected_role: expectedRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Login failed" };
      }

      // MFA required
      if (data.mfa_required) {
        setPendingMfaChallenge({
          challengeId: data.challenge_id,
          userId: data.user_id,
          channel: data.channel || "email",
        });
        return {
          mfaRequired: true,
          challengeId: data.challenge_id,
          userId: data.user_id,
          channel: data.channel || "email",
          method: data.method,
        };
      }

      // Normal session response
      if (data.access_token && data.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) {
          return { error: sessionError.message };
        }
        // fetchUserData will be triggered by onAuthStateChange
        const actualRole = data.role as UserRole || "talent";
        return { role: actualRole };
      }

      return { error: "Unexpected response from server" };
    } catch (err: any) {
      return { error: err?.message || "Network error" };
    }
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
      const actualRole = await fetchUserData(data.user);
      return { role: actualRole };
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
    setPendingMfaChallenge(null);
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

  const verifyOtp = async (
    challengeId: string,
    code: string,
    userId: string
  ): Promise<{ error?: string; role?: string }> => {
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gawa-csrf": "1" },
        body: JSON.stringify({ challenge_id: challengeId, code, user_id: userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "OTP verification failed" };
      }

      // Set session from OTP verify response
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      }

      setPendingMfaChallenge(null);
      return { role: data.role };
    } catch (err: any) {
      return { error: err?.message || "Network error" };
    }
  };

  const resendOtp = async (
    challengeId: string
  ): Promise<{ error?: string; challengeId?: string }> => {
    try {
      const res = await fetch("/api/auth/otp/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-gawa-csrf": "1" },
        body: JSON.stringify({ challenge_id: challengeId }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Failed to resend OTP" };
      }

      if (data.challenge_id) {
        setPendingMfaChallenge((prev) =>
          prev ? { ...prev, challengeId: data.challenge_id } : null
        );
        return { challengeId: data.challenge_id };
      }

      return {};
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
        pendingMfaChallenge,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        signInWithGoogle,
        verifyOtp,
        resendOtp,
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
