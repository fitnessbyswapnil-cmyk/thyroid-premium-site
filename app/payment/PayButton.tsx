"use client";

import { pushDL, generateEventId, buildMetaUserData } from "@/app/lib/analytics";

// CTA for the high-ticket program page. Mirrors the site's initiate_checkout
// dataLayer shape (same event name + event_id convention so existing GTM
// triggers fire) but with THIS program's value — the shared trackInitiateCheckout
// hardcodes the ₹299 session product and would report the wrong amount here.
export default function PayButton({ href }: { href: string }) {
  const handleClick = () => {
    const event_id = generateEventId("initiate_checkout");
    pushDL({
      event: "initiate_checkout",
      event_id,
      value: 45000,
      currency: "INR",
      content_name: "Personalised Thyroid Fat-Loss Blueprint",
      content_category: "thyroid_coaching_program",
      page_type: "program_enrollment",
      metaUserData: buildMetaUserData(undefined, event_id),
    });
  };

  return (
    <a href={href} onClick={handleClick} className="cta-button" aria-label="Pay securely and begin the program">
      Pay Securely &amp; Begin
    </a>
  );
}
