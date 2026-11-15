import { recipientError } from '@/utils/children/accountRecipient';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, AlertTriangle, CheckCircle2, ArrowLeft, Upload, LayoutGrid } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useToast } from '@/contexts/ToastContext';
import { ActiveYearNotice } from '@/components/children/ActiveYearNotice';
import { ImportChildrenModal } from '@/components/children/ImportChildrenModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { StatusPage } from '@/components/ui/StatusPage';
import { importChildren } from '@/services/children/childrenService';
import { GENDER_LABELS } from '@/models/School';
import { AllergyStateBadge, ImportRowResultBadge } from '@/components/children/ChildBadges';
import { DECLARATION_STATE } from '@/models/children/childrenConstants';
import { formatDate, formatFileSize } from '@/utils/format';
import { canEnrollChild } from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import { clearImportDraft, peekImportDraft } from '@/utils/children/importDraft';
import '@/styles/modules/children.css';

/** Bước 2 nhập trẻ từ Excel: xem trước kết quả kiểm tra file (chọn file ở ImportChildrenModal) ⇒ nhập ⇒ kết quả. */
export default function ImportChildrenPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { yearReadOnly } = useSchoolYear();
  const [draft, setDraft] = useState(peekImportDraft);
  const [reupload, setReupload] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [imported, setImported] = useState(null);

  // Rời màn là bỏ bản xem trước: quay lại màn này phải tải file lại (user chốt 14/11/2026, phương án 1a).
  useEffect(() => clearImportDraft, []);

  if (!canEnrollChild(user))
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Nhập từ Excel')} />
        <h1 className="page__title">Nhập danh sách trẻ từ Excel</h1>
        <StatusPage
          kind="403"
          title="Bạn không có quyền tiếp nhận trẻ"
          description="Chỉ Hiệu trưởng hoặc Phó hiệu trưởng được giao quyền tiếp nhận trẻ mới nhập được danh sách trẻ."
        />
      </div>
    );

  if (imported)
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Nhập từ Excel')} />
        <h1 className="page__title">Nhập danh sách trẻ từ Excel</h1>
        <div className="card">
          <div className="state">
            <div className="state__icon tr-state-success">
              <CheckCircle2 size={26} />
            </div>
            <div className="state__title">Đã nhập {imported.created} hồ sơ trẻ</div>
            <div className="muted tr-state-text">
              Hồ sơ đã được tiếp nhận. Các trẻ đang ở trạng thái <b>Chờ xếp lớp</b>; xếp lớp cho từng trẻ tại màn Xếp lớp. Tài khoản phụ
              huynh chưa tạo: kích hoạt ở màn Tài khoản phụ huynh.
            </div>
            <div className="row mt-12 gap-2">
              <Link className="btn" to="/children">
                Về danh sách trẻ
              </Link>
              <Link className="btn btn--primary" to="/children/placement">
                <LayoutGrid size={16} /> Xếp lớp cho trẻ mới
              </Link>
            </div>
          </div>
        </div>
      </div>
    );

  if (yearReadOnly)
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Nhập từ Excel')} />
        <h1 className="page__title">Nhập danh sách trẻ từ Excel</h1>
        <ActiveYearNotice action="Nhập danh sách trẻ" />
      </div>
    );

  // Chưa có bản xem trước (F5, mở link trực tiếp, quay lại bằng lịch sử) ⇒ về Danh sách trẻ và mở sẵn hộp chọn file.
  if (!draft) return <Navigate to="/children?import=1" replace />;

  const selectRecipient = (rowNo, idNumber) =>
    setDraft((previous) => ({
      ...previous,
      preview: {
        ...previous.preview,
        rows: previous.preview.rows.map((row) => {
          if (row.rowNo !== rowNo) return row;
          const guardians = row.payload.child.guardians.map((g) => ({ ...g, accountRecipient: g.idNumber === idNumber }));
          return {
            ...row,
            selectionError: recipientError(guardians),
            payload: { ...row.payload, child: { ...row.payload.child, guardians } },
          };
        }),
      },
    }));
  const rows = draft.preview.rows.map((row) => ({
    ...row,
    errors: [...row.errors, ...(row.selectionError ? [row.selectionError] : [])],
  }));
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const validRows = rows.filter((r) => r.errors.length === 0);
  const shown = onlyErrors ? errorRows : rows;

  const doImport = async () => {
    try {
      const result = await importChildren(
        validRows.map((r) => r.payload),
        user,
        draft.campusId || undefined,
      );
      clearImportDraft();
      setImported(result);
      setConfirm(false);
      toast.success(`Đã nhập ${result.created} hồ sơ trẻ.`, 'Nhập danh sách thành công');
    } catch (err) {
      setConfirm(false);
      toast.error(err, 'Không nhập được danh sách');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Nhập từ Excel')} />
      <div className="page__head">
        <h1 className="page__title">Kiểm tra danh sách nhập</h1>
        <Button icon={Upload} onClick={() => setReupload(true)}>
          Tải file khác
        </Button>
      </div>

      <section className="card">
        <div className="card__header row row--between row--wrap gap-3">
          <div className="stack gap-1">
            <div className="row row--wrap gap-2">
              <h2 className="card__title">Kết quả kiểm tra</h2>
              <span className="chip chip--blue">{rows.length} dòng</span>
              <span className="chip chip--green">{validRows.length} hợp lệ</span>
              {errorRows.length > 0 && <span className="chip chip--red">{errorRows.length} dòng lỗi</span>}
            </div>
            <div className="row row--wrap gap-2 muted text-sm">
              <FileSpreadsheet size={16} color="var(--file-sheet)" aria-hidden="true" />
              <span>
                {draft.fileName} ({formatFileSize(draft.fileSize)})
              </span>
              {draft.campusName && (
                <span>
                  · Điểm trường tiếp nhận: <b>{draft.campusName}</b>
                </span>
              )}
            </div>
          </div>
          {errorRows.length > 0 && (
            <label className="checkbox">
              <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
              Chỉ hiện dòng lỗi
            </label>
          )}
        </div>
        {errorRows.length > 0 && (
          <div className="alert alert--danger tr-alert-flat" role="alert">
            <AlertTriangle size={18} />
            <div>File còn {errorRows.length} dòng lỗi. Sửa các dòng này trong file rồi bấm Tải file khác để kiểm tra lại.</div>
          </div>
        )}
        <div className="table-wrap tr-table-flat">
          <table className="table table--grid table--compact">
            <thead>
              <tr>
                <th className="center">Dòng</th>
                <th>Họ tên trẻ</th>
                <th>Ngày sinh</th>
                <th>Giới tính</th>
                <th>Phụ huynh</th>
                <th>Phụ huynh nhận tài khoản</th>
                <th>Số điện thoại</th>
                <th>CCCD phụ huynh</th>
                <th>Dị ứng</th>
                <th className="tr-col-result">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const c = r.payload.child;
                const g = c.guardians[0];
                const a = r.payload.declaration.allergies;
                return (
                  <tr key={r.rowNo} className={r.errors.length ? 'tr-row-error' : ''}>
                    <td className="center">{r.rowNo}</td>
                    <td className="fw-600">{c.fullName || <span className="muted">(trống)</span>}</td>
                    <td className="nowrap">
                      {c.dateOfBirth ? formatDate(c.dateOfBirth) : r.raw.dateOfBirth || <span className="muted">(trống)</span>}
                    </td>
                    <td>{GENDER_LABELS[c.gender] || r.raw.gender || <span className="muted">(trống)</span>}</td>
                    <td>
                      {c.guardians.map((guardian, index) => (
                        <div key={index}>
                          {guardian.fullName} <span className="muted">({guardian.relation})</span>
                        </div>
                      ))}
                    </td>
                    <td>
                      <select
                        className="input"
                        aria-label={`Phụ huynh nhận tài khoản dòng ${r.rowNo}`}
                        value={
                          c.guardians.find((guardian) => guardian.accountRecipient)?.idNumber ||
                          (c.guardians.length === 1 ? g.idNumber : '')
                        }
                        onChange={(e) => selectRecipient(r.rowNo, e.target.value)}
                        disabled={c.guardians.length === 1}
                      >
                        <option value="">Chọn phụ huynh</option>
                        {c.guardians.map((guardian, index) => (
                          <option key={index} value={guardian.idNumber}>
                            {guardian.fullName} · {guardian.relation}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="nowrap">
                      {c.guardians.map((guardian, index) => (
                        <div key={index}>{guardian.phone}</div>
                      ))}
                    </td>
                    <td className="nowrap">
                      {c.guardians.map((guardian, index) => (
                        <div key={index}>{guardian.idNumber || <span className="muted">(trống)</span>}</div>
                      ))}
                    </td>
                    <td className="text-sm">
                      {a.state === DECLARATION_STATE.REPORTED ? a.items.join(', ') : <AllergyStateBadge status={a.state} />}
                    </td>
                    <td>
                      <div className="stack gap-1-5">
                        <ImportRowResultBadge errorCount={r.errors.length} />
                        {r.errors.length > 0 && (
                          <ul className="tr-error-list">
                            {r.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        )}
                        {(r.notes || []).map((n) => (
                          <span key={n} className="text-xs muted">
                            {n}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="page-actions">
        <Button className="wizard-actions__back" icon={ArrowLeft} onClick={() => navigate('/children')}>
          Quay lại
        </Button>
        <Button variant="primary" icon={Upload} disabled={validRows.length === 0 || errorRows.length > 0} onClick={() => setConfirm(true)}>
          Nhập {validRows.length} trẻ
        </Button>
      </div>

      {reupload && (
        <ImportChildrenModal
          initialCampusId={draft.campusId}
          onClose={() => setReupload(false)}
          onChecked={(next) => {
            setDraft(next);
            setOnlyErrors(false);
            setReupload(false);
          }}
        />
      )}

      <ConfirmationModal
        open={confirm}
        title="Nhập danh sách trẻ?"
        message={`Hệ thống sẽ tạo ${validRows.length} hồ sơ trẻ ở trạng thái Chờ xếp lớp${draft.campusName ? ` tại ${draft.campusName}` : ''}, kèm khai báo sức khỏe theo file. Tài khoản phụ huynh kích hoạt sau ở màn Tài khoản phụ huynh.`}
        confirmLabel={`Nhập ${validRows.length} trẻ`}
        onConfirm={doImport}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
