import { CheckCircle, Lock } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { ACCOUNT_STATUS_LABELS } from '@/models/account/permissionConstants';

export const AccountStatusBadge = createStatusBadge({ ACTIVE: ['green', CheckCircle], INACTIVE: ['gray', Lock] }, ACCOUNT_STATUS_LABELS);
