import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, CheckCircle2, KeyRound, Eye, Plus, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useParentAccountOptions, usePlacementClasses } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Stepper } from '@/components/ui/Stepper';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { ChildInfoFields } from '@/components/children/ChildInfoFields';
import { ChildProfileFields } from '@/components/children/ChildProfileFields';
import { ChildProfileSummary } from '@/components/children/ChildProfileSummary';
import { ClassPlacementFields } from '@/components/children/ClassPlacementFields';
import { ExistingGuardianPicker } from '@/components/children/ExistingGuardianPicker';
import { HealthDeclarationFields } from '@/components/children/HealthDeclarationFields';
import { DeclarationSummary } from '@/components/children/DeclarationSummary';
import { checkDuplicateChild, enrollChild } from '@/services/children/childrenService';
import { GENDER_LABELS, ageGroupById, ageLabel } from '@/models/School';
import { formatDate } from '@/utils/format';
import { hasErrors, normalizePhone, validateChildInfo, validateDeclaration } from '@/utils/children/childrenValidation';
import { PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
import { canEnrollChild } from '@/utils/children/childrenPermissions';
import { emptyChildInfo, emptyDeclaration, suggestAgeGroupId } from '@/utils/children/childrenHelpers';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const STEPS = ['Thông tin trẻ & phụ huynh', 'Xếp lớp', 'Khai báo sức khỏe', 'Xem lại & xác nhận'];

const GUARDIAN_MODE = { EXISTING: 'EXISTING', NEW: 'NEW' };
const GUARDIAN_MODE_LABELS = { EXISTING: 'Đã có tài khoản', NEW: 'Chưa có tài khoản' };
const MAX_GUARDIANS = 3;

const stepOfField = (field) => (field.startsWith('declaration.') ? 2 : field === 'classId' ? 1 : 0);

/** Splits '422' details from the service back into each step's error map. */
const splitServerErrors = (details = {}) => {
  const out = { info: {}, placement: {}, declaration: {} };
  Object.entries(details).forEach(([k, v]) => {
    if (k.startsWith('declaration.')) out.declaration[k.slice(12)] = v;
    else if (k === 'classId') out.placement.classId = v;
    else out.info[k] = v;
  });
  return out;
};

export default function EnrollChildPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const { classes, loading: classesLoading } = usePlacementClasses(schoolYear);
  const accountsQ = useParentAccountOptions({ enabled: canEnrollChild(user) });

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [info, setInfo] = useState(emptyChildInfo);
  const [guardianMode, setGuardianMode] = useState(GUARDIAN_MODE.NEW);
  const [linked, setLinked] = useState([]);
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [declaration, setDeclaration] = useState(emptyDeclaration());
  const [errors, setErrors] = useState({ info: {}, placement: {}, declaration: {} });
  const [duplicate, setDuplicate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!canEnrollChild(user)) {
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Tiếp nhận trẻ')} />
        <h1 className="page__title">Tiếp nhận trẻ</h1>
        <StatusPage
          kind="403"
          title="Bạn không có quyền tiếp nhận trẻ"
          description="Chỉ Phó hiệu trưởng phụ trách điểm trường được tiếp nhận trẻ."
        />
      </div>
    );
  }

  const suggested = suggestAgeGroupId(info.dateOfBirth, schoolYear);
  const selectedClass = classes.find((c) => c.id === classId);
  const dirty = !!(info.fullName || info.dateOfBirth || linked.length || info.guardians.some((g) => g.fullName || g.phone));

  // Chế độ "Đã có tài khoản": thông tin liên hệ lấy từ tài khoản; BE vẫn đọc lại theo accountId khi lưu.
  const withGuardians = (base, mode, links) =>
    mode === GUARDIAN_MODE.NEW
      ? base
      : {
          ...base,
          guardians: links.map((g) => {
            const acc = accountsQ.accounts.find((a) => a.id === g.accountId);
            return {
              accountId: g.accountId,
              relation: g.relation,
              fullName: acc?.fullName || '',
              phone: acc?.phone || '',
              email: acc?.email || '',
            };
          }),
        };
  const effectiveInfo = withGuardians(info, guardianMode, linked);

  const validateInfo = (value, mode = guardianMode) => {
    const errs = validateChildInfo(value);
    if (mode === GUARDIAN_MODE.EXISTING && !value.guardians.length) errs.guardians = 'Chọn ít nhất một tài khoản phụ huynh';
    return errs;
  };

  const accountOfContact = (g) => {
    const phone = normalizePhone(g?.phone);
    const email = (g?.email || '').trim().toLowerCase();
    return accountsQ.accounts.find((a) => (phone && a.phone === phone) || (email && a.email.toLowerCase() === email)) || null;
  };

  const switchMode = (mode) => {
    setGuardianMode(mode);
    setErrors((e) => ({ ...e, info: Object.fromEntries(Object.entries(e.info).filter(([k]) => !k.startsWith('guardians'))) }));
  };

  const pickSuggestedAccount = (g) => {
    const acc = accountOfContact(g);
    if (!acc) return;
    setLinked((l) =>
      l.some((x) => x.accountId === acc.id) || l.length >= MAX_GUARDIANS ? l : [...l, { accountId: acc.id, relation: g.relation }],
    );
    switchMode(GUARDIAN_MODE.EXISTING);
  };

  const changeLinked = (value) => {
    setLinked(value);
    const now = validateInfo(withGuardians(info, GUARDIAN_MODE.EXISTING, value), GUARDIAN_MODE.EXISTING);
    setErrors((e) => ({ ...e, info: Object.fromEntries(Object.entries(e.info).filter(([k]) => now[k])) }));
  };

  const goTo = (i) => {
    setStep(i);
    setMaxReached((m) => Math.max(m, i));
    window.scrollTo({ top: 0 });
  };

  const blurCheck = (field) => {
    const all = validateInfo(effectiveInfo);
    setErrors((e) => {
      const next = { ...e.info };
      if (all[field]) next[field] = all[field];
      else delete next[field];
      return { ...e, info: next };
    });
  };

  const changeInfo = (value) => {
    setInfo(value);
    setDuplicate(null);
    // Clear errors as soon as the user fixes them; new errors only appear on blur / next.
    const now = validateInfo(withGuardians(value, guardianMode, linked));
    setErrors((e) => ({ ...e, info: Object.fromEntries(Object.entries(e.info).filter(([k]) => now[k])) }));
  };

  const next = async () => {
    if (step === 0) {
      const errs = validateInfo(effectiveInfo);
      setErrors((e) => ({ ...e, info: errs }));
      if (hasErrors(errs)) return;
      setBusy(true);
      try {
        const dup = await checkDuplicateChild({ fullName: info.fullName, dateOfBirth: info.dateOfBirth }, user);
        setDuplicate(dup);
        if (dup) return;
      } catch (err) {
        toast.error(err, 'Không kiểm tra được hồ sơ trùng');
        return;
      } finally {
        setBusy(false);
      }
      if (!ageGroupId) setAgeGroupId(suggested);
      goTo(1);
    } else if (step === 1) {
      // Lớp không bắt buộc khi tiếp nhận: bỏ trống thì trẻ ở trạng thái Chờ xếp lớp.
      goTo(2);
    } else if (step === 2) {
      const errs = validateDeclaration(declaration);
      setErrors((e) => ({ ...e, declaration: errs }));
      if (!hasErrors(errs)) goTo(3);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const child = await enrollChild({ child: effectiveInfo, classId, declaration }, user);
      setSaved(child);
      toast.success(`Đã lưu hồ sơ ${child.fullName} (${child.code}).`, 'Tiếp nhận thành công');
    } catch (err) {
      if (err.status === 422 && err.details) {
        setErrors(splitServerErrors(err.details));
        goTo(Math.min(...Object.keys(err.details).map(stepOfField)));
      }
      toast.error(err, 'Không lưu được hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    // Trạng thái tài khoản lấy từ BE trả về sau khi lưu, không suy từ lựa chọn trên form.
    const needsActivation = (saved.guardians || []).some((g) => g.accountStatus === PARENT_ACCOUNT_STATUS.NOT_ACTIVATED);
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Tiếp nhận trẻ')} />
        <h1 className="page__title">Tiếp nhận trẻ</h1>
        <div className="card">
          <div className="state">
            <div className="state__icon tr-state-success">
              <CheckCircle2 size={26} />
            </div>
            <div className="state__title">
              Đã tiếp nhận {saved.fullName}
              {saved.className ? ` vào ${saved.className}` : ' – chờ xếp lớp'}
            </div>
            <div className="muted tr-state-text">
              Mã trẻ <b>{saved.code}</b>.{' '}
              {needsActivation
                ? 'Bước tiếp theo: kích hoạt tài khoản cho phụ huynh chưa có tài khoản để nhận tên đăng nhập và mật khẩu qua SMS.'
                : 'Trẻ đã được liên kết vào tài khoản phụ huynh có sẵn; phụ huynh xem được trẻ trên ứng dụng, không cần mật khẩu mới.'}
            </div>
            <div className="row row--wrap mt-12 gap-2 tr-state-actions">
              <button
                className="btn"
                onClick={() => {
                  setSaved(null);
                  setInfo(emptyChildInfo());
                  setGuardianMode(GUARDIAN_MODE.NEW);
                  setLinked([]);
                  setClassId('');
                  setAgeGroupId('');
                  setDeclaration(emptyDeclaration());
                  setStep(0);
                  setMaxReached(0);
                }}
              >
                <Plus size={16} /> Tiếp nhận trẻ khác
              </button>
              <Link className="btn" to={`/children/${saved.id}`}>
                <Eye size={16} /> Xem hồ sơ
              </Link>
              {needsActivation && (
                <Link className="btn btn--primary" to={`/children/activation?childId=${saved.id}`}>
                  <KeyRound size={16} /> Kích hoạt tài khoản phụ huynh
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Tiếp nhận trẻ')} />
      <div className="page__head">
        <h1 className="page__title">Tiếp nhận trẻ</h1>
        <Link to="/children/import" className="btn">
          Nhập nhiều trẻ từ Excel
        </Link>
      </div>
      <div className="card stepper-card">
        <Stepper steps={STEPS} current={step} maxReached={maxReached} onStepClick={goTo} />
      </div>

      {step === 0 && (
        <section className="card wizard-card">
          <ChildInfoFields
            split
            value={info}
            onChange={changeInfo}
            errors={errors.info}
            onBlurField={blurCheck}
            guardianTabs={
              <div className="tabs tr-guardian-mode" role="tablist" aria-label="Tài khoản phụ huynh">
                {[GUARDIAN_MODE.EXISTING, GUARDIAN_MODE.NEW].map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={guardianMode === m}
                    className={`tab ${guardianMode === m ? 'tab--active' : ''}`}
                    onClick={() => switchMode(m)}
                  >
                    {GUARDIAN_MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            }
            guardiansOverride={
              guardianMode === GUARDIAN_MODE.EXISTING && (
                <ExistingGuardianPicker
                  accounts={accountsQ.accounts}
                  loading={accountsQ.loading}
                  error={accountsQ.error}
                  onRetry={accountsQ.reload}
                  value={linked}
                  onChange={changeLinked}
                  errors={errors.info}
                />
              )
            }
            guardianNotice={(i) => {
              const acc = accountOfContact(info.guardians[i]);
              return (
                acc && (
                  <div className="alert alert--warning mt-12">
                    <AlertTriangle size={18} />
                    <div>
                      Số điện thoại hoặc email này đã có tài khoản phụ huynh <b>{acc.fullName}</b>.{' '}
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => pickSuggestedAccount(info.guardians[i])}>
                        Chọn tài khoản này
                      </button>
                    </div>
                  </div>
                )
              );
            }}
          />
          {duplicate && (
            <div className="alert alert--danger mt-16" role="alert">
              <AlertTriangle size={18} />
              <div>
                Hồ sơ này đã tồn tại (trùng họ tên và ngày sinh). Xem lại hồ sơ đã có.{' '}
                {duplicate.sameCampus ? (
                  <Link className="text-primary" to={`/children/${duplicate.id}`}>
                    {duplicate.fullName} ({duplicate.code})
                  </Link>
                ) : (
                  'Hồ sơ thuộc điểm trường khác – liên hệ Hiệu trưởng.'
                )}
              </div>
            </div>
          )}
        </section>
      )}
      {step === 0 && (
        <section className="card wizard-card">
          <ChildProfileFields value={info.profile} onChange={(profile) => changeInfo({ ...info, profile })} errors={errors.info} />
        </section>
      )}

      {step === 1 && (
        <section className="card wizard-card">
          <h2 className="card__title mb-12">Xếp lớp năm học {schoolYear}</h2>
          {classesLoading ? (
            <Spinner deferred />
          ) : (
            <ClassPlacementFields
              classes={classes}
              ageGroupId={ageGroupId}
              onAgeGroupChange={(v) => {
                setAgeGroupId(v);
                if (classes.find((c) => c.id === classId)?.ageGroupId !== v) setClassId('');
              }}
              classId={classId}
              onClassChange={(id) => {
                setClassId(id);
                setErrors((e) => ({ ...e, placement: {} }));
              }}
              suggestedAgeGroupId={suggested}
              error={errors.placement.classId}
              userById={md.userById}
              required={false}
            />
          )}
        </section>
      )}

      {step === 2 && (
        <section className="card wizard-card">
          <h2 className="card__title mb-12">Khai báo sức khỏe khi tiếp nhận</h2>
          <HealthDeclarationFields
            value={declaration}
            onChange={(v) => {
              setDeclaration(v);
              setErrors((e) => ({ ...e, declaration: {} }));
            }}
            errors={errors.declaration}
          />
        </section>
      )}

      {step === 3 && (
        <>
          <section className="card wizard-card">
            <div className="row row--between mb-12">
              <h2 className="card__title">Thông tin trẻ</h2>
              <button className="btn btn--sm btn--ghost" onClick={() => goTo(0)}>
                Sửa
              </button>
            </div>
            <dl className="info-list info-list--wide">
              <dt>Họ và tên</dt>
              <dd className="fw-600">{info.fullName}</dd>
              <dt>Ngày sinh</dt>
              <dd>
                {formatDate(info.dateOfBirth)} <span className="muted">({ageLabel(info.dateOfBirth)})</span>
              </dd>
              <dt>Giới tính</dt>
              <dd>{GENDER_LABELS[info.gender]}</dd>
              {effectiveInfo.guardians.map((g, i) => (
                <div key={i} className="tr-dl-pair">
                  <dt>Phụ huynh {i + 1}</dt>
                  <dd>
                    {g.fullName} ({g.relation}) · {g.phone}
                    {g.email ? ` · ${g.email}` : ''}
                    {g.accountId && <span className="muted"> · tài khoản có sẵn, liên kết khi lưu</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <h3 className="subsection-title mt-16">Thông tin hành chính</h3>
            <ChildProfileSummary profile={info.profile} />
          </section>
          <section className="card wizard-card">
            <div className="row row--between mb-12">
              <h2 className="card__title">Lớp</h2>
              <button className="btn btn--sm btn--ghost" onClick={() => goTo(1)}>
                Sửa
              </button>
            </div>
            {selectedClass ? (
              <p>
                <b>{selectedClass.name}</b> – {ageGroupById(selectedClass.ageGroupId)?.name} · năm học {schoolYear} · sĩ số hiện tại{' '}
                {selectedClass.enrolledCount}/{selectedClass.capacity}
              </p>
            ) : (
              <p className="muted">Chưa xếp lớp. Trẻ ở trạng thái Chờ xếp lớp, xếp lớp sau tại màn Xếp lớp.</p>
            )}
          </section>
          <section className="card wizard-card">
            <div className="row row--between mb-12">
              <h2 className="card__title">Khai báo sức khỏe</h2>
              <button className="btn btn--sm btn--ghost" onClick={() => goTo(2)}>
                Sửa
              </button>
            </div>
            <DeclarationSummary declaration={declaration} />
          </section>
        </>
      )}

      <div className="page-actions">
        {step === 0 ? (
          <button className="btn wizard-actions__back" onClick={() => (dirty ? setConfirmLeave(true) : navigate('/children'))}>
            <ArrowLeft size={16} /> Hủy
          </button>
        ) : (
          <button className="btn wizard-actions__back" onClick={() => goTo(step - 1)} disabled={busy}>
            <ArrowLeft size={16} /> Quay lại
          </button>
        )}
        {step < 3 ? (
          <button className="btn btn--primary" onClick={next} disabled={busy}>
            {busy && <Spinner small />} Tiếp tục <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn btn--primary" onClick={save} disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu hồ sơ tiếp nhận
          </button>
        )}
      </div>

      <ConfirmationModal
        open={confirmLeave}
        title="Hủy tiếp nhận trẻ?"
        message="Thông tin đã nhập sẽ không được lưu."
        confirmLabel="Hủy tiếp nhận"
        cancelLabel="Tiếp tục nhập"
        danger
        onConfirm={() => navigate('/children')}
        onClose={() => setConfirmLeave(false)}
      />
    </div>
  );
}
