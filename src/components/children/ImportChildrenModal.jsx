import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { ImportDialog } from '@/components/upload/ImportDialog';
import { SelectField } from '@/components/form/Field';
import { ActiveYearNotice } from '@/components/children/ActiveYearNotice';
import { previewEnrollmentImport } from '@/services/children/childrenService';
import { IMPORT_COLUMNS } from '@/models/children/childrenConstants';
import { downloadCsv } from '@/utils/exportCsv';
import { childCampusesOf } from '@/utils/children/childrenPermissions';
import { saveImportDraft } from '@/utils/children/importDraft';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = '.csv,.xlsx,.xls';

const downloadTemplate = () =>
  downloadCsv(
    [
      IMPORT_COLUMNS.map((c) => c.label),
      // Dòng mẫu: hành chính và tiền sử bắt buộc trừ CCCD trẻ, nhóm máu (user chốt 2026-10-22; tuần thai từ 2026-11-04); mỗi giá
      // trị ứng 1 cột IMPORT_COLUMNS.
      [
        ...['Nguyễn Minh An', '15/04/2022', 'Nam', 'Nguyễn Văn Bình', 'Bố', '0912 000 111', '9999 1200 0111'],
        ...['phuhuynh.mau@example.com', 'Không', ''],
        ...['', 'Không', '39', 'Kinh', 'Trẻ em dưới 6 tuổi', '', 'Hải Phòng', 'Phường Thượng Hồng', 'Số 1 đường mẫu'],
        ...['Không', 'Không', 'Không', ''],
        ...['', '', '', '', '', '', '', '', '', '', ''],
      ],
    ],
    'mau-tiep-nhan-tre.csv',
  );

// Quy tắc chi tiết ẩn sau "Xem hướng dẫn chi tiết" (user chốt 14/11/2026); khung chính chỉ giữ 3 ý.
const GUIDE_DETAILS = [
  'Hệ thống kiểm tra từng dòng: thông tin bắt buộc, số điện thoại, số CCCD phụ huynh, email và hồ sơ trùng. Dòng lỗi sửa trong file rồi tải lên lại.',
  'Các cột hành chính và tiền sử là bắt buộc, trừ CCCD trẻ và nhóm máu, vì phiếu khám sức khỏe lấy từ hồ sơ.',
  'Số CCCD phụ huynh gồm 12 chữ số. Để ô ở dạng chữ để Excel không bỏ số 0 đầu.',
  'Có thể nhập thêm phụ huynh 2, 3. Chọn một người nhận tài khoản ở cột CCCD phụ huynh nhận tài khoản hoặc ở bản xem trước.',
  'Số CCCD phụ huynh trùng tài khoản có sẵn: hệ thống dùng họ tên, số điện thoại, email của tài khoản và liên kết người được chọn với trẻ khi kích hoạt.',
  'Trẻ có tiếp xúc với người bệnh lao phải ghi ngày tiếp xúc gần nhất (dd/mm/yyyy). Hệ thống báo Hiệu trưởng và Phó hiệu trưởng điểm trường khi nhập.',
  'File mẫu cũ thiếu cột (vd. "Số CCCD phụ huynh") thì tải lại file mẫu.',
];

// Nút bật/tắt nằm dưới phần chi tiết (không dùng <details> vì summary luôn đứng đầu): mở ra thì nút xuống cuối danh sách.
function ImportGuide() {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <>
      <ul className="tr-import-points">
        <li>Dùng đúng file mẫu của trường, mỗi dòng một trẻ.</li>
        <li>File .xlsx hoặc .csv, tối đa 10MB.</li>
        <li>
          Trẻ nhập xong ở trạng thái <b>Chờ xếp lớp</b>; xếp lớp tại màn Xếp lớp.
        </li>
      </ul>
      {open && (
        <ul id="import-children-guide" className="tr-import-points tr-import-details">
          {GUIDE_DETAILS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      <Button
        variant="link"
        className="tr-import-toggle"
        aria-expanded={open}
        aria-controls="import-children-guide"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Thu gọn hướng dẫn' : 'Xem hướng dẫn chi tiết'} <Chevron size={16} aria-hidden="true" />
      </Button>
    </>
  );
}

/**
 * Bước 1 nhập trẻ từ Excel: chọn điểm trường + file, bấm kiểm tra ⇒ giữ bản xem trước trong bộ nhớ rồi gọi onChecked(draft) để màn gọi
 * chuyển sang màn xem trước. Mount mới mỗi lần mở (màn gọi render có điều kiện) nên không cần tự đặt lại state.
 */
export function ImportChildrenModal({ initialCampusId, onClose, onChecked }) {
  const { user } = useAuth();
  const md = useMasterData();
  const { yearReadOnly } = useSchoolYear();
  const campusOptions = childCampusesOf(user, md.campuses);
  // Có từ 2 điểm trường được tiếp nhận (Hiệu trưởng, PHT được phân 2 điểm trường) ⇒ bắt buộc chọn, không chọn sẵn; 1 điểm trường ⇒ dùng luôn.
  const pickCampus = campusOptions.length > 1;
  const [campusPick, setCampusPick] = useState(() =>
    pickCampus && campusOptions.some((c) => String(c.id) === String(initialCampusId)) ? String(initialCampusId) : '',
  );
  const [campusError, setCampusError] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [unsupported, setUnsupported] = useState('');
  const [reading, setReading] = useState(false);

  const campusId = pickCampus ? campusPick : campusOptions[0]?.id || '';
  const campus = md.campusById(campusId);
  const campusName = campus?.shortName || campus?.name || '';
  const tooLarge = !!file && file.size > MAX_SIZE;

  const takeFile = (next) => {
    setFile(next);
    setUnsupported('');
    setFileError(next.size > MAX_SIZE ? `${next.name} vượt quá 10MB. Chọn file nhỏ hơn.` : '');
  };

  const check = async () => {
    if (pickCampus && !campusId) {
      setCampusError('Chọn điểm trường tiếp nhận trẻ');
      return;
    }
    setFileError('');
    setUnsupported('');
    setReading(true);
    try {
      const preview = await previewEnrollmentImport(file, user);
      if (!preview.supported) {
        setUnsupported(preview.message);
        return;
      }
      const draft = { preview, fileName: file.name, fileSize: file.size, campusId, campusName };
      saveImportDraft(draft);
      onChecked(draft);
    } catch (err) {
      setFileError(err.details?.file ? `${err.message} ${err.details.file}.` : err.message);
    } finally {
      setReading(false);
    }
  };

  return (
    <ImportDialog
      open
      title="Nhập danh sách trẻ từ Excel"
      guide={<ImportGuide />}
      onTemplate={downloadTemplate}
      templateLabel="Tải file mẫu"
      options={
        <>
          <ActiveYearNotice action="Nhập danh sách trẻ" />
          {pickCampus ? (
            <SelectField
              label="Điểm trường tiếp nhận"
              required
              error={campusError}
              hint="Trẻ trong file vào điểm trường này, ở trạng thái Chờ xếp lớp."
              fieldClassName="tr-field-narrow"
              placeholder="Chọn điểm trường"
              options={campusOptions.map((c) => ({ value: String(c.id), label: c.shortName || c.name }))}
              value={campusPick}
              disabled={reading}
              onChange={(e) => {
                setCampusPick(e.target.value);
                setCampusError('');
              }}
            />
          ) : (
            campusName && (
              <div className="text-sm">
                Điểm trường tiếp nhận: <b>{campusName}</b>
              </div>
            )
          )}
        </>
      }
      accept={ACCEPT}
      hint="File .xlsx hoặc .csv theo mẫu, tối đa 10MB."
      maxSize={null}
      uploadLabel="Chọn file"
      fileName={file?.name}
      reading={reading}
      onFile={takeFile}
      confirmLabel="Tải lên và kiểm tra"
      idleLabel="Tải lên và kiểm tra"
      confirmDisabled={!file || tooLarge || yearReadOnly}
      busy={reading}
      onConfirm={check}
      onClose={onClose}
    >
      {fileError && (
        <div className="alert alert--danger mt-12" role="alert">
          <AlertTriangle size={18} />
          <div>{fileError}</div>
        </div>
      )}
      {unsupported && (
        <div className="alert alert--warning mt-12" role="status">
          <AlertTriangle size={18} />
          <div>{unsupported}</div>
        </div>
      )}
    </ImportDialog>
  );
}
