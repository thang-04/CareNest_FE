import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Upload,
  LayoutGrid,
  Info,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { importChildren, previewEnrollmentImport } from '@/services/children/childrenService';
import { GENDER_LABELS } from '@/models/School';
import { AllergyStateBadge, ImportRowResultBadge } from '@/components/children/ChildBadges';
import { DECLARATION_STATE, IMPORT_COLUMNS } from '@/models/children/childrenConstants';
import { downloadCsv } from '@/utils/exportCsv';
import { formatDate, formatFileSize } from '@/utils/format';
import { canEnrollChild, childCampusesOf } from '@/utils/children/childrenPermissions';
import { defaultCampusId } from '@/utils/children/childrenHelpers';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';
import { LottiePlayer } from '@/components/ui/LottiePlayer';

const loadDocumentScan = () => import('@/assets/lottie/document-scan.json');

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = '.csv,.xlsx,.xls';

const downloadTemplate = () =>
  downloadCsv(
    [
      IMPORT_COLUMNS.map((c) => c.label),
      // Dòng mẫu: hành chính và tiền sử bắt buộc trừ CCCD trẻ, nhóm máu (user chốt 2026-10-22); mỗi giá trị ứng 1 cột IMPORT_COLUMNS.
      [
        ...['Nguyễn Minh An', '15/04/2022', 'Nam', 'Nguyễn Văn Bình', 'Bố', '0912 000 111', '9999 1200 0111'],
        ...['phuhuynh.mau@example.com', 'Không', ''],
        ...['', 'Không', '', 'Kinh', 'Trẻ em dưới 6 tuổi', '', 'Hải Phòng', 'Phường Thượng Hồng', 'Số 1 đường mẫu'],
        ...['Không', 'Không', 'Không', ''],
      ],
    ],
    'mau-tiep-nhan-tre.csv',
  );

export default function ImportChildrenPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const inputRef = useRef(null);
  const [campusPick, setCampusPick] = useState(null);
  const [campusError, setCampusError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [imported, setImported] = useState(null);

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

  // Hiệu trưởng, PHT toàn trường chọn điểm trường cho cả file; PHT một điểm trường dùng điểm trường của mình (BE kiểm lại).
  const campusOptions = childCampusesOf(user, md.campuses);
  const pickCampus = campusOptions.length > 1;
  const campusId = campusPick ?? defaultCampusId(campusOptions, user);
  const campusName = md.campusById(campusId)?.shortName || md.campusById(campusId)?.name || '';

  const readFile = async (f) => {
    if (!f) return;
    setFileError('');
    setPreview(null);
    setFile(f);
    if (f.size > MAX_SIZE) {
      setFileError(`${f.name} vượt quá 10MB. Chọn file nhỏ hơn.`);
      return;
    }
    setReading(true);
    try {
      setPreview(await previewEnrollmentImport(f, user));
      setOnlyErrors(false);
    } catch (err) {
      setFileError(err.details?.file ? `${err.message} ${err.details.file}.` : err.message);
    } finally {
      setReading(false);
    }
  };

  const rows = preview?.rows || [];
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const validRows = rows.filter((r) => r.errors.length === 0);
  const shown = onlyErrors ? errorRows : rows;

  const askImport = () => {
    if (pickCampus && !campusId) setCampusError('Chọn điểm trường tiếp nhận trẻ');
    else setConfirm(true);
  };

  const doImport = async () => {
    try {
      const result = await importChildren(
        validRows.map((r) => r.payload),
        user,
        campusId || undefined,
      );
      setImported(result);
      setConfirm(false);
      toast.success(`Đã nhập ${result.created} hồ sơ trẻ.`, 'Nhập danh sách thành công');
    } catch (err) {
      setConfirm(false);
      if (err.details?.campusId) setCampusError(err.details.campusId);
      toast.error(err, 'Không nhập được danh sách');
    }
  };

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

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Nhập từ Excel')} />
      <div className="page__head">
        <h1 className="page__title">Nhập danh sách trẻ từ Excel</h1>
        <button className="btn" onClick={downloadTemplate}>
          <Download size={16} /> Tải file mẫu
        </button>
      </div>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Dùng file theo mẫu của trường (.xlsx hoặc .csv), mỗi dòng một trẻ. Hệ thống kiểm tra từng dòng: thông tin bắt buộc, số điện thoại,
          số CCCD phụ huynh (12 chữ số; để ô dạng chữ để Excel không bỏ số 0 đầu), email và hồ sơ trùng. File mẫu cũ chưa có cột &quot;Số
          CCCD phụ huynh&quot; thì tải lại file mẫu. Sửa các dòng lỗi trong file rồi tải lên lại. Sau khi nhập, trẻ cần được xếp lớp để hoàn
          tất tiếp nhận. Số CCCD phụ huynh trùng tài khoản phụ huynh có sẵn thì dùng họ tên, số điện thoại, email của tài khoản và liên kết
          trẻ vào tài khoản đó. Các cột hành chính và tiền sử bắt buộc (trừ CCCD trẻ, nhóm máu) vì phiếu khám sức khỏe lấy từ hồ sơ; file
          mẫu cũ thiếu cột thì tải lại file mẫu. Trẻ khai có tiếp xúc với người bệnh lao thì phải ghi ngày tiếp xúc gần nhất (dd/mm/yyyy);
          hệ thống báo Hiệu trưởng và Phó hiệu trưởng điểm trường khi nhập.
        </div>
      </div>

      <section className="card wizard-card">
        {pickCampus && (
          <FormField
            label="Điểm trường tiếp nhận"
            required
            error={campusError}
            hint="Trẻ trong file vào điểm trường này, ở trạng thái Chờ xếp lớp."
            className="tr-field-narrow mb-16"
          >
            <select
              className="select"
              value={campusId}
              onChange={(e) => {
                setCampusPick(e.target.value);
                setCampusError('');
              }}
            >
              <option value="">Chọn điểm trường</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <div
          className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Chọn file danh sách trẻ"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            readFile(e.dataTransfer.files?.[0]);
          }}
        >
          {reading ? (
            <LottiePlayer load={loadDocumentScan} speed={0.6} className="import-reading" fallback={<Spinner />} />
          ) : (
            <UploadCloud size={30} className="text-primary" />
          )}
          <div>
            Kéo thả file hoặc <span className="text-primary">chọn file</span>
          </div>
          <div className="muted text-sm">(.xlsx hoặc .csv theo mẫu – tối đa 10MB)</div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        {file && (
          <div className="file-row mt-12">
            <FileSpreadsheet size={26} color="var(--file-sheet)" />
            <div className="flex-1 min-w-0">
              <div className="file-row__name">{file.name}</div>
              <div className="muted text-sm">{formatFileSize(file.size)}</div>
            </div>
          </div>
        )}
        {fileError && (
          <div className="alert alert--danger mt-12" role="alert">
            <AlertTriangle size={18} />
            <div>{fileError}</div>
          </div>
        )}
        {preview && !preview.supported && (
          <div className="alert alert--warning mt-12" role="status">
            <AlertTriangle size={18} />
            <div>{preview.message}</div>
          </div>
        )}
      </section>

      {preview?.supported && (
        <section className="card">
          <div className="card__header row row--between row--wrap gap-3">
            <div className="row row--wrap gap-2">
              <h2 className="card__title">Kết quả kiểm tra</h2>
              <span className="chip chip--blue">{rows.length} dòng</span>
              <span className="chip chip--green">{validRows.length} hợp lệ</span>
              {errorRows.length > 0 && <span className="chip chip--red">{errorRows.length} dòng lỗi</span>}
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
              <div>File còn {errorRows.length} dòng lỗi. Sửa các dòng này trong file rồi tải lên lại để nhập.</div>
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
                        {g.fullName} {g.relation && <span className="muted">({g.relation})</span>}
                      </td>
                      <td className="nowrap">{g.phone}</td>
                      <td className="nowrap">{g.idNumber || <span className="muted">(trống)</span>}</td>
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
      )}

      <div className="page-actions">
        <button className="btn wizard-actions__back" onClick={() => navigate('/children')}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        {preview?.supported && (
          <button className="btn btn--primary" disabled={validRows.length === 0 || errorRows.length > 0} onClick={askImport}>
            <Upload size={16} /> Nhập {validRows.length} trẻ
          </button>
        )}
      </div>

      <ConfirmationModal
        open={confirm}
        title="Nhập danh sách trẻ?"
        message={`Hệ thống sẽ tạo ${validRows.length} hồ sơ trẻ ở trạng thái Chờ xếp lớp${pickCampus ? ` tại ${campusName}` : ''}, kèm khai báo sức khỏe theo file. Tài khoản phụ huynh kích hoạt sau ở màn Tài khoản phụ huynh.`}
        confirmLabel={`Nhập ${validRows.length} trẻ`}
        onConfirm={doImport}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
