"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only enable shortcuts on public dashboard pages
    if (!pathname?.startsWith('/public-dash')) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+D
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        
        // Show a toast notification
        toast.success("Opening admin dashboard...", {
          description: "Use Ctrl+Shift+D to quickly access admin",
          duration: 2000,
        });
        
        // Navigate to admin with a small delay to allow toast to show
        setTimeout(() => {
          router.push('/admin');
        }, 100);
      }
    };

    // Add event listener with passive: false to allow preventDefault
    document.addEventListener('keydown', handleKeyDown, { passive: false });

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [router, pathname]);

  return null; // This component doesn't render anything
} 