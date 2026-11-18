import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';

export const metadata: Metadata = { title: 'Offline | Arrear Ease' };

// Precached by the service worker and shown when a page can't be loaded without a connection.
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center space-y-4">
        <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="font-headline text-2xl font-bold">You&apos;re offline</h1>
        <p className="text-muted-foreground text-sm">
          Arrear Ease needs an internet connection to load this page and your saved data. Check your connection and try again.
        </p>
        <a href="/" className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Try again
        </a>
      </div>
    </main>
  );
}
