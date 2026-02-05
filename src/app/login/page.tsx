'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setLoading(true);

    // Auth factice : on crée un cookie côté client pour débloquer l'accès
    document.cookie = 'mm_auth=1; path=/; max-age=86400';

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-indigo-300/40 blur-[120px] animate-pulse" />
      <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-violet-300/40 blur-[120px] animate-pulse" />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-1 rounded-[28px] bg-gradient-to-r from-indigo-300/60 via-violet-300/60 to-sky-300/60 blur-xl" />
        <div className="relative bg-white/80 border border-slate-200/60 backdrop-blur-2xl rounded-[28px] p-8 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.3)] floaty">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-indigo-500 text-white font-bold flex items-center justify-center shadow-lg">MM</div>
              <div>
                <h1 className="text-xl font-semibold tracking-wide text-slate-900">MasterMonitor</h1>
                <p className="text-xs text-slate-500">Accès sécurisé</p>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full border border-indigo-400/40 text-indigo-700 bg-indigo-50">v2.0</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900">Connexion</h2>
            <p className="text-sm text-slate-500">Entrez vos identifiants pour accéder au tableau de bord.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Email professionnel</label>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-400/60 focus-within:border-indigo-400/60">
                <Mail size={16} className="text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="nom.prenom@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Mot de passe</label>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-400/60 focus-within:border-indigo-400/60">
                <Lock size={16} className="text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 text-red-300 text-xs px-3 py-2 border border-red-400/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors disabled:opacity-70 shadow-[0_10px_30px_-12px_rgba(99,102,241,0.35)]"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Connexion chiffrée</span>
            <span className="text-indigo-600">Support IT interne</span>
          </div>
          <style jsx>{`
            @keyframes floaty {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }
            .floaty {
              animation: floaty 6s ease-in-out infinite;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
