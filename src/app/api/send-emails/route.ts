import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { INSFORGE_URL, INSFORGE_SERVICE_KEY } from '@/lib/insforge';

const EDGE_FN_URL = process.env.INSFORGE_EDGE_FUNCTION_URL || `${INSFORGE_URL}/functions/send-emails-worker`;

function getClient() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_SERVICE_KEY });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { smtpConfig, scheduleConfig, profileId } = body;

    if (!profileId) {
      return NextResponse.json({ error: 'profileId requerido' }, { status: 400 });
    }
    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.password) {
      return NextResponse.json({ error: 'Configuración SMTP incompleta' }, { status: 400 });
    }

    const client = getClient();

    // 1. Obtener contactos pending del perfil
    const { data: contacts, error: contactsErr } = await client.database
      .from('contacts')
      .select()
      .eq('profile_id', profileId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (contactsErr) return NextResponse.json({ error: 'Error al obtener contactos' }, { status: 500 });
    if (!contacts?.length) return NextResponse.json({ error: 'No hay contactos pendientes de envío' }, { status: 400 });

    // 2. Obtener app_config del perfil
    const { data: config, error: configErr } = await client.database
      .from('app_config')
      .select()
      .eq('profile_id', profileId)
      .maybeSingle();

    if (configErr || !config) return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
    if (!config.cv_storage_url || !config.cv_original_name) {
      return NextResponse.json({ error: 'No hay CV subido' }, { status: 400 });
    }
    if (!config.template_subject || !config.template_body) {
      return NextResponse.json({ error: 'La plantilla de email está incompleta' }, { status: 400 });
    }

    // 3. Crear send_session con profile_id
    const { data: sessions, error: sessionErr } = await client.database
      .from('send_sessions')
      .insert([{ total: contacts.length, status: 'running', profile_id: profileId }])
      .select();

    if (sessionErr || !sessions?.length) {
      return NextResponse.json({ error: 'Error al crear sesión de envío' }, { status: 500 });
    }
    const session = sessions[0];

    // 4. Asignar send_session_id a los contactos
    const contactIds = contacts.map((c: { id: string }) => c.id);
    await client.database
      .from('contacts')
      .update({ send_session_id: session.id })
      .in('id', contactIds);

    // 5. Llamar Edge Function fire-and-forget
    const workerPayload = {
      sessionId: session.id,
      profileId,
      smtpConfig,
      contacts,
      cvUrl: config.cv_storage_url,
      cvName: config.cv_original_name,
      template: {
        subject: config.template_subject,
        body: config.template_body,
      },
      scheduleConfig: scheduleConfig || {
        delayMs: config.schedule_delay_ms,
        startHour: config.schedule_start_hour,
        endHour: config.schedule_end_hour,
      },
      insforgeUrl: INSFORGE_URL,
      insforgeServiceKey: INSFORGE_SERVICE_KEY,
    };

    fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INSFORGE_SERVICE_KEY}`,
      },
      body: JSON.stringify(workerPayload),
    }).catch((err) => console.error('Edge function call failed:', err));

    return NextResponse.json({ sessionId: session.id, total: contacts.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('send-emails error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
