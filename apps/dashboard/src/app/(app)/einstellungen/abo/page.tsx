'use client';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@tapperl/ui';

/** Rücksprungadresse des Zahlungsanbieters (…/einstellungen/abo?checkout=…) → Abo-Reiter. */
function Redirect() {
  const router = useRouter();
  const params = useSearchParams();
  React.useEffect(() => {
    const checkout = params.get('checkout');
    router.replace(`/einstellungen?tab=abo${checkout === 'success' || checkout === 'cancel' ? `&checkout=${checkout}` : ''}`);
  }, [router, params]);
  return <Skeleton className="h-96 rounded-2xl" />;
}

export default function BillingReturnPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Redirect />
    </React.Suspense>
  );
}
