/**
 * GET /api/verify-payment?orderId=...
 *
 * Polls Cashfree to confirm an order is PAID.
 * Used by /payment-success to verify before advancing to /session-booked.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ paid: false, error: "Missing orderId" }, { status: 400 });
  }

  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    console.error("[verify-payment] Missing Cashfree credentials");
    return NextResponse.json({ paid: false, error: "Server configuration error" }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.cashfree.com/pg/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secretKey,
      },
      // Don't cache — we need live status
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[verify-payment] Cashfree API error:", res.status);
      return NextResponse.json({ paid: false, error: "Cashfree API error" }, { status: 502 });
    }

    const order = await res.json() as { order_status?: string };
    const paid = order.order_status === "PAID";

    return NextResponse.json({ paid, status: order.order_status ?? "UNKNOWN" });
  } catch (err) {
    console.error("[verify-payment] fetch error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ paid: false, error: "Verification failed" }, { status: 500 });
  }
}
