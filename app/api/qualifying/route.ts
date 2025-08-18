import { NextResponse } from "next/server";
import { adminSupabase } from "@/utils/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track");
  
  if (!track) {
    return NextResponse.json({ error: "No track specified" }, { status: 400 });
  }
  
  const { data: qualifying, error } = await adminSupabase
    .from("qualifying")
    .select("*")
    .eq("track", track)
    .order("position", { ascending: true });
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(qualifying);
}

export async function POST(request: Request) {
  const { track, qualifyingResults } = await request.json();
  console.log("POST /api/qualifying payload:", { track, qualifyingResults });

  // Check if qualifying results already exist for this track
  const { data: existingQualifying, error: existingErr } = await adminSupabase
    .from("qualifying")
    .select("id")
    .eq("track", track);
    
  if (existingErr) {
    console.error("Error checking existing qualifying:", existingErr);
    return NextResponse.json({ error: existingErr.message }, { status: 500 });
  }
  
  if ((existingQualifying?.length || 0) > 0) {
    return NextResponse.json(
      { error: "Qualifying results for this event already exist. Updating existing results is disabled." },
      { status: 400 }
    );
  }

  // Insert qualifying results
  for (const result of qualifyingResults) {
    if (!result.driverId) continue;
    
    const { error: insertError } = await adminSupabase.from("qualifying").insert([
      {
        track,
        position: result.position,
        driver: result.driverId
      },
    ]);
    
    if (insertError) {
      console.error("Error inserting qualifying result:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    
    console.log(`Inserted qualifying result for driver ${result.driverId} at position ${result.position}`);
  }

  return NextResponse.json({ success: true });
}
