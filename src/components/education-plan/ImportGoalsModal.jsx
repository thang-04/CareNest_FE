import { useEffect, useRef, useState } from 'react';
import { Download } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useGoalImportSources } from '@/hooks/education-plan/useGoalImportSources';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { getImportGoals } from '@/models/education-plan/importGoals.mjs';
import { ROLES } from '@/models/User';
import { EmptyState, Modal, Notice, YearPlanStatusBadge } from '@/components/education-plan/eduUi';
import { ErrorState, LoadingState } from '@/components/ui/States';

export default function ImportGoalsModal({ excludeId, defaultAgeGroupId, onClose, onImport }) {
  const { schoolYears, user } = useEducationPlan();
  const [year, setYear] = useState(schoolYears[1] || schoolYears[0] || '');
  const [ageGroupId, setAgeGroupId] = useState(defaultAgeGroupId || '');
  const [sourceId, setSourceId] = useState('');
  const [picked, setPicked] = useState({ key: '', ids: [] });
  const [checking, setChecking] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const isLeader = user.role === ROLES.TEAM_LEADER;
  const query = useGoalImportSources({
    schoolYear: year,
    ageGroupId: isLeader ? defaultAgeGroupId : ageGroupId,
    excludeId,
    sourceId,
    actor: user,
  });
  const source = query.source;
  const goals = source ? getImportGoals(source) : [];
  const key = `${query.sourceKey}:${source?.revision ?? 0}:${source?.status || ''}`;
  const selected = new Set(picked.key === key ? picked.ids : []);
  const selectedIds = goals.filter((goal) => selected.has(goal.id)).map((goal) => goal.id);
  const count = selectedIds.length;
  const busy = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  const latest = useRef({});
  latest.current = { key, onImport, onClose };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const reset = () => {
    generation.current++;
    busy.current = false;
    setChecking(false);
    setConfirmError('');
    setPicked({ key: '', ids: [] });
  };
  const close = () => {
    generation.current++;
    onClose();
  };
  const toggle = (ids) => {
    setConfirmError('');
    const on = !ids.every((id) => selected.has(id));
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setPicked({ key, ids: [...next] });
  };
  const confirm = async () => {
    if (busy.current || !source || !count || query.loadingSource) return;
    busy.current = true;
    setChecking(true);
    setConfirmError('');
    const token = ++generation.current;
    const valid = () => alive.current && token === generation.current && latest.current.key === key;
    try {
      const fresh = await query.readFresh();
      if (!valid()) return;
      const freshIds = new Set(getImportGoals(fresh).map((goal) => goal.id));
      if (
        fresh.id !== source.id ||
        fresh.status !== source.status ||
        (fresh.revision ?? 0) !== (source.revision ?? 0) ||
        selectedIds.some((id) => !freshIds.has(id))
      ) {
        setPicked({ key: '', ids: [] });
        setConfirmError('Kế hoạch nguồn đã thay đổi. Xem lại nội dung và chọn lại mục tiêu.');
        query.reloadSource();
        return;
      }
      const applied = await latest.current.onImport({ source: fresh, selectedGoalIds: selectedIds });
      if (applied && valid()) latest.current.onClose();
      else if (valid()) setConfirmError('Chưa thêm được mục tiêu. Kiểm tra lại quyền sửa và phiên sửa kế hoạch.');
    } catch (error) {
      if (valid()) setConfirmError(error.message || 'Không đọc được kế hoạch nguồn. Vui lòng thử lại.');
    } finally {
      if (valid()) {
        busy.current = false;
        setChecking(false);
      }
    }
  };
  const ready = source && !query.loadingSource && !query.sourceError && !query.loadingList && !query.listError;
  return (
    <Modal
      title="Lấy mục tiêu từ kế hoạch có sẵn"
      width={760}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            Hủy
          </button>
          <button className="btn btn--primary" disabled={!ready || !count || checking} onClick={confirm}>
            <Download size={16} aria-hidden /> {checking ? 'Đang kiểm tra…' : `Thêm ${count || ''} mục tiêu`}
          </button>
        </>
      }
    >
      <div className="grid-2 gap-3">
        <div className="field">
          <label className="field__label" htmlFor="imp-year">
            Năm học
          </label>
          <select
            id="imp-year"
            className="select"
            value={year}
            onChange={(event) => {
              reset();
              setYear(event.target.value);
              setSourceId('');
            }}
          >
            {schoolYears.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="imp-age">
            Nhóm tuổi
          </label>
          <select
            id="imp-age"
            className="select"
            value={isLeader ? defaultAgeGroupId : ageGroupId}
            disabled={isLeader}
            onChange={(event) => {
              reset();
              setAgeGroupId(event.target.value);
              setSourceId('');
            }}
          >
            {!isLeader && <option value="">Tất cả nhóm tuổi</option>}
            {AGE_GROUPS.filter((age) => !isLeader || age.id === defaultAgeGroupId).map((age) => (
              <option key={age.id} value={age.id}>
                {age.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="muted text-xs">Chỉ chép mục tiêu và nội dung giáo dục. Không lấy chủ đề, đợt nghỉ hoặc dấu tích chủ đề từ nguồn.</p>
      {confirmError && <Notice tone="warn">{confirmError}</Notice>}
      {query.loadingList ? (
        <LoadingState />
      ) : query.listError ? (
        <ErrorState
          error={query.listError}
          onRetry={() => {
            reset();
            query.reloadList();
          }}
        />
      ) : !query.sources.length ? (
        <EmptyState title="Không có bộ mục tiêu phù hợp" desc="Thử chọn năm học hoặc nhóm tuổi khác trong phạm vi của bạn." />
      ) : (
        <>
          <div className="field">
            <label className="field__label" htmlFor="imp-src">
              Bộ mục tiêu
            </label>
            <select
              id="imp-src"
              className="select"
              value={query.sourceId}
              onChange={(event) => {
                reset();
                setSourceId(event.target.value);
              }}
            >
              {query.sources.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
          {query.loadingSource ? (
            <LoadingState />
          ) : query.sourceError ? (
            <ErrorState
              error={query.sourceError}
              onRetry={() => {
                reset();
                query.reloadSource();
              }}
            />
          ) : (
            ready && (
              <>
                <p className="muted text-sm">
                  {source.schoolYear} · {AGE_GROUPS.find((age) => age.id === source.ageGroupId)?.name} ·{' '}
                  <YearPlanStatusBadge status={source.status} />
                </p>
                <div className="row row--between">
                  <span className="fw-600" aria-live="polite">
                    Đã chọn {count}/{goals.length} mục tiêu
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={!goals.length || checking}
                    onClick={() => toggle(goals.map((goal) => goal.id))}
                  >
                    {goals.length > 0 && count === goals.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                </div>
                {!goals.length ? (
                  <EmptyState title="Kế hoạch nguồn chưa có mục tiêu" />
                ) : (
                  <div className="ga-pick-list">
                    {source.domains.map((domain) => {
                      const items = goals.filter((goal) => goal.domainName === domain.name);
                      if (!items.length) return null;
                      return (
                        <div key={domain.id || domain.name} className="mb-8">
                          <label className="ga-goal-check ga-goal-check--head">
                            <input
                              type="checkbox"
                              disabled={checking}
                              checked={items.every((goal) => selected.has(goal.id))}
                              onChange={() => toggle(items.map((goal) => goal.id))}
                            />
                            <span className="fw-600">{domain.name}</span>
                          </label>
                          {items.map((goal) => (
                            <div key={goal.id}>
                              {(goal.sub || goal.group) && (
                                <p className="muted text-xs">{[goal.sub?.text, goal.group?.text].filter(Boolean).join(' › ')}</p>
                              )}
                              <label className="ga-goal-check ga-goal-check--child">
                                <input
                                  type="checkbox"
                                  disabled={checking}
                                  checked={selected.has(goal.id)}
                                  onChange={() => toggle([goal.id])}
                                />
                                <span className="ga-goal-code">{goal.code}</span>
                                <span className="text-sm">{goal.text}</span>
                              </label>
                              <ul className="muted text-sm">
                                {goal.contents.map((content) => (
                                  <li key={content.id}>{content.text}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </Modal>
  );
}
