'use client';

import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { RotateCcw, Save } from 'lucide-react';

const storageKey = 'mm_settings';

const defaultSettings = {
  fullName: '',
  email: '',
  role: 'Administrateur',
  department: 'Exploitation',
  location: 'Casablanca',
  twoFactor: true,
  sessionTimeout: '4h',
  auditLogs: true,
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  theme: 'systeme',
  density: 'confort',
  language: 'fr',
  timezone: 'Africa/Casablanca',
  adDomain: 'monitor.local',
  adServer: '192.168.203.128',
  alertDigest: 'quotidien',
  autoRefresh: '30s',
};

type Settings = typeof defaultSettings;

type ADUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  location: string;
  groups: string[];
  role: 'admin' | 'manager' | 'technician' | 'user';
  isActive: boolean;
};

const getCookieValue = (name: string) => {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
};

const getRoleLabel = (role: ADUser['role']) => {
  const labels: Record<ADUser['role'], string> = {
    admin: 'Administrateur',
    manager: 'Manager',
    technician: 'Technicien',
    user: 'Utilisateur',
  };
  return labels[role] || role;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [hasStoredSettings, setHasStoredSettings] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      setSettings((previous) => ({ ...previous, ...parsed }));
      setHasStoredSettings(true);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    if (hasStoredSettings) return;

    const browserLanguage = typeof navigator !== 'undefined' && navigator.language
      ? navigator.language.split('-')[0]
      : defaultSettings.language;

    const browserTimezone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || defaultSettings.timezone;
      } catch {
        return defaultSettings.timezone;
      }
    })();

    setSettings((previous) => ({
      ...previous,
      language: browserLanguage,
      timezone: browserTimezone,
    }));
  }, [hasStoredSettings]);

  useEffect(() => {
    const fetchAdProfile = async () => {
      try {
        const response = await fetch('/api/ad/users');
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !Array.isArray(payload.users)) return;

        const currentUsername = (getCookieValue('mm_user') || '').toLowerCase();
        if (!currentUsername) return;

        const matchedUser = (payload.users as ADUser[]).find((user) =>
          (user.username || '').toLowerCase() === currentUsername ||
          (user.email || '').toLowerCase() === currentUsername
        );

        if (!matchedUser) return;

        const fullName = `${matchedUser.firstName || ''} ${matchedUser.lastName || ''}`.trim();

        setSettings((previous) => ({
          ...previous,
          fullName: fullName || previous.fullName,
          email: matchedUser.email || previous.email,
          role: getRoleLabel(matchedUser.role) || previous.role,
          department: matchedUser.department || previous.department,
          location: matchedUser.location || previous.location,
        }));
      } catch {
      }
    };

    fetchAdProfile();
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [saved]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    setSaved(true);
  };

  const handleReset = () => {
    localStorage.removeItem(storageKey);
    setSettings(defaultSettings);
    setHasStoredSettings(false);
    setSaved(false);
  };

  const fieldClassName = 'mt-1.5 h-9 w-full rounded-lg border border-slate-200/80 bg-white/80 px-3 text-sm text-slate-700 outline-none backdrop-blur-sm transition-all duration-200 focus:border-teal-300 focus:ring-2 focus:ring-teal-200';
  const panelClassName = 'group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md';
  const normalizedRole = settings.role.toLowerCase();
  const roleMeta = normalizedRole.includes('admin')
    ? { emoji: '👑', tone: 'border-red-200/80 bg-gradient-to-r from-red-50 to-white text-red-700' }
    : normalizedRole.includes('manager')
      ? { emoji: '🧭', tone: 'border-amber-200/80 bg-gradient-to-r from-amber-50 to-white text-amber-700' }
      : normalizedRole.includes('techn')
        ? { emoji: '🛠️', tone: 'border-sky-200/80 bg-gradient-to-r from-sky-50 to-white text-sky-700' }
        : { emoji: '👤', tone: 'border-slate-200/80 bg-gradient-to-r from-slate-50 to-white text-slate-700' };

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white via-cyan-50/50 to-teal-50/50 p-4 shadow-sm backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-200/40 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 left-24 h-20 w-20 rounded-full bg-teal-200/40 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
            <h1 className="text-3xl font-bold text-teal-600">Paramètres</h1>
            <p className="mt-2 text-sm text-slate-600">Gérez votre profil, la sécurité et l'intégration Active Directory.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Configuration active
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-all hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <RotateCcw size={15} />
              Réinitialiser
            </button>
            <button
              onClick={handleSave}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:from-teal-700 hover:to-cyan-700"
            >
              <Save size={15} />
              Enregistrer
            </button>
          </div>
        </div>

        {saved && (
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700 backdrop-blur-sm animate-pulse">
            ✅ Paramètres enregistrés avec succès.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className={`${panelClassName} ring-1 ring-teal-100/70`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-r from-teal-100/40 to-transparent" />
            <h2 className="relative mb-3 inline-flex items-center gap-2 rounded-full border border-teal-200/70 bg-teal-50/80 px-2.5 py-1 text-sm font-semibold text-teal-700">👤 Profil</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Nom complet</label>
                <input value={settings.fullName} onChange={(event) => update('fullName', event.target.value)} className={fieldClassName} placeholder="Nom Prénom" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input value={settings.email} onChange={(event) => update('email', event.target.value)} className={fieldClassName} placeholder="nom@domaine.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Rôle</label>
                <div className={`mt-1.5 flex h-9 w-full items-center rounded-lg border px-3 shadow-sm transition-all hover:-translate-y-0.5 ${roleMeta.tone}`}>
                  <span className="inline-flex items-center gap-2 truncate text-sm font-semibold leading-none">
                    <span>{roleMeta.emoji}</span>
                    <span>{settings.role}</span>
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Département</label>
                <input value={settings.department} onChange={(event) => update('department', event.target.value)} className={fieldClassName} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Localisation</label>
                <input value={settings.location} onChange={(event) => update('location', event.target.value)} className={fieldClassName} placeholder="Ville / site" />
              </div>
            </div>
          </section>

          <section className={`${panelClassName} ring-1 ring-rose-100/70`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-r from-rose-100/40 to-transparent" />
            <h2 className="relative mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200/70 bg-rose-50/80 px-2.5 py-1 text-sm font-semibold text-rose-700">🔐 Sécurité</h2>
            <div className="space-y-3 text-sm">
              <label className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span>2FA</span>
                <input type="checkbox" checked={settings.twoFactor} onChange={(event) => update('twoFactor', event.target.checked)} className="h-4 w-4" />
              </label>
              <label className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span>Journal d'audit</span>
                <input type="checkbox" checked={settings.auditLogs} onChange={(event) => update('auditLogs', event.target.checked)} className="h-4 w-4" />
              </label>
              <div>
                <label className="text-xs font-medium text-slate-600">Durée de session</label>
                <select value={settings.sessionTimeout} onChange={(event) => update('sessionTimeout', event.target.value)} className={fieldClassName}>
                  <option value="2h">2 heures</option>
                  <option value="4h">4 heures</option>
                  <option value="8h">8 heures</option>
                  <option value="12h">12 heures</option>
                </select>
              </div>
            </div>
          </section>

          <section className={`${panelClassName} ring-1 ring-sky-100/70`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-r from-sky-100/40 to-transparent" />
            <h2 className="relative mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200/70 bg-sky-50/80 px-2.5 py-1 text-sm font-semibold text-sky-700">🔔 Notifications</h2>
            <div className="space-y-3 text-sm">
              <label className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span>Email</span>
                <input type="checkbox" checked={settings.emailNotifications} onChange={(event) => update('emailNotifications', event.target.checked)} className="h-4 w-4" />
              </label>
              <label className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span>Push</span>
                <input type="checkbox" checked={settings.pushNotifications} onChange={(event) => update('pushNotifications', event.target.checked)} className="h-4 w-4" />
              </label>
              <label className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3">
                <span>SMS</span>
                <input type="checkbox" checked={settings.smsNotifications} onChange={(event) => update('smsNotifications', event.target.checked)} className="h-4 w-4" />
              </label>
              <div>
                <label className="text-xs font-medium text-slate-600">Digest alertes</label>
                <select value={settings.alertDigest} onChange={(event) => update('alertDigest', event.target.value)} className={fieldClassName}>
                  <option value="temps-reel">Temps réel</option>
                  <option value="horaire">Horaire</option>
                  <option value="quotidien">Quotidien</option>
                </select>
              </div>
            </div>
          </section>

          <section className={`${panelClassName} ring-1 ring-indigo-100/70`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-r from-indigo-100/40 to-transparent" />
            <h2 className="relative mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-2.5 py-1 text-sm font-semibold text-indigo-700">🌍 Préférences & AD</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Langue</label>
                <select value={settings.language} onChange={(event) => update('language', event.target.value)} className={fieldClassName}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Fuseau horaire</label>
                <input value={settings.timezone} onChange={(event) => update('timezone', event.target.value)} className={fieldClassName} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Thème</label>
                <select value={settings.theme} onChange={(event) => update('theme', event.target.value)} className={fieldClassName}>
                  <option value="clair">Clair</option>
                  <option value="sombre">Sombre</option>
                  <option value="systeme">Système</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Densité</label>
                <select value={settings.density} onChange={(event) => update('density', event.target.value)} className={fieldClassName}>
                  <option value="compact">Compact</option>
                  <option value="confort">Confort</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Domaine AD</label>
                <input value={settings.adDomain} onChange={(event) => update('adDomain', event.target.value)} className={fieldClassName} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Serveur AD</label>
                <input value={settings.adServer} onChange={(event) => update('adServer', event.target.value)} className={fieldClassName} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Auto-refresh dashboard</label>
                <select value={settings.autoRefresh} onChange={(event) => update('autoRefresh', event.target.value)} className={fieldClassName}>
                  <option value="15s">15 secondes</option>
                  <option value="30s">30 secondes</option>
                  <option value="60s">60 secondes</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
