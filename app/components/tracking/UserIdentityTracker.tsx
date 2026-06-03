"use client";

import { useEffect } from "react";
import {
  pushDL,
  getOrCreateExternalId,
  getFbc,
  getFbp,
  normalizeEmail,
  normalizePhone,
} from "../../lib/analytics";

const STORAGE_KEY = "meta_user_identity";

// Mirror identity into the FLAT localStorage keys that the GTM advanced-matching
// variables read ({{JS - user_email}} = localStorage 'user_email', etc.). Without
// this bridge the browser Meta Pixel fired with NO email/phone → low EMQ. Values
// are normalized so they hash identically to the server CAPI side.
function writeFlatIdentityKeys(identity: UserIdentity) {
  try {
    if (identity.email) localStorage.setItem("user_email", normalizeEmail(identity.email));
    if (identity.phone) localStorage.setItem("user_phone", normalizePhone(identity.phone));
    if (identity.first_name) localStorage.setItem("user_name", identity.first_name);
    const externalId = getOrCreateExternalId();
    if (externalId) localStorage.setItem("external_id", externalId);
  } catch {
    // non-critical
  }
}

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

// Builds a complete meta_userdata_ready payload with both nested user_data and
// flat fields so GTM DLVs can map email/phone/etc. into GA4 event params.
function buildIdentityPayload(identity: UserIdentity): Record<string, unknown> {
  const email = normalizeEmail(identity.email);
  const phone = normalizePhone(identity.phone);
  const payload: Record<string, unknown> = {
    event: "meta_userdata_ready",
    user_data: {
      ...identity,
      ...(email && { email }),
      ...(phone && { phone }),
    },
  };
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (identity.first_name) payload.first_name = identity.first_name;
  const external_id = getOrCreateExternalId();
  const fbc = getFbc();
  const fbp = getFbp();
  if (external_id) payload.external_id = external_id;
  if (fbc) payload.fbc = fbc;
  if (fbp) payload.fbp = fbp;
  return payload;
}

// Fires meta_userdata_ready on every page load when localStorage has identity.
// GTM should listen for this event to set user properties before other events.
export function UserIdentityTracker() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const identity: UserIdentity = JSON.parse(stored);
      window.user_identity = identity;
      if (Object.keys(identity).length > 0) {
        writeFlatIdentityKeys(identity);
        pushDL(buildIdentityPayload(identity));
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
    writeFlatIdentityKeys(merged);
    pushDL(buildIdentityPayload(merged));
  } catch {
    // non-critical
  }
}
