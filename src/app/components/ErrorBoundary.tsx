import React, { type ReactNode } from 'react';
import { useRouteError } from 'react-router';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { describeError, errorReference } from '../lib/errors';

const crashRef = () => `ui-${Date.now().toString(36)}`;

function CrashScreen({ error, onReset, fullPage }: { error: unknown; onReset?: () => void; fullPage?: boolean }) {
  const f = describeError(error, 'This page hit a problem');
  const isNewVersion = f.code === 'CHUNK_LOAD_FAILED';
  const title = isNewVersion ? f.title : 'This page hit a problem';
  const message = isNewVersion ? f.message : 'Something unexpected happened while showing this page. The rest of the app still works.';
  const ref = errorReference({ code: isNewVersion ? f.code : 'UI_CRASH', ref: f.ref ?? crashRef() });

  return (
    <div className={`${fullPage ? 'min-h-dvh' : 'h-full min-h-[60vh]'} flex items-center justify-center bg-slate-50 p-6`}>
      <div role="alert" className="text-center max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-2 justify-center">
          {onReset && !isNewVersion && (
            <button onClick={onReset} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-50">
              <RotateCcw className="w-4 h-4" /> Try again
            </button>
          )}
          <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            <RefreshCw className="w-4 h-4" /> Reload
          </button>
        </div>
        <p className="mt-5 text-[11px] font-mono text-slate-400">{ref}</p>
      </div>
    </div>
  );
}

interface State {
  error: unknown;
}

/** Last-resort boundary around the whole app. */
export class ErrorBoundary extends React.Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TIPE] UI crash:', error, info.componentStack);
  }

  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} onReset={() => this.setState({ error: null })} fullPage />;
    return this.props.children;
  }
}

/** Router-level boundary: a crashing page keeps the sidebar and navigation usable. */
export function RouteError() {
  const error = useRouteError();
  console.error('[TIPE] Route error:', error);
  return <CrashScreen error={error} onReset={() => window.history.go(0)} />;
}
