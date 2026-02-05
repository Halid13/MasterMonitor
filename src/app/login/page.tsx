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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Veuillez saisir votre email et votre mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Connexion refusée.');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Erreur réseau.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 relative overflow-hidden">
      {/* Deep cyber background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.12),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(14,165,233,0.12),transparent_40%),radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.12),transparent_45%)]" />
      <div className="absolute inset-0 matrix" />
      <div className="absolute inset-0 scan" />
      <div className="absolute inset-0 noise" />

      <div className="relative z-10 min-h-screen flex items-center">
        <div className="w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          {/* Left panel */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-indigo-200/70 bg-indigo-50 text-indigo-700 text-xs tracking-[0.2em]">
              ACCESS NODE • MM-CORE
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-wide leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-sky-500 to-violet-500">MasterMonitor</span>
              <span className="block text-slate-700 mt-2">Secure Operations Console</span>
            </h1>
            <p className="text-slate-600 max-w-xl">
              Interface de supervision futuriste avec accès sécurisé. Connectez-vous pour déverrouiller le centre de contrôle.
            </p>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/90 text-white flex items-center justify-center text-sm font-bold">MM</div>
              <div className="text-xs text-slate-500">
                <p>Session chiffrée 256-bit</p>
                <p>Authentification interne</p>
              </div>
            </div>
          </div>

          {/* Right panel: login card */}
          <div className="relative">
            <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-r from-indigo-300/40 via-sky-300/40 to-violet-300/40 blur-xl" />
            <div className="relative bg-white/80 border border-slate-200/70 rounded-[26px] p-8 backdrop-blur-2xl shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Connexion</h2>
                  <p className="text-xs text-slate-500">Identifiants requis</p>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full border border-sky-200/80 text-sky-700 bg-sky-50">v3.0</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Email professionnel</label>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 focus-within:ring-2 focus-within:ring-sky-400/60 focus-within:border-sky-400/60">
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
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 focus-within:ring-2 focus-within:ring-sky-400/60 focus-within:border-sky-400/60">
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
                  <div className="rounded-xl bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-70 shadow-[0_10px_30px_-12px_rgba(14,165,233,0.35)]"
                >
                  {loading ? 'Connexion…' : 'Se connecter'}
                </button>
              </form>

              <div className="mt-6 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Accès supervisé</span>
                <span className="text-sky-600">Support IT interne</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .matrix {
          background-image:
            linear-gradient(transparent 23px, rgba(148, 163, 184, 0.18) 24px),
            linear-gradient(90deg, transparent 23px, rgba(148, 163, 184, 0.18) 24px);
          background-size: 24px 24px;
          mask-image: radial-gradient(circle at center, black 40%, transparent 80%);
        }
        .scan {
          background: linear-gradient(180deg, transparent, rgba(56, 189, 248, 0.18), transparent);
          animation: scan 7s linear infinite;
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .noise {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.1'/></svg>");
          opacity: 0.05;
          mix-blend-mode: multiply;
          animation: noiseShift 2.5s steps(2) infinite;
        }
        @keyframes noiseShift {
          0% { transform: translate(0, 0); }
          25% { transform: translate(-2%, 1%); }
          50% { transform: translate(2%, -1%); }
          75% { transform: translate(-1%, -2%); }
          100% { transform: translate(0, 0); }
        }
      `}</style>
    </div>
  );
}
