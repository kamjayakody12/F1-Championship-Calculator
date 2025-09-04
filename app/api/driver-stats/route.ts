import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Fetch all data in parallel
    const [
      { data: drivers, error: driversError },
      { data: teams, error: teamsError },
      { data: results, error: resultsError },
      { data: tracks, error: tracksError },
      { data: selectedTracks, error: selectedTracksError },
      { data: rules, error: rulesError }
    ] = await Promise.all([
      supabase.from('drivers').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('results').select('*'),
      supabase.from('tracks').select('*'),
      supabase.from('selected_tracks').select('*, track(*)'),
      supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single()
    ]);

    if (driversError || teamsError || resultsError || tracksError || selectedTracksError || rulesError) {
      console.error('Error fetching data:', { driversError, teamsError, resultsError, tracksError, selectedTracksError, rulesError });
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    // Combine results with track names
    const resultsWithTrackNames = results.map(result => {
      const track = tracks.find(t => t.id === result.track);
      return {
        ...result,
        trackName: track?.name || 'Unknown Track'
      };
    });

    return NextResponse.json({
      drivers,
      teams,
      results: resultsWithTrackNames,
      tracks,
      selectedTracks,
      rules
    });
  } catch (error) {
    console.error('Error in driver-stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
