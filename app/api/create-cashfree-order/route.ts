/**
 * POST /api/create-cashfree-order
 *
 * Creates a Cashfree payment order server-side and returns the
 * payment_session_id needed by the Cashfree JS SDK modal on the client.
 *
 * Body: { leadId, customerPhone, customerName, customerEmail? }
 * Returns: { paymentSessionId, orderId }
 *
 * ENV VARS:
 *   CASHFREE_APP_ID        — from Cashfree Dashboard → Credentials
 *   CASHFREE_SECRET_KEY    — from Cashfree Dashboard → Credentials
 *   NEXT_PUBLIC_APP_URL    — https://swapnilumbarkarfitness.in
 */
import { NextRequest, NextResponse } from "next/server";

// ── TEST MODE ─────────────────────────────────────────────────────────────────
// Set IS_TEST_MODE = true during QA to charge ₹1 instead of ₹299.
// UI/copy always shows ₹299 — only the actual Cashfree transaction amount changes.
// Flip back to false before going live.
const IS_TEST_MODE = true;
const DISPLAY_PRICE = 299;
const ACTUAL_PAYMENT_AMOUNT = IS_TEST_MODE ? 1 : DISPLAY_PRICE;
// ─────────────────────────────────────────────────────────────────────────────

const CF_BASE =
  process.env.NODE_ENV === "production"
    ? "https://api.cashfree.com"
    : "https://sandbox.cashfree.com";

export async function POST(req: NextRequest) {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://swapnilumbarkarfitness.in";

  if (!appId || !secretKey) {
    console.error("[create-cashfree-order] Missing Cashfree credentials");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const body = await req.json() as {
    leadId?: string;
    customerPhone?: string;
    customerName?: string;
    customerEmail?: string;
  };

  const { leadId, customerPhone, customerName, customerEmail } = body;

  if (!leadId || !customerPhone || !customerName) {
    return NextResponse.json(
      { error: "leadId, customerPhone, and customerName are required" },
      { status: 400 },
    );
  }

  // Normalise phone: strip non-digits, take last 10 digits
  const phone = customerPhone.replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) {
    return NextResponse.json(
      { error: "Invalid phone number — must be 10 digits" },
      { status: 400 },
    );
  }

  // order_id must be unique per transaction; include timestamp to allow retries
  const orderId = `thyroid_${leadId}_${Date.now()}`;

  try {
    const res = await fetch(`${CF_BASE}/pg/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secretKey,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: ACTUAL_PAYMENT_AMOUNT,
        order_currency: "INR",
        customer_details: {
          customer_id: leadId,
          customer_phone: phone,
          customer_name: customerName,
          customer_email:
            customerEmail || "noreply@swapnilumbarkarfitness.in",
        },
        order_meta: {
          // {order_id} is a Cashfree template variable — replaced at redirect time
          return_url: `${appUrl}/payment-success?leadId=${leadId}&order_id={order_id}`,
          notify_url: `${appUrl}/api/cashfree-webhook`,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("[create-cashfree-order] Cashfree API error:", res.status, errBody);
      return NextResponse.json(
        { error: "Failed to create payment order" },
        { status: 502 },
      );
    }

    const order = await res.json() as {
      payment_session_id?: string;
      order_id?: string;
    };

    if (!order.payment_session_id) {
      console.error("[create-cashfree-order] No payment_session_id in response:", order);
      return NextResponse.json(
        { error: "Invalid response from Cashfree" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      paymentSessionId: order.payment_session_id,
      orderId: order.order_id ?? orderId,
    });
  } catch (err) {
    console.error("[create-cashfree-order] fetch error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Network error creating order" },
      { status: 500 },
    );
  }
}
