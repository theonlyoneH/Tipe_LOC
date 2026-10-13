import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AuthShell } from '../components/AuthShell';
import { ProfileFields, inputCls } from '../components/ProfileFields';
import { api } from '../lib/api';
import { FormError } from '../components/FormError';
import { clearCache } from '../lib/queries';
import { useSession } from '../lib/session';
import type { Category, User } from '../lib/types';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    category: 'exporter' as Category,
    industry: '',
    country: '',
    company_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const navigate = useNavigate();
  const signIn = useSession((s) => s.signIn);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: User }>('/register', {
        body: { ...form, email: form.email.trim().toLowerCase() },
        auth: false,
      });
      clearCache();
      signIn(res.token, res.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="text-3xl font-bold text-slate-900 mb-1">Create account</h2>
      <p className="text-slate-500 mb-6">Your profile powers lead ranking and AI outreach.</p>

      <form onSubmit={handleRegister} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">Email</span>
          <input type="email" required autoComplete="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">Password</span>
          <input type="password" required minLength={6} autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>

        <ProfileFields value={form} onChange={setForm} />

        <FormError error={error} />

        <button type="submit" disabled={loading} className="w-full py-4 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-800 transition disabled:opacity-70">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        Already have an account? <Link to="/login" className="text-blue-600 font-semibold">Sign in</Link>
      </p>
    </AuthShell>
  );
}
