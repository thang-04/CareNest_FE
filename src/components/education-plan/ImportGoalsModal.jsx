import { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useGoalImportSources } from '@/hooks/education-plan/useGoalImportSources';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { getImportGoals } from '@/models/education-plan/importGoals.mjs';
import { EmptyState, Modal, Notice, YearPlanStatusBadge } from '@/components/education-plan/eduUi';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { GoalPicker } from '@/components/education-plan/GoalPicker';
import { versionOf } from '@/models/education-plan/planVersions.mjs';

export default function ImportGoalsModal({ excludeId, defaultAgeGroupId, defaultYear, onClose, onImport }) {
  const { schoolYears, user } = useEducationPlan();
  // Mặc định năm học của kế hoạch đang soạn (Tiền 31/10)
  const [year, setYear] = useState(schoolYears.includes(defaultYear) ? defaultYear : schoolYears[1] || schoolYears[0] || '');
  const [ageGroupId, setAgeGroupId] = useState(defaultAgeGroupId || '');
  const [sourceId, setSourceId] = useState('');
  const [picked, setPicked] = useState({ key: '', ids: [] });
  const [checking, setChecking] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const query = useGoalImportSources({
    schoolYear: year,
    ageGroupId,
    excludeId,
    sourceId,
    actor: user,
  });
  const source = query.source;
  const goals = useMemo(() => (source ? getImportGoals(source) : []), [source]);
  // Dạng cây của danh sách chọn dùng chung (GoalPicker): lĩnh vực → lĩnh vực con → nhóm kết quả mong đợi → MT
  const pickTree = useMemo(() => {
    const domains = [];
    goals.forEach((goal) => {
      let d = domains.find((x) => x.name === goal.domainName);
      if (!d) domains.push((d = { name: goal.domainName, subs: [] }));
      const subKey = goal.sub?.id || '-';
      let sub = d.subs.find((x) => x.key === subKey);
      if (!sub) d.subs.push((sub = { key: subKey, name: goal.sub?.text || '', groups: [] }));
      const groupKey = goal.group?.id || '-';
      let group = sub.groups.find((x) => x.key === groupKey);
      if (!group) sub.groups.push((group = { key: groupKey, title: goal.group?.text || '', goals: [] }));
      group.goals.push({ id: goal.id, code: goal.code, text: goal.text, contents: goal.contents.map((c) => c.text) });
    });
    return domains;
  }, [goals]);
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
      width={1100}
      className="ga-cur-modal"
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
      <div className="ga-cur-filters gap-3">
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
            value={ageGroupId}
            onChange={(event) => {
              reset();
              setAgeGroupId(event.target.value);
              setSourceId('');
            }}
          >
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((age) => (
              <option key={age.id} value={age.id}>
                {age.name}
              </option>
            ))}
          </select>
        </div>
      </div>
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
        <EmptyState title="Không có kế hoạch phù hợp" />
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
                <div className="ga-cur-meta">
                  <span className="chip chip--blue">{AGE_GROUPS.find((age) => age.id === source.ageGroupId)?.name}</span>
                  <span className="muted text-sm">
                    {source.schoolYear} · Phiên bản {versionOf(source)}
                  </span>
                  <YearPlanStatusBadge status={source.status} />
                </div>
                {!goals.length ? (
                  <EmptyState title="Kế hoạch nguồn chưa có mục tiêu" />
                ) : (
                  <GoalPicker tree={pickTree} picked={selected} onToggle={toggle} disabled={checking} />
                )}
              </>
            )
          )}
        </>
      )}
    </Modal>
  );
}
