import { useEffect, useRef, useState } from 'react';
import { Download, Upload } from '@/components/ui/icons';
import { Modal, Notice, fmtDate } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { previewGoalFile } from '@/services/education-plan/educationPlanService';
import { prepareFileImport, previewSummary } from '@/models/education-plan/importGoalFile.mjs';
import { AGE_GROUPS, domainLabel } from '@/models/education-plan/educationPlanConstants';
import { downloadDoc, goalTemplateFile } from '@/utils/education-plan/yearPlanDoc';

const ACCEPT = '.docx,.doc,.xlsx,.csv';
const SHOWN_WARNINGS = 8;

export function ImportGoalFileModal({ form, themes = [], allowedAgeGroupIds, yearRange, onImport, onClose }) {
  const fileRef = useRef(null);
  const generation = useRef(0);
  const alive = useRef(true);
  const applying = useRef(false);
  const [state, setState] = useState({ status: 'idle' });
  const [applyError, setApplyError] = useState('');
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  const target = form || { themes, breaks: [], domains: [], ageGroupId: '', schoolYear: '' };
  const preview = state.status === 'ready' ? state.preview : null;
  const prepared = prepareFileImport(target, preview, { allowedAgeGroupIds, yearRange });
  const summary = preview ? previewSummary(preview) : [];
  const goals = summary.reduce((n, d) => n + d.goals, 0);
  const full = !!preview?.metadata || !!preview?.themes?.length || !!preview?.breaks?.length;
  const metadata = preview?.metadata;
  const groupName = (id) => AGE_GROUPS.find((group) => group.id === id)?.name || 'Chưa xác định';
  const canAdd =
    !!preview &&
    !prepared.error &&
    (goals || prepared.themes.length || prepared.breaks.length || (!target.title?.trim() && metadata?.title));
  const close = () => {
    if (applying.current) return;
    alive.current = false;
    generation.current++;
    onClose();
  };
  const read = async (file) => {
    if (!file || !alive.current || applying.current) return;
    const current = ++generation.current;
    setApplyError('');
    setState({ status: 'loading', name: file.name });
    try {
      const result = await previewGoalFile(file);
      if (alive.current && current === generation.current) setState({ status: 'ready', name: file.name, preview: result });
    } catch (error) {
      if (alive.current && current === generation.current)
        setState({ status: 'error', name: file.name, message: error.message || 'Không đọc được file' });
    } finally {
      if (alive.current && current === generation.current && fileRef.current) fileRef.current.value = '';
    }
  };
  const apply = () => {
    if (!alive.current || applying.current || !canAdd) return;
    applying.current = true;
    try {
      if (onImport(preview)) {
        applying.current = false;
        close();
      } else setApplyError('Chưa thể bổ sung. Kiểm tra quyền sửa và thông tin kế hoạch hiện tại.');
    } finally {
      applying.current = false;
    }
  };
  const template = () => {
    const file = goalTemplateFile(target.themes || themes);
    downloadDoc(file.html, file.name);
  };
  return (
    <Modal
      title="Nhập file mục tiêu"
      width={720}
      onClose={close}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!canAdd} onClick={apply}>
            <Download size={16} aria-hidden /> {full ? 'Bổ sung vào kế hoạch' : `Thêm ${goals || ''} mục tiêu`}
          </button>
        </>
      }
    >
      <p className="muted text-sm">
        Word (.doc, .docx), Excel (.xlsx) hoặc CSV, tối đa 2 MB. Xem trước rồi bổ sung; dữ liệu đã nhập giữ nguyên. Chỉ ghi lên hệ thống khi
        bấm Lưu.
      </p>
      <div className="row row--wrap gap-2">
        <button
          type="button"
          className="btn btn--outline-primary"
          disabled={state.status === 'loading'}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} aria-hidden /> Chọn file
        </button>
        <button type="button" className="btn btn--ghost" onClick={template}>
          <Download size={16} aria-hidden /> Tải file mẫu
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          aria-label="Chọn file mục tiêu"
          onChange={(e) => read(e.target.files?.[0])}
        />
      </div>
      {state.status === 'loading' && <LoadingState text="Đang đọc file…" />}
      {state.status === 'error' && <Notice tone="err">{state.message}</Notice>}
      {applyError && <Notice tone="warn">{applyError}</Notice>}
      {preview && (
        <>
          <p className="text-sm">
            <b>{state.name}</b>
          </p>
          {prepared.error && <Notice tone="err">{prepared.error}</Notice>}
          {metadata && (
            <>
              <h3 className="text-md">Thông tin chung</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thông tin</th>
                      <th>Trong file</th>
                      <th>Khi bổ sung</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Tên kế hoạch</th>
                      <td>{metadata.title || '—'}</td>
                      <td>
                        {target.title?.trim() || metadata.title || '—'}
                        {target.title?.trim() && <span className="muted text-sm"> · Giữ tên đang có</span>}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Năm học</th>
                      <td>{metadata.schoolYear || 'Chưa xác định'}</td>
                      <td>{target.schoolYear || '—'} · Giữ năm đang mở</td>
                    </tr>
                    <tr>
                      <th scope="row">Nhóm tuổi</th>
                      <td>{groupName(prepared.sourceAgeGroupId)}</td>
                      <td>{groupName(prepared.ageGroupId)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!!prepared.shifted && (
            <Notice>
              Ngày chủ đề, đợt nghỉ được dời {Math.abs(prepared.shifted)} năm {prepared.shifted > 0 ? 'về sau' : 'về trước'} theo năm học
              đang mở. Kiểm tra lịch dưới đây trước khi bổ sung.
            </Notice>
          )}
          {prepared.themes.length > 0 && (
            <>
              <h3 className="text-md">Chủ đề trong file</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Chủ đề</th>
                      <th>Viết tắt</th>
                      <th>Từ ngày sau dời</th>
                      <th>Đến ngày sau dời</th>
                      <th>Lễ hội</th>
                      <th>Ghi chú</th>
                      <th>Khi bổ sung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.themes.map((t) => (
                      <tr key={t.id}>
                        <td>{t.name}</td>
                        <td>{t.abbr}</td>
                        <td>{fmtDate(t.start)}</td>
                        <td>{fmtDate(t.end)}</td>
                        <td>{t.festivals || '—'}</td>
                        <td>{t.note || '—'}</td>
                        <td>{t.existing ? `Giữ chủ đề đã có (${t.targetAbbr || t.abbr})` : 'Thêm mới'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {prepared.breaks.length > 0 && (
            <>
              <h3 className="text-md">Đợt nghỉ trong file</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Đợt nghỉ</th>
                      <th>Từ ngày sau dời</th>
                      <th>Đến ngày sau dời</th>
                      <th>Ghi chú</th>
                      <th>Khi bổ sung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.breaks.map((b) => (
                      <tr key={b.id}>
                        <td>{b.label}</td>
                        <td>{fmtDate(b.start)}</td>
                        <td>{fmtDate(b.end)}</td>
                        <td>{b.note || '—'}</td>
                        <td>{b.existing ? 'Giữ đợt nghỉ đã có' : 'Thêm mới'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <h3 className="text-md">Mục tiêu và dấu tích</h3>
          {goals ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lĩnh vực</th>
                    <th className="center">Mục tiêu</th>
                    <th className="center">Nội dung</th>
                    <th className="center">Dấu tích chủ đề</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((d) => (
                    <tr key={d.name}>
                      <td>{domainLabel(d.name)}</td>
                      <td className="center">{d.goals}</td>
                      <td className="center">{d.contents}</td>
                      <td className="center">{d.ticks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Notice tone="warn">File không có mục tiêu nào để thêm.</Notice>
          )}
          {prepared.missingThemes.length > 0 && (
            <Notice tone="warn">
              Chưa có chủ đề {prepared.missingThemes.join(', ')}: dấu tích ở các cột này chưa ghép được. Thêm hoặc sửa chủ đề ở phần 2 rồi
              nhập lại nếu cần.
            </Notice>
          )}
          {prepared.warnings.length > 0 && (
            <Notice tone="warn">
              <ul>
                {prepared.warnings.slice(0, SHOWN_WARNINGS).map((w, i) => (
                  <li key={i}>{w.row ? `Dòng ${w.row}: ${w.message}` : w.message}</li>
                ))}
              </ul>
              {prepared.warnings.length > SHOWN_WARNINGS && (
                <details>
                  <summary>Xem thêm {prepared.warnings.length - SHOWN_WARNINGS} cảnh báo</summary>
                  <ul>
                    {prepared.warnings.slice(SHOWN_WARNINGS).map((w, i) => (
                      <li key={i}>{w.row ? `Dòng ${w.row}: ${w.message}` : w.message}</li>
                    ))}
                  </ul>
                </details>
              )}
            </Notice>
          )}
        </>
      )}
    </Modal>
  );
}
