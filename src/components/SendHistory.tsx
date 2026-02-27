'use client';

import { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';

interface SendSession {
  id: string;
  status: 'running' | 'paused' | 'completed' | 'aborted';
  total: number;
  sent_count: number;
  failed_count: number;
  started_at: string;
  finished_at: string | null;
}

interface SessionContact {
  id: string;
  email: string;
  company: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  sent_at?: string;
}

interface Props {
  profileId: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: SendSession['status'] }) {
  if (status === 'completed') {
    return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium">Completado</span>;
  }
  if (status === 'aborted') {
    return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 font-medium">Abortado</span>;
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">
      <Loader2 size={10} className="animate-spin" />
      {status === 'paused' ? 'Pausado' : 'Enviando'}
    </span>
  );
}

export default function SendHistory({ profileId }: Props) {
  const [sessions, setSessions] = useState<SendSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Record<string, SessionContact[]>>({});
  const [loadingContacts, setLoadingContacts] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    fetch(`/api/send-history?profileId=${profileId}`)
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [profileId]);

  async function toggleSession(sessionId: string) {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    if (contacts[sessionId]) return; // ya cargados

    setLoadingContacts(sessionId);
    try {
      const res = await fetch(`/api/send-history?profileId=${profileId}&sessionId=${sessionId}`);
      const data = await res.json();
      setContacts((prev) => ({ ...prev, [sessionId]: Array.isArray(data) ? data : [] }));
    } catch {
      setContacts((prev) => ({ ...prev, [sessionId]: [] }));
    } finally {
      setLoadingContacts(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <History size={20} className="text-blue-600" />
          Historial de envíos
        </h2>

        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            <Clock size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Sin historial aún</p>
            <p className="text-sm mt-1">Los envíos completados aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const isExpanded = expandedId === session.id;
              const sessionContacts = contacts[session.id] ?? [];
              const isLoadingThis = loadingContacts === session.id;

              return (
                <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => toggleSession(session.id)}
                  >
                    {isExpanded
                      ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                      : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={session.status} />
                        <span className="text-sm text-gray-600">
                          {formatDate(session.started_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle size={12} /> {session.sent_count} enviados
                        </span>
                        {session.failed_count > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle size={12} /> {session.failed_count} fallidos
                          </span>
                        )}
                        <span className="text-gray-400">Total: {session.total}</span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {isLoadingThis ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 size={18} className="animate-spin text-blue-500" />
                        </div>
                      ) : sessionContacts.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Sin detalle de contactos</p>
                      ) : (
                        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                          {sessionContacts.map((c) => (
                            <div key={c.id} className="flex items-center gap-3 px-4 py-2">
                              {c.status === 'sent'    && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                              {c.status === 'failed'  && <XCircle size={14} className="text-red-500 flex-shrink-0" />}
                              {c.status === 'pending' && <Loader2 size={14} className="text-gray-300 flex-shrink-0 animate-spin" />}
                              <span className="text-sm font-medium text-gray-700 w-36 truncate">{c.company || '—'}</span>
                              <span className="text-sm text-gray-400 flex-1 truncate">{c.email}</span>
                              {c.error && (
                                <span className="text-xs text-red-400 truncate max-w-[160px]" title={c.error}>{c.error}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
