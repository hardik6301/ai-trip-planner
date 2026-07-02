// Import Node crypto for HMAC SHA256 signature verification
import crypto from "crypto";
// Import NextResponse for JSON HTTP responses from this API route
import { NextResponse } from "next/server";
// Import the server Supabase client to verify session and update profiles
import { createClient } from "@/lib/supabase/server";
// Admin client bypasses RLS for trusted post-payment profile updates
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/razorpay/verify-payment
 * Verifies Razorpay payment signature and upgrades the user to Pro.
 */
export async function POST(request) {
  try {
    // Read Razorpay secret from server env only
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

    // Reject if secret is missing
    if (!keySecret) {
      return NextResponse.json(
        { error: "Razorpay is not configured on the server" },
        { status: 500 }
      );
    }

    // Parse JSON body from the client after successful checkout
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
    } = body;

    // Validate required Razorpay fields
    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !userId
    ) {
      return NextResponse.json(
        { error: "Missing required payment fields" },
        { status: 400 }
      );
    }

    // Bind Supabase to the current request cookies
    const supabase = await createClient();

    // Resolve the logged-in user from the session
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Reject unauthenticated requests
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prevent upgrading a different user's profile
    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build the payload Razorpay signs: order_id|payment_id
    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;

    // Compute expected HMAC SHA256 hex digest with the key secret
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(signaturePayload)
      .digest("hex");

    // Reject tampered or forged signatures
    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // Pro fields to persist after successful payment
    const proFields = {
      is_pro: true,
      pro_since: new Date().toISOString(),
      subscription_id: razorpay_payment_id,
    };

    // Prefer admin client (bypasses RLS) once payment signature is verified
    const admin = createAdminClient();
    let updateError = null;

    if (admin) {
      const { data: updated, error } = await admin
        .from("profiles")
        .update(proFields)
        .eq("id", user.id)
        .select("id");

      updateError = error;

      // Profile row missing — create it with Pro status
      if (!error && (!updated || updated.length === 0)) {
        const { error: insertError } = await admin.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
          ...proFields,
        });
        updateError = insertError;
      }
    } else {
      // Fallback: update via user session when service role key is not set
      const { data: updated, error } = await supabase
        .from("profiles")
        .update(proFields)
        .eq("id", user.id)
        .select("id");

      updateError = error;

      if (!error && (!updated || updated.length === 0)) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null,
          ...proFields,
        });
        updateError = insertError;
      }
    }

    // Surface database update failures
    if (updateError) {
      console.error("Failed to update profile after payment:", updateError);
      return NextResponse.json(
        {
          error: "Payment verified but profile update failed",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Success — client can refresh UI to show Pro status
    return NextResponse.json({ success: true });
  } catch (error) {
    // Log unexpected failures for debugging
    console.error("Verify Razorpay payment error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment", details: error.message },
      { status: 500 }
    );
  }
}
