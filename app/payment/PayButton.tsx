"use client";

import { pushDL, generateEventId, buildMetaUserData } from "@/app/lib/analytics";

// CTA for the high-ticket program page. Mirrors the site's initiate_checkout
// dataLayer shape (same event name + event_id convention, so existing GTM
// triggers fire) but with THIS program's value — the shared trackInitiateCheckout
// hardcodes the ₹299 session product and would send the wrong amount here.
export default function PayButton({
  href,
  price,
}: {
  href: string;
  price: string;
}) {
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
    <a
      href={href}
      onClick={handleClick}
      className="block w-full rounded-2xl bg-[#6E3B52] px-8 py-5 text-center text-[1.05rem] font-semibold tracking-[-0.01em] text-[#F5EFE6] shadow-[0_14px_40px_rgba(110,59,82,0.35)] transition-all duration-200 hover:bg-[#5d3145] hover:shadow-[0_18px_48px_rgba(110,59,82,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C7A25E] active:scale-[0.99]"
    >
      Pay Securely &amp; Begin
      <span className="mt-1 block text-[0.8rem] font-normal text-[#F5EFE6]/75">
        {price}
      </span>
    </a>
  );
}
