"use client";

import { useEffect } from "react";

// Old Tally → Cashfree bridge — no longer used. Redirect to native funnel.
export default function BookConfirmedPage() {
  useEffect(() => {
    window.location.replace("/book");
  }, []);
  return null;
}
