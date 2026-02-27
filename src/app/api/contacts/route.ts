import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { INSFORGE_URL, INSFORGE_SERVICE_KEY } from '@/lib/insforge';

function getClient() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_SERVICE_KEY });
}

// GET /api/contacts?profileId=<uuid>
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  const db = getClient();
  let query = db.database
    .from('contacts')
    .select()
    .order('created_at', { ascending: true });

  if (profileId) {
    query = query.eq('profile_id', profileId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/contacts — uno o varios (body debe incluir profile_id)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const contacts = Array.isArray(body) ? body : [body];

  const db = getClient();
  const { data, error } = await db.database
    .from('contacts')
    .insert(contacts)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// DELETE /api/contacts?id=<uuid> | ?all=true&profileId=<uuid>
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all');
  const profileId = searchParams.get('profileId');

  const db = getClient();

  if (all === 'true') {
    let query = db.database
      .from('contacts')
      .delete()
      .eq('status', 'pending');
    if (profileId) {
      query = query.eq('profile_id', profileId);
    }
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (id) {
    const { error } = await db.database
      .from('contacts')
      .delete()
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: 'Parámetro id o all requerido' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
