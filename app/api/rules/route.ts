import { supabase } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET: fetch rules
export async function GET() {
  const { data, error } = await supabase
    .from('rules')
    .select('polegivespoint, fastestlapgivespoint')
    .eq('id', 1)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: update rules
export async function POST(request: Request) {
  const { polegivespoint, fastestlapgivespoint } = await request.json();
  const { error } = await supabase
    .from('rules')
    .update({ polegivespoint, fastestlapgivespoint })
    .eq('id', 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
} 