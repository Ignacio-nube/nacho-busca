import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { INSFORGE_URL, INSFORGE_SERVICE_KEY } from '@/lib/insforge';

function getClient() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_SERVICE_KEY });
}

// GET /api/send-history?profileId=<uuid>          — listar sesiones del perfil
// GET /api/send-history?profileId=<uuid>&sessionId=<uuid> — contactos de esa sesión
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');
  const sessionId = searchParams.get('sessionId');

  if (!profileId) return NextResponse.json({ error: 'profileId requerido' }, { status: 400 });

  const db = getClient();

  if (sessionId) {
    const { data, error } = await db.database
      .from('contacts')
      .select()
      .eq('send_session_id', sessionId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  }

  const { data, error } = await db.database
    .from('send_sessions')
    .select()
    .eq('profile_id', profileId)
    .order('started_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
