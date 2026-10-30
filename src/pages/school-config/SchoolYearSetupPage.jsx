import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, FileSpreadsheet, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useSchoolYearItem, useSchoolYears, useYearReadiness } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Stepper } from '@/components/ui/Stepper';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { copySourcesFor } from '@/components/school-config/CopyClassesModal';
import { ActivateYearModal, YearReadinessCard } from '@/components/school-config/YearReadiness';
import { Tabs } from '@/components/ui/Tabs';
import { YearSetupImportPanel } from '@/components/school-config/YearSetupImportPanel';
import RoomListPage from '@/pages/school-config/RoomListPage';
import AgeGroupsClassesPage from '@/pages/school-config/AgeGroupsClassesPage';
import TeacherAssignmentPage from '@/pages/school-config/TeacherAssignmentPage';
import { copyYear, saveSchoolYear, saveSemester } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import { canConfigureSchool } from '@/utils/school-config/schoolConfigPermissions';
import {
  SEMESTER_FIELDS,
  errorsAfterChange,
  hasErrors,
  semesterOf,
  validateSchoolYear,
  validateSemester,
} from '@/utils/school-config/schoolConfigValidation';
import {
  COPY_PARTS,
  SETUP_STEPS,
  completedSteps,
  copySummary,
  firstOpenStep,
  readCopyResult,
  shiftToYear,
  suggestSemesters,
  stepOfPart,
  suggestNextYear,
  writeCopyResult,
} from '@/utils/school-config/yearSetup';
import { yearCrumbs } from '@/utils/school-config/breadcrumbs';
import VicePrincipalAssignmentPage from '@/pages/school-config/VicePrincipalAssignmentPage';
import CutoffSettingPage from '@/pages/school-config/CutoffSettingPage';
import YearPlacementPage from '@/pages/school-config/YearPlacementPage';
import '@/styles/modules/school-config.css';

const NO_COPY = '';
const SEMESTER_KEYS = SEMESTER_FIELDS.map(([k]) => k);
const SEMESTER_INPUTS = [
  ['semester1Start', 'Học kỳ I từ ngày'],
  ['semester1End', 'Học kỳ I đến ngày'],
  ['semester2Start', 'Học kỳ II từ ngày'],
  ['semester2End', 'Học kỳ II đến ngày'],
];
const hasSemester = (f) => SEMESTER_KEYS.some((k) => f[k]);

/** Bước 1: thông tin năm học + chọn năm nguồn; lưu xong thì chép các phần đã chọn rồi sang bước 2. */
function InfoStep({ year, years, user, onSaved }) {
  const toast = useToast();
  const others = years.filter((y) => y.id !== year?.id);
  const planned = !year || year.status === YEAR_STATUS.PLANNED;
  const nameLocked = !!year && !planned;
  const [form, setForm] = useState(() =>
    year
      ? { name: year.name, startDate: year.startDate, endDate: year.endDate, ...semesterOf(year) }
      : { ...suggestNextYear(years), ...semesterOf(null) },
  );
  const sources = useMemo(
    () => (planned ? copySourcesFor(years, { id: year?.id ?? null, startDate: form.startDate }) : []),
    [planned, years, year?.id, form.startDate],
  );
  // Năm mới: mặc định chép từ năm gần nhất; năm đã tạo (quay lại bước 1) thì mặc định không chép lại
  const [sourceId, setSourceId] = useState(() => (year ? NO_COPY : sources[0]?.id || NO_COPY));
  const [parts, setParts] = useState(() => new Set(COPY_PARTS.map((p) => p.key)));
  const [semesterTouched, setSemesterTouched] = useState(!!year?.semester1Start);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const source = sources.find((y) => y.id === sourceId) || null;

  // Học kỳ điền sẵn (theo năm nguồn, không có thì theo ngày bắt đầu/kết thúc năm học) cho tới khi người dùng tự sửa
  useEffect(() => {
    if (semesterTouched) return;
    const shifted = source?.semester1Start
      ? Object.fromEntries(SEMESTER_KEYS.map((k) => [k, shiftToYear(source[k], source.startDate, form.startDate)]))
      : suggestSemesters(form.startDate, form.endDate) || semesterOf(null);
    setForm((f) => (SEMESTER_KEYS.every((k) => f[k] === shifted[k]) ? f : { ...f, ...shifted }));
  }, [source, form.startDate, form.endDate, semesterTouched]);

  const validate = (f = form) => {
    const e = validateSchoolYear(f, others, { creating: !year });
    // Học kỳ không bắt buộc ở bước này; đã nhập ngày nào thì phải đủ và đúng cả 4 ngày
    if (hasSemester(f) && !e.startDate && !e.endDate) Object.assign(e, validateSemester(f, f));
    if (source && parts.size === 0) e.parts = 'Chọn ít nhất một phần để sao chép';
    return e;
  };
  const set = (patch) => {
    if (SEMESTER_KEYS.some((k) => k in patch)) setSemesterTouched(true);
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => errorsAfterChange(e, patch, { ...form, ...patch }, {}));
  };
  const blurCheck = (field) => {
    const e = validate();
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };
  const togglePart = (key) => {
    setParts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setErrors(({ parts: _p, ...rest }) => rest);
  };

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      const changed = !year || form.name !== year.name || form.startDate !== year.startDate || form.endDate !== year.endDate;
      const saved = changed
        ? await saveSchoolYear(year?.id || null, { name: form.name, startDate: form.startDate, endDate: form.endDate }, user)
        : year;
      if (hasSemester(form) && SEMESTER_KEYS.some((k) => form[k] !== (year?.[k] || ''))) {
        try {
          await saveSemester(saved.id, semesterOf(form), user);
        } catch (err) {
          toast.error(err, 'Chưa lưu được thời gian học kỳ');
        }
      }
      let result = null;
      if (source && parts.size) {
        try {
          result = await copyYear(saved.id, { sourceYearId: source.id, parts: [...parts] }, user);
          const summary = copySummary(result);
          toast.success(summary ? `Đã sao chép ${summary}.` : 'Không có gì mới để sao chép.', `Từ năm học ${source.name}`);
        } catch (err) {
          toast.error(err, 'Không sao chép được từ năm cũ');
        }
      } else if (changed) {
        toast.success('Đã lưu thay đổi.', `Năm học ${saved.name}`);
      }
      onSaved(saved, result);
    } catch (err) {
      const d = err.details;
      setErrors(d?.semester ? { endDate: d.semester } : d || { _form: err.message });
      setSaving(false);
    }
  };

  return (
    <>
      <section className="card wizard-card">
        <h2 className="section-title">Thông tin năm học</h2>
        {errors._form && (
          <div className="alert alert--danger mb-12" role="alert">
            {errors._form}
          </div>
        )}
        <div className="grid-3">
          <FormField label="Tên năm học" required error={errors.name}>
            <input
              className="input"
              value={form.name}
              disabled={nameLocked}
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => blurCheck('name')}
            />
          </FormField>
          <FormField label="Ngày bắt đầu" required error={errors.startDate}>
            <DateInput value={form.startDate} onChange={(v) => set({ startDate: v })} onBlur={() => blurCheck('startDate')} />
          </FormField>
          <FormField label="Ngày kết thúc" required error={errors.endDate}>
            <DateInput
              min={form.startDate}
              value={form.endDate}
              onChange={(v) => set({ endDate: v })}
              onBlur={() => blurCheck('endDate')}
            />
          </FormField>
        </div>
      </section>

      <section className="card wizard-card">
        <h2 className="section-title">Thời gian học kỳ</h2>
        <div className="grid-2">
          {SEMESTER_INPUTS.map(([key, label]) => (
            <FormField key={key} label={label} error={errors[key]}>
              <DateInput
                min={form.startDate}
                max={form.endDate}
                value={form[key]}
                onChange={(v) => set({ [key]: v })}
                onBlur={() => blurCheck(key)}
              />
            </FormField>
          ))}
        </div>
      </section>

      {planned && (
        <section className="card wizard-card">
          <h2 className="section-title">Lấy dữ liệu từ năm cũ</h2>
          <div className="grid-3">
            <FormField label="Năm học nguồn">
              <select className="select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value={NO_COPY}>Không sao chép, nhập từ đầu</option>
                {sources.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} · {y.classCount} lớp
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          {source && (
            <FormField label="Sao chép và điền sẵn vào các bước" required error={errors.parts}>
              <div className="sc-setup__parts">
                {COPY_PARTS.map((p) => (
                  <label key={p.key} className="checkbox">
                    <input type="checkbox" checked={parts.has(p.key)} onChange={() => togglePart(p.key)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </FormField>
          )}
        </section>
      )}

      <div className="page-actions">
        <Link className="btn wizard-actions__back" to="/school/years">
          <ArrowLeft size={16} /> Về danh sách
        </Link>
        <button className="btn btn--primary" onClick={submit} disabled={saving}>
          {saving ? <Spinner small /> : <Save size={16} />} Lưu và tiếp tục
        </button>
      </div>
    </>
  );
}

/** Dòng không chép được ở bước này (GV đã nghỉ, phòng đã dùng...): lỗi đỏ để Hiệu trưởng xử lý tay. */
function CopyIssues({ copy, step, onDismiss }) {
  if (!copy) return null;
  const rows = (copy.skipped || []).filter((s) => stepOfPart(s.part) === step);
  const noRoom = step === 1 ? copy.withoutRoom || [] : [];
  if (!rows.length && !noRoom.length) return null;
  return (
    <div className="alert alert--danger mb-12 sc-setup__issues" role="alert">
      <AlertTriangle size={18} />
      <div>
        <b>Chưa sao chép được từ năm cũ:</b>
        <ul>
          {noRoom.length > 0 && <li>Lớp chưa có phòng (phòng cũ đã dùng hoặc ngừng sử dụng): {noRoom.join(', ')}</li>}
          {rows.map((s, i) => (
            <li key={i}>
              <b>{s.name}</b>: {s.reason}
            </li>
          ))}
        </ul>
      </div>
      <button className="btn btn--sm" onClick={onDismiss}>
        Đã xử lý
      </button>
    </div>
  );
}

// Bước 2 (Cần 30/10/2026): xem xét lại Phòng ban trước, rồi tạo lớp ở màn Nhóm tuổi & lớp
const ROOM_PARTS = [
  { key: 0, label: '1. Phòng ban' },
  { key: 1, label: '2. Nhóm tuổi & lớp' },
];

function StepBody({ step, part, onPart, year, years, onActivated, onChanged }) {
  const [activating, setActivating] = useState(null);
  const [importing, setImporting] = useState(null);
  // Nhập Excel xong ⇒ dựng lại màn nhúng để đọc dữ liệu mới
  const [version, setVersion] = useState(0);
  const importButton = (mode) =>
    year?.status !== YEAR_STATUS.CLOSED && (
      <button type="button" className="btn btn--sm" onClick={() => setImporting(mode)}>
        <FileSpreadsheet size={16} /> Nhập từ Excel
      </button>
    );
  const importPanel = (
    <YearSetupImportPanel
      open={!!importing}
      mode={importing}
      yearId={year?.id}
      onClose={(changed) => {
        setImporting(null);
        if (changed) {
          setVersion((v) => v + 1);
          onChanged?.();
        }
      }}
    />
  );
  if (step === 1)
    return (
      <div className="sc-setup__tabbed">
        <div className="row gap-3 mb-16">
          <Tabs items={ROOM_PARTS} value={part} onChange={onPart} ariaLabel="Phòng & lớp" />
          {importButton('rooms')}
        </div>
        <div className="sc-setup__embed" key={version}>
          {part === 0 ? <RoomListPage /> : <AgeGroupsClassesPage embedded />}
        </div>
        {importPanel}
      </div>
    );
  // Tạo lớp xong thì phân công tổ trưởng và giáo viên ngay (Cần 30/10/2026), Phó hiệu trưởng sau
  if (step === 2)
    return (
      <>
        <div className="row mb-16 sc-setup__import">{importButton('teachers')}</div>
        <div className="sc-setup__embed" key={version}>
          <TeacherAssignmentPage />
        </div>
        {importPanel}
      </>
    );
  if (step === 3)
    return (
      <div className="sc-setup__embed">
        <VicePrincipalAssignmentPage embedded />
      </div>
    );
  if (step === 4)
    return (
      <div className="sc-setup__embed">
        <CutoffSettingPage />
      </div>
    );
  if (step === 5)
    return (
      <div className="sc-setup__embed">
        <YearPlacementPage />
      </div>
    );
  // Kích hoạt theo thứ tự: năm sắp diễn ra sớm nhất trước
  const next = years.filter((y) => y.status === YEAR_STATUS.PLANNED).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  return (
    <>
      <YearReadinessCard year={year} blockedBy={next && next.id !== year.id ? next : null} onActivate={setActivating} showSetup={false} />
      <ActivateYearModal
        year={activating}
        activeYear={years.find((y) => y.status === YEAR_STATUS.ACTIVE)}
        onClose={() => setActivating(null)}
        onDone={onActivated}
      />
    </>
  );
}

/** Thiết lập năm học từng bước (Cần chốt 30/10/2026): 7 bước, mỗi bước lưu ngay nên thoát ra rồi làm tiếp được. */
export default function SchoolYearSetupPage() {
  const { id, step: stepParam } = useParams();
  const step = id ? Math.min(Math.max(Number(stepParam) || 1, 1), SETUP_STEPS.length) - 1 : 0;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { schoolYear, setSchoolYear } = useSchoolYear();
  const { years, loading: loadingYears, error: listError, reload } = useSchoolYears({ live: false });
  const { year, loading, error } = useSchoolYearItem(id, { live: false });
  const [copy, setCopy] = useState(() => (id ? readCopyResult(id) : null));
  const [part, setPart] = useState(0);
  const { readiness, reload: reloadReadiness } = useYearReadiness(id);
  const done = useMemo(() => completedSteps(readiness, year), [readiness, year]);
  // Đổi bước ⇒ tính lại bước nào đã xong (phân công giáo viên... không báo thay đổi dữ liệu qua sự kiện)
  useEffect(() => {
    setPart(0);
    if (id) reloadReadiness({ silent: true });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mở /setup không kèm bước ⇒ vào thẳng bước đầu tiên chưa xong
  useEffect(() => {
    if (id && !stepParam && readiness)
      navigate(`/school/years/${id}/setup/${firstOpenStep(done, SETUP_STEPS.length) + 1}`, { replace: true });
  }, [id, stepParam, readiness, done, navigate]);

  useEffect(() => {
    setCopy(id ? readCopyResult(id) : null);
    // Các màn trong bước đọc năm học trên header ⇒ chuyển header sang năm đang thiết lập
    if (id) setSchoolYear(id);
  }, [id, setSchoolYear]);

  const goTo = (i) => navigate(`/school/years/${id}/setup/${i + 1}`);
  const dismiss = () => {
    const rest = copy && {
      ...copy,
      skipped: (copy.skipped || []).filter((s) => stepOfPart(s.part) !== step),
      withoutRoom: step === 1 ? [] : copy.withoutRoom,
    };
    writeCopyResult(id, rest);
    setCopy(rest);
  };

  let body;
  if (!canConfigureSchool(user)) body = <ScNoAccess description="Chỉ Hiệu trưởng được tạo và thiết lập năm học." />;
  else if (error || listError) body = <ErrorState error={error || listError} onRetry={reload} />;
  else if (loadingYears || loading || (id && !year)) body = <LoadingState />;
  else if (year?.status === YEAR_STATUS.CLOSED) body = <ScNoAccess description="Năm học đã kết thúc nên chỉ xem được." />;
  else if (id && !stepParam) body = <LoadingState />;
  else if (step === 0)
    body = (
      <InfoStep
        key={id || 'new'}
        year={year}
        years={years}
        user={user}
        onSaved={(saved, result) => {
          if (result) writeCopyResult(saved.id, result);
          navigate(`/school/years/${saved.id}/setup/2`);
        }}
      />
    );
  else if (String(schoolYear) !== String(id)) body = <LoadingState />;
  else
    body = (
      <>
        <CopyIssues copy={copy} step={step} onDismiss={dismiss} />
        <StepBody
          step={step}
          part={part}
          onPart={setPart}
          year={year}
          years={years}
          onActivated={() => navigate('/school/years')}
          onChanged={() => reloadReadiness({ silent: true })}
        />
      </>
    );

  return (
    <div className="page">
      <Breadcrumb items={yearCrumbs(id ? `Thiết lập năm học ${year?.name || ''}`.trim() : 'Tạo năm học')} />
      <div className="row gap-3">
        <h1 className="page__title">{id ? `Thiết lập năm học ${year?.name || ''}` : 'Tạo năm học'}</h1>
        {year && <YearStatusBadge status={year.status} size="lg" />}
      </div>
      <div className="card stepper-card">
        <Stepper
          steps={SETUP_STEPS}
          completed={id ? done : undefined}
          current={step}
          maxReached={id ? SETUP_STEPS.length - 1 : 0}
          onStepClick={id ? goTo : undefined}
        />
      </div>
      {body}
      {id && step > 0 && year && (
        <div className="page-actions">
          <button className="btn wizard-actions__back" onClick={() => (step === 1 && part === 1 ? setPart(0) : goTo(step - 1))}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          {step < SETUP_STEPS.length - 1 ? (
            <button className="btn btn--primary" onClick={() => (step === 1 && part === 0 ? setPart(1) : goTo(step + 1))}>
              Tiếp tục <ArrowRight size={16} />
            </button>
          ) : (
            <Link className="btn" to="/school/years">
              Về danh sách năm học
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
