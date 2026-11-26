import { addDays } from '@/utils/format';

export function defaultLeaveDate(options) {
  if (!options || options.minDate > options.maxDate) return '';
  const preferred = options.nextSchoolDay ?? addDays(options.today, 1);
  return preferred >= options.minDate && preferred <= options.maxDate ? preferred : options.minDate;
}
