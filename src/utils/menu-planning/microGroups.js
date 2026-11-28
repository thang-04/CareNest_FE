import { MICRONUTRIENT_GROUPS } from '@/models/menu-planning/menuPlanningConstants';

/** Nhóm vi chất ('minerals' | 'vitamins') của một mã chất; không thuộc nhóm nào thì ''. */
export const microGroupOf = (code) => MICRONUTRIENT_GROUPS.find((g) => g.items.includes(code))?.key || '';
