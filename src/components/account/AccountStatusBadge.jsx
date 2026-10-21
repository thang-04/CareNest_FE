import { CheckCircle, Lock, KeyRound } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { ACCOUNT_STATUS_LABELS } from '@/models/account/permissionConstants';

export const AccountStatusBadge = createStatusBadge(
  { ACTIVE: ['green', CheckCircle], INACTIVE: ['gray', Lock], PENDING_ACTIVATION: ['orange', KeyRound] },
  { ...ACCOUNT_STATUS_LABELS, PENDING_ACTIVATION: 'Chờ kích hoạt' },
);
