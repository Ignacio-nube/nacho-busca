'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, FileText, Mail, Settings, Send, Clock, History } from 'lucide-react';
import { Contact, EmailTemplate, CvFile, TabId, SmtpConfig, ScheduleConfig, Profile } from '@/types';
import ContactsManager from '@/components/ContactsManager';
import CVUploader from '@/components/CVUploader';
import EmailComposer from '@/components/EmailComposer';
import SmtpConfigComponent from '@/components/SmtpConfig';
import ScheduleConfigComponent from '@/components/ScheduleConfig';
import SendProgress from '@/components/SendProgress';
import ProfileSelector from '@/components/ProfileSelector';
import SendHistory from '@/components/SendHistory';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'contacts',  label: 'Contactos', icon: <Users size={18} /> },
  { id: 'cv',        label: 'Mi CV',     icon: <FileText size={18} /> },
  { id: 'template',  label: 'Plantilla', icon: <Mail size={18} /> },
  { id: 'smtp',      label: 'SMTP',      icon: <Settings size={18} /> },
  { id: 'schedule',  label: 'Programar', icon: <Clock size={18} /> },
  { id: 'send',      label: 'Enviar',    icon: <Send size={18} /> },
  { id: 'history',   label: 'Historial', icon: <History size={18} /> },
];

const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: 'Candidatura espontánea — {{company}}',
  body: `Estimado equipo de {{company}},

Me pongo en contacto con ustedes para enviarles mi currículum vitae y expresar mi interés en formar parte de su empresa.

Adjunto mi CV para su consideración. Quedo a su disposición para cualquier consulta o entrevista.

Muchas gracias por su tiempo.

Un cordial saludo`,
};

const DEFAULT_SCHEDULE: ScheduleConfig = {
  delayMs: 3000,
  startHour: 9,
  endHour: 18,
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>('contacts');

  // Perfiles
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [activeSessionIds, setActiveSessionIds] = useState<Record<string, string>>({});

  // Estado del perfil activo
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate>(DEFAULT_TEMPLATE);
  const [cvFile, setCvFile] = useState<CvFile | null>(null);
  const [smtpConfig, setSmtpConfig] = useState<Omit<SmtpConfig, 'password'> | null>(null);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE);

  const [hydrated, setHydrated] = useState(false);

  const loadProfileData = useCallback(async (profileId: string) => {
    const [contactsRes, configRes] = await Promise.all([
      fetch(`/api/contacts?profileId=${profileId}`),
      fetch(`/api/config?profileId=${profileId}`),
    ]);

    if (contactsRes.ok) {
      const data = await contactsRes.json();
      setContacts(
        data.map((c: {
          id: string; email: string; company: string;
          status?: string; error?: string; sent_at?: string; send_session_id?: string;
        }) => ({
          id: c.id,
          email: c.email,
          company: c.company || '',
          status: c.status || 'pending',
          error: c.error,
          sent_at: c.sent_at,
          send_session_id: c.send_session_id,
        }))
      );
    }

    if (configRes.ok) {
      const cfg = await configRes.json();
      if (cfg.template_subject || cfg.template_body) {
        setEmailTemplate({
          subject: cfg.template_subject || DEFAULT_TEMPLATE.subject,
          body: cfg.template_body || DEFAULT_TEMPLATE.body,
        });
      } else {
        setEmailTemplate(DEFAULT_TEMPLATE);
      }
      if (cfg.smtp_host || cfg.smtp_user) {
        setSmtpConfig({
          host: cfg.smtp_host || 'smtp.gmail.com',
          port: cfg.smtp_port || 587,
          secure: cfg.smtp_secure || false,
          user: cfg.smtp_user || '',
          fromName: cfg.smtp_from_name || '',
        });
      } else {
        setSmtpConfig(null);
      }
      if (cfg.cv_storage_key) {
        setCvFile({
          name: cfg.cv_original_name || 'CV.pdf',
          size: cfg.cv_size || 0,
          uploadedAt: cfg.cv_uploaded_at || new Date().toISOString(),
          storageKey: cfg.cv_storage_key,
          storageUrl: cfg.cv_storage_url || '',
        });
      } else {
        setCvFile(null);
      }
      setScheduleConfig({
        delayMs: cfg.schedule_delay_ms ?? DEFAULT_SCHEDULE.delayMs,
        startHour: cfg.schedule_start_hour ?? DEFAULT_SCHEDULE.startHour,
        endHour: cfg.schedule_end_hour ?? DEFAULT_SCHEDULE.endHour,
      });
    }
    // La contraseña SMTP no se persiste — se reinicia al cambiar de perfil
    setSmtpPassword('');
  }, []);

  // Carga inicial: perfiles + datos del primero
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/profiles');
        const profilesData: Profile[] = res.ok ? await res.json() : [];

        if (profilesData.length === 0) {
          // No debería pasar después de la migración, pero por si acaso
          setHydrated(true);
          return;
        }

        setProfiles(profilesData);
        const firstId = profilesData[0].id;
        setActiveProfileId(firstId);
        await loadProfileData(firstId);
      } catch (err) {
        console.error('Error loading initial state:', err);
      } finally {
        setHydrated(true);
      }
    }
    init();
  }, [loadProfileData]);

  async function handleSelectProfile(id: string) {
    if (id === activeProfileId) return;
    setActiveProfileId(id);
    setContacts([]);
    setEmailTemplate(DEFAULT_TEMPLATE);
    setCvFile(null);
    setSmtpConfig(null);
    setScheduleConfig(DEFAULT_SCHEDULE);
    await loadProfileData(id);
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function handleSmtpFormSubmit(config: Omit<SmtpConfig, 'password'>, password: string) {
    setSmtpConfig(config);
    setSmtpPassword(password);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Send size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Nacho busca laburo</h1>
            <p className="text-xs text-gray-500">Envío masivo de CV por email</p>
          </div>
          {profiles.length > 0 && activeProfileId && (
            <ProfileSelector
              profiles={profiles}
              activeProfileId={activeProfileId}
              activeSessionIds={activeSessionIds}
              onSelectProfile={handleSelectProfile}
              onProfilesChange={setProfiles}
            />
          )}
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className={`ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-semibold ${tab.id === 'contacts' && contacts.length > 0 ? '' : 'hidden'}`}>
                  {contacts.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeProfileId ? (
          <>
            <div className={activeTab === 'contacts' ? '' : 'hidden'}>
              <ContactsManager contacts={contacts} onChange={setContacts} profileId={activeProfileId} />
            </div>
            <div className={activeTab === 'cv' ? '' : 'hidden'}>
              <CVUploader cvFile={cvFile} onChange={setCvFile} profileId={activeProfileId} />
            </div>
            <div className={activeTab === 'template' ? '' : 'hidden'}>
              <EmailComposer template={emailTemplate} onChange={setEmailTemplate} profileId={activeProfileId} />
            </div>
            <div className={activeTab === 'smtp' ? '' : 'hidden'}>
              <SmtpConfigComponent
                config={smtpConfig}
                onSave={(cfg) => setSmtpConfig(cfg)}
                onPasswordChange={setSmtpPassword}
                onFullSave={handleSmtpFormSubmit}
                profileId={activeProfileId}
              />
            </div>
            <div className={activeTab === 'schedule' ? '' : 'hidden'}>
              <ScheduleConfigComponent config={scheduleConfig} onChange={setScheduleConfig} profileId={activeProfileId} />
            </div>
            <div className={activeTab === 'send' ? '' : 'hidden'}>
              <SendProgress
                contacts={contacts}
                cvFile={cvFile}
                template={emailTemplate}
                smtpConfig={smtpConfig}
                smtpPassword={smtpPassword}
                scheduleConfig={scheduleConfig}
                profileId={activeProfileId}
                onSessionStart={(sessionId) => setActiveSessionIds((prev) => ({ ...prev, [activeProfileId]: sessionId }))}
                onSessionEnd={() => setActiveSessionIds((prev) => { const next = { ...prev }; delete next[activeProfileId]; return next; })}
              />
            </div>
            <div className={activeTab === 'history' ? '' : 'hidden'}>
              <SendHistory profileId={activeProfileId} />
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p>No hay perfiles disponibles.</p>
          </div>
        )}
      </main>
    </div>
  );
}
