/**
 * /api/rules
 * 
 * Manages championship rules configuration.
 * Rules are stored as a singleton (only one rules record exists with id=1).
 * 
 * Rules Configuration:
 * - polegivespoint: Whether pole position awards +1 bonus point
 * - fastestlapgivespoint: Whether fastest lap awards +1 bonus point
 * 
 * These rules affect point calculations in:
 * - /api/results (when creating results)
 * - /api/results/update (when updating results)
 * - /api/results/details (when displaying points)
 * 
 * Endpoints:
 * - GET: Fetch current rules
 * - POST: Update rules configuration
 */

import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';
import { apiCache, withCacheControlHeaders } from '@/lib/cache';

/**
 * GET /api/rules
 * 
 * Fetches the current championship rules configuration.
 * Rules are cached for 60 seconds since they rarely change.
 * 
 * Returns:
 * {
 *   polegivespoint: boolean,      // Whether pole position awards +1 point
 *   fastestlapgivespoint: boolean // Whether fastest lap awards +1 point
 * }
 * 
 * Note: Rules are a singleton - there's always exactly one rules record (id=1)
 */
export async function GET() {
  // Check cache first
  const cached = apiCache.get<any>('rules:singleton');
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  
  // Fetch the singleton rules record
  const { data, error } = await supabase
    .from('rules')
    .select('polegivespoint, fastestlapgivespoint')
    .eq('id', 1)  // Always fetch the singleton record
    .single();
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Cache for 60 seconds and return
  apiCache.set('rules:singleton', data, 60_000);
  return NextResponse.json(data, withCacheControlHeaders());
}

/**
 * POST /api/rules
 * 
 * Updates the championship rules configuration.
 * This affects how points are calculated for all future and re-calculated results.
 * 
 * Request Body:
 * {
 *   polegivespoint: boolean,      // Enable/disable pole position bonus point
 *   fastestlapgivespoint: boolean // Enable/disable fastest lap bonus point
 * }
 * 
 * Important:
 * - Changing rules does NOT automatically recalculate existing points
 * - To apply new rules to existing results, use /api/recalculate-points
 * - Rules affect both Race and Sprint events
 * 
 * Returns:
 * { success: true }
 */
export async function POST(request: Request) {
  const { polegivespoint, fastestlapgivespoint } = await request.json();
  
  // Update the singleton rules record
  const { error } = await supabase
    .from('rules')
    .update({ polegivespoint, fastestlapgivespoint })
    .eq('id', 1);  // Always update the singleton record
    
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Invalidate cache so next GET fetches fresh rules
  apiCache.del('rules:singleton');
  
  return NextResponse.json({ success: true });
} 