import { useState } from 'react';
import { Download } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useGoalImportSources } from '@/hooks/education-plan/useGoalImportSources';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { breakExists, themeExists } from '@/models/education-plan/importThemes.mjs';
import { versionOf } from '@/models/education-plan/planVersions.mjs';
import { ROLES } from '@/models/User';
import { EmptyState, Modal, Notice, YearPlanStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { ErrorState, LoadingState } from '@/components/ui/States';

/*
 * Lấy chủ đề, đợt nghỉ từ kế hoạch năm có sẵn (BE:EDU-43): chọn năm học / nhóm tuổi / kế hoạch như hộp lấy mục tiêu
 * (quyền xem EDU-06), tích từng dòng hoặc chọn tất cả. Dòng đã có trong bản đang soạn thì không chọn được.
 */

const range = (start, end) => (start || end ? `${start ? fmtDate(start) : '…'} – ${end ? fmtDate(end) : '…'}` : '—');

export default function ImportThemesModal({ excludeId, defaultAgeGroupId, form, onClose, onImport }) {
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
    ageGroupId,
    excludeId,
    sourceId,
    actor: user,
  });
  const source = query.source;
  const key = `${query.sourceKey}:${source?.revision ?? 0}`;
  const selected = new Set(picked.key === key ? picked.ids : []);
  // Mã dòng thêm tiền tố để chủ đề và đợt nghỉ không đụng nhau trong cùng một tập chọn
  const rows = source
    ? [
        ...(source.themes || []).map((t, i) => ({ id: `t:${t.id}`, kind: 'theme', item: t, no: i + 1, has: themeExists(t, form.themes) })),
        ...(source.breaks || []).map((b, i) => ({ id: `b:${b.id}`, kind: 'break', item: b, no: i + 1, has: breakExists(b, form.breaks) })),
      ]
    : [];
  const open = rows.filter((r) => !r.has).map((r) => r.id);
  const count = open.filter((id) => selected.has(id)).length;
  const allPicked = open.length > 0 && open.every((id) => selected.has(id));

  const reset = () => {
    setConfirmError('');
    setPicked({ key: '', ids: [] });
  };
  const toggle = (ids) => {
    setConfirmError('');
    const on = !ids.every((id) => selected.has(id));
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setPicked({ key, ids: [...next] });
  };
  const confirm = async () => {
    if (checking || !source || !count) return;
    setChecking(true);
    try {
      // Đọc lại bản nguồn: đã đổi thì yêu cầu chọn lại, không chép dữ liệu cũ
      const fresh = await query.readFresh();
      if (fresh.id !== source.id || (fresh.revision ?? 0) !== (source.revision ?? 0)) {
        reset();
        setConfirmError('Kế hoạch nguồn đã thay đổi. Xem lại và chọn lại chủ đề.');
        query.reloadSource();
        return;
      }
      const ids = [...selected];
      const applied = onImport({
        source: fresh,
        themeIds: ids.filter((id) => id.startsWith('t:')).map((id) => id.slice(2)),
        breakIds: ids.filter((id) => id.startsWith('b:')).map((id) => id.slice(2)),
      });
      if (applied) onClose();
      else setConfirmError('Chưa thêm được chủ đề. Kiểm tra lại quyền sửa và phiên sửa kế hoạch.');
    } catch (error) {
      setConfirmError(error.message || 'Không đọc được kế hoạch nguồn. Vui lòng thử lại.');
    } finally {
      setChecking(false);
    }
  };
  const ready = source && !query.loadingSource && !query.sourceError && !query.loadingList && !query.listError;
  const table = (kind, title) => {
    const list = rows.filter((r) => r.kind === kind);
    if (!list.length) return null;
    return (
      <div className="table-wrap">
        <table className="table ga-plan-table">
          <caption className="ga-cur-sub__name">{title}</caption>
          <thead>
            <tr>
              <th className="ga-col-stt" aria-label="Chọn" />
              <th className="ga-col-stt ga-stt">STT</th>
              <th>{kind === 'theme' ? 'Tên chủ đề' : 'Đợt nghỉ'}</th>
              {kind === 'theme' && <th className="ga-col-abbr">Viết tắt</th>}
              <th>Từ – đến</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const name = kind === 'theme' ? r.item.name : r.item.label;
              return (
                <tr key={r.id}>
                  <td className="ga-stt">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${name || `dòng ${r.no}`}`}
                      disabled={r.has || checking}
                      checked={!r.has && selected.has(r.id)}
                      onChange={() => toggle([r.id])}
                    />
                  </td>
                  <td className="ga-stt">{r.no}</td>
                  <td>
                    {name || '—'} {r.has && <span className="chip">Đã có</span>}
                  </td>
                  {kind === 'theme' && <td className="center">{r.item.abbr || '—'}</td>}
                  <td className="nowrap">{range(r.item.start, r.item.end)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <Modal
      title="Lấy chủ đề từ kế hoạch có sẵn"
      width={900}
      className="ga-cur-modal"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn--primary" disabled={!ready || !count || checking} onClick={confirm}>
            <Download size={16} aria-hidden /> {checking ? 'Đang kiểm tra…' : `Thêm ${count || ''} dòng`}
          </button>
        </>
      }
    >
      <div className="ga-cur-filters gap-3">
        <div className="field">
          <label className="field__label" htmlFor="imt-year">
            Năm học
          </label>
          <select
            id="imt-year"
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
          <label className="field__label" htmlFor="imt-age">
            Nhóm tuổi
          </label>
          <select
            id="imt-age"
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
        {query.sources.length > 0 && (
          <div className="field">
            <label className="field__label" htmlFor="imt-src">
              Kế hoạch
            </label>
            <select
              id="imt-src"
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
        )}
      </div>
      {isLeader && <p className="muted text-sm">Nhóm tuổi khác chỉ hiện kế hoạch đã ban hành.</p>}
      {confirmError && <Notice tone="warn">{confirmError}</Notice>}
      {query.loadingList ? (
        <LoadingState />
      ) : query.listError ? (
        <ErrorState error={query.listError} onRetry={query.reloadList} />
      ) : !query.sources.length ? (
        <EmptyState title="Không có kế hoạch phù hợp" />
      ) : query.loadingSource ? (
        <LoadingState />
      ) : query.sourceError ? (
        <ErrorState error={query.sourceError} onRetry={query.reloadSource} />
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
            {!rows.length ? (
              <EmptyState title="Kế hoạch nguồn chưa có chủ đề, đợt nghỉ" />
            ) : (
              <>
                <div className="row row--between gap-2">
                  <span className="fw-600" aria-live="polite">
                    Đã chọn {count}/{open.length} dòng
                  </span>
                  <button type="button" className="btn btn--sm" disabled={!open.length || checking} onClick={() => toggle(open)}>
                    {allPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                </div>
                {table('theme', 'Chủ đề')}
                {table('break', 'Đợt nghỉ')}
              </>
            )}
          </>
        )
      )}
    </Modal>
  );
}
