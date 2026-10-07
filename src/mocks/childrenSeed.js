/*
 * Fictional health and parent-account data for the seeded children (no real child data).
 * Built from db.children / db.classes so ids always match; the children repository seeds it lazily.
 */

const DATES = ['2026-03-16', '2026-06-15', '2026-09-15'];

const ageMonthsOn = (dob, on) => {
  const [y1, m1, d1] = dob.split('-').map(Number);
  const [y2, m2, d2] = on.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

const round1 = (n) => Math.round(n * 10) / 10;

const buildMeasurements = (children, classes) => {
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
  const list = [];
  children
    .filter((ch) => ch.status === 'ACTIVE' && ch.id.startsWith('ch_') && /^ch_\d+$/.test(ch.id))
    .forEach((ch, idx) => {
      const n = Number(ch.id.slice(3));
      const cls = classById[ch.classId];
      const teacherId = cls?.homeroomTeacherId || null;
      // A few children get a profile outside the normal band so the demo shows every status.
      const weightFactor = n % 11 === 0 ? 0.78 : n % 13 === 0 ? 1.32 : 1 + ((n % 5) - 2) * 0.03;
      const dates = n % 9 === 0 ? DATES.slice(1) : DATES;
      dates.forEach((date, k) => {
        const age = ageMonthsOn(ch.dateOfBirth, date);
        if (age < 0) return;
        const height = 87 + (age - 24) * 0.6 + ((n % 4) - 1.5) * 1.2;
        // The last check of child 7, 14 … shows a slower weight gain for the AI trend demo.
        const slow = n % 7 === 0 && k === dates.length - 1 ? -0.6 : 0;
        const weight = (12 + (age - 24) * 0.17) * weightFactor + slow;
        list.push({
          id: `hm_${ch.id}_${k}`,
          childId: ch.id,
          date,
          heightCm: round1(height),
          weightKg: round1(weight),
          note: k === 0 && idx % 6 === 0 ? 'Khám định kỳ học kỳ II: răng miệng bình thường.' : '',
          measuredBy: teacherId,
          published: true,
          publishedAt: `${date}T09:00:00.000Z`,
          createdAt: `${date}T08:30:00.000Z`,
          edits: [],
        });
      });
    });
  return list;
};

const buildDeclarations = (children) =>
  children.map((ch, i) => ({
    childId: ch.id,
    allergies: ch.allergies.length ? { state: 'REPORTED', items: [...ch.allergies] } : { state: 'NONE_REPORTED', items: [] },
    diet:
      i % 5 === 0
        ? { state: 'REPORTED', text: 'Ăn cháo/cơm nát, không ăn đồ cay.' }
        : { state: i % 3 === 0 ? 'NOT_PROVIDED' : 'NONE_REPORTED', text: '' },
    otherNotes: { state: 'NOT_PROVIDED', text: '' },
    allergyConfirmation: ch.allergies.length ? { by: 'u_hung', at: '2026-08-20T02:00:00.000Z' } : null,
    declaredBy: 'u_lan',
    declaredAt: ch.enrolledAt ? `${ch.enrolledAt}T02:00:00.000Z` : null,
    history: [],
  }));

const buildParentAccounts = (children) => {
  const accounts = [];
  children.forEach((ch) =>
    (ch.guardians || []).forEach((g) => {
      if (g.accountStatus !== 'ACTIVE') return;
      const phone = g.phone.replace(/\s/g, '');
      const existing = accounts.find((a) => a.phone === phone);
      if (existing) existing.childIds.push(ch.id);
      else
        accounts.push({
          id: `pa_${ch.id}`,
          username: phone,
          phone,
          email: g.email || '',
          fullName: g.fullName,
          status: 'ACTIVE',
          childIds: [ch.id],
          createdAt: '2026-08-16T02:00:00.000Z',
          sms: [{ at: '2026-08-16T02:00:00.000Z', status: 'SENT' }],
        });
    }),
  );
  return accounts;
};

export const buildSeedChildRecords = ({ children = [], classes = [] }) => ({
  healthMeasurements: buildMeasurements(children, classes),
  healthDeclarations: buildDeclarations(children),
  parentAccounts: buildParentAccounts(children),
  childPlacements: [],
});
