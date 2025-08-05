"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/app/login/actions";
import { useSearchParams } from "next/navigation";

export function SignupForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin";

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Enter your details below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            {/* Hidden input for redirect */}
            <input type="hidden" name="redirect" value={redirectTo} />
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  placeholder="John"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  placeholder="Doe"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input 
                  id="confirmPassword" 
                  name="confirmPassword" 
                  type="password" 
                  required 
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="terms"
                  name="terms"
                  className="h-4 w-4 rounded border-gray-300"
                  required
                />
                <Label htmlFor="terms" className="text-sm">
                  I agree to the{" "}
                  <a href="#" className="underline underline-offset-4">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="underline underline-offset-4">
                    Privacy Policy
                  </a>
                </Label>
              </div>
              <Button type="submit" formAction={signup} className="w-full">
                Create Account
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <a href="/login" className="underline underline-offset-4">
                Sign in
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 