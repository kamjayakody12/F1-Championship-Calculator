// app/api/selected-tracks/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { apiCache, withCacheControlHeaders } from "@/lib/cache";

export async function GET() {
  // Join selected_tracks with tracks and include the type field
  const cached = apiCache.get<any[]>(`selected-tracks:list`);
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  const { data: sel, error } = await supabase
    .from('selected_tracks')
    .select('id, track, type, tracks(*)');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const payload = (sel || []).map((s: any) => ({ id: s.id, track: s.tracks, type: s.type }));
  apiCache.set('selected-tracks:list', payload, 60_000);
  return NextResponse.json(payload, withCacheControlHeaders());
}

export async function POST(request: Request) {
  const { trackId, type } = await request.json();
  
  // Ensure track exists
  const { data: trackObj, error: trackError } = await supabase
    .from('tracks')
    .select('*')
    .eq('id', trackId)
    .single();
    
  if (trackError || !trackObj) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }



  // Insert new selected track with type
  const { data: newSel, error } = await supabase
    .from('selected_tracks')
    .insert([{ track: trackId, type }])
    .select('id, track, type, tracks(*)')
    .single();
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  apiCache.del('selected-tracks:list');
  return NextResponse.json({ 
    id: newSel.id, 
    track: newSel.tracks,
    type: newSel.type 
  });
}

export async function PUT(request: Request) {
  const { trackId, type } = await request.json();
  
  if (!trackId || !type) {
    return NextResponse.json({ error: "trackId and type are required" }, { status: 400 });
  }

  // Update the track type
  const { data: updatedTrack, error } = await supabase
    .from('selected_tracks')
    .update({ type })
    .eq('id', trackId)
    .select('id, track, type, tracks(*)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updatedTrack) return NextResponse.json({ error: "Selected track not found" }, { status: 404 });

  apiCache.del('selected-tracks:list');
  return NextResponse.json({ 
    id: updatedTrack.id, 
    track: updatedTrack.tracks,
    type: updatedTrack.type 
  });
}

export async function DELETE(request: Request) {
  const { trackId } = await request.json();
  
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from('selected_tracks')
    .delete()
    .eq('id', trackId);
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  apiCache.del('selected-tracks:list');
  return NextResponse.json({ success: true });
}
