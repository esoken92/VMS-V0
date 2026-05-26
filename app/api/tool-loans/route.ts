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
      .from('tool_loans')
      .select(`
        *,
        tools:tool_id (name, barcode),
        profiles:user_id (full_name)
      `)
      .order('check_out_date', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`tools.name.ilike.%${search}%,profiles.full_name.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching tool loans:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tool loans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body: any = await request.json();

    const { data, error } = await supabase
      .from('tool_loans')
      // @ts-ignore - Supabase types are placeholders
      .insert({
        tool_id: body.tool_id,
        user_id: body.user_id,
        check_out_date: body.check_out_date || new Date().toISOString(),
        expected_return_date: body.expected_return_date,
        notes: body.notes,
        status: 'checked_out',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating tool loan:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tool loan' },
      { status: 500 }
    );
  }
}
