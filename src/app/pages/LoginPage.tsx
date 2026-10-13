import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { AuthShell } from '../components/AuthShell';
import { api } from '../lib/api';
import { FormError } from '../components/FormError';
import { clearCache } from '../lib/queries';
import { useSession } from '../lib/session';
import type { User } from '../lib/types';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const signIn = useSession((s) => s.signIn);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: User }>('/login', { body: { email: email.trim().toLowerCase(), password }, auth: false });
      clearCache();
      signIn(res.token, res.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h2>
        <p className="text-slate-500">Sign in to continue to your dashboard</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">Email</span>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </label>

        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">Password</span>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </label>

        <FormError error={error} />

        <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 hover:shadow-blue-300 transition-all active:scale-[0.98] disabled:opacity-70">
          {loading ? 'Signing in…' : <>Sign in <ArrowRight className="w-5 h-5" /></>}
        </button>
      </form>

      <p className="mt-8 text-center pt-6 border-t border-slate-100 text-slate-600">
        Don't have an account? <Link to="/register" className="text-blue-600 font-bold hover:underline">Register</Link>
      </p>
    </AuthShell>
  );
}
