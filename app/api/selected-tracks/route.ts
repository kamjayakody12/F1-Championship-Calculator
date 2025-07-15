// app/api/selected-tracks/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";

export async function GET() {
  // Join selected_tracks with tracks
  const { data: sel, error } = await supabase
    .from('selected_tracks')
    .select('id, track, tracks(*)');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    (sel || []).map((s: any) => ({ id: s.id, track: s.tracks }))
  );
}

export async function POST(request: Request) {
  const { trackId } = await request.json();
  // Ensure track exists
  const { data: trackObj, error: trackError } = await supabase.from('tracks').select('*').eq('id', trackId).single();
  if (trackError || !trackObj) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }
  const { data: newSel, error } = await supabase.from('selected_tracks').insert([{ track: trackId }]).select('id, track, tracks(*)').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: newSel.id, track: newSel.tracks });
}

export async function DELETE(request: Request) {
  const { trackId } = await request.json();
  const { error } = await supabase.from('selected_tracks').delete().eq('track', trackId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    console.log('PUT /api/selected-tracks - request body:', body); // Debug log
    
    const { trackIds } = body;
    
    if (!trackIds || !Array.isArray(trackIds)) {
      console.error('Invalid trackIds:', trackIds); // Debug log
      return NextResponse.json({ error: "trackIds must be an array" }, { status: 400 });
    }

    console.log('PUT /api/selected-tracks - trackIds:', trackIds); // Debug log

    // Validate that all trackIds are valid UUIDs
    const invalidIds = trackIds.filter(id => !id || typeof id !== 'string' || id.trim() === '');
    if (invalidIds.length > 0) {
      console.error('Invalid track IDs found:', invalidIds); // Debug log
      return NextResponse.json({ error: `Invalid track IDs: ${invalidIds.join(', ')}` }, { status: 400 });
    }

    // Remove all existing selected tracks
    const { error: deleteError } = await supabase.from('selected_tracks').delete().not('id', 'is', null);
    if (deleteError) {
      console.error('Delete error:', deleteError); // Debug log
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log('Successfully deleted existing tracks'); // Debug log

    // Insert the new selected tracks
    const inserts = trackIds.map((trackId: string) => ({ track: trackId }));
    console.log('Inserting tracks:', inserts); // Debug log
    
    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from('selected_tracks').insert(inserts);
      if (insertError) {
        console.error('Insert error:', insertError); // Debug log
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      console.log('Successfully inserted new tracks'); // Debug log
    } else {
      console.log('No tracks to insert'); // Debug log
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT endpoint error:', error); // Debug log
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
