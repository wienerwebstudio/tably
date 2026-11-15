'use client';
import { SWRConfig } from 'swr';
import { api, LocaleProvider, ToastProvider } from '@tably/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider locale="de">
      <SWRConfig value={{ fetcher: (path: string) => api(path), revalidateOnFocus: true, shouldRetryOnError: false, dedupingInterval: 2000 }}>
        <ToastProvider>{children}</ToastProvider>
      </SWRConfig>
    </LocaleProvider>
  );
}
