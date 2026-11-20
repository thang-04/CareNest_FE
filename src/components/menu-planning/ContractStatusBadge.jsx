import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CONTRACT_STATUS_LABELS } from '@/models/menu-planning/menuPlanningConstants';

// Trạng thái hợp đồng NCC do BE tính tại hôm nay (NUT-27); chỉ cảnh báo, không chặn nghiệp vụ
export const ContractStatusBadge = createStatusBadge(
  { ACTIVE: ['green'], EXPIRING: ['orange'], EXPIRED: ['red'], NOT_STARTED: ['blue'], NONE: ['gray'] },
  CONTRACT_STATUS_LABELS,
);

/** Hợp đồng cần chú ý (sắp hết hoặc đã hết hạn). */
export const contractNeedsAttention = (status) => status === 'EXPIRING' || status === 'EXPIRED';
