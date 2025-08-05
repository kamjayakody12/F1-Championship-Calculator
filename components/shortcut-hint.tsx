"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Info } from "lucide-react";

export function ShortcutHint() {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only show on the main public dashboard page
    if (pathname !== '/public-dash') {
      return;
    }

    // Show the hint after 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-background border border-border rounded-lg p-3 shadow-lg max-w-xs animate-in slide-in-from-bottom-2 duration-300 z-50">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info className="w-4 h-4" />
        <span>
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">D</kbd> to open admin
        </span>
      </div>
    </div>
  );
} 