/*
 * Fictional pickup history (no real child data): built from the seeded attendance of the last two school days,
 * so only children who were present have a pickup record. Collection: db.pickups.
 */

const NAMES = { Bố: 'Văn', Mẹ: 'Thị', Ông: 'Văn', Bà: 'Thị' };

export const buildPickupSeed = ({ attendance = [], children = [], classes = [], today }) => {
  const days = [...new Set(attendance.map((r) => r.date))]
    .filter((d) => d < today)
    .sort()
    .slice(-2);
  const childById = Object.fromEntries(children.map((c) => [c.id, c]));
  const teacherOf = (classId) => classes.find((c) => c.id === classId)?.homeroomTeacherId || null;
  const records = [];

  attendance
    .filter((r) => days.includes(r.date) && r.status === 'PRESENT')
    .forEach((r, i) => {
      const child = childById[r.childId];
      if (!child) return;
      const guardian = child.guardians?.[0];
      const family = child.fullName.split(' ')[0];
      const minute = String(10 + ((i * 7) % 45)).padStart(2, '0');
      const at = new Date(`${r.date}T16:${minute}:00+07:00`).toISOString();
      const base = {
        date: r.date,
        childId: r.childId,
        classId: r.classId,
        campusId: r.campusId,
        teacherId: teacherOf(r.classId),
        pickupPersonPhone: '',
        recordedAt: at,
        parentNotification: { channel: 'APP', at },
      };
      // Every 9th child: a grandparent came, the teacher called the parent first.
      if (i % 9 === 4) {
        const relation = i % 2 ? 'Bà' : 'Ông';
        records.push({
          ...base,
          id: `pk_${r.id}_a`,
          outcome: 'HANDED_OVER',
          verification: 'PHONE_CONFIRMED',
          pickupPersonName: `${family} ${NAMES[relation]} ${relation === 'Bà' ? 'Lan' : 'Tâm'}`,
          pickupPersonRelation: relation,
          handedOverAt: at,
          phoneConfirmed: true,
          note: 'Phụ huynh xác nhận qua điện thoại, ông/bà đón thay.',
        });
        return;
      }
      records.push({
        ...base,
        id: `pk_${r.id}`,
        outcome: 'HANDED_OVER',
        verification: 'PHOTO_MATCH',
        pickupPersonName: guardian?.fullName || 'Phụ huynh',
        pickupPersonRelation: guardian?.relation || 'Bố',
        handedOverAt: at,
        phoneConfirmed: false,
        note: '',
      });
    });
  return { pickups: records };
};
