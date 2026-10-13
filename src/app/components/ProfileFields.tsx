import { useIndustries } from '../lib/queries';
import type { User } from '../lib/types';

// Reference list for the country picker (free text is still allowed).
export const COUNTRIES = [
  'India', 'USA', 'UK', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Poland', 'Sweden', 'Switzerland',
  'China', 'Japan', 'South Korea', 'Singapore', 'Vietnam', 'Indonesia', 'Thailand', 'Malaysia', 'Bangladesh',
  'UAE', 'Saudi Arabia', 'Turkey', 'Israel', 'Egypt', 'South Africa', 'Nigeria',
  'Canada', 'Mexico', 'Brazil', 'Australia', 'Russia',
];

export const inputCls =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500';

type Editable = Pick<User, 'category' | 'industry' | 'country' | 'company_name'>;

export function ProfileFields<T extends Editable>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  const { data: industries = [] } = useIndustries();
  const set = (k: keyof Editable) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">You are a/an</span>
          <select className={inputCls} value={value.category} onChange={set('category')}>
            <option value="exporter">Exporter (find buyers)</option>
            <option value="importer">Importer (find suppliers)</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">Industry</span>
          <input required list="industry-options" className={inputCls} value={value.industry} onChange={set('industry')} placeholder="e.g. Textiles" />
          <datalist id="industry-options">{industries.map((i) => <option key={i} value={i} />)}</datalist>
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">Company name</span>
          <input className={inputCls} value={value.company_name} onChange={set('company_name')} placeholder="Your company" />
        </label>
        <label className="block">
          <span className="block text-sm font-semibold text-slate-700 mb-1">Country</span>
          <input list="country-options" className={inputCls} value={value.country} onChange={set('country')} placeholder="Where you operate" />
          <datalist id="country-options">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
      </div>
    </>
  );
}
