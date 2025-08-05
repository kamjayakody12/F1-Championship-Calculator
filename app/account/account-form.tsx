"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { type User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function AccountForm({ user }: { user: User | null }) {
  const supabase = createClient();
  const router = useRouter();

  // State for loading status and form fields
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");

  // Function to fetch the user's profile details
  const getProfile = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user metadata from Supabase
      const userMetadata = user.user_metadata || {};
      
      setFirstName(userMetadata.first_name || "");
      setLastName(userMetadata.last_name || "");
      setEmail(user.email || "");
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Error loading user data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Run the fetch function when the component loads
  useEffect(() => {
    getProfile();
  }, [user, getProfile]);

  // Function to validate password strength
  const validatePassword = (password: string): { isValid: boolean; error: string } => {
    if (password.length < 6) {
      return { isValid: false, error: "Password must be at least 6 characters long" };
    }

    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"|<>?,./`~]/.test(password);

    if (!hasLowercase) {
      return { isValid: false, error: "Password must contain at least one lowercase letter (a-z)" };
    }
    if (!hasUppercase) {
      return { isValid: false, error: "Password must contain at least one uppercase letter (A-Z)" };
    }
    if (!hasNumber) {
      return { isValid: false, error: "Password must contain at least one number (0-9)" };
    }
    if (!hasSpecialChar) {
      return { isValid: false, error: "Password must contain at least one special character (!@#$%^&*()_+-=[]{};':\"|<>?,./`~)" };
    }

    return { isValid: true, error: "" };
  };

  // Function to update the user's profile
  async function updateProfile() {
    if (!user) return;

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
        }
      });

      if (error) throw error;
      
      toast.success("Profile updated successfully!");
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error updating profile!");
    } finally {
      setLoading(false);
    }
  }

  // Function to update password
  async function updatePassword() {
    if (!user) return;

    // Clear previous error
    setPasswordError("");

    // Validate password match
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match!");
      return;
    }

    // Validate password strength
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setPasswordError(validation.error);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        // Handle specific Supabase password errors
        if (error.message.includes("Password should contain at least one character")) {
          setPasswordError("Password must contain at least one character of each: lowercase letter, uppercase letter, number, and special character");
        } else {
          setPasswordError(error.message);
        }
        return;
      }
      
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
    } catch (error) {
      console.error("Error updating password:", error);
      setPasswordError("Error updating password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Function to sign out
  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not Signed In</CardTitle>
            <CardDescription>
              Please sign in to access your account settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/login")} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <div className="w-full max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>
              Update your profile information and manage your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Profile Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                    className="bg-background border-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                    className="bg-background border-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email  </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted border-input text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>
              <Button 
                onClick={updateProfile} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "Updating..." : "Update Profile"}
              </Button>
            </div>

            <Separator className="bg-border" />

            {/* Password Change */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Change Password</h3>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password  </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordError(""); // Clear error when user types
                  }}
                  placeholder="Enter new password"
                  className="bg-background border-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password  </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordError(""); // Clear error when user types
                  }}
                  placeholder="Confirm new password"
                  className="bg-background border-input"
                />
              </div>
              
              {/* Password Requirements */}
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 p-3 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Password Requirements:</h4>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• At least 6 characters long</li>
                  <li>• At least one lowercase letter (a-z)</li>
                  <li>• At least one uppercase letter (A-Z)</li>
                  <li>• At least one number (0-9)</li>
                  <li>• At least one special character (!@#$%^&*()_+-=[]{};&apos;:&quot;|&lt;&gt;?,./`~)</li>
                </ul>
              </div>

              {/* Error Message */}
              {passwordError && (
                <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-700 dark:text-red-300">{passwordError}</p>
                </div>
              )}

              <Button 
                onClick={updatePassword} 
                disabled={loading || !newPassword || !confirmPassword}
                variant="outline"
                className="w-full"
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </div>

            <Separator className="bg-border" />

            {/* Sign Out */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-foreground">Sign Out</h3>
              <Button 
                onClick={signOut} 
                variant="destructive"
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}