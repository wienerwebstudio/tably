'use client';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { defineCopy, PageHeader, Skeleton, TabPanel, Tabs, useCopy } from '@tapperl/ui';
import { useSession } from '@/lib/session';
import { CompanySettings } from '@/components/settings/company';
import { LocationsSettings } from '@/components/settings/locations';
import { TeamSettings } from '@/components/settings/team';
import { BillingSettings } from '@/components/settings/billing';
import { SecuritySettings } from '@/components/settings/security';
import { IntegrationsSettings } from '@/components/settings/integrations';
import { AuditSettings } from '@/components/settings/audit';

const copy = defineCopy({
  de: {
    title: 'Einstellungen',
    description: 'Betriebsdaten, Team, Abonnement und dein eigenes Konto.',
    tabs: {
      betrieb: 'Betrieb',
      standorte: 'Standorte',
      team: 'Team',
      abo: 'Abonnement',
      sicherheit: 'Konto & Sicherheit',
      integrationen: 'Integrationen',
      protokoll: 'Protokoll',
    },
  },
});

type TabKey = 'betrieb' | 'standorte' | 'team' | 'abo' | 'sicherheit' | 'integrationen' | 'protokoll';

function SettingsTabs() {
  const t = useCopy(copy);
  const { can } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const visible = React.useMemo(() => {
    const all: Array<{ value: TabKey; show: boolean }> = [
      { value: 'betrieb', show: true },
      { value: 'standorte', show: can('locations.manage') },
      { value: 'team', show: can('members.manage') },
      { value: 'abo', show: true },
      { value: 'sicherheit', show: true },
      { value: 'integrationen', show: true },
      { value: 'protokoll', show: can('audit.read') },
    ];
    return all.filter((tab) => tab.show).map((tab) => ({ value: tab.value, label: t.tabs[tab.value] }));
  }, [can, t]);

  const requested = params.get('tab');
  const active: TabKey = visible.find((tab) => tab.value === requested)?.value ?? 'betrieb';

  const setTab = (next: TabKey) => {
    const search = new URLSearchParams();
    search.set('tab', next);
    router.replace(`${pathname}?${search.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={active} onChange={setTab} tabs={visible}>
      <TabPanel value="betrieb"><CompanySettings /></TabPanel>
      {can('locations.manage') ? <TabPanel value="standorte"><LocationsSettings /></TabPanel> : null}
      {can('members.manage') ? <TabPanel value="team"><TeamSettings /></TabPanel> : null}
      <TabPanel value="abo"><BillingSettings /></TabPanel>
      <TabPanel value="sicherheit"><SecuritySettings /></TabPanel>
      <TabPanel value="integrationen"><IntegrationsSettings /></TabPanel>
      {can('audit.read') ? <TabPanel value="protokoll"><AuditSettings /></TabPanel> : null}
    </Tabs>
  );
}

export default function SettingsPage() {
  const t = useCopy(copy);
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <React.Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <SettingsTabs />
      </React.Suspense>
    </>
  );
}
