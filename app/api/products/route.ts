// @ts-nocheck - Supabase types are placeholders, will be generated when database is set up
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const supplier = searchParams.get('supplier');
    const bin = searchParams.get('bin');

    let query = supabase
      .from('products')
      .select(`
        *,
        suppliers:supplier_id (name),
        bin_locations:bin_id (zone, row, column)
      `);

    if (search) {
      query = query.or(`sku.ilike.%${search}%,name.ilike.%${search}%,barcode.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (supplier) {
      query = query.eq('supplier_id', supplier);
    }

    if (bin) {
      query = query.ilike('bin_id', `%${bin}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body: any = await request.json();

    const { data, error } = await supabase
      .from('products')
      // @ts-ignore - Supabase types are placeholders
      .insert({
        sku: body.sku,
        name: body.name,
        description: body.description,
        category: body.category,
        supplier_id: body.supplier_id,
        bin_id: body.bin_id,
        barcode: body.barcode,
        unit_of_measure: body.unit_of_measure,
        min_stock_level: body.min_stock_level,
        max_stock_level: body.max_stock_level,
        unit_cost: body.unit_cost,
        selling_price: body.selling_price,
        weight_kg: body.weight_kg,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product' },
      { status: 500 }
    );
  }
}
