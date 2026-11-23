export const sameSchoolYearId = (actual, expected) =>
  actual != null && actual !== '' && expected != null && expected !== '' && String(actual) === String(expected);

export function educationSchoolYears(years, useMock) {
  return years.flatMap((year) => {
    if (useMock) return [{ ...year, headerId: year.id }];
    const value = String(year.beId ?? year.id ?? '');
    const id = /^\d+$/.test(value) ? Number(value) : null;
    return Number.isSafeInteger(id) && id > 0 ? [{ ...year, id, headerId: year.id }] : [];
  });
}

const normalizedYearName = (value) => String(value ?? '').replace(/\s*[-–]\s*/g, '-');

export function mockSchoolYearId(years, value) {
  if (value == null || value === '') return null;
  const name = normalizedYearName(value);
  return years?.find((year) => sameSchoolYearId(year.id, value) || normalizedYearName(year.name) === name)?.id ??
    (typeof value === 'number' ? value : name);
}

export function previousSchoolYears(years, schoolYearId) {
  const current = years.find((year) => sameSchoolYearId(year.id, schoolYearId));
  if (!current?.startDate) return [];
  return years
    .filter((year) => year.startDate && year.startDate < current.startDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
