import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "border rounded px-3 py-2 focus:outline-none focus:ring",
        className
      )}
      {...props}
    />
  );
}
