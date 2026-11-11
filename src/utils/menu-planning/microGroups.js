import { MICRONUTRIENT_GROUPS } from '@/models/menu-planning/menuPlanningConstants';

/** Nhóm vi chất ('minerals' | 'vitamins') của một mã chất; không thuộc nhóm nào thì ''. */
export const microGroupOf = (code) => MICRONUTRIENT_GROUPS.find((g) => g.items.includes(code))?.key || '';

/** Màu badge đếm số liệu: đủ = xanh lá, thiếu một phần = vàng, chưa có gì = xám. */
export const coverageTone = (have, total) => (have === 0 ? 'gray' : have === total ? 'green' : 'orange');
