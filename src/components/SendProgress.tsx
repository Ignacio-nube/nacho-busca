'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  FileText,
  Mail,
  Settings,
  Clock,
  PauseCircle,
} from 'lucide-react';
import { Contact, SmtpConfig, EmailTemplate, CvFile, ScheduleConfig } from '@/types';
import { createClient } from '@insforge/sdk';

interface Props {
  contacts: Contact[];
  cvFile: CvFile | null;
  template: EmailTemplate;
  smtpConfig: Omit<SmtpConfig, 'password'> | null;
  smtpPassword: string;
  scheduleConfig: ScheduleConfig;
  profileId: string;
  onSessionStart?: (sessionId: string) => void;
  onSessionEnd?: () => void;
}

type SendStatus = 'idle' | 'sending' | 'paused' | 'done' | 'error';

interface ContactState {
  id: string;
  email: string;
  company: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export default function SendProgress({
  contacts,
  cvFile,
  template,
  smtpConfig,
  smtpPassword,
  scheduleConfig,
  profileId,
  onSessionStart,
  onSessionEnd,
}: Props) {
  const [status, setStatus] = useState<SendStatus>('idle');
  const [globalError, setGlobalError] = useState('');
  const [resumeAt, setResumeAt] = useState<string | null>(null);
  const [contactMap, setContactMap] = useState<Map<string, ContactState>>(new Map());
  const realtimeRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<string | null>(null);

  // Inicializar el mapa de contactos desde props
  useEffect(() => {
    const map = new Map<string, ContactState>();
    for (const c of contacts) {
      map.set(c.id, {
        id: c.id,
        email: c.email,
        company: c.company,
        status: (c.status as 'pending' | 'sent' | 'failed') || 'pending',
        error: c.error,
      });
    }
    setContactMap(new Map(map));
  }, [contacts]);

  // Al montar o cambiar de perfil, verificar si hay sesión activa para reconectar
  useEffect(() => {
    if (!profileId) return;

    async function checkActiveSession() {
      try {
        const res = await fetch(`/api/send-sessions/active?profileId=${profileId}`);
        if (!res.ok) return;
        const { session, contacts: sessionContacts } = await res.json();
        if (!session) return;

        // Hay sesión activa — inicializar mapa con esos contactos
        const map = new Map<string, ContactState>();
        for (const c of (sessionContacts as ContactState[])) {
          map.set(c.id, {
            id: c.id,
            email: c.email,
            company: c.company,
            status: c.status || 'pending',
            error: c.error,
          });
        }
        setContactMap(new Map(map));
        setStatus(session.status === 'paused' ? 'paused' : 'sending');
        if (session.resume_at) setResumeAt(session.resume_at);

        subscribeToSession(session.id);
        onSessionStart?.(session.id);
      } catch {
        // silencioso
      }
    }

    checkActiveSession();

    return () => {
      if (realtimeRef.current && channelRef.current) {
        realtimeRef.current.realtime.unsubscribe(channelRef.current);
        realtimeRef.current.realtime.disconnect();
        realtimeRef.current = null;
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  function subscribeToSession(sessionId: string) {
    const client = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    });
    realtimeRef.current = client;

    const channel = `send-session:${sessionId}`;
    channelRef.current = channel;

    client.realtime.connect().then(async () => {
      await client.realtime.subscribe(channel);

      client.realtime.on('contact_updated', (payload: { id: string; status: 'sent' | 'failed'; error?: string }) => {
        setContactMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(payload.id);
          if (existing) {
            next.set(payload.id, { ...existing, status: payload.status, error: payload.error });
          }
          return next;
        });
      });

      client.realtime.on('session_paused', (payload: { resumeAt: string }) => {
        setStatus('paused');
        setResumeAt(payload.resumeAt);
      });

      client.realtime.on('session_updated', (payload: { status: string }) => {
        if (payload.status === 'completed' || payload.status === 'aborted') {
          setStatus('done');
          client.realtime.unsubscribe(channel);
          client.realtime.disconnect();
          onSessionEnd?.();
        }
      });
    }).catch(() => {/* silencioso */});
  }

  const checks = [
    {
      icon: <Building2 size={18} />,
      label: 'Empresas',
      ok: contacts.some((c) => !c.status || c.status === 'pending'),
      detail: contacts.some((c) => !c.status || c.status === 'pending')
        ? `${contacts.filter((c) => !c.status || c.status === 'pending').length} pendiente(s)`
        : 'Sin contactos pendientes',
    },
    {
      icon: <FileText size={18} />,
      label: 'CV',
      ok: cvFile !== null,
      detail: cvFile ? cvFile.name : 'No se ha subido ningún CV',
    },
    {
      icon: <Mail size={18} />,
      label: 'Plantilla',
      ok: !!(template.subject && template.body),
      detail: template.subject && template.body ? 'Asunto y cuerpo configurados' : 'Falta asunto o cuerpo',
    },
    {
      icon: <Settings size={18} />,
      label: 'SMTP',
      ok: !!(smtpConfig && smtpPassword),
      detail: smtpConfig
        ? smtpPassword
          ? `${smtpConfig.host}:${smtpConfig.port}`
          : 'Falta la contraseña (ve a la pestaña SMTP)'
        : 'SMTP no configurado',
    },
  ];

  const allReady = checks.every((c) => c.ok);

  const allContacts = Array.from(contactMap.values());
  const sentList    = allContacts.filter((c) => c.status === 'sent');
  const failedList  = allContacts.filter((c) => c.status === 'failed');
  const pendingList = allContacts.filter((c) => c.status === 'pending');

  async function handleSend() {
    if (!allReady || !smtpConfig || !cvFile) return;
    setStatus('sending');
    setGlobalError('');
    setResumeAt(null);

    try {
      const res = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          smtpConfig: { ...smtpConfig, password: smtpPassword },
          scheduleConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error desconocido');

      const { sessionId } = data;
      onSessionStart?.(sessionId);
      subscribeToSession(sessionId);
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Error desconocido');
      setStatus('error');
    }
  }

  const isSending = status === 'sending' || status === 'paused';

  return (
    <div className="space-y-6">
      {/* Checklist */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <Send size={20} className="text-blue-600" />
          Requisitos para enviar
        </h2>
        <div className="space-y-3">
          {checks.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className={item.ok ? 'text-green-600' : 'text-gray-300'}>{item.icon}</div>
              <span className="font-medium text-gray-700 w-20 text-sm">{item.label}</span>
              {item.ok ? (
                <CheckCircle size={17} className="text-green-500 flex-shrink-0" />
              ) : (
                <XCircle size={17} className="text-red-400 flex-shrink-0" />
              )}
              <span className={`text-sm ${item.ok ? 'text-gray-500' : 'text-red-500'}`}>
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Send button */}
      <div className="flex items-center gap-4">
        <button
          className={`btn-primary text-base px-8 py-3 ${
            !allReady || isSending ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleSend}
          disabled={!allReady || isSending}
        >
          {status === 'sending' ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send size={18} />
              Enviar a {pendingList.length} empresa{pendingList.length !== 1 ? 's' : ''}
            </>
          )}
        </button>
        <p className={`text-sm text-amber-600 flex items-center gap-1 ${allReady ? 'hidden' : ''}`}>
          <AlertCircle size={16} />
          Completa todos los requisitos
        </p>
      </div>

      {/* Banner paused */}
      {status === 'paused' && resumeAt && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <PauseCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Envío pausado fuera del horario configurado</p>
            <p className="text-sm mt-1 flex items-center gap-1">
              <Clock size={14} />
              Retoma automáticamente a las{' '}
              <strong>{new Date(resumeAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</strong>
              {' '}del día siguiente.
            </p>
          </div>
        </div>
      )}

      {/* Global error */}
      <div className={`flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 ${globalError ? '' : 'hidden'}`}>
        <XCircle size={20} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Error al enviar</p>
          <p className="text-sm mt-1">{globalError}</p>
        </div>
      </div>

      {/* Progress summary (during send) */}
      {isSending && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1.5 text-green-600">
              <CheckCircle size={15} /> {sentList.length} enviados
            </span>
            <span className="flex items-center gap-1.5 text-red-500">
              <XCircle size={15} /> {failedList.length} fallidos
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <Loader2 size={15} className="animate-spin" /> {pendingList.length} pendientes
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${allContacts.length ? ((sentList.length + failedList.length) / allContacts.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Results live feed */}
      {(isSending || status === 'done') && allContacts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">
              {status === 'done' ? 'Resultados finales' : 'En tiempo real'}
            </span>
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle size={14} /> {sentList.length} enviados
            </span>
            {failedList.length > 0 && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <XCircle size={14} /> {failedList.length} fallidos
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {[...sentList, ...failedList, ...pendingList].map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                {c.status === 'sent'    && <CheckCircle size={16} className="text-green-500 flex-shrink-0" />}
                {c.status === 'failed'  && <XCircle     size={16} className="text-red-500   flex-shrink-0" />}
                {c.status === 'pending' && <Loader2     size={16} className="text-gray-300  flex-shrink-0 animate-spin" />}
                <span className="font-medium text-sm text-gray-800 truncate w-44">{c.company || c.email}</span>
                <span className="text-sm text-gray-400 flex-1 truncate">{c.email}</span>
                <span className={`text-xs text-red-500 truncate max-w-xs ${c.error ? '' : 'hidden'}`}>{c.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
