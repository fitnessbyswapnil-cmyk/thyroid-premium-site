"use client";

import { useEffect } from "react";
import { pushDL } from "../../lib/analytics";

const STORAGE_KEY = "meta_user_identity";

export type UserIdentity = {
  email?: string;
  phone?: string;
  first_name?: string;
};

declare global {
  interface Window {
    user_identity?: UserIdentity;
  }
}

export function UserIdentityTracker() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const identity: UserIdentity = JSON.parse(stored);
      window.user_identity = identity;
      if (Object.keys(identity).length > 0) {
        pushDL({ event: "meta_userdata_ready", user_data: { ...identity } });
      }
    } catch {
      // non-critical
    }
  }, []);

  return null;
}

export function persistUserIdentity(data: Partial<UserIdentity>) {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const existing: UserIdentity = stored ? JSON.parse(stored) : {};
    const merged: UserIdentity = { ...existing, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.user_identity = merged;
    pushDL({ event: "meta_userdata_ready", user_data: { ...merged } });
  } catch {
    // non-critical
  }
}
