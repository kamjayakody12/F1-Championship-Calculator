// app/api/login/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  // Replace this logic with your real authentication
  if (email === "kani@nadeev.com" && password === "nadeevisgay") {
    return NextResponse.json({ success: true, message: "Logged in" });
  }
  return NextResponse.json({ success: false, message: "Invalid credentials" });
}
