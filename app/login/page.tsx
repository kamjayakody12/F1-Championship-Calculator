// app/admin/login/page.tsx
"use client";

import { LoginForm } from "@/components/login-form";

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
