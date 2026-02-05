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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-xl p-8">
        <div className="text-center space-y-2 mb-6">
          <h1 className="text-3xl font-bold text-teal-600">MasterMonitor</h1>
          <p className="text-sm text-slate-500">Connexion au tableau de bord</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Email professionnel</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 focus-within:ring-2 focus-within:ring-teal-300">
              <Mail size={16} className="text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-slate-800"
                placeholder="nom.prenom@company.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Mot de passe</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2.5 focus-within:ring-2 focus-within:ring-teal-300">
              <Lock size={16} className="text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-slate-800"
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold transition-colors disabled:opacity-70"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
