import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { INSFORGE_URL, INSFORGE_SERVICE_KEY } from '@/lib/insforge';

function getClient() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_SERVICE_KEY });
}

// GET /api/send-sessions/active?profileId=<uuid>
// Devuelve la sesión activa (running/paused) más reciente del perfil, si existe
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) return NextResponse.json({ error: 'profileId requerido' }, { status: 400 });

  const db = getClient();

  const { data: sessions, error } = await db.database
    .from('send_sessions')
    .select()
    .eq('profile_id', profileId)
    .in('status', ['running', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const session = sessions?.[0] ?? null;
  if (!session) return NextResponse.json({ session: null, contacts: [] });

  const { data: contacts } = await db.database
    .from('contacts')
    .select()
    .eq('send_session_id', session.id)
    .eq('profile_id', profileId);

  return NextResponse.json({ session, contacts: contacts ?? [] });
}
