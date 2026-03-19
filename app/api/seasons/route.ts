import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { createNextSeason } from "@/lib/season-lifecycle";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latest = searchParams.get("latest") === "true";
  const ensureActive = searchParams.get("ensureActive") === "true";

  if (ensureActive) {
    try {
      const latestSeason = await supabase
        .from("seasons")
        .select("id, season_number, is_finalized")
        .order("season_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latestSeason.data || latestSeason.data.is_finalized) {
        await createNextSeason();
      }
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Failed to ensure active season" }, { status: 500 });
    }
  }

  let query = supabase.from("seasons").select("*").order("season_number", { ascending: false });
  if (latest) query = query.limit(1);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(latest ? (data?.[0] || null) : (data || []));
}

export async function POST(request: Request) {
  try {
    const created = await createNextSeason();
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create season" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return NextResponse.json(
    { error: "Manual season updates are disabled. Winners are computed automatically when season is finalized." },
    { status: 405 }
  );
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  const { error } = await supabase.from("seasons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

