// @ts-nocheck - Supabase types are placeholders, will be generated when database is set up
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('stock_takes')
      .select(`
        *,
        profiles:user_id (full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`id.ilike.%${search}%,zone.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching stock takes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stock takes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body: any = await request.json();

    const { data, error } = await supabase
      .from('stock_takes')
      // @ts-ignore - Supabase types are placeholders
      .insert({
        zone: body.zone,
        user_id: body.user_id,
        status: body.status || 'pending',
        notes: body.notes,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock take:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create stock take' },
      { status: 500 }
    );
  }
}
