import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetupLanding } from './setup-landing';

export const metadata: Metadata = {
  title: 'Stempel einrichten',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function Page() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <Suspense>
        <SetupLanding />
      </Suspense>
    </div>
  );
}
