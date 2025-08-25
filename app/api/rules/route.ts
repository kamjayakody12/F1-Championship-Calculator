import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';
import { apiCache, withCacheControlHeaders } from '@/lib/cache';

// GET: fetch rules
export async function GET() {
  const cached = apiCache.get<any>('rules:singleton');
  if (cached) return NextResponse.json(cached, withCacheControlHeaders());
  const { data, error } = await supabase
    .from('rules')
    .select('polegivespoint, fastestlapgivespoint')
    .eq('id', 1)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  apiCache.set('rules:singleton', data, 60_000);
  return NextResponse.json(data, withCacheControlHeaders());
}

// POST: update rules
export async function POST(request: Request) {
  const { polegivespoint, fastestlapgivespoint } = await request.json();
  const { error } = await supabase
    .from('rules')
    .update({ polegivespoint, fastestlapgivespoint })
    .eq('id', 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  apiCache.del('rules:singleton');
  return NextResponse.json({ success: true });
} 