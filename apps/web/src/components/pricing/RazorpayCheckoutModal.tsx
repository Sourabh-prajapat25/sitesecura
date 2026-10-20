"use client";

import React, { useEffect, useState } from "react";
import { CheckoutSessionResponse } from "@/types";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutData: CheckoutSessionResponse | null;
  userEmail?: string;
  userName?: string;
  onSuccess: (result: { paymentId: string; subscriptionId: string; signature: string }) => void;
  onError: (err: Error) => void;
}

export function RazorpayCheckoutModal({
  isOpen,
  onClose,
  checkoutData,
  userEmail,
  userName,
  onSuccess,
  onError,
}: RazorpayCheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isMockSession, setIsMockSession] = useState(false);

  useEffect(() => {
    if (!isOpen || !checkoutData) return;

    const subId = checkoutData.subscription_id || "";
    const isMock = subId.startsWith("sub_mock_") || !checkoutData.key_id || checkoutData.key_id.startsWith("rzp_test_placeholder");
    setIsMockSession(isMock);

    // If mock in non-production, don't force real razorpay script loading unless needed
    if (isMock) {
      return;
    }

    // Load Razorpay script dynamically
    const scriptId = "razorpay-checkout-script";
    if (document.getElementById(scriptId)) {
      setIsScriptLoaded(true);
      launchRazorpay();
      return;
    }

    setLoading(true);
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
      setLoading(false);
      launchRazorpay();
    };
    script.onerror = () => {
      setLoading(false);
      onError(new Error("Failed to load Razorpay payment gateway script. Please check your network connection."));
    };
    document.body.appendChild(script);

    function launchRazorpay() {
      try {
        if (!(window as any).Razorpay) {
          throw new Error("Razorpay SDK not available.");
        }

        const options = {
          key: checkoutData?.key_id,
          subscription_id: checkoutData?.subscription_id,
          name: "SiteSecura",
          description: `${(checkoutData?.plan || "basic").toUpperCase()} Plan (${checkoutData?.interval === "year" ? "Yearly" : "Monthly"})`,
          image: "/logo.png",
          handler: function (response: {
            razorpay_payment_id: string;
            razorpay_subscription_id: string;
            razorpay_signature: string;
          }) {
            onSuccess({
              paymentId: response.razorpay_payment_id,
              subscriptionId: response.razorpay_subscription_id,
              signature: response.razorpay_signature,
            });
          },
          prefill: {
            name: userName || "",
            email: userEmail || "",
          },
          theme: {
            color: "#0284c7",
          },
          modal: {
            ondismiss: function () {
              onClose();
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          onError(new Error(response?.error?.description || "Payment failed at gateway."));
        });
        rzp.open();
      } catch (err: any) {
        onError(err);
      }
    }
  }, [isOpen, checkoutData]);

  if (!isOpen || !checkoutData) return null;

  // Development simulation view when mock keys are used
  if (isMockSession) {
    const handleSimulatePayment = () => {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        const subId = checkoutData.subscription_id || `sub_mock_${Date.now()}`;
        const payId = `pay_mock_${Date.now()}`;
        const mockSig = `mock_sig_${Date.now()}`;
        onSuccess({
          paymentId: payId,
          subscriptionId: subId,
          signature: mockSig,
        });
      }, 600);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Razorpay Checkout (Sandbox)</h3>
              <p className="text-xs text-slate-400">Development Simulation Mode</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 mb-5 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Plan:</span>
              <span className="font-semibold capitalize text-white">{checkoutData.plan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Interval:</span>
              <span className="font-semibold capitalize text-white">{checkoutData.interval}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Amount:</span>
              <span className="font-semibold text-emerald-400">
                ₹{checkoutData.amount ? (checkoutData.amount / 100).toLocaleString("en-IN") : "0"}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 pt-2 border-t border-slate-700">
              <span>Subscription ID:</span>
              <span className="font-mono text-[11px] truncate max-w-[200px]">{checkoutData.subscription_id}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-6">
            In development without live Razorpay credentials, clicking below simulates payment authorization and cryptographically triggers backend verification.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                "Simulate Pay"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading indicator while Razorpay modal mounts
  return loading ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl bg-slate-900 border border-slate-800 px-5 py-4 text-slate-200 shadow-xl">
        <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
        <span className="text-sm font-medium">Opening secure checkout...</span>
      </div>
    </div>
  ) : null;
}
