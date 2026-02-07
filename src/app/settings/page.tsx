'use client';

import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { Bell, Lock, User, ShieldCheck, Palette, Globe, Server, Database, Save } from 'lucide-react';

const defaultSettings = {
  fullName: '',
  email: '',
  role: 'Administrateur',
  department: '',
  twoFactor: false,
  sessionTimeout: '8h',
  emailNotifications: true,
  pushNotifications: false,
  smsNotifications: false,
  theme: 'clair',
  density: 'confort',
  language: 'fr',
  timezone: 'Africa/Casablanca',
  auditLogs: true,
  adDomain: 'monitor.local',
  adServer: '192.168.203.128',
};

type Settings = typeof defaultSettings;

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('mm_settings');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('mm_settings', JSON.stringify(settings));
    setSaved(true);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-teal-600">Paramètres</h1>
            <p className="text-slate-600 mt-2">Gérez votre profil, sécurité et préférences système</p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Save size={18} />
            Enregistrer
          </button>
        </div>

        {saved && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3">
            ✅ Paramètres enregistrés.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profil */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <User size={18} className="text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-900">Profil utilisateur</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700">Nom complet</label>
                <input
                  value={settings.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200 focus:ring-2 focus:ring-teal-300"
                  placeholder="Nom Prénom"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Email</label>
                <input
                  value={settings.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200 focus:ring-2 focus:ring-teal-300"
                  placeholder="nom.prenom@domaine.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Rôle</label>
                <input
                  value={settings.role}
                  onChange={(e) => update('role', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200 focus:ring-2 focus:ring-teal-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Département</label>
                <input
                  value={settings.department}
                  onChange={(e) => update('department', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200 focus:ring-2 focus:ring-teal-300"
                />
              </div>
            </div>
          </section>

          {/* Sécurité */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-rose-600" />
              <h2 className="text-sm font-semibold text-slate-900">Sécurité</h2>
            </div>
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/70 border border-slate-200">
                <span>Authentification à deux facteurs (2FA)</span>
                <input
                  type="checkbox"
                  checked={settings.twoFactor}
                  onChange={(e) => update('twoFactor', e.target.checked)}
                  className="w-4 h-4"
                />
              </label>
              <div>
                <label className="text-xs font-semibold text-slate-700">Durée session</label>
                <select
                  value={settings.sessionTimeout}
                  onChange={(e) => update('sessionTimeout', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200"
                >
                  <option value="2h">2h</option>
                  <option value="4h">4h</option>
                  <option value="8h">8h</option>
                  <option value="12h">12h</option>
                </select>
              </div>
              <label className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/70 border border-slate-200">
                <span>Journal d'audit</span>
                <input
                  type="checkbox"
                  checked={settings.auditLogs}
                  onChange={(e) => update('auditLogs', e.target.checked)}
                  className="w-4 h-4"
                />
              </label>
            </div>
          </section>

          {/* Notifications */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            </div>
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/70 border border-slate-200">
                <span>Email</span>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => update('emailNotifications', e.target.checked)}
                  className="w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/70 border border-slate-200">
                <span>Push</span>
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) => update('pushNotifications', e.target.checked)}
                  className="w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/70 border border-slate-200">
                <span>SMS</span>
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={(e) => update('smsNotifications', e.target.checked)}
                  className="w-4 h-4"
                />
              </label>
            </div>
          </section>

          {/* Apparence */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-purple-600" />
              <h2 className="text-sm font-semibold text-slate-900">Apparence</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700">Thème</label>
                <select
                  value={settings.theme}
                  onChange={(e) => update('theme', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200"
                >
                  <option value="clair">Clair</option>
                  <option value="sombre">Sombre</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Densité</label>
                <select
                  value={settings.density}
                  onChange={(e) => update('density', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200"
                >
                  <option value="confort">Confort</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>
          </section>

          {/* Localisation */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Globe size={18} className="text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Localisation</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700">Langue</label>
                <select
                  value={settings.language}
                  onChange={(e) => update('language', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200"
                >
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                  <option value="es">Espagnol</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Fuseau horaire</label>
                <input
                  value={settings.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200"
                />
              </div>
            </div>
          </section>

          {/* Intégration AD */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Active Directory</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700">Domaine</label>
                <input
                  value={settings.adDomain}
                  onChange={(e) => update('adDomain', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Serveur</label>
                <input
                  value={settings.adServer}
                  onChange={(e) => update('adServer', e.target.value)}
                  className="w-full mt-2 px-4 py-2 rounded-xl bg-white/70 border border-slate-200"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">Ces informations sont indicatives et n'altèrent pas la configuration LDAP.</p>
          </section>

          {/* Système */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Server size={18} className="text-orange-600" />
              <h2 className="text-sm font-semibold text-slate-900">Système</h2>
            </div>
            <div className="text-sm space-y-3">
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/70 border border-slate-200">
                <span>Version application</span>
                <span className="text-slate-600">v3.0</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/70 border border-slate-200">
                <span>Environnement</span>
                <span className="text-slate-600">Production</span>
              </div>
            </div>
          </section>

          {/* Données */}
          <section className="rounded-2xl bg-white/80 border border-slate-200/60 backdrop-blur-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">Données</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button className="flex-1 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">
                Exporter la configuration
              </button>
              <button className="flex-1 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100">
                Purger le cache
              </button>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
