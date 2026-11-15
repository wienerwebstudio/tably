'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { ProgramViewDto } from '@tapperl/types';
import { Alert, ApiError, defineCopy, EmptyState, ErrorState, Skeleton, useCopy } from '@tapperl/ui';
import { EnrollForm } from '@/components/card/enroll-form';
import { ProgramCard } from '@/components/card/program-card';

const copy = defineCopy({
  de: {
    notFoundTitle: 'Diese Treuekarte gibt es nicht',
    notFoundText: 'Bitte prüfe den Link oder frag im Geschäft nach dem aktuellen Anmeldelink.',
    closedTitle: 'Anmeldung derzeit nicht möglich',
    closedText: 'Dieses Treueprogramm ist im Moment pausiert. Bitte versuche es später erneut.',
    headline: (org: string) => `Deine Treuekarte bei ${org}`,
    intro: 'Einmal anlegen, bei jedem Besuch Stempel sammeln. Ohne App, direkt im Browser.',
    bonus: (n: number) => `Zum Start schenken wir dir ${n} ${n === 1 ? 'Stempel' : 'Stempel'}.`,
    have: 'Du hast schon eine Karte?',
    recover: 'Karte wiederfinden',
  },
});

interface ProgramResponse {
  program: ProgramViewDto;
  open: boolean;
  cardId: string | null;
}

export default function JoinPage() {
  const t = useCopy(copy);
  const { org, program } = useParams<{ org: string; program: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<ProgramResponse, ApiError>(`/public/programs/${org}/${program}`);

  React.useEffect(() => {
    if (data?.cardId) router.replace(`/karte/${data.cardId}`);
  }, [data?.cardId, router]);

  if (error?.status === 404) return <EmptyState className="flex-1" title={t.notFoundTitle} description={t.notFoundText} />;
  if (error) return <ErrorState onRetry={() => void mutate()} />;
  if (isLoading || !data || data.cardId) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64 rounded-[28px]" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <ProgramCard program={data.program} balance={data.program.signupBonus} />
      <div>
        <h1 className="font-display text-[1.75rem] leading-tight tracking-tight">{t.headline(data.program.organization.name)}</h1>
        <p className="mt-2 text-muted">{data.program.description || t.intro}</p>
        {data.program.signupBonus > 0 ? <p className="mt-2 text-sm font-medium text-brand">{t.bonus(data.program.signupBonus)}</p> : null}
      </div>
      {data.open ? (
        <>
          <EnrollForm program={data.program} onDone={(result) => router.replace(`/karte/${result.cardId}?neu=1`)} />
          <p className="text-center text-sm text-muted">
            {t.have}{' '}
            <Link href={`/karten/wiederfinden?org=${data.program.organization.slug}`} className="font-medium text-brand hover:underline">{t.recover}</Link>
          </p>
        </>
      ) : (
        <Alert tone="warn" title={t.closedTitle}>{t.closedText}</Alert>
      )}
    </div>
  );
}
