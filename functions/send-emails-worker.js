import { createClient } from 'npm:@insforge/sdk@latest';
import nodemailer from 'npm:nodemailer@latest';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function interpolate(template, contact) {
  return template
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{email\}\}/g, contact.email || '');
}

function msUntilHour(hour) {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() + 1);
  target.setHours(hour, 0, 0, 0);
  return target.getTime() - now.getTime();
}

function isWithinSchedule(startHour, endHour) {
  const hour = new Date().getHours();
  return hour >= startHour && hour < endHour;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    sessionId,
    smtpConfig,
    contacts,
    cvUrl,
    cvName,
    template,
    scheduleConfig,
    insforgeUrl,
    insforgeServiceKey,
  } = payload;

  if (!sessionId || !smtpConfig || !contacts?.length) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const delayMs    = scheduleConfig?.delayMs    ?? 3000;
  const startHour  = scheduleConfig?.startHour  ?? 9;
  const endHour    = scheduleConfig?.endHour    ?? 18;

  // Responder inmediatamente al caller (fire-and-forget pattern)
  // La función sigue ejecutándose en background
  const responsePromise = new Response(JSON.stringify({ ok: true, sessionId }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  // Inicializar cliente InsForge con service key
  const client = createClient({ baseUrl: insforgeUrl, anonKey: insforgeServiceKey });

  async function publish(event, data) {
    try {
      await client.realtime.connect();
      await client.realtime.subscribe(`send-session:${sessionId}`);
      await client.realtime.publish(`send-session:${sessionId}`, event, data);
    } catch (e) {
      console.error(`Failed to publish ${event}:`, e);
    }
  }

  async function updateContact(id, fields) {
    await client.database
      .from('contacts')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);
  }

  async function updateSession(fields) {
    await client.database
      .from('send_sessions')
      .update({ ...fields })
      .eq('id', sessionId);
  }

  // Ejecutar envío en background (no bloquea la respuesta HTTP)
  (async () => {
    // Crear transporter nodemailer
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: { user: smtpConfig.user, pass: smtpConfig.password },
    });

    let sentCount   = 0;
    let failedCount = 0;

    for (const contact of contacts) {
      // Verificar horario
      if (!isWithinSchedule(startHour, endHour)) {
        const resumeAt = new Date(Date.now() + msUntilHour(startHour)).toISOString();
        await updateSession({ status: 'paused', resume_at: resumeAt });
        await publish('session_paused', { resumeAt });

        // Dormir hasta la hora de inicio del día siguiente
        const waitMs = msUntilHour(startHour);
        console.log(`Out of schedule. Sleeping ${waitMs}ms until ${resumeAt}`);
        await sleep(waitMs);
        await updateSession({ status: 'running', resume_at: null });
      }

      // Enviar email
      try {
        const subject = interpolate(template.subject, contact);
        const text    = interpolate(template.body, contact);
        const html    = interpolate(template.body.replace(/\n/g, '<br>'), contact);

        await transporter.sendMail({
          from: `"${smtpConfig.fromName}" <${smtpConfig.user}>`,
          to: contact.email,
          subject,
          text,
          html,
          headers: {
            'X-Mailer': 'cv-mailer/1.0',
            'Precedence': 'bulk',
            'X-Priority': '3',
          },
          attachments: cvUrl ? [{ filename: cvName, path: cvUrl }] : [],
        });

        sentCount++;
        await updateContact(contact.id, { status: 'sent', sent_at: new Date().toISOString(), error: null });
        await publish('contact_updated', { id: contact.id, status: 'sent' });
        await updateSession({ sent_count: sentCount });
      } catch (err) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
        await updateContact(contact.id, { status: 'failed', error: errorMsg });
        await publish('contact_updated', { id: contact.id, status: 'failed', error: errorMsg });
        await updateSession({ failed_count: failedCount });
      }

      // Delay entre envíos (excepto el último)
      if (contacts.indexOf(contact) < contacts.length - 1) {
        await sleep(delayMs);
      }
    }

    // Finalizar sesión
    await updateSession({
      status: 'completed',
      finished_at: new Date().toISOString(),
      sent_count: sentCount,
      failed_count: failedCount,
    });
    await publish('session_updated', { status: 'completed', sentCount, failedCount });
  })().catch((err) => {
    console.error('Worker error:', err);
    updateSession({ status: 'aborted' }).catch(() => {});
    publish('session_updated', { status: 'aborted' }).catch(() => {});
  });

  return responsePromise;
}
