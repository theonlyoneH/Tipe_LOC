import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { queryClient } from '../lib/queries';

/** Thin banner while the browser is offline; refreshes data when it comes back. */
export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      queryClient.invalidateQueries();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online) return null;
  return (
    <div role="status" className="bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-2 py-1.5">
      <WifiOff className="w-3.5 h-3.5" /> You're offline. Showing saved data; changes will fail until you reconnect.
    </div>
  );
}
