// Import NextResponse for JSON HTTP responses from this API route
import { NextResponse } from "next/server";
// Import the server Supabase client to read the authenticated user session
import { createClient } from "@/lib/supabase/server";

// Pro one-time price in paise (₹199 × 100)
const PRO_AMOUNT_PAISE = 19900;
// Razorpay currency code for Indian Rupees
const PRO_CURRENCY = "INR";

/**
 * POST /api/razorpay/create-order
 * Creates a Razorpay order for Travora Pro (₹199 one-time).
 */
export async function POST() {
  try {
    // Read Razorpay credentials from server env (secret never sent to browser)
    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    // Reject if Razorpay is not configured
    if (!keyId || !keySecret) {
      const missing = [];
      if (!keyId) missing.push("NEXT_PUBLIC_RAZORPAY_KEY_ID");
      if (!keySecret) missing.push("RAZORPAY_KEY_SECRET");
      return NextResponse.json(
        {
          error: "Razorpay is not configured on the server",
          details: `Missing in .env.local: ${missing.join(", ")}. Save the file and restart npm run dev.`,
        },
        { status: 500 }
      );
    }

    // Bind Supabase to the current request cookies
    const supabase = await createClient();

    // Resolve the logged-in user from the session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Only authenticated users can start checkout
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Razorpay receipt max is 40 chars — full UUID + timestamp exceeds that limit
    // Full user id is stored in order notes below for reconciliation
    const receipt = `travora_pro_${Date.now()}`;

    // Call Razorpay Orders API with Basic auth (key_id:key_secret)
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        amount: PRO_AMOUNT_PAISE,
        currency: PRO_CURRENCY,
        receipt,
        notes: {
          user_id: user.id,
          product: "travora_pro_onetime",
        },
      }),
    });

    // Parse Razorpay JSON body
    const orderData = await razorpayResponse.json();

    // Surface Razorpay validation or auth errors
    if (!razorpayResponse.ok) {
      console.error("Razorpay create order failed:", orderData);
      return NextResponse.json(
        {
          error: orderData.error?.description || "Failed to create Razorpay order",
        },
        { status: 500 }
      );
    }

    // Return data needed to open Razorpay Checkout on the client
    return NextResponse.json({
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId,
    });
  } catch (error) {
    // Log unexpected failures for debugging
    console.error("Create Razorpay order error:", error);
    return NextResponse.json(
      { error: "Failed to create order", details: error.message },
      { status: 500 }
    );
  }
}
