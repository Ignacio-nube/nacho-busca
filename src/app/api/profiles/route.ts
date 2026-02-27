import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { INSFORGE_URL, INSFORGE_SERVICE_KEY } from '@/lib/insforge';

function getClient() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_SERVICE_KEY });
}

// GET /api/profiles
export async function GET() {
  const db = getClient();
  const { data, error } = await db.database
    .from('profiles')
    .select()
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/profiles — crear perfil con app_config vacío
export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = body.name || 'Nuevo perfil';

  const db = getClient();

  const { data: profiles, error: profileErr } = await db.database
    .from('profiles')
    .insert([{ name }])
    .select();

  if (profileErr || !profiles?.length) {
    return NextResponse.json({ error: profileErr?.message || 'Error al crear perfil' }, { status: 500 });
  }

  const profile = profiles[0];

  // Crear fila en app_config para el nuevo perfil (los defaults del schema cubren el resto)
  await db.database
    .from('app_config')
    .insert([{ profile_id: profile.id }]);

  return NextResponse.json(profile);
}

// PATCH /api/profiles?id=<uuid>
export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Parámetro id requerido' }, { status: 400 });

  const body = await request.json();
  const { name } = body;

  const db = getClient();
  const { data, error } = await db.database
    .from('profiles')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

// DELETE /api/profiles?id=<uuid>
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Parámetro id requerido' }, { status: 400 });

  const db = getClient();
  const { error } = await db.database
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
