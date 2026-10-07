import { useCallback, useState } from 'react';
import { Plus, Save, Send, Trash2, Printer, Info, AlertTriangle, CheckCircle2, XCircle, Inbox } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import {
  Breadcrumb,
  Modal,
  ConfirmationModal,
  LoadingState,
  EmptyState,
  ErrorState,
  Spinner,
  SearchSelect,
  StatusBadge,
  STATUS_TONES,
  ProgressBar,
  Logo,
  LogoFull,
  SignaturePicker,
  FileUploader,
  ImageUploader,
  ConditionBadge,
  ConditionSelect,
  Avatar,
  ProgressSteps,
  Stepper,
  Pagination,
} from '@/components';
import { TransferStatusBadge } from '@/components/facility-transfer/TransferStatusBadge';
import { RoundStatusBadge, SheetStatusBadge } from '@/components/inventory-inspection/InspectionBadges';
import { TRANSFER_STATUS } from '@/models/facility-transfer/transferConstants';
import { ROUND_STATUS, SHEET_STATUS } from '@/models/inventory-inspection/inspectionConstants';
import { CONDITION_OPTIONS } from '@/models/Asset';
import './ui-kit.css';

const COLOR_GROUPS = [
  {
    title: 'Thương hiệu (lấy từ logo)',
    tokens: ['--brand-blue-700', '--brand-blue-600', '--brand-sky-400', '--brand-sky-300', '--brand-mint-300'],
  },
  { title: 'Hành động chính', tokens: ['--primary', '--primary-600', '--primary-100', '--primary-50', '--primary-25'] },
  {
    title: 'Ngữ nghĩa',
    tokens: [
      '--success',
      '--success-50',
      '--warning',
      '--warning-50',
      '--danger',
      '--danger-50',
      '--purple',
      '--purple-50',
      '--teal',
      '--teal-50',
    ],
  },
  {
    title: 'Chữ, viền, nền',
    tokens: ['--text', '--text-2', '--text-3', '--border', '--border-strong', '--bg', '--surface', '--surface-soft', '--sidebar-bg'],
  },
];

const TONE_MEANING = {
  gray: 'Nháp, đã hủy, không hoạt động',
  orange: 'Đang chờ người khác (chờ bàn giao, chờ kiểm kê)',
  blue: 'Đang thực hiện',
  purple: 'Chờ duyệt / phê duyệt / chênh lệch',
  red: 'Cần xử lý, bị từ chối, yêu cầu làm lại',
  green: 'Hoàn thành, đã duyệt',
  teal: 'Nhãn thông tin (vai trò)',
};

const tokenValue = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function Section({ id, title, children, code }) {
  return (
    <section className="card uikit-section" id={id}>
      <div className="card__header">
        <div className="card__title">{title}</div>
        <a href={`#${id}`} className="muted text-sm">
          #{id}
        </a>
      </div>
      <div className="card__body">
        {children}
        {code && (
          <pre className="uikit-code">
            <code>{code.trim()}</code>
          </pre>
        )}
      </div>
    </section>
  );
}

const NAV = [
  ['colors', 'Màu sắc'],
  ['typography', 'Chữ'],
  ['buttons', 'Nút'],
  ['forms', 'Form'],
  ['status', 'Trạng thái'],
  ['alerts', 'Thông báo'],
  ['table', 'Bảng & thẻ'],
  ['states', 'Loading / Empty / Error'],
  ['flow', 'Tiến trình & phân trang'],
  ['overlays', 'Modal & Toast'],
  ['domain', 'Chữ ký, upload, tài sản'],
  ['brand', 'Logo'],
];

/** Living style guide: every shared token / component with a copy-paste snippet. */
export default function UiKitPage() {
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [select, setSelect] = useState(null);
  const [condition, setCondition] = useState('GOOD');
  const [signature, setSignature] = useState(null);
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]);
  const [step, setStep] = useState(1);
  const [page, setPage] = useState(1);
  const onSignature = useCallback(({ url }) => setSignature(url), []);

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Thư viện giao diện (UI Kit)' }]} />
      <h1 className="page__title">Thư viện giao diện CareNest</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Trang dành cho developer. Mọi màn hình mới phải dùng lại các token và component dưới đây. Quy ước chi tiết: <code>DESIGN.md</code>{' '}
          ở thư mục gốc.
        </div>
      </div>

      <nav className="uikit-nav">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="btn btn--sm">
            {label}
          </a>
        ))}
      </nav>

      <div className="stack" style={{ gap: 16 }}>
        <Section
          id="colors"
          title="Màu sắc (design tokens)"
          code={`/* Chỉ dùng biến, không viết mã màu trực tiếp */\n.my-box { color: var(--text-2); background: var(--primary-25); border: 1px solid var(--border); }`}
        >
          {COLOR_GROUPS.map((g) => (
            <div key={g.title} className="mb-16">
              <div className="subsection-title">{g.title}</div>
              <div className="uikit-swatches">
                {g.tokens.map((t) => (
                  <div key={t} className="uikit-swatch">
                    <div className="uikit-swatch__color" style={{ background: `var(${t})` }} />
                    <code>{t}</code>
                    <span className="muted">{tokenValue(t)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section
          id="typography"
          title="Chữ"
          code={`<h1 className="page__title">Tiêu đề trang</h1>\n<h2 className="section-title">Tiêu đề khối</h2>\n<div className="subsection-title">Tiêu đề nhỏ</div>\n<span className="muted">Chữ phụ</span>`}
        >
          <div className="page__title" style={{ margin: 0 }}>
            Tiêu đề trang – 28px / 700
          </div>
          <div className="section-title">Tiêu đề khối – 18px / 600</div>
          <div className="subsection-title">Tiêu đề nhỏ – 15px / 600</div>
          <p style={{ margin: '4px 0' }}>Nội dung – 14px / 400, font Be Vietnam Pro</p>
          <p className="text-2" style={{ margin: '4px 0' }}>
            Chữ phụ .text-2
          </p>
          <p className="muted" style={{ margin: '4px 0' }}>
            Chữ mờ .muted
          </p>
        </Section>

        <Section
          id="buttons"
          title="Nút"
          code={`<button className="btn btn--primary"><Send size={16} /> Gửi phiếu</button>\n<button className="btn">Quay lại</button>\n<button className="btn btn--outline-danger"><Trash2 size={16} /> Xóa</button>\n<button className="btn btn--primary btn--sm">Nhỏ</button>  <button className="btn btn--primary btn--lg">Lớn</button>`}
        >
          <div className="row row--wrap">
            <button className="btn btn--primary">
              <Send size={16} /> Gửi phiếu (primary)
            </button>
            <button className="btn">Quay lại (default)</button>
            <button className="btn btn--outline-primary">
              <Printer size={16} /> In phiếu
            </button>
            <button className="btn btn--warning">Yêu cầu điều chỉnh</button>
            <button className="btn btn--danger">Hủy phiếu</button>
            <button className="btn btn--outline-danger">
              <Trash2 size={16} /> Xóa
            </button>
            <button className="btn btn--success">Hoàn thành</button>
            <button className="btn btn--ghost">Ghost</button>
            <button className="btn btn--primary" disabled>
              Disabled
            </button>
            <button className="btn btn--primary">
              <Spinner small /> Đang gửi...
            </button>
          </div>
          <div className="row row--wrap mt-12">
            <button className="btn btn--primary btn--sm">
              <Plus size={15} /> Nhỏ (sm)
            </button>
            <button className="btn btn--primary">
              <Save size={16} /> Thường
            </button>
            <button className="btn btn--primary btn--lg">Lớn (lg)</button>
          </div>
          <div className="alert alert--warning mt-12 text-sm">
            <AlertTriangle size={16} />
            <div>
              Nhãn nút bắt đầu bằng <b>động từ</b> (Gửi phiếu, Xác nhận nhận, Lưu nháp). Không dùng “OK”, “Submit”. Mỗi vùng hành động (đầu
              trang, chân trang, modal) chỉ 1 nút primary; In / Xuất luôn là nút thường.
            </div>
          </div>
        </Section>

        <Section
          id="forms"
          title="Form"
          code={`<div className="field">\n  <label className="field__label" htmlFor="x">Lý do<span className="req">*</span></label>\n  <input id="x" className={\`input \${error ? 'input--error' : ''}\`} />\n  {error && <span className="field__error">{error}</span>}\n</div>\n\n<div className="form-row">  /* nhãn bên trái, ô bên phải */\n  <label className="form-row__label">Ngày lập</label>\n  <div className="form-row__control"><input className="input" type="date" /></div>\n</div>`}
        >
          <div className="grid-3">
            <div className="field">
              <label className="field__label" htmlFor="uk-input">
                Ô nhập<span className="req">*</span>
              </label>
              <input id="uk-input" className="input" placeholder="Nhập nội dung..." />
              <span className="field__hint">Gợi ý định dạng đặt ở đây</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="uk-err">
                Ô báo lỗi
              </label>
              <input id="uk-err" className="input input--error" defaultValue="0" />
              <span className="field__error">Số lượng phải lớn hơn 0</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="uk-select">
                Select
              </label>
              <select id="uk-select" className="select">
                <option>Campus 1</option>
                <option>Campus 2</option>
              </select>
            </div>
            <div className="field">
              <span className="field__label">SearchSelect (có tìm kiếm)</span>
              <SearchSelect
                value={select}
                onChange={setSelect}
                placeholder="Chọn giáo viên..."
                options={[
                  { value: 'a', label: 'Nguyễn Văn An' },
                  { value: 'b', label: 'Trần Thị Mai' },
                ]}
              />
            </div>
            <div className="field">
              <span className="field__label">ConditionSelect</span>
              <ConditionSelect value={condition} onChange={setCondition} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="uk-text">
                Textarea
              </label>
              <textarea id="uk-text" className="textarea" rows={2} />
            </div>
          </div>
          <div className="row row--wrap mt-12" style={{ gap: 20 }}>
            <label className="radio">
              <input type="radio" name="uk-r" defaultChecked /> Radio
            </label>
            <label className="checkbox">
              <input type="checkbox" defaultChecked /> Checkbox
            </label>
          </div>
        </Section>

        <Section
          id="status"
          title="Trạng thái (StatusBadge)"
          code={`// 1 status = 1 tông màu theo quy ước bên dưới\nexport const MyStatusBadge = createStatusBadge(\n  { DRAFT: ['gray', FileEdit], PENDING: ['orange', Clock], DONE: ['green', CheckCircle2] },\n  MY_STATUS_LABELS,\n);\n<MyStatusBadge status={item.status} />`}
        >
          <table className="table table--compact mb-16">
            <thead>
              <tr>
                <th>Tông</th>
                <th>Ý nghĩa (dùng thống nhất cho mọi module)</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_TONES.map((t) => (
                <tr key={t}>
                  <td>
                    <StatusBadge tone={t} label={t} />
                  </td>
                  <td>{TONE_MEANING[t]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="subsection-title">Ví dụ đang dùng</div>
          <div className="row row--wrap mb-8">
            {Object.values(TRANSFER_STATUS).map((s) => (
              <TransferStatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="row row--wrap mb-8">
            {Object.values(ROUND_STATUS).map((s) => (
              <RoundStatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="row row--wrap mb-8">
            {Object.values(SHEET_STATUS).map((s) => (
              <SheetStatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="row row--wrap">
            {CONDITION_OPTIONS.map((c) => (
              <ConditionBadge key={c.value} value={c.value} />
            ))}
          </div>
          <div className="mt-12" style={{ maxWidth: 320 }}>
            <ProgressBar value={7} total={10} />
            <ProgressBar value={10} total={10} tone="green" />
          </div>
        </Section>

        <Section
          id="alerts"
          title="Thông báo trong trang"
          code={`<div className="alert alert--warning"><AlertTriangle size={18} /><div>Nội dung</div></div>`}
        >
          <div className="stack" style={{ gap: 8 }}>
            <div className="alert alert--info">
              <Info size={18} />
              <div>
                <b>info</b> – hướng dẫn, giải thích quy trình
              </div>
            </div>
            <div className="alert alert--success">
              <CheckCircle2 size={18} />
              <div>
                <b>success</b> – kết quả tốt, đã hoàn tất
              </div>
            </div>
            <div className="alert alert--warning">
              <AlertTriangle size={18} />
              <div>
                <b>warning</b> – cần chú ý, có hệ quả (khóa dữ liệu…)
              </div>
            </div>
            <div className="alert alert--danger">
              <XCircle size={18} />
              <div>
                <b>danger</b> – lỗi, bị chặn, cần xử lý ngay
              </div>
            </div>
            <div className="alert alert--purple">
              <Info size={18} />
              <div>
                <b>purple</b> – việc chờ duyệt / chênh lệch
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="table"
          title="Bảng & thẻ"
          code={`<div className="card card--soft-header">\n  <div className="card__header"><div className="card__title">Tiêu đề</div></div>\n  <div className="card__body">\n    <div className="table-wrap"><table className="table">...</table></div>\n  </div>\n</div>`}
        >
          <div className="card card--soft-header">
            <div className="card__header">
              <div className="card__title">Danh sách tài sản</div>
            </div>
            <div className="card__body">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="center">STT</th>
                      <th>Mã</th>
                      <th>Tên tài sản</th>
                      <th className="center">Số lượng</th>
                      <th className="center">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="center">1</td>
                      <td>TS0001</td>
                      <td>Bàn học mầm non</td>
                      <td className="center">5</td>
                      <td className="center">
                        <ConditionBadge value="GOOD" />
                      </td>
                    </tr>
                    <tr>
                      <td className="center">2</td>
                      <td>TS0002</td>
                      <td>Ghế nhựa</td>
                      <td className="center">10</td>
                      <td className="center">
                        <ConditionBadge value="NEED_REPAIR" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="stat-grid mt-16" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card stat-card--blue">
              <div className="stat-card__value">12</div>
              <div className="stat-card__label">stat-card--blue</div>
            </div>
            <div className="stat-card stat-card--orange">
              <div className="stat-card__value">3</div>
              <div className="stat-card__label">stat-card--orange</div>
            </div>
            <div className="stat-card stat-card--green">
              <div className="stat-card__value">8</div>
              <div className="stat-card__label">stat-card--green</div>
            </div>
          </div>
        </Section>

        <Section
          id="states"
          title="Loading / Empty / Error"
          code={`{loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={reload} /> : !items.length ? <EmptyState title="Chưa có dữ liệu" /> : ...}`}
        >
          <div className="grid-3">
            <div className="card">
              <LoadingState />
            </div>
            <div className="card">
              <EmptyState
                icon={Inbox}
                title="Chưa có phiếu"
                description="Tạo phiếu đầu tiên."
                action={<button className="btn btn--primary btn--sm">Tạo phiếu</button>}
              />
            </div>
            <div className="card">
              <ErrorState error={{ message: 'Không kết nối được máy chủ' }} onRetry={() => toast.info('Thử lại')} />
            </div>
          </div>
        </Section>

        <Section
          id="flow"
          title="Tiến trình, wizard, phân trang"
          code={`<ProgressSteps steps={[{ label: 'Tạo phiếu', sub: '06/10/2026', done: true }, { label: 'Bàn giao', warn: true }, { label: 'Hoàn thành' }]} />
<Stepper steps={WIZARD_STEPS} current={step} maxReached={2} onStepClick={setStep} />
<Pagination page={page} total={items.length} onChange={setPage} unit="phiếu" />   // rows = paginate(items, page)`}
        >
          <div className="subsection-title">ProgressSteps (đầu trang chi tiết)</div>
          <div className="card card__body mb-16">
            <ProgressSteps
              steps={[
                { label: 'Tạo phiếu', sub: 'Nguyễn Thị Lan · 06/10/2026', done: true },
                { label: 'Bàn giao', sub: 'Nguyễn Văn An · 07/10/2026', done: true },
                { label: 'Xác nhận nhận', sub: 'Có chênh lệch', warn: true },
                { label: 'Hoàn thành' },
              ]}
            />
          </div>
          <div className="subsection-title">Stepper (wizard)</div>
          <div className="card stepper-card mb-16">
            <Stepper
              steps={['Thông tin chung', 'Chọn tài sản', 'Chọn người thực hiện', 'Xác nhận và gửi']}
              current={step}
              maxReached={2}
              onStepClick={setStep}
            />
          </div>
          <div className="subsection-title">Pagination (chân bảng)</div>
          <div className="card">
            <Pagination page={page} total={21} onChange={setPage} unit="phiếu" />
          </div>
        </Section>

        <Section
          id="overlays"
          title="Modal, xác nhận, toast"
          code={`const toast = useToast();\ntoast.success('Đã lưu');  toast.error(err.message, 'Không lưu được');\n\n<ConfirmationModal open={open} title="Hủy phiếu?" message="..." confirmLabel="Hủy phiếu" danger\n  onConfirm={doCancel} onClose={() => setOpen(false)} />`}
        >
          <div className="row row--wrap">
            <button className="btn" onClick={() => setModal(true)}>
              Mở Modal
            </button>
            <button className="btn btn--outline-danger" onClick={() => setConfirm(true)}>
              Mở ConfirmationModal (danger)
            </button>
            <button className="btn" onClick={() => toast.success('Đã lưu nháp phiếu LC009', 'Thành công')}>
              Toast success
            </button>
            <button className="btn" onClick={() => toast.error('Số lượng vượt tồn kho', 'Không gửi được')}>
              Toast error
            </button>
            <button className="btn" onClick={() => toast.warning('Phòng đang kiểm kê')}>
              Toast warning
            </button>
            <button className="btn" onClick={() => toast.info('Đã đổi tài khoản')}>
              Toast info
            </button>
          </div>
          <Modal
            open={modal}
            title="Tiêu đề modal"
            onClose={() => setModal(false)}
            footer={
              <>
                <button className="btn" onClick={() => setModal(false)}>
                  Quay lại
                </button>
                <button className="btn btn--primary" onClick={() => setModal(false)}>
                  Xác nhận
                </button>
              </>
            }
          >
            Nội dung modal. Esc hoặc bấm nền để đóng.
          </Modal>
          <ConfirmationModal
            open={confirm}
            title="Hủy phiếu luân chuyển?"
            message="Hành động nguy hiểm luôn cần xác nhận và nêu rõ hệ quả."
            confirmLabel="Hủy phiếu"
            danger
            onConfirm={() => setConfirm(false)}
            onClose={() => setConfirm(false)}
          />
        </Section>

        <Section
          id="domain"
          title="Chữ ký, upload, tài sản"
          code={`<SignaturePicker value={url} onChange={({ url }) => setUrl(url)} />            // dạng tab (PHT)\n<SignaturePicker variant="compact" value={url} onChange={onSignature} />   // dạng gọn (giáo viên)\n<FileUploader files={files} onChange={setFiles} />\n<ImageUploader images={images} onChange={setImages} max={3} />`}
        >
          <div className="grid-2">
            <div>
              <div className="subsection-title">SignaturePicker (compact)</div>
              <SignaturePicker variant="compact" value={signature} onChange={onSignature} />
            </div>
            <div className="stack">
              <div className="subsection-title">FileUploader</div>
              <FileUploader files={files} onChange={setFiles} />
              <div className="subsection-title">ImageUploader (ảnh bằng chứng)</div>
              <ImageUploader images={images} onChange={setImages} />
            </div>
          </div>
        </Section>

        <Section
          id="brand"
          title="Logo"
          code={`<Logo />            // sidebar\n<Logo collapsed />  // chỉ biểu tượng\n<LogoFull width={160} />  // logo gốc (đăng nhập, splash)\n<PrintHeader />     // đầu mọi bản in A4`}
        >
          <div className="row row--wrap" style={{ gap: 40, alignItems: 'center' }}>
            <Logo />
            <Logo collapsed />
            <LogoFull width={140} />
            <div className="row">
              <Avatar user={{ fullName: 'Nguyễn Thị Lan', avatarColor: '#7c5cff' }} size="lg" />
              <Avatar user={{ fullName: 'Nguyễn Văn An', avatarColor: '#1f6feb' }} />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
