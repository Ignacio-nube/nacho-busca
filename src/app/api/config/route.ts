import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { INSFORGE_URL, INSFORGE_SERVICE_KEY } from '@/lib/insforge';

function getClient() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_SERVICE_KEY });
}

// GET /api/config?profileId=<uuid>
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get('profileId');

  if (!profileId) return NextResponse.json({ error: 'profileId requerido' }, { status: 400 });

  const db = getClient();
  const { data, error } = await db.database
    .from('app_config')
    .select()
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}

// PATCH /api/config — body debe incluir profileId; nunca persiste smtp_password
export async function PATCH(request: NextRequest) {
  const body = await request.json();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { smtp_password, profileId, ...safe } = body;

  if (!profileId) return NextResponse.json({ error: 'profileId requerido' }, { status: 400 });

  const db = getClient();
  const { data, error } = await db.database
    .from('app_config')
    .update({ ...safe, updated_at: new Date().toISOString() })
    .eq('profile_id', profileId)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? {});
}
