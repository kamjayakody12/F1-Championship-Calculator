"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get the current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // If no user and we're on an admin route, redirect to login
          if (pathname?.startsWith('/admin')) {
            const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
            router.push(loginUrl);
            return;
          }
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (pathname?.startsWith('/admin')) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          if (pathname?.startsWith('/admin')) {
            router.push('/login');
          }
        } else if (event === 'SIGNED_IN') {
          setUser(session?.user ?? null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth, router, pathname]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If no user and we're on an admin route, don't render children
  if (!user && pathname?.startsWith('/admin')) {
    return null;
  }

  // If user is authenticated or we're not on an admin route, render children
  return <>{children}</>;
} 