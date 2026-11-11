import { workflowKey } from '@/models/education-plan/planLevel.mjs';
import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { eduError } from './eduMockErrors';
import { ROLES } from '@/models/User';
import { CREATOR_ROLES, REVIEWER_ROLES, withDefaults } from '@/models/education-plan/eduConfig';

const rolesOf = (user) => [...(user?.roles || []), user?.role];
const canConfigure = (user) => rolesOf(user).includes(ROLES.PRINCIPAL);
const view = (config, user) => {
  const cfg = withDefaults(config);
  const author =
    !cfg.workflowPolicy.year.reviewers.some((role) => rolesOf(user).includes(role)) &&
    cfg.workflowPolicy.year.creators.some((role) => rolesOf(user).includes(role));
  const scoped = user?.role === ROLES.TEAM_LEADER || user?.role === ROLES.TEACHER;
  const groups = scoped ? [user?.ageGroupId].filter(Boolean) : [...new Set((readDb().classes || []).map((cls) => cls.ageGroupId))];
  return {
    ...cfg,
    canConfigure: canConfigure(user),
    ...(user
      ? {
          yearCreationScopes: author ? groups : [],
          schoolYearCreationScopes:
            cfg.workflowPolicy.schoolYear.creators.some((r) => rolesOf(user).includes(r)) &&
            !cfg.workflowPolicy.schoolYear.reviewers.some((r) => rolesOf(user).includes(r))
              ? groups
              : [],
        }
      : {}),
  };
};

// BE:FR-003/012 — fake backend đối soát tài liệu đang mở trong cùng lần lưu policy.
const reconcile = (db, policies, revision) => {
  for (const [collection, kind] of [
    ['eduGoals', 'year'],
    ['eduClassBranch', 'branch'],
    ['eduClassTheme', 'theme'],
  ]) {
    for (const doc of db[collection] || []) {
      if (doc.status === 'APPROVED') continue;
      const policy = policies[kind === 'year' ? workflowKey(doc) : kind];
      const members =
        kind === 'theme'
          ? [
              doc,
              ...(db.eduClassWeek || []).filter(
                (week) => week.classId === doc.classId && week.yearPlanId === doc.yearPlanId && week.themeId === doc.themeId,
              ),
            ]
          : [doc];
      if (doc.status === 'REVIEW') {
        const authorIds = new Set(members.flatMap((member) => member.authorIds || []));
        const roles = policy.reviewers;
        const approvals = doc.approvals || [];
        const cls = (db.classes || []).find((item) => item.id === doc.classId);
        const eligible = (role) =>
          (db.users || []).some(
            (user) =>
              !authorIds.has(user.id) &&
              user.status !== 'INACTIVE' &&
              rolesOf(user).includes(role) &&
              (role !== ROLES.TEAM_LEADER || user.ageGroupId === (cls?.ageGroupId || doc.ageGroupId)),
          );
        const missing = roles.filter(
          (role) =>
            !approvals.some(
              (approval) =>
                approval.userId != null &&
                !authorIds.has(approval.userId) &&
                approval.roleKey === role &&
                (approval.round ?? doc.reviewRound) === doc.reviewRound,
            ),
        );
        const waitingRole = missing.find((role) => eligible(role) || role === roles.at(-1)) || null;
        members.forEach((member) => {
          member.status = waitingRole || !roles.length ? 'REVIEW' : 'APPROVED';
          member.waitingRole = waitingRole;
          member.approvals = clone(approvals);
          member.review = { ...(member.review || {}), policyRevision: revision, roles, waitingRole, approvals: clone(approvals) };
          if (!waitingRole && roles.length) {
            member.completedAt = new Date().toISOString();
            member.completionMode = 'POLICY_CHANGE';
            member.printSnapshot = {
              schemaVersion: 1,
              origin: 'PUBLICATION',
              documentType: member.kind || kind,
              policyRevision: revision,
              capturedAt: member.completedAt,
              slots: [
                {
                  roleKey: 'CREATOR',
                  label: 'Người soạn',
                  names: [
                    ...new Set(
                      [...(db.users || []).filter((user) => authorIds.has(user.id)).map((user) => user.fullName), doc.owner?.name].filter(
                        Boolean,
                      ),
                    ),
                  ],
                },
                ...roles.map((role) => ({
                  roleKey: role,
                  label: role,
                  names: approvals.filter((approval) => approval.roleKey === role).map((approval) => approval.name),
                })),
              ],
            };
          }
        });
      }
      members.forEach((member) => {
        if (
          member.editing &&
          !(db.users || []).some(
            (user) => user.id === member.editing.userId && policy.creators.some((role) => rolesOf(user).includes(role)),
          )
        ) {
          delete member.editing;
          delete member.editSessionId;
          delete member.editingAt;
          delete member.editingFrom;
          member.status = 'DRAFT';
        }
        if (kind === 'year') member.revision = (member.revision || 0) + 1;
        else member.version = (member.version || 0) + 1;
      });
    }
  }
};

export const eduConfigMockRepository = {
  async get(user) {
    await delay(60);
    return clone(view(readDb().eduConfig, user));
  },
  async save(cfg, user) {
    await delay();
    if (!rolesOf(user).some((role) => [ROLES.VICE_PRINCIPAL, ROLES.PRINCIPAL].includes(role))) throw eduError('EDU_CONFIG_FORBIDDEN');
    const current = withDefaults(readDb().eduConfig);
    if (cfg.workflowPolicy && JSON.stringify(cfg.workflowPolicy) !== JSON.stringify(current.workflowPolicy))
      throw eduError('INVALID_VALUE', 'dùng chức năng lưu người tạo/duyệt');
    if (JSON.stringify(cfg.durationPolicy || current.durationPolicy) !== JSON.stringify(current.durationPolicy)) {
      if (!canConfigure(user)) throw eduError('EDU_CONFIG_FORBIDDEN');
      if (cfg.durationPolicy.revision !== current.durationPolicy.revision) throw eduError('YEAR_PLAN_REVISION_STALE');
      for (const key of ['theme', 'branch']) {
        const { minWeeks, maxWeeks } = cfg.durationPolicy[key] || {};
        if (!Number.isInteger(minWeeks) || !Number.isInteger(maxWeeks) || minWeeks < 1 || minWeeks > maxWeeks)
          throw eduError('INVALID_VALUE', 'giới hạn tuần học');
      }
    }
    const durationPolicy =
      JSON.stringify(cfg.durationPolicy || current.durationPolicy) === JSON.stringify(current.durationPolicy)
        ? current.durationPolicy
        : { ...cfg.durationPolicy, revision: current.durationPolicy.revision + 1 };
    const next = withDefaults({
      ...current,
      durationPolicy,
      domainLabels: cfg.domainLabels,
      extraDomains: cfg.extraDomains,
      weekRows: cfg.weekRows,
    });
    if (!next.weekRows.some((row) => row.key === 'hoc')) throw eduError('LESSON_ROW_REQUIRED');
    if (next.weekRows.some((row) => !row.label.trim())) throw eduError('REQUIRED_FIELD_MISSING', 'tên dòng hoạt động');
    const names = next.extraDomains.map((name) => name.trim().toLowerCase());
    if (new Set(names).size !== names.length) throw eduError('DOMAIN_NAME_EXISTS', '');
    return writeDb((db) => {
      db.eduConfig = clone(next);
      return clone(view(next, user));
    });
  },
  async saveWorkflowPolicy(cfg, user) {
    await delay();
    if (!canConfigure(user)) throw eduError('EDU_CONFIG_FORBIDDEN');
    const current = withDefaults(readDb().eduConfig);
    if (cfg.workflowRevision !== current.workflowRevision) throw eduError('YEAR_PLAN_REVISION_STALE');
    const policies = cfg.workflowPolicy && {
      ...cfg.workflowPolicy,
      schoolYear: cfg.workflowPolicy.schoolYear || current.workflowPolicy.schoolYear,
    };
    if (!policies || Object.keys(policies).sort().join(',') !== 'branch,schoolYear,theme,year')
      throw eduError('INVALID_VALUE', 'loại tài liệu');
    for (const policy of Object.values(policies)) {
      if (Object.keys(policy).sort().join(',') !== 'creators,reviewers') throw eduError('INVALID_VALUE', 'vai trò');
      for (const [key, allowed] of [
        ['creators', CREATOR_ROLES],
        ['reviewers', REVIEWER_ROLES],
      ]) {
        const list = policy[key];
        if (!Array.isArray(list) || !list.length || new Set(list).size !== list.length || list.some((role) => !allowed.includes(role)))
          throw eduError('INVALID_VALUE', 'vai trò');
      }
      if (policy.creators.some((role) => policy.reviewers.includes(role))) throw eduError('INVALID_VALUE', 'vai trò tạo và duyệt trùng');
      if (
        policy.creators.length !== 1 ||
        policy.reviewers.some((role) => CREATOR_ROLES.indexOf(role) <= CREATOR_ROLES.indexOf(policy.creators[0]))
      )
        throw eduError('INVALID_VALUE', 'người duyệt phải có cấp bậc cao hơn người soạn');
    }
    if (JSON.stringify(policies) === JSON.stringify(current.workflowPolicy)) return clone(view(current, user));
    return writeDb((db) => {
      db.eduConfig = {
        ...current,
        workflowPolicy: clone(policies),
        workflowRevision: current.workflowRevision + 1,
        signers: {
          year: policies.year.reviewers,
          branch: policies.branch.reviewers,
          theme: policies.theme.reviewers,
          week: policies.theme.reviewers,
        },
      };
      reconcile(db, policies, db.eduConfig.workflowRevision);
      return clone(view(db.eduConfig, user));
    });
  },
};
