'use client';

import { useState } from 'react';
import { Plus, Upload, Trash2, Download, Building2, Loader2 } from 'lucide-react';
import { Contact } from '@/types';
import { parseCsvToContacts, CSV_TEMPLATE_EXAMPLE } from '@/lib/csv-parser';

interface Props {
  contacts: Contact[];
  onChange: (contacts: Contact[]) => void;
  profileId: string;
}

const EMPTY_FORM = { email: '', company: '' };

export default function ContactsManager({ contacts, onChange, profileId }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function addContact() {
    if (!form.email) {
      setError('El email es obligatorio');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Email inválido');
      return;
    }
    if (contacts.some((c) => c.email === form.email)) {
      setError('Este email ya está en la lista');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, company: form.company, profile_id: profileId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar');
      }
      const [saved] = await res.json();
      onChange([...contacts, saved]);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(id: string) {
    try {
      await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
      onChange(contacts.filter((c) => c.id !== id));
    } catch {
      // silencioso
    }
  }

  async function clearAll() {
    if (!confirm(`¿Eliminar todos los ${contacts.length} contactos pendientes?`)) return;
    try {
      await fetch(`/api/contacts?all=true&profileId=${profileId}`, { method: 'DELETE' });
      onChange(contacts.filter((c) => c.status !== 'pending'));
    } catch {
      // silencioso
    }
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const newContacts = parseCsvToContacts(text);
      if (newContacts.length === 0) {
        alert('No se encontraron emails válidos. El CSV debe tener una columna "email" o "correo".');
        return;
      }
      const existing = new Set(contacts.map((c) => c.email));
      const toAdd = newContacts.filter((c) => !existing.has(c.email));
      if (toAdd.length === 0) {
        alert('Todos los contactos del CSV ya están en la lista');
        return;
      }

      setSaving(true);
      try {
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toAdd.map(({ email, company }) => ({ email, company, profile_id: profileId }))),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Error al importar');
        }
        const saved = await res.json();
        onChange([...contacts, ...saved]);
        const skipped = newContacts.length - toAdd.length;
        alert(`Importados ${saved.length} contactos${skipped > 0 ? ` (${skipped} duplicados omitidos)` : ''}`);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Error al importar CSV');
      } finally {
        setSaving(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE_EXAMPLE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_contactos.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Plus size={20} className="text-blue-600" />
          Agregar contacto
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              className="input"
              type="email"
              placeholder="info@inmobiliaria.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addContact()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
            <input
              className="input"
              placeholder="Inmobiliaria García"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addContact()}
            />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <button className="btn-primary mt-4" onClick={addContact} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Agregar
        </button>
      </div>

      {/* Import / Actions */}
      <div className="flex flex-wrap gap-3">
        <label className={`btn-secondary cursor-pointer ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={16} />
          Importar CSV
          <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
        </label>
        <button className="btn-secondary" onClick={downloadTemplate}>
          <Download size={16} />
          Plantilla CSV de ejemplo
        </button>
        {contacts.some((c) => c.status === 'pending' || !c.status) && (
          <button
            className="ml-auto flex items-center gap-1 text-sm text-red-600 hover:text-red-800 transition-colors"
            onClick={clearAll}
          >
            <Trash2 size={16} />
            Limpiar pendientes
          </button>
        )}
      </div>

      {/* Table */}
      {contacts.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <Building2 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay empresas</p>
          <p className="text-sm mt-1">Agrega manualmente o importa un CSV con columnas <code className="bg-gray-100 px-1 rounded">empresa, email</code></p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-600">
              {contacts.length} empresa{contacts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Empresa</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-gray-800">{c.company || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{c.email}</td>
                    <td className="px-4 py-2">
                      {c.status === 'sent' && <span className="text-xs text-green-600 font-medium">✓ Enviado</span>}
                      {c.status === 'failed' && <span className="text-xs text-red-600 font-medium">✗ Falló</span>}
                      {(!c.status || c.status === 'pending') && <span className="text-xs text-gray-400">Pendiente</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeContact(c.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
