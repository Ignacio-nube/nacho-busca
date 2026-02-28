'use client';

import { useState } from 'react';
import { Settings, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { SmtpConfig as SmtpConfigType, SmtpPreset } from '@/types';

interface Props {
  config: Omit<SmtpConfigType, 'password'> | null;
  onSave: (config: Omit<SmtpConfigType, 'password'>) => void;
  onPasswordChange?: (password: string) => void;
  onFullSave?: (config: Omit<SmtpConfigType, 'password'>, password: string) => void;
  profileId: string;
}

const PRESETS: SmtpPreset[] = [
  { name: 'Gmail',             host: 'smtp.gmail.com',          port: 587, secure: false },
  { name: 'Gmail (SSL)',       host: 'smtp.gmail.com',          port: 465, secure: true  },
  { name: 'Outlook / Hotmail', host: 'smtp-mail.outlook.com',   port: 587, secure: false },
  { name: 'Yahoo',             host: 'smtp.mail.yahoo.com',     port: 587, secure: false },
];

type TestStatus = 'idle' | 'loading' | 'ok' | 'error';

export default function SmtpConfig({ config, onSave, onPasswordChange, onFullSave, profileId }: Props) {
  const [host,        setHost]        = useState(config?.host     || 'smtp.gmail.com');
  const [port,        setPort]        = useState(String(config?.port || 587));
  const [secure,      setSecure]      = useState(config?.secure   || false);
  const [user,        setUser]        = useState(config?.user     || '');
  const [fromName,    setFromName]    = useState(config?.fromName || '');
  const [password,    setPassword]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [testStatus,  setTestStatus]  = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [saving,      setSaving]      = useState(false);
  const [saveResult,  setSaveResult]  = useState<'ok' | 'error' | null>(null);

  function applyPreset(p: SmtpPreset) {
    setHost(p.host);
    setPort(String(p.port));
    setSecure(p.secure);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!host.trim())     e.host = 'Requerido';
    if (!port.trim())     e.port = 'Requerido';
    if (!user.trim())     e.user = 'Requerido';
    if (!password.trim()) e.password = 'Requerido para probar y enviar';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function testConnection() {
    if (!validate()) return;
    setTestStatus('loading');
    setTestMessage('');
    try {
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: Number(port), secure, user, password, fromName }),
      });
      const data = await res.json();
      setTestStatus(res.ok ? 'ok' : 'error');
      setTestMessage(res.ok ? data.message : data.error);
    } catch {
      setTestStatus('error');
      setTestMessage('Error de red al contactar con el servidor');
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!host.trim() || !user.trim()) {
      setErrors({
        host: !host.trim() ? 'Requerido' : '',
        user: !user.trim() ? 'Requerido' : '',
      });
      return;
    }
    const cfg: Omit<SmtpConfigType, 'password'> = {
      host, port: Number(port), secure, user, fromName,
    };

    setSaving(true);
    try {
      // Persistir en InsForge (sin password)
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          smtp_host: host,
          smtp_port: Number(port),
          smtp_secure: secure,
          smtp_user: user,
          smtp_from_name: fromName,
        }),
      });

      if (onFullSave) onFullSave(cfg, password);
      else            onSave(cfg);
      if (onPasswordChange) onPasswordChange(password);
      setSaveResult('ok');
      setTimeout(() => setSaveResult(null), 3000);
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  }

  const bannerCls =
    testStatus === 'ok'    ? 'bg-green-50 text-green-700 border-green-200' :
    testStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                             'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings size={20} className="text-blue-600" />
          Configuración SMTP
        </h2>

        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Presets rápidos</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" className="btn-secondary py-1.5 text-sm" onClick={() => applyPreset(p)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Servidor SMTP *</label>
              <input className="input" placeholder="smtp.gmail.com" value={host} onChange={(e) => setHost(e.target.value)} />
              <p className={`text-red-500 text-xs mt-1 ${errors.host ? 'visible' : 'invisible'}`}>{errors.host || '\u00a0'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puerto *</label>
              <input className="input" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="secure" className="w-4 h-4 text-blue-600" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
            <label htmlFor="secure" className="text-sm text-gray-700">Usar SSL/TLS (puerto 465)</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de remitente</label>
            <input className="input" placeholder="Tu Nombre" value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (usuario SMTP) *</label>
            <input className="input" type="email" placeholder="tu@gmail.com" value={user} onChange={(e) => setUser(e.target.value)} />
            <p className={`text-red-500 text-xs mt-1 ${errors.user ? 'visible' : 'invisible'}`}>{errors.user || '\u00a0'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña de aplicación *
              <span className="ml-2 font-normal text-gray-400 text-xs">(no se persiste — solo en memoria)</span>
            </label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPwd ? 'text' : 'password'}
                placeholder="xxxx xxxx xxxx xxxx"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowPwd(!showPwd)}>
                <span className={showPwd ? '' : 'hidden'}><EyeOff size={16} /></span>
                <span className={showPwd ? 'hidden' : ''}><Eye size={16} /></span>
              </button>
            </div>
            <p className={`text-red-500 text-xs mt-1 ${errors.password ? 'visible' : 'invisible'}`}>{errors.password || '\u00a0'}</p>
          </div>

          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${bannerCls} ${testStatus === 'idle' ? 'hidden' : ''}`}>
            <span className={testStatus === 'loading' ? '' : 'hidden'}><Loader2 size={16} className="animate-spin flex-shrink-0" /></span>
            <span className={testStatus === 'ok' ? '' : 'hidden'}><CheckCircle size={16} className="flex-shrink-0" /></span>
            <span className={testStatus === 'error' ? '' : 'hidden'}><XCircle size={16} className="flex-shrink-0" /></span>
            <span>{testStatus === 'loading' ? 'Probando conexión...' : testMessage}</span>
          </div>

          {saveResult === 'ok' && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm border bg-green-50 text-green-700 border-green-200">
              <CheckCircle size={16} className="flex-shrink-0" />
              Configuración guardada. La contraseña solo se guarda en memoria.
            </div>
          )}
          {saveResult === 'error' && (
            <div className="flex items-center gap-2 p-3 rounded-lg text-sm border bg-red-50 text-red-700 border-red-200">
              <XCircle size={16} className="flex-shrink-0" />
              Error al guardar la configuración SMTP.
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={testConnection}>
              <span className={testStatus === 'loading' ? '' : 'hidden'}><Loader2 size={16} className="animate-spin" /></span>
              <span className={testStatus === 'loading' ? 'hidden' : ''}><Settings size={16} /></span>
              <span>Probar conexión</span>
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              Guardar configuración
            </button>
          </div>
        </form>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
        <p>
          <strong>Gmail:</strong> Necesitas activar verificación en 2 pasos y crear una{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">
            contraseña de aplicación
          </a>.
        </p>
        <p><strong>Límite Gmail:</strong> ~500 emails/día con contraseña de aplicación.</p>
      </div>
    </div>
  );
}
