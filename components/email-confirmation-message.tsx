"use client";

import { CheckCircle, Mail, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmailConfirmationMessageProps {
  email?: string;
}

export function EmailConfirmationMessage({ email }: EmailConfirmationMessageProps) {
  return (
    <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <CardTitle className="text-green-800 dark:text-green-200">
            Account Created Successfully!
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-green-700 dark:text-green-300">
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">
                Please check your email for a confirmation link
              </p>
              {email && (
                <p className="text-sm opacity-80">
                  We sent a confirmation email to: <span className="font-mono">{email}</span>
                </p>
              )}
              <p className="text-sm mt-2 opacity-80">
                Click the link in the email to complete your account setup and start using the admin dashboard.
              </p>
            </div>
          </div>
        </CardDescription>
        <div className="mt-6 pt-4 border-t border-green-200 dark:border-green-800">
          <Link href="/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
} 