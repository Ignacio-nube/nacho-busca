'use client';

import { useState, useRef } from 'react';
import { Clock, Loader2, CheckCircle } from 'lucide-react';
import { ScheduleConfig } from '@/types';

interface Props {
  config: ScheduleConfig;
  onChange: (config: ScheduleConfig) => void;
  profileId: string;
}

function formatDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ScheduleConfigComponent({ config, onChange, profileId }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(updated: ScheduleConfig) {
    onChange(updated);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch('/api/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId,
            schedule_delay_ms: updated.delayMs,
            schedule_start_hour: updated.startHour,
            schedule_end_hour: updated.endHour,
          }),
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch {/* silencioso */} finally {
        setSaving(false);
      }
    }, 600);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Programación de envío
          </h2>
          {saving && <Loader2 size={16} className="animate-spin text-blue-500" />}
          {saved && <CheckCircle size={16} className="text-green-500" />}
        </div>

        <div className="space-y-6">
          {/* Delay entre emails */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Intervalo entre emails: <span className="text-blue-600 font-semibold">{formatDelay(config.delayMs)}</span>
            </label>
            <input
              type="range"
              min="1000"
              max="30000"
              step="500"
              value={config.delayMs}
              onChange={(e) => handleChange({ ...config, delayMs: Number(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1s (rápido)</span>
              <span>30s (conservador)</span>
            </div>
          </div>

          {/* Horario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Horario de envío
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hora inicio</label>
                <select
                  className="input"
                  value={config.startHour}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    handleChange({ ...config, startHour: v, endHour: Math.max(v + 1, config.endHour) });
                  }}
                >
                  {hours.map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hora fin</label>
                <select
                  className="input"
                  value={config.endHour}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    handleChange({ ...config, endHour: v, startHour: Math.min(config.startHour, v - 1) });
                  }}
                >
                  {hours.filter((h) => h > config.startHour).map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Los emails solo se envían entre las <strong>{String(config.startHour).padStart(2, '0')}:00</strong> y las <strong>{String(config.endHour).padStart(2, '0')}:00</strong>.
              Si se llega al horario límite, el envío se pausa automáticamente hasta el día siguiente.
            </p>
          </div>
        </div>
      </div>

      {/* Info anti-spam */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-2">
        <p className="font-semibold">Recomendaciones anti-spam</p>
        <ul className="list-disc list-inside space-y-1 text-amber-700">
          <li>Usa un intervalo de al menos <strong>3-5 segundos</strong> entre emails.</li>
          <li>Envía solo en horario laboral para mejor tasa de apertura.</li>
          <li>Gmail limita a ~500 emails/día. Yahoo y Outlook pueden ser más restrictivos.</li>
          <li>El envío se detiene solo si hay un error grave; los fallos individuales se registran y continúan.</li>
        </ul>
      </div>
    </div>
  );
}
