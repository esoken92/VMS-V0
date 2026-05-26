// @ts-nocheck - Supabase types are placeholders, will be generated when database is set up
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        products:product_id (name, sku),
        profiles:user_id (full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`reference.ilike.%${search}%`);
    }

    if (type) {
      query = query.eq('movement_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stock movements' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body: any = await request.json();

    const { data, error } = await supabase
      .from('stock_movements')
      // @ts-ignore - Supabase types are placeholders
      .insert({
        product_id: body.product_id,
        movement_type: body.movement_type,
        quantity: body.quantity,
        reference: body.reference,
        reason: body.reason,
        user_id: body.user_id,
        bin_id: body.bin_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock movement:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create stock movement' },
      { status: 500 }
    );
  }
}
