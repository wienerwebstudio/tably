import type { ProgramViewDto } from '@tapperl/types';
import { LoyaltyCard } from '@tapperl/ui';

/** LoyaltyCard aus der öffentlichen Programmsicht der API. */
export function ProgramCard({ program, balance, highlightIndex, compact, className }: { program: ProgramViewDto; balance: number; highlightIndex?: number | null; compact?: boolean; className?: string }) {
  return (
    <LoyaltyCard
      className={className}
      compact={compact}
      highlightIndex={highlightIndex}
      data={{
        organizationName: program.organization.name,
        cardTitle: program.cardTitle,
        stampsRequired: program.stampsRequired,
        balance,
        stampIcon: program.stampIcon,
        rewardName: program.design.rewardText || program.rewards[0]?.name || null,
        unitLabel: program.unitLabel,
        backgroundColor: program.design.backgroundColor,
        textColor: program.design.textColor,
        accentColor: program.design.accentColor,
        logoUrl: program.logoUrl,
        footerText: program.design.footerText,
      }}
    />
  );
}
