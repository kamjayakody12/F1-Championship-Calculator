"use client";

import { SignupForm } from "@/components/signup-form";
import { EmailConfirmationMessage } from "@/components/email-confirmation-message";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";

function SignupContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const redirect = searchParams.get("redirect");
  const email = searchParams.get("email");

  useEffect(() => {
    if (message) {
      // Check if it's an email confirmation message
      if (message.includes("check your email") || message.includes("confirmation link")) {
        toast.success("Account created successfully!", {
          description: message,
          duration: 6000,
        });
      } else {
        // Show other messages as errors
        toast.error(message);
      }
    }
    
    // Show notification if user was redirected from admin
    if (redirect && redirect.startsWith('/admin')) {
      toast.info("Please create an account to access the admin dashboard", {
        description: "You'll be redirected back after successful signup",
        duration: 4000,
      });
    }
  }, [message, redirect]);

  // Check if we should show the email confirmation message
  const showEmailConfirmation = message && (message.includes("check your email") || message.includes("confirmation link"));

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {showEmailConfirmation ? (
          <EmailConfirmationMessage email={email || undefined} />
        ) : (
          <SignupForm />
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-6" />}>
      <SignupContent />
    </Suspense>
  );
}