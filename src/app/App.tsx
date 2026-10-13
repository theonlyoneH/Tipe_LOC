import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { router } from './routes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { queryClient, restoreCache } from './lib/queries';
import { useSession } from './lib/session';

// Paint the last known data immediately; queries revalidate in the background.
restoreCache(useSession.getState().user?.email);

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
