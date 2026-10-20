"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User } from "firebase/auth";
import {
  subscribeToAuthState,
  signOutUser,
  getFirebaseIdToken,
  reloadCurrentUser,
} from "@/lib/auth";
import { api } from "@/lib/api";
import { UserProfile, Organization, SubscriptionPlan, OnboardingStatus } from "@/types";
import { normalizePlan } from "@/lib/entitlements";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  organization: Organization | null;
  plan: SubscriptionPlan;
  onboardingStatus: OnboardingStatus | null;
  loading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  reloadUser: () => Promise<User | null>;
  logout: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organization: null,
  plan: "free",
  onboardingStatus: null,
  loading: true,
  isAuthenticated: false,
  isEmailVerified: false,
  reloadUser: async () => null,
  logout: async () => {},
  getIdToken: async () => null,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (firebaseUser: User) => {
    try {
      const syncRes = await api.syncUser();
      setProfile(syncRes.user);
      setOrganization(syncRes.organization);
      setPlan(normalizePlan(syncRes.plan));
      setOnboardingStatus(syncRes.onboarding_status || "completed");
    } catch (syncErr) {
      try {
        const res = await api.getCurrentUser();
        setProfile(res.user);
        setOrganization(res.organization);
        setPlan(normalizePlan(res.plan));
        setOnboardingStatus((res as any).onboarding_status || "completed");
      } catch (e) {
        // Fallback for offline or local preview
        setProfile({
          id: firebaseUser.uid,
          firebase_uid: firebaseUser.uid,
          organization_id: "default-org",
          email: firebaseUser.email || "user@sitesecura.io",
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          role: "free",
          is_active: true,
          created_at: new Date().toISOString(),
        });
        setPlan("free");
        setOnboardingStatus("completed");
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser);
      } else {
        setProfile(null);
        setOrganization(null);
        setPlan("free");
        setOnboardingStatus(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const reloadUser = useCallback(async (): Promise<User | null> => {
    const updated = await reloadCurrentUser();
    setUser(updated ? ({ ...updated } as User) : null);
    if (updated) {
      await fetchProfile(updated);
    }
    return updated;
  }, [fetchProfile]);

  const logout = async () => {
    await signOutUser();
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setPlan("free");
    setOnboardingStatus(null);
  };

  const getIdToken = async (forceRefresh = false) => {
    return await getFirebaseIdToken(forceRefresh);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        organization,
        plan,
        onboardingStatus,
        loading,
        isAuthenticated: !!user,
        isEmailVerified: Boolean(user?.emailVerified),
        reloadUser,
        logout,
        getIdToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
