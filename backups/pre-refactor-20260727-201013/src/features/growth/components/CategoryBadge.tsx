import { cn } from '../../../lib/utils';
import { getTaskCategoryMeta } from '../constants';

interface CategoryBadgeProps {
  category?: string | null;
  compact?: boolean;
  className?: string;
}

export function CategoryBadge({ category, compact = false, className }: CategoryBadgeProps) {
  const meta = getTaskCategoryMeta(category);

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', meta.badgeClassName, className)}>
      {compact ? meta.shortLabel : meta.label}
    </span>
  );
}
