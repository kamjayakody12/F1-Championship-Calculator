// app/login/page.tsx
"use client";

import { LoginForm } from "@/components/login-form";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const redirect = searchParams.get("redirect");

  useEffect(() => {
    if (message) {
      toast.error(message);
    }
    
    // Show notification if user was redirected from admin
    if (redirect && redirect.startsWith('/admin')) {
      toast.info("Please log in to access the admin dashboard", {
        description: "You'll be redirected back after successful login",
        duration: 4000,
      });
    }
  }, [message, redirect]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
