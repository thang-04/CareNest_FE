import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Save, CheckCircle2, KeyRound, Eye, Plus, AlertTriangle, RotateCcw, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useCitizenIdAccounts, usePlacementClasses } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Stepper } from '@/components/ui/Stepper';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { ChildInfoFields } from '@/components/children/ChildInfoFields';
import { ChildProfileFields } from '@/components/children/ChildProfileFields';
import { ChildProfileSummary } from '@/components/children/ChildProfileSummary';
import { ClassPlacementFields } from '@/components/children/ClassPlacementFields';
import { HealthDeclarationFields } from '@/components/children/HealthDeclarationFields';
import { DeclarationSummary } from '@/components/children/DeclarationSummary';
import { checkDuplicateChild, checkGuardianConflicts, enrollChild, readmitChild } from '@/services/children/childrenService';
import { FormField } from '@/components/form/FormField';
import { GENDER_LABELS, ageGroupById, ageLabel } from '@/models/School';
import { formatDate } from '@/utils/format';
import { hasErrors, validateChildInfo, validateDeclaration } from '@/utils/children/childrenValidation';
import { canActivateParentsAt, canEnrollChild, childCampusesOf } from '@/utils/children/childrenPermissions';
import {
  defaultCampusId,
  emptyChildInfo,
  emptyDeclaration,
  suggestAgeGroupId,
  withGuardianAccounts,
} from '@/utils/children/childrenHelpers';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const STEPS = ['Thông tin trẻ & phụ huynh', 'Xếp lớp', 'Khai báo sức khỏe', 'Xem lại & xác nhận'];

const PLACEMENT_FIELDS = ['classId', 'campusId'];

const stepOfField = (field) => (field.startsWith('declaration.') ? 2 : PLACEMENT_FIELDS.includes(field) ? 1 : 0);

/** Splits '422' details from the service back into each step's error map. */
const splitServerErrors = (details = {}) => {
  const out = { info: {}, placement: {}, declaration: {} };
  Object.entries(details).forEach(([k, v]) => {
    if (k.startsWith('declaration.')) out.declaration[k.slice(12)] = v;
    else if (PLACEMENT_FIELDS.includes(k)) out.placement[k] = v;
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

  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [info, setInfo] = useState(emptyChildInfo);
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  // null = chưa chọn: dùng điểm trường mặc định; giữ lựa chọn khi tiếp nhận trẻ khác.
  const [campusPick, setCampusPick] = useState(null);
  const [declaration, setDeclaration] = useState(emptyDeclaration());
  const [errors, setErrors] = useState({ info: {}, placement: {}, declaration: {} });
  const [duplicate, setDuplicate] = useState(null);
  const [readmitOpen, setReadmitOpen] = useState(false);
  const [readmitReason, setReadmitReason] = useState('');
  const [readmitError, setReadmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // CCCD trùng tài khoản phụ huynh có sẵn ⇒ dùng tài khoản đó (user chốt 2026-10-23); bỏ 2 tab Đã có / Chưa có tài khoản.
  const accountOf = useCitizenIdAccounts(
    info.guardians.map((g) => g.idNumber),
    { enabled: canEnrollChild(user) },
  );

  if (!canEnrollChild(user)) {
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Tiếp nhận trẻ')} />
        <h1 className="page__title">Tiếp nhận trẻ</h1>
        <StatusPage
          kind="403"
          title="Bạn không có quyền tiếp nhận trẻ"
          description="Chỉ Hiệu trưởng hoặc Phó hiệu trưởng được giao quyền tiếp nhận trẻ."
        />
      </div>
    );
  }

  const suggested = suggestAgeGroupId(info.dateOfBirth, schoolYear);
  const selectedClass = classes.find((c) => c.id === classId);
  // Hiệu trưởng, PHT toàn trường chọn điểm trường: trẻ chưa xếp lớp thuộc điểm trường này (BE kiểm lại).
  const campusOptions = childCampusesOf(user, md.campuses);
  const pickCampus = campusOptions.length > 1;
  const campusId = campusPick ?? defaultCampusId(campusOptions, user);
  const campusLabel = (id) => md.campusById(id)?.shortName || md.campusById(id)?.name || '';
  const dirty = !!(info.fullName || info.dateOfBirth || info.guardians.some((g) => g.fullName || g.phone || g.idNumber));

  // Phụ huynh có CCCD trùng tài khoản: họ tên, SĐT, email theo tài khoản; BE vẫn tự liên kết theo CCCD khi lưu.
  const withAccounts = (value) => ({ ...value, guardians: withGuardianAccounts(value.guardians, accountOf) });
  const effectiveInfo = withAccounts(info);
  const validateInfo = (value) => validateChildInfo(value);

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
    const now = validateInfo(withAccounts(value));
    setErrors((e) => ({ ...e, info: Object.fromEntries(Object.entries(e.info).filter(([k]) => now[k])) }));
  };

  const toPlacement = () => {
    if (!ageGroupId) setAgeGroupId(suggested);
    goTo(1);
  };

  const readmit = async () => {
    try {
      const child = await readmitChild(duplicate.id, { reason: readmitReason }, user);
      toast.success(
        `Đã mở lại hồ sơ ${child.fullName} (${child.code}): trẻ ở trạng thái Chờ xếp lớp. Cập nhật hồ sơ, khai báo sức khỏe nếu có thay đổi rồi xếp lớp.`,
        'Tiếp nhận lại',
      );
      navigate(`/children/${child.id}`);
    } catch (err) {
      if (err.details?.reason) setReadmitError(err.details.reason);
      else setReadmitOpen(false);
      toast.error(err, 'Không mở lại được hồ sơ');
    }
  };

  const next = async () => {
    if (step === 0) {
      const errs = validateInfo(effectiveInfo);
      setErrors((e) => ({ ...e, info: errs }));
      if (hasErrors(errs)) return;
      setBusy(true);
      try {
        // Trùng hồ sơ = cùng họ tên, ngày sinh và CCCD một phụ huynh (BE kiểm); trẻ đã nghỉ học thì gợi ý mở lại hồ sơ cũ.
        const dup = await checkDuplicateChild(
          {
            fullName: info.fullName,
            dateOfBirth: info.dateOfBirth,
            guardianIdNumbers: effectiveInfo.guardians.map((g) => g.idNumber),
          },
          user,
        );
        setDuplicate(dup);
        if (dup) return;
        // CCCD/SĐT phụ huynh lệch phụ huynh đã có: báo ngay ở bước này, không đợi lưu; lưu vẫn kiểm lại (user chốt 2026-10-28).
        await checkGuardianConflicts(effectiveInfo.guardians, user);
      } catch (err) {
        if (err.status === 409 && err.details) {
          setErrors((e) => ({ ...e, info: err.details }));
          toast.error(err, 'Thông tin phụ huynh chưa đúng');
        } else toast.error(err, 'Không kiểm tra được hồ sơ');
        return;
      } finally {
        setBusy(false);
      }
      toPlacement();
    } else if (step === 1) {
      // Lớp không bắt buộc khi tiếp nhận: bỏ trống thì trẻ ở trạng thái Chờ xếp lớp của điểm trường đã chọn.
      if (pickCampus && !campusId) {
        setErrors((e) => ({ ...e, placement: { campusId: 'Chọn điểm trường tiếp nhận trẻ' } }));
        return;
      }
      goTo(2);
    } else if (step === 2) {
      const errs = validateDeclaration(declaration, { dateOfBirth: info.dateOfBirth });
      setErrors((e) => ({ ...e, declaration: errs }));
      if (!hasErrors(errs)) goTo(3);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const child = await enrollChild({ child: effectiveInfo, classId, campusId: campusId || undefined, declaration }, user);
      setSaved(child);
      toast.success(`Đã lưu hồ sơ ${child.fullName} (${child.code}).`, 'Tiếp nhận thành công');
    } catch (err) {
      // 409 trùng CCCD/SĐT với phụ huynh khác cũng trả lỗi theo ô (details).
      if ((err.status === 422 || err.status === 409) && err.details) {
        setErrors(splitServerErrors(err.details));
        goTo(Math.min(...Object.keys(err.details).map(stepOfField)));
      }
      toast.error(err, 'Không lưu được hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    // Kết quả tài khoản phụ huynh lấy từ BE trả về sau khi lưu (form tiếp nhận kích hoạt ngay — user chốt 2026-10-28).
    const accounts = saved.guardianAccounts || [];
    const created = accounts.filter((a) => a.result === 'CREATED');
    // Tài khoản có sẵn đổi SĐT ở form ⇒ tên đăng nhập mới, mật khẩu mới gửi SMS (user chốt 2026-10-28).
    const renamed = accounts.filter((a) => a.result === 'LINKED' && a.phoneChanged);
    const smsFailed = [...created, ...renamed].filter((a) => a.smsStatus === 'FAILED');
    const smsSent = created.filter((a) => a.smsStatus !== 'FAILED');
    const renamedSent = renamed.filter((a) => a.smsStatus !== 'FAILED');
    const linked = accounts.filter((a) => a.result === 'LINKED');
    const waiting = accounts.filter((a) => a.result === 'NOT_ACTIVATED');
    const phones = (list) => list.map((a) => a.phone).join(', ');
    const names = (list) => list.map((a) => a.fullName).join(', ');
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
              <div>
                Mã trẻ <b>{saved.code}</b>.
              </div>
              {smsSent.length > 0 && <div>Đã tạo tài khoản phụ huynh, mật khẩu tạm gửi qua SMS tới {phones(smsSent)}.</div>}
              {renamedSent.length > 0 && (
                <div>Tài khoản có sẵn đổi tên đăng nhập sang {phones(renamedSent)}; mật khẩu tạm mới đã gửi qua SMS tới số mới.</div>
              )}
              {smsFailed.length > 0 && (
                <div>Chưa gửi được SMS mật khẩu tới {phones(smsFailed)}: gửi lại mật khẩu ở màn Tài khoản phụ huynh.</div>
              )}
              {linked.length > 0 && (
                <div>Liên kết vào tài khoản có sẵn của {names(linked)}; phụ huynh xem được trẻ trên ứng dụng, không cần mật khẩu mới.</div>
              )}
              {waiting.length > 0 && (
                <div>Chưa tạo tài khoản cho {names(waiting)}: người có quyền kích hoạt ở màn Tài khoản phụ huynh.</div>
              )}
            </div>
            <div className="row row--wrap mt-12 gap-2 tr-state-actions">
              <button
                className="btn"
                onClick={() => {
                  setSaved(null);
                  setInfo(emptyChildInfo());
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
              {(waiting.length > 0 || smsFailed.length > 0) && (
                <Link className="btn btn--primary" to={`/children/activation?childId=${saved.id}`}>
                  <KeyRound size={16} /> {waiting.length > 0 ? 'Kích hoạt tài khoản phụ huynh' : 'Gửi lại mật khẩu'}
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
          <ChildInfoFields split value={info} onChange={changeInfo} errors={errors.info} onBlurField={blurCheck} accountOf={accountOf} />
          {duplicate?.kind === 'ACTIVE' && (
            <div className="alert alert--danger mt-16" role="alert">
              <AlertTriangle size={18} />
              <div>
                Hồ sơ này đã tồn tại (trùng họ tên, ngày sinh và phụ huynh). Xem lại hồ sơ đã có.{' '}
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
          {duplicate?.kind === 'LEFT' && (
            <div className="alert alert--warning mt-16" role="alert">
              <RotateCcw size={18} />
              <div className="tr-cell-stack">
                {duplicate.sameCampus ? (
                  <span>
                    Trẻ này từng học ở trường và đã nghỉ học{duplicate.leftAt ? ` từ ${formatDate(duplicate.leftAt)}` : ''}: hồ sơ cũ{' '}
                    <Link className="text-primary" to={`/children/${duplicate.id}`}>
                      {duplicate.fullName} ({duplicate.code})
                    </Link>
                    . Nên mở lại hồ sơ cũ để giữ mã trẻ, lịch sử sức khỏe, đánh giá và tài khoản phụ huynh.
                  </span>
                ) : (
                  <span>Trẻ này có hồ sơ cũ (đã nghỉ học) ở điểm trường khác. Liên hệ Hiệu trưởng nếu cần mở lại hồ sơ cũ.</span>
                )}
                <div className="row row--wrap gap-2">
                  {duplicate.canReadmit && (
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      onClick={() => {
                        setReadmitReason('');
                        setReadmitError('');
                        setReadmitOpen(true);
                      }}
                    >
                      <RotateCcw size={15} /> Mở lại hồ sơ cũ
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      setDuplicate(null);
                      toPlacement();
                    }}
                  >
                    Vẫn tạo hồ sơ mới
                  </button>
                </div>
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
              campuses={campusOptions}
              campusId={campusId}
              onCampusChange={(id) => {
                setCampusPick(id);
                if (classes.find((c) => c.id === classId)?.campusId !== id) setClassId('');
                setErrors((e) => ({ ...e, placement: {} }));
              }}
              campusError={errors.placement.campusId}
            />
          )}
        </section>
      )}

      {step === 2 && (
        <section className="card wizard-card">
          <h2 className="card__title mb-12">Khai báo sức khỏe khi tiếp nhận</h2>
          <HealthDeclarationFields
            dateOfBirth={info.dateOfBirth}
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
                    {g.fullName} ({g.relation}) · {g.phone} · CCCD {g.idNumber}
                    {g.email ? ` · ${g.email}` : ''}
                    {accountOf(g.idNumber) && <span className="muted"> · tài khoản có sẵn, liên kết khi lưu</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {canActivateParentsAt(selectedClass?.campusId || campusId, user) && (
              <div className="alert alert--info mt-12">
                <Info size={18} />
                <div>
                  Khi lưu, phụ huynh chưa có tài khoản được tạo tài khoản ngay và nhận mật khẩu tạm qua SMS; phụ huynh đã có tài khoản chỉ
                  được liên kết thêm trẻ.
                </div>
              </div>
            )}
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
            {pickCampus && (
              <p className="mb-12">
                Điểm trường: <b>{campusLabel(selectedClass?.campusId || campusId)}</b>
              </p>
            )}
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
        open={readmitOpen}
        title="Mở lại hồ sơ cũ?"
        message={
          duplicate?.kind === 'LEFT'
            ? `${duplicate.fullName} (${duplicate.code}) về trạng thái Chờ xếp lớp, giữ mã trẻ và toàn bộ lịch sử. Thông tin vừa nhập ở form không được lưu; có thay đổi thì sửa ở hồ sơ trẻ.`
            : ''
        }
        confirmLabel="Mở lại hồ sơ"
        onConfirm={readmit}
        onClose={() => setReadmitOpen(false)}
      >
        <div className="confirm__form mt-12">
          <FormField label="Lý do tiếp nhận lại" required error={readmitError}>
            <textarea
              className="textarea"
              rows={2}
              maxLength={300}
              value={readmitReason}
              onChange={(e) => {
                setReadmitReason(e.target.value);
                if (readmitError) setReadmitError('');
              }}
              placeholder="Ví dụ: Gia đình chuyển về lại địa phương, xin cho trẻ học tiếp"
            />
          </FormField>
        </div>
      </ConfirmationModal>

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
