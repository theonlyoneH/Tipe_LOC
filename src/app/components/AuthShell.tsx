import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

const FEATURES = [
  { title: 'News-ranked lead discovery', body: 'Buyers and suppliers re-ranked live from global trade headlines, Pinecone semantic search and your own swipes.' },
  { title: 'Swipe-based vetting', body: 'Approve, reject or skip in a second. Every swipe teaches the ranking what a good lead looks like for you.' },
  { title: 'AI outreach on autopilot', body: 'Approving a lead drafts a personalised opener on its preferred channel. The AI handles replies, follow-ups and meetings.' },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex bg-slate-50">
      <div className="hidden lg:flex w-1/2 bg-blue-900 p-16 flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800/60 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center"><Sparkles className="w-6 h-6" /></div>
            <span className="text-2xl font-bold uppercase tracking-wider">Tipe</span>
          </div>
          <h1 className="text-5xl font-bold mb-6 leading-tight">Trade Intent <br /> Prediction Engine</h1>
          <p className="text-xl text-blue-100 mb-12 max-w-lg">Find the right trade partners the day the market moves, and start the conversation automatically.</p>
          <div className="space-y-8">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="flex gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold shrink-0">{i + 1}</div>
                <div>
                  <h3 className="font-bold text-lg">{f.title}</h3>
                  <p className="text-blue-200">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-sm text-blue-300">© {new Date().getFullYear()} TIPE</div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Sparkles className="w-5 h-5 text-white" /></div>
          <span className="text-xl font-bold uppercase tracking-wider text-slate-900">Tipe</span>
        </div>
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-10 border border-slate-100">{children}</div>
      </div>
    </div>
  );
}
