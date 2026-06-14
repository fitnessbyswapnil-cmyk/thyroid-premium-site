"use client";

import { useEffect } from "react";
import {
  pushDL,
  getOrCreateExternalId,
  getFbc,
  getFbp,
  generateEventId,
  buildMetaUserData,
  normalizeEmail,
  normalizePhone,
} from "../../lib/analytics";

const STORAGE_KEY = "meta_user_identity";

export type UserIdentity = {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
};

declare global {
  interface Window {
    user_identity?: UserIdentity;
  }
}

// Builds a complete metaUserDataReady payload. Event name matches the GTM
// Custom Event trigger ("metaUserDataReady") that fires the GA4 "meta_userdata"
// tag. Carries nested user_data, flat top-level fields, AND the metaUserData
// object the tag reads — all with real, normalized values, never "undefined".
function buildIdentityPayload(identity: UserIdentity): Record<string, unknown> {
  const event_id = generateEventId("meta_userdata");
  const payload: Record<string, unknown> = {
    event: "metaUserDataReady",
    event_id,
    user_data: { ...identity },
  };
  if (identity.email) payload.email = normalizeEmail(identity.email);
  if (identity.phone) payload.phone = normalizePhone(identity.phone);
  if (identity.first_name) payload.first_name = identity.first_name;
  if (identity.last_name) payload.last_name = identity.last_name;
  const external_id = getOrCreateExternalId();
  const fbc = getFbc();
  const fbp = getFbp();
  if (external_id) payload.external_id = external_id;
  if (fbc) payload.fbc = fbc;
  if (fbp) payload.fbp = fbp;
  payload.metaUserData = buildMetaUserData(identity, event_id);
  return payload;
}

// Fires metaUserDataReady on every page load when localStorage has identity.
// GTM should listen for this event to set user properties before other events.
export function UserIdentityTracker() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const identity: UserIdentity = JSON.parse(stored);
      window.user_identity = identity;
      if (Object.keys(identity).length > 0) {
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
    pushDL(buildIdentityPayload(merged));
  } catch {
    // non-critical
  }
}
