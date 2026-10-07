import { DEFAULT_PRINT_TEMPLATE } from './printTemplate';

/** App-wide constants shown in the shell (header, footer, browser tab). */
export const APP_NAME = 'CareNest';
export const APP_VERSION = '1.0.0';
/** Display name (sentence case). The print template keeps its own upper-case heading. */
export const SCHOOL_NAME = 'Trường Mầm Non Thượng Hồng';
export const SUPPORT_EMAIL = DEFAULT_PRINT_TEMPLATE.email;

/** School years selectable in the header. Backend will provide this list later. */
export const SCHOOL_YEARS = [
  { id: '2026-2027', label: '2026 - 2027' },
  { id: '2025-2026', label: '2025 - 2026' },
  { id: '2024-2025', label: '2024 - 2025' },
];
export const DEFAULT_SCHOOL_YEAR = SCHOOL_YEARS[0].id;
