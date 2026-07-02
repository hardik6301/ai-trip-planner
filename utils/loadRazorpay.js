/**
 * Dynamically load the Razorpay Checkout script (client-only).
 * @returns {Promise<boolean>}
 */
export function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    // Reuse script if already loaded on the page
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    // Inject checkout.js as specified in Razorpay docs
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    // Resolve when the script is ready
    script.onload = () => resolve(true);

    // Reject if CDN fails
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));

    document.body.appendChild(script);
  });
}
