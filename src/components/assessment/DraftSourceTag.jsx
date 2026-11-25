import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function DraftSourceTag({ draft }) {
  if (!draft) return null;
  if (draft.source === 'AI' || (draft.source && typeof draft.source === 'object')) {
    return <AiDraftTag />;
  }
  return (
    <StatusBadge
      tone="gray"
      label={draft.source === 'TEMPLATE' ? 'Bản nháp mẫu – cần giáo viên duyệt' : 'Bản nháp – cần giáo viên duyệt'}
    />
  );
}
