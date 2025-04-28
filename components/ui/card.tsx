// components/ui/card.tsx
import React from "react";
import { cn } from "@/lib/utils";

// The outer wrapper for a card
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border p-4 shadow bg-white", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Simple header area—often holds title/description
export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 flex flex-col space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

// The card’s main content area
export function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-2 px-0", className)} {...props}>
      {children}
    </div>
  );
}

// Card title (usually inside Header)
export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-bold leading-none", className)} {...props}>
      {children}
    </h3>
  );
}

// Small descriptive text (usually under title)
export function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-gray-500", className)} {...props}>
      {children}
    </p>
  );
}

// NEW: CardFooter for actions/buttons at the bottom
export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-end space-x-2 border-t pt-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// NEW: CardAction for icon buttons or inline actions
export function CardAction({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("inline-flex items-center p-1", className)} {...props}>
      {children}
    </div>
  );
}
