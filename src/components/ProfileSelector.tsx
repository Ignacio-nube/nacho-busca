'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { Profile } from '@/types';

interface Props {
  profiles: Profile[];
  activeProfileId: string;
  activeSessionIds: Record<string, string>;
  onSelectProfile: (id: string) => void;
  onProfilesChange: (profiles: Profile[]) => void;
}

export default function ProfileSelector({
  profiles,
  activeProfileId,
  activeSessionIds,
  onSelectProfile,
  onProfilesChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function createProfile() {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Error al crear perfil');
      const profile = await res.json();
      onProfilesChange([...profiles, profile]);
      onSelectProfile(profile.id);
      setNewName('');
      setCreating(false);
      setOpen(false);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  async function renameProfile(id: string) {
    const name = editName.trim();
    if (!name) { setEditingId(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/profiles?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Error al renombrar');
      onProfilesChange(profiles.map((p) => p.id === id ? { ...p, name } : p));
      setEditingId(null);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  async function deleteProfile(id: string, name: string) {
    if (profiles.length <= 1) {
      alert('No puedes eliminar el único perfil.');
      return;
    }
    if (!confirm(`¿Eliminar el perfil "${name}"? Se borrarán todos sus contactos y configuración.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/profiles?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      const remaining = profiles.filter((p) => p.id !== id);
      onProfilesChange(remaining);
      if (activeProfileId === id) {
        onSelectProfile(remaining[0].id);
      }
      setOpen(false);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  function startEdit(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(id);
    setEditName(name);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
      >
        <span className="max-w-[140px] truncate">{activeProfile?.name || 'Perfil'}</span>
        {activeSessionIds[activeProfileId] && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        )}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                  profile.id === activeProfileId ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  if (editingId !== profile.id) {
                    onSelectProfile(profile.id);
                    setOpen(false);
                  }
                }}
              >
                {editingId === profile.id ? (
                  <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-0.5 outline-none focus:border-blue-500"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameProfile(profile.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button onClick={() => renameProfile(profile.id)} className="text-green-600 hover:text-green-800">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={`flex-1 text-sm truncate ${profile.id === activeProfileId ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                      {profile.name}
                    </span>
                    {activeSessionIds[profile.id] && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" title="Envío activo" />
                    )}
                    <button
                      onClick={(e) => startEdit(profile.id, profile.name, e)}
                      className="text-gray-300 hover:text-blue-500 transition-colors"
                      title="Renombrar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id, profile.name); }}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Eliminar perfil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 p-2">
            {creating ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 outline-none focus:border-blue-500"
                  placeholder="Nombre del perfil"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createProfile();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                />
                <button
                  onClick={createProfile}
                  disabled={loading || !newName.trim()}
                  className="text-blue-600 hover:text-blue-800 disabled:opacity-40"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button onClick={() => { setCreating(false); setNewName(''); }} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Nuevo perfil
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
