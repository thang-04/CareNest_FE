import { ApiError, clone, writeDb } from '@/mocks/mockDatabase';
import { activeYearId } from '@/mocks/roomManagers';
import {
  REWARD_GENERAL_TITLES,
  REWARD_PROGRAM_TITLES,
  REWARD_TITLES,
  DIAGNOSTIC_TERMS,
  TICKET_RULES,
} from '@/models/assessment/assessmentConstants';
import { inLeaderEditScope, inLeaderScope, isClassTeacher, isLeader } from '@/utils/assessment/assessmentPermissions';
import { addDays, monthEnd, monthsBetween, schoolDaysBetween, todayIso, weekStart } from '@/utils/assessment/assessmentPeriods';
import { uid } from '@/utils/id';

// BE giả: đối chiếu BE RewardListServiceImpl, QualityReportServiceImpl, ChildEvaluationServiceImpl (OBS/AUTH).
const deny = () => {
  throw new ApiError(403, 'Bạn không có quyền thực hiện thao tác này.');
};
const invalid = (message) => {
  throw new ApiError(422, message);
};
const pct = (n, d) => (d ? Math.round((n * 100) / d) : 0);
const average = (n, d) => (d ? Math.round(n / d) : 0);
const now = () => new Date().toISOString();
const roster = (db, cls) => db.children.filter((c) => c.classId === cls.id && c.status === 'ACTIVE');
const yearOf = (db, cls) => db.schoolYears.find((y) => y.id === cls.schoolYear);
const programClass = (db, cls) => (db.ageGroups.find((g) => g.id === cls.ageGroupId)?.ageFromMonths || 0) >= 60;
const yearEndOf = (db, cls, childId) =>
  db.yearEndEvaluations.find(
    (e) => e.childId === childId && e.classId === cls.id && e.schoolYear === cls.schoolYear && e.status === 'CONFIRMED',
  );
const scoped = (db, year, user) =>
  db.classes.filter((c) => c.schoolYear === (year || activeYearId(db)) && (isClassTeacher(c, user) || inLeaderScope(c.campusId, user)));
const leaderClasses = (db, params, user) => {
  if (!isLeader(user) || (params.campusId && !inLeaderScope(params.campusId, user))) deny();
  return scoped(db, params.schoolYear, user).filter((c) => !params.campusId || c.campusId === params.campusId);
};
const campuses = (db, classes) => db.campuses.filter((c) => classes.some((cls) => cls.campusId === c.id));
const accessClass = (db, classId, user) => {
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls || !(isClassTeacher(cls, user) || inLeaderScope(cls.campusId, user))) deny();
  return cls;
};
const countTickets = (db, cls, childId, type) =>
  (db.behaviourTickets || []).filter(
    (t) =>
      t.childId === childId &&
      t.classId === cls.id &&
      t.type === type &&
      t.periodStart >= yearOf(db, cls).startDate &&
      t.periodEnd <= yearOf(db, cls).endDate,
  ).length;
const flagsOf = (db, childId, dates) =>
  (db.dailyObservations || []).filter((o) => o.childId === childId && o.flag === true && dates.has(o.date)).length;
const listOf = (db, cls) => (db.classRewardLists || []).find((l) => l.classId === cls.id);
const detailOf = (db, cls, user) => {
  const list = listOf(db, cls);
  const year = yearOf(db, cls);
  const canEdit =
    isClassTeacher(cls, user) && year?.status === 'ACTIVE' && (!list || ['DRAFT', 'RETURNED', 'REJECTED'].includes(list.status));
  const show = isClassTeacher(cls, user) || list?.status !== 'DRAFT';
  const days = new Set(
    (db.attendance || [])
      .filter((r) => r.classId === cls.id && r.date >= year.startDate && r.date <= year.endDate && r.date <= todayIso())
      .map((r) => r.date),
  );
  const children = roster(db, cls).map((c) => {
    const ye = yearEndOf(db, cls, c.id);
    const present = new Set(
      (db.attendance || [])
        .filter((r) => r.childId === c.id && r.classId === cls.id && days.has(r.date) && r.status === 'PRESENT')
        .map((r) => r.date),
    ).size;
    const weekly = countTickets(db, cls, c.id, 'WEEKLY'),
      monthly = countTickets(db, cls, c.id, 'MONTHLY');
    const suggested = [];
    if (ye) {
      // BE giả OBS-14: gợi ý một danh hiệu bé ngoan cao nhất đạt được, lớp 5–6 tuổi thêm hoàn thành tốt chương trình
      const diligent = days.size && present * 100 >= 90 * days.size;
      const elapsed = [...days].sort();
      const weeks = new Set(elapsed.map(weekStart)).size;
      const months = new Set(elapsed.map((d) => d.slice(0, 7))).size;
      const good = weeks && weekly * 2 >= weeks;
      const allRound = months && monthly * 2 >= months;
      if (diligent && allRound) suggested.push(REWARD_GENERAL_TITLES[3]);
      else if (diligent && good) suggested.push(REWARD_GENERAL_TITLES[1]);
      else if (good) suggested.push(REWARD_GENERAL_TITLES[0]);
      if (programClass(db, cls) && ye.programCompleted) suggested.push(REWARD_PROGRAM_TITLES[1]);
    }
    const item = show && list?.items.find((r) => r.childId === c.id);
    return {
      childId: c.id,
      fullName: c.fullName,
      dateOfBirth: c.dateOfBirth,
      schoolDays: days.size,
      presentDays: present,
      attendanceRate: pct(present, days.size),
      weeklyTickets: weekly,
      monthlyTickets: monthly,
      yearEnd: ye ? { id: ye.id, finalContent: ye.finalContent, confirmedAt: ye.confirmedAt } : null,
      programCompleted: ye?.programCompleted ?? null,
      suggested,
      titles: item?.titles || [],
      note: item?.note || '',
    };
  });
  return {
    ...list,
    listId: list?.id || null,
    classId: cls.id,
    className: cls.name,
    campusId: cls.campusId,
    schoolYearId: cls.schoolYear,
    programClass: programClass(db, cls),
    status: list?.status || null,
    titleOptions: programClass(db, cls) ? REWARD_TITLES : REWARD_GENERAL_TITLES,
    children,
    history: list?.history || [],
    canEdit,
    canReview: user?.role === 'VICE_PRINCIPAL' && inLeaderEditScope(cls.campusId, user) && list?.status === 'PENDING_VP',
    canDecide: user?.role === 'PRINCIPAL' && ['PENDING_VP', 'PENDING_PRINCIPAL'].includes(list?.status),
  };
};

export const createAssessmentReportsMock = (ensureReady) => ({
  async getRewardLists(params = {}, user) {
    const db = ensureReady();
    if (!user) deny();
    return clone(
      scoped(db, params.schoolYear, user).map((cls) => {
        const d = detailOf(db, cls, user);
        return {
          classId: cls.id,
          className: cls.name,
          campusId: cls.campusId,
          campusName: db.campuses.find((c) => c.id === cls.campusId)?.name,
          listId: d.listId,
          status: d.status,
          children: d.children.length,
          awarded: d.children.filter((c) => c.titles.length).length,
          submittedAt: d.submittedAt,
          updatedAt: d.updatedAt,
        };
      }),
    );
  },
  async getRewardList(classId, user) {
    const db = ensureReady();
    return clone(detailOf(db, accessClass(db, classId, user), user));
  },
  async saveRewardList(classId, items, { submit = false } = {}, user) {
    ensureReady();
    return writeDb((db) => {
      const cls = accessClass(db, classId, user),
        detail = detailOf(db, cls, user);
      if (!detail.canEdit) deny();
      const seen = new Set();
      const rows = (items || []).flatMap((item) => {
        const c = detail.children.find((child) => child.childId === item.childId);
        if (!c || seen.has(item.childId)) invalid('Trẻ không thuộc lớp hoặc bị trùng.');
        seen.add(item.childId);
        const titles = [...new Set(item.titles || [])],
          note = (item.note || '').trim();
        if (titles.some((t) => !detail.titleOptions.includes(t))) invalid('Danh hiệu không hợp lệ.');
        if (note.length > 300 || DIAGNOSTIC_TERMS.some((term) => note.toLowerCase().includes(term))) invalid('Ghi chú không hợp lệ.');
        if (!titles.length) return [];
        if (!c.yearEnd) invalid('Cần xác nhận đánh giá cuối năm trước.');
        if (
          titles.filter((t) => REWARD_GENERAL_TITLES.includes(t)).length > 1 ||
          titles.filter((t) => REWARD_PROGRAM_TITLES.includes(t)).length > 1
        )
          invalid('Mỗi trẻ chọn một danh hiệu bé ngoan và tối đa một danh hiệu hoàn thành chương trình.');
        if (titles.some((t) => REWARD_PROGRAM_TITLES.includes(t)) && !c.programCompleted) invalid('Trẻ chưa hoàn thành chương trình.');
        return [{ childId: item.childId, titles, note }];
      });
      if (submit && !rows.length) invalid('Chọn ít nhất một trẻ được khen thưởng.');
      db.classRewardLists ||= [];
      let list = listOf(db, cls);
      const at = now();
      if (!list) {
        list = { id: uid('reward-list'), classId, createdBy: user.id, createdByName: user.fullName, history: [] };
        db.classRewardLists.push(list);
      }
      Object.assign(list, {
        items: rows,
        status: submit ? 'PENDING_VP' : 'DRAFT',
        updatedBy: user.id,
        updatedByName: user.fullName,
        updatedAt: at,
        ...(submit ? { submittedAt: at } : {}),
      });
      list.history.push({
        id: uid('reward-event'),
        action: submit ? 'SUBMITTED' : 'UPDATED',
        userId: user.id,
        userName: user.fullName,
        at,
      });
      return clone(detailOf(db, cls, user));
    });
  },
  async reviewRewardList(id, body, user) {
    return this.changeRewardList(id, body, user, false);
  },
  async decideRewardList(id, body, user) {
    return this.changeRewardList(id, body, user, true);
  },
  changeRewardList(id, { decision, comment = '' }, user, principal) {
    ensureReady();
    return writeDb((db) => {
      const list = (db.classRewardLists || []).find((r) => r.id === id);
      if (!list) throw new ApiError(404, 'Không tìm thấy danh sách.');
      const cls = accessClass(db, list.classId, user),
        d = detailOf(db, cls, user);
      if (!(principal ? d.canDecide : d.canReview)) deny();
      if (!(principal ? ['APPROVE', 'RETURN'] : ['FORWARD', 'RETURN']).includes(decision)) invalid('Quyết định không hợp lệ.');
      if (comment.trim().length > 500 || (['REJECT', 'RETURN'].includes(decision) && !comment.trim())) invalid('Nhập lý do hợp lệ.');
      const at = now(),
        step = { by: user.id, byName: user.fullName, at, decision, comment: comment.trim() };
      list[principal ? 'principalDecision' : 'vpReview'] = step;
      list.status = { APPROVE: 'APPROVED', REJECT: 'REJECTED', FORWARD: 'PENDING_PRINCIPAL', RETURN: 'RETURNED' }[decision];
      list.updatedAt = at;
      list.history.push({
        id: uid('reward-event'),
        action: { APPROVE: 'APPROVED', REJECT: 'REJECTED', FORWARD: 'FORWARDED', RETURN: 'RETURNED' }[decision],
        userId: user.id,
        userName: user.fullName,
        at,
        note: comment.trim(),
      });
      return clone(detailOf(db, cls, user));
    });
  },
  async markProgramCompletion(id, completed, user) {
    ensureReady();
    return writeDb((db) => {
      const e = db.yearEndEvaluations.find((r) => r.id === id);
      if (!e) throw new ApiError(404, 'Không tìm thấy đánh giá.');
      const cls = accessClass(db, e.classId, user);
      if (!isClassTeacher(cls, user) || e.status === 'CONFIRMED' || yearOf(db, cls)?.status !== 'ACTIVE') deny();
      if (!programClass(db, cls) || typeof completed !== 'boolean') invalid('Không áp dụng hoàn thành chương trình.');
      e.programCompleted = completed;
      return clone(e);
    });
  },
  async getProgramCompletion(params = {}, user) {
    const db = ensureReady(),
      classes = leaderClasses(db, params, user);
    const rows = classes
      .filter((cls) => programClass(db, cls))
      .map((cls) => {
        const children = roster(db, cls),
          done = children.map((c) => yearEndOf(db, cls, c.id));
        const completed = done.filter((e) => e?.programCompleted === true).length;
        const notCompleted = done.filter((e) => e?.programCompleted === false).length;
        return {
          classId: cls.id,
          className: cls.name,
          campusId: cls.campusId,
          children: children.length,
          completed,
          notCompleted,
          unmarked: children.length - completed - notCompleted,
          completedRate: pct(completed, children.length),
        };
      });
    const totals = { children: 0, completed: 0, notCompleted: 0, unmarked: 0 };
    rows.forEach((r) =>
      Object.keys(totals).forEach((k) => {
        totals[k] += r[k];
      }),
    );
    totals.completedRate = pct(totals.completed, totals.children);
    return clone({ campusIds: campuses(db, classes).map((c) => c.id), campuses: campuses(db, classes), rows, totals });
  },
  // BE giả OBS-24: HT, PHT xem mọi lớp; chấm: HT mọi lớp, PHT điểm trường mình; GV xem lớp mình
  async getClassRatings(params = {}, user) {
    const db = ensureReady();
    const leader = isLeader(user);
    if (!leader && !['TEACHER', 'TEAM_LEADER'].includes(user?.role)) deny();
    const classes = scoped(db, params.schoolYear, user).filter((c) => leader || isClassTeacher(c, user));
    const shown = classes.filter((c) => !params.campusId || c.campusId === params.campusId);
    const saved = (db.classRatings || []).filter((r) => r.period === params.period);
    return clone({
      period: params.period,
      campuses: campuses(db, classes).map((c) => ({ id: c.id, name: c.shortName || c.name })),
      rows: shown.map((c) => {
        const r = saved.find((x) => x.classId === c.id);
        return {
          classId: c.id,
          className: c.name,
          campusId: c.campusId,
          ageGroupId: c.ageGroupId,
          levels: r?.levels || {},
          note: r?.note || null,
          ratedAt: r?.ratedAt || null,
          ratedByName: r?.ratedByName || null,
          canEdit: inLeaderEditScope(c.campusId, user),
        };
      }),
    });
  },
  async saveClassRatings({ period, items }, user) {
    const db = ensureReady();
    items.forEach((i) => {
      const cls = db.classes.find((c) => c.id === i.classId);
      if (!cls || !inLeaderEditScope(cls.campusId, user)) deny();
    });
    db.classRatings = [
      ...(db.classRatings || []).filter((r) => r.period !== period || !items.some((i) => i.classId === r.classId)),
      ...items.map((i) => ({
        period,
        classId: i.classId,
        levels: i.levels,
        note: i.note?.trim() || null,
        ratedAt: new Date().toISOString(),
        ratedByName: user.fullName,
      })),
    ];
    writeDb(db);
    return this.getClassRatings({ period }, user);
  },
  async getQualityReport(params = {}, user) {
    const db = ensureReady();
    // GV, tổ trưởng: lớp mình (BE thêm lớp nhóm tuổi của tổ trưởng); không có dòng tổng
    const leader = isLeader(user);
    if (!leader && !['TEACHER', 'TEAM_LEADER'].includes(user?.role)) deny();
    const classes = leader ? leaderClasses(db, params, user) : scoped(db, params.schoolYear, user);
    const year = db.schoolYears.find((y) => y.id === (params.schoolYear || activeYearId(db)));
    if (!year) throw new ApiError(404, 'Không tìm thấy năm học.');
    const last = [todayIso(), year.endDate].sort()[0],
      months = monthsBetween(year.startDate, last).map((m) => m.slice(0, 7));
    const month = (params.month || last).slice(0, 7);
    if (!months.includes(month)) invalid('Tháng phải nằm trong năm học và không ở tương lai.');
    const rows = classes.map((cls) => {
      const children = roster(db, cls),
        ids = new Set(children.map((c) => c.id));
      const all = (db.attendance || []).filter(
        (a) => a.classId === cls.id && a.date >= year.startDate && a.date <= last && schoolDaysBetween(a.date, a.date).length,
      );
      const records = all.filter((a) => a.date.startsWith(month)),
        days = new Set(records.map((r) => r.date));
      const present = records.filter((r) => r.status === 'PRESENT'),
        meals = new Set(present.filter((r) => r.meals?.LUNCH || r.meals?.includes?.('LUNCH')).map((r) => r.childId));
      const presentDays = present.filter((r) => ids.has(r.childId)).length,
        possibleDays = children.length * days.size;
      const diligent = children.filter(
        (c) => days.size && records.filter((r) => r.childId === c.id && r.status === 'PRESENT').length * 100 >= 90 * days.size,
      ).length;
      const weekly = children.map((c) => {
        let n = 0;
        for (let d = `${month}-01`; d <= monthEnd(`${month}-01`); d = addDays(d, 1)) {
          if (weekStart(d) !== d) continue;
          const dates = new Set(
            all.filter((r) => r.childId === c.id && r.status === 'PRESENT' && r.date >= d && r.date <= addDays(d, 4)).map((r) => r.date),
          );
          if (dates.size >= TICKET_RULES.WEEK_MIN_PRESENT_DAYS && flagsOf(db, c.id, dates) >= TICKET_RULES.WEEK_MIN_FLAGS) n++;
        }
        return n;
      });
      const good = weekly.filter((n) => n >= 1).length,
        allRound = weekly.filter((n) => n >= TICKET_RULES.MONTH_MIN_WEEKLY_TICKETS).length;
      const age = db.ageGroups.find((g) => g.id === cls.ageGroupId);
      return {
        classId: cls.id,
        className: cls.name,
        campusId: cls.campusId,
        ageGroupId: cls.ageGroupId,
        level: age?.ageFromMonths < 36 ? 'NHA_TRE' : 'MAU_GIAO',
        children: children.length,
        schoolDays: days.size,
        avgPresent: average(present.length, days.size),
        presentDays,
        possibleDays,
        attendanceRate: pct(presentDays, possibleDays),
        mealChildren: children.filter((c) => meals.has(c.id)).length,
        mealRate: pct(children.filter((c) => meals.has(c.id)).length, children.length),
        diligentChildren: diligent,
        diligentRate: pct(diligent, children.length),
        goodChildren: good,
        goodRate: pct(good, children.length),
        allRoundChildren: allRound,
        allRoundRate: pct(allRound, children.length),
        avgPresentByMonth: Object.fromEntries(
          months.map((m) => {
            const rs = all.filter((r) => r.date.startsWith(m));
            return [m, average(rs.filter((r) => r.status === 'PRESENT').length, new Set(rs.map((r) => r.date)).size)];
          }),
        ),
      };
    });
    const total = (group, level) => {
      const t = { level };
      for (const k of [
        'children',
        'schoolDays',
        'avgPresent',
        'presentDays',
        'possibleDays',
        'mealChildren',
        'diligentChildren',
        'goodChildren',
        'allRoundChildren',
      ])
        t[k] = group.reduce((n, r) => n + r[k], 0);
      for (const [rate, n, d] of [
        ['attendanceRate', 'presentDays', 'possibleDays'],
        ['mealRate', 'mealChildren', 'children'],
        ['diligentRate', 'diligentChildren', 'children'],
        ['goodRate', 'goodChildren', 'children'],
        ['allRoundRate', 'allRoundChildren', 'children'],
      ])
        t[rate] = pct(t[n], t[d]);
      t.avgPresentByMonth = Object.fromEntries(months.map((m) => [m, group.reduce((n, r) => n + r.avgPresentByMonth[m], 0)]));
      return t;
    };
    return clone({
      month,
      monthStart: `${month}-01`,
      monthEnd: monthEnd(`${month}-01`),
      months,
      campuses: campuses(db, classes),
      allCampuses: campuses(db, scoped(db, params.schoolYear, user)),
      campusIds: campuses(db, classes).map((c) => c.id),
      rows,
      totals:
        leader && rows.length
          ? [
              ...['NHA_TRE', 'MAU_GIAO']
                .filter((level) => rows.some((r) => r.level === level))
                .map((level) =>
                  total(
                    rows.filter((r) => r.level === level),
                    level,
                  ),
                ),
              total(rows, 'ALL'),
            ]
          : [],
    });
  },
});
