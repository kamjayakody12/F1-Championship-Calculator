import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

/**
 * GET /api/driver-stats
 * 
 * Fetches comprehensive championship data for the driver standings page.
 * This endpoint aggregates all the data needed to display:
 * - Driver standings table
 * - Points progression chart
 * - Points distribution chart
 * - Ranking evolution chart
 * - Driver statistics
 * 
 * Returns:
 * {
 *   drivers: Array<Driver>,           // All drivers with their current points
 *   teams: Array<Team>,               // All teams with their current points
 *   results: Array<Result>,           // All race results with track names
 *   tracks: Array<Track>,             // All available tracks
 *   selectedTracks: Array<SelectedTrack>, // Tracks in current season
 *   rules: Rules                      // Current rules configuration
 * }
 * 
 * Performance:
 * - Uses Promise.all() to fetch all data in parallel
 * - Single API call reduces network overhead
 * - Frontend can calculate charts from this data
 */
export async function GET() {
  try {
    // STEP 1: Fetch all required data in parallel for optimal performance
    // Using Promise.all() means all queries run simultaneously instead of sequentially
    const [
      { data: drivers, error: driversError },
      { data: teams, error: teamsError },
      { data: results, error: resultsError },
      { data: tracks, error: tracksError },
      { data: selectedTracks, error: selectedTracksError },
      { data: rules, error: rulesError }
    ] = await Promise.all([
      // Fetch all drivers with their current championship points
      supabase.from('drivers').select('*'),

      // Fetch all teams with their current constructor points
      supabase.from('teams').select('*'),

      // Fetch all race results (includes position, pole, fastest lap, etc.)
      supabase.from('results').select('*'),

      // Fetch all available tracks (for track names and metadata)
      supabase.from('tracks').select('*'),

      // Fetch selected tracks for current season with nested track data
      // This includes the event type (Race/Sprint) and schedule information
      supabase.from('selected_tracks').select('*, track(*)'),

      // Fetch rules configuration (determines if pole/fastest lap give bonus points)
      supabase.from('rules').select('polegivespoint, fastestlapgivespoint').eq('id', 1).single()
    ]);

    // STEP 2: Check for any errors in the parallel queries
    if (driversError || teamsError || resultsError || tracksError || selectedTracksError || rulesError) {
      console.error('Error fetching data:', {
        driversError,
        teamsError,
        resultsError,
        tracksError,
        selectedTracksError,
        rulesError
      });
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    // STEP 3: Enrich results with track names for easier frontend display
    // The results table stores track IDs, but we want to show track names
    const resultsWithTrackNames = results.map(result => {
      // Find the corresponding track for this result
      const track = tracks.find(t => t.id === result.track);

      return {
        ...result,
        trackName: track?.name || 'Unknown Track'  // Fallback if track not found
      };
    });

    // STEP 4: Return all data in a single response
    // Frontend will use this data to calculate:
    // - Driver standings (from drivers array)
    // - Points progression (from results + selectedTracks)
    // - Points distribution (from results grouped by track)
    // - Ranking evolution (from results over time)
    return NextResponse.json({
      drivers,                          // Driver standings data
      teams,                            // Team standings data
      results: resultsWithTrackNames,   // Race results with track names
      tracks,                           // All available tracks
      selectedTracks,                   // Current season tracks
      rules                             // Rules configuration
    });

  } catch (error) {
    // Catch any unexpected errors (network issues, database connection, etc.)
    console.error('Error in driver-stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
