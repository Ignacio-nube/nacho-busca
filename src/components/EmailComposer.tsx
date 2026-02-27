'use client';

import { useRef } from 'react';
import { useState } from 'react';
import { Mail, Eye, EyeOff } from 'lucide-react';
import { EmailTemplate, Contact } from '@/types';
import { interpolateTemplate } from '@/lib/template';

interface Props {
  template: EmailTemplate;
  onChange: (template: EmailTemplate) => void;
  profileId: string;
}

const SAMPLE_CONTACT: Contact = {
  id: 'sample',
  email: 'info@inmobiliaria-garcia.com',
  company: 'Inmobiliaria García',
  status: 'pending',
};

const VARIABLES = [
  { var: '{{company}}', label: 'Nombre de la empresa' },
  { var: '{{email}}',   label: 'Email de la empresa'  },
];

export default function EmailComposer({ template, onChange, profileId }: Props) {
  const [preview, setPreview] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewSubject = interpolateTemplate(template.subject, SAMPLE_CONTACT);
  const previewBody    = interpolateTemplate(template.body,    SAMPLE_CONTACT);

  function insertVariable(v: string) {
    onChange({ ...template, body: template.body + v });
  }

  function handleChange(updated: EmailTemplate) {
    onChange(updated);
    // Debounce: guardar en InsForge 1s después del último cambio
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          template_subject: updated.subject,
          template_body: updated.body,
        }),
      }).catch(() => {/* silencioso */});
    }, 1000);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Mail size={20} className="text-blue-600" />
            Plantilla de email
          </h2>
          <button
            type="button"
            className="btn-secondary text-sm py-1.5"
            onClick={() => setPreview((p) => !p)}
          >
            <span className={preview ? '' : 'hidden'}><EyeOff size={16} /></span>
            <span className={preview ? 'hidden' : ''}><Eye size={16} /></span>
            <span>{preview ? 'Editar' : 'Vista previa'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs text-gray-500">Variables:</span>
          {VARIABLES.map(({ var: v, label }) => (
            <button
              key={v}
              type="button"
              title={label}
              disabled={preview}
              className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-default"
              onClick={() => insertVariable(v)}
            >
              {v}
            </button>
          ))}
        </div>

        <div className={preview ? 'hidden' : 'space-y-4'}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
            <input
              className="input"
              value={template.subject}
              onChange={(e) => handleChange({ ...template, subject: e.target.value })}
              placeholder="Candidatura espontánea — {{company}}"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuerpo del email</label>
            <textarea
              className="input min-h-[300px] resize-y text-sm leading-relaxed"
              value={template.body}
              onChange={(e) => handleChange({ ...template, body: e.target.value })}
              placeholder="Estimado equipo de {{company}}, ..."
            />
          </div>
        </div>

        <div className={preview ? 'space-y-3' : 'hidden'}>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Asunto</span>
            </div>
            <div className="px-4 py-3">
              <p className={previewSubject ? 'text-gray-800 font-medium' : 'text-gray-400 italic'}>
                {previewSubject || 'Sin asunto'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuerpo</span>
            </div>
            <div className="px-4 py-4 min-h-[120px]">
              <pre className={`whitespace-pre-wrap text-sm font-sans leading-relaxed ${previewBody ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                {previewBody || 'Sin contenido'}
              </pre>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Ejemplo: <strong>{SAMPLE_CONTACT.company}</strong> · {SAMPLE_CONTACT.email}
          </p>
        </div>

      </div>
    </div>
  );
}
