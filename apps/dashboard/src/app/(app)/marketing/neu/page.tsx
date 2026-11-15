'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { ArrowLeft } from 'lucide-react';
import { defineCopy, PageHeader, useCopy, useToast } from '@tably/ui';
import { CampaignForm } from '@/components/marketing/campaign-form';

const copy = defineCopy({
  de: {
    back: 'Alle Kampagnen',
    title: 'Neue Kampagne',
    description: 'Lege fest, wen du erreichen möchtest und was du mitteilen willst. Gespeichert wird zunächst ein Entwurf – versendet wird erst, wenn du startest.',
    saved: 'Entwurf gespeichert.',
  },
});

export default function NewCampaignPage() {
  const t = useCopy(copy);
  const router = useRouter();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        back={
          <Link href="/marketing" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            {t.back}
          </Link>
        }
      />
      <div className="max-w-4xl">
        <CampaignForm
          onSaved={(campaign) => {
            toast.success(t.saved);
            void mutate('/campaigns');
            void mutate(`/campaigns/${campaign.id}`, campaign, { revalidate: false });
            router.push(`/marketing/${campaign.id}`);
          }}
        />
      </div>
    </>
  );
}
