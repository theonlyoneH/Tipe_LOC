import { useEffect, useState } from 'react';
import { FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { ProfileFields, inputCls } from '../components/ProfileFields';
import { useUpdateProfile } from '../lib/queries';
import { useSession } from '../lib/session';
import type { User } from '../lib/types';

export function Profile() {
  const user = useSession((s) => s.user);
  const update = useUpdateProfile();
  const [form, setForm] = useState<User | null>(user);
  useEffect(() => setForm(user), [user]);

  if (!form) return null;
  const dirty = JSON.stringify(form) !== JSON.stringify(user);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const { email: _email, ...patch } = form;
    update.mutate(patch, {
      onSuccess: () => toast.success('Profile saved. Leads and news re-ranked for your profile.'),
    });
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">Profile</h1>
        <p className="text-slate-600">Your industry and country drive lead ranking, news and AI outreach.</p>
      </div>

      <form onSubmit={save} className="bg-white rounded-2xl shadow-sm p-6 lg:p-8 border border-slate-200 space-y-5">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            {(form.company_name || form.email).substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 truncate">{form.company_name || form.email.split('@')[0]}</h2>
            <p className="text-slate-600 capitalize">{form.category} · {form.industry}</p>
          </div>
        </div>

        <label className="block">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1"><Mail className="w-4 h-4" /> Email</span>
          <input value={form.email} readOnly className={`${inputCls} bg-slate-100 text-slate-500 cursor-not-allowed`} />
        </label>

        <ProfileFields value={form} onChange={setForm} />

        <label className="block">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1"><FileText className="w-4 h-4" /> Company description</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What you make, certifications, capacity, target markets. The AI uses this to personalise outreach."
            className={inputCls}
          />
        </label>

        <button type="submit" disabled={!dirty || update.isPending} className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
          {update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
