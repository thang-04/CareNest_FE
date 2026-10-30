import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useClassPlanContext } from '@/components/education-plan/planUi';
import { PageHead, Notice, EduStatusBadge } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { LearningResourceViewer } from '@/components/education-plan/LearningResourceViewer';
import { themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { numberGoals } from '@/models/education-plan/goalTable';
import { themeGoalBlocks, themeActivities, teachingDayPicks, teachingDayUnlinked } from '@/models/education-plan/classPlan';
import { activitySignature, matchDayActivities, resourceMatches } from '@/models/education-plan/learningResources.mjs';
import { learningResourceService } from '@/services/education-plan/learningResourceService';

export default function TeachingPresentationPage() {
  const { classId, themeId } = useParams();
  return <Presentation key={`${classId}/${themeId}`} />;
}
function Presentation() {
  const { classId, themeId } = useParams();
  const [query] = useSearchParams();
  const { user, classThemePlans, weekPlans } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan } = ctx;
  const doc = classThemePlans.find((d) => d.classId === classId && d.themeId === themeId);
  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const weekKey = query.get('week');
  const date = query.get('date');
  const week = weekPlans.find((w) => w.classId === classId && w.themeId === themeId && w.weekStart === weekKey);
  const day = date ? week?.days?.findIndex((d) => d.date === date) : null;
  const scopeValid = (!weekKey && !date) || (!!week && (!date || day >= 0));
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signatureState, setSignatures] = useState({ rows: null, values: {} });
  const signatures = signatureState.rows === doc?.rows ? signatureState.values : {};
  const [index, setIndex] = useState(0);
  const [mediaIndex, setMediaIndex] = useState(0);
  const stage = useRef(null);
  const [fullError, setFullError] = useState('');
  const activities = useMemo(() => {
    if (!doc || !yearPlan) return [];
    const all = themeActivities(themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId), (g) => themeRowOf(doc, g));
    return weekKey && week ? [...matchDayActivities(all, teachingDayPicks(week, day)), ...teachingDayUnlinked(week, day)] : all;
  }, [doc, yearPlan, themeId, weekKey, week, day]);
  useEffect(() => {
    if (!doc) return undefined;
    let alive = true;
    setLoading(true);
    Promise.all([
      learningResourceService.list(user, doc.id),
      Promise.all(Object.entries(doc.rows || {}).map(async ([id, row]) => [id, await activitySignature(row.activities)])),
    ])
      .then(([rows, sigs]) => {
        if (alive) {
          setItems(rows);
          setSignatures({ rows: doc.rows, values: Object.fromEntries(sigs) });
          setError('');
        }
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [doc, user]);
  const safeIndex = Math.min(index, Math.max(0, activities.length - 1));
  const activity = activities[safeIndex];
  const media = activity ? items.filter((r) => resourceMatches(r, activity, signatures[activity.goalId])) : [];
  const chosen = media[Math.min(mediaIndex, Math.max(0, media.length - 1))] || null;
  const move = (delta) => {
    setIndex((i) => Math.max(0, Math.min(activities.length - 1, i + delta)));
    setMediaIndex(0);
  };
  useEffect(() => {
    const key = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input,select,textarea,video,iframe,[contenteditable="true"]')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        move(e.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities.length]);
  if (ctx.loading) return <LoadingState />;
  if (!cls || !theme || !doc) return <StatusPage kind="404" title="Chưa có kế hoạch chủ đề đã lưu để dạy học" />;
  const back = weekKey ? `/education/class/${classId}/weeks/${weekKey}` : `/education/class/${classId}/themes/${themeId}`;
  return (
    <div className="page ga-page ga-teaching" ref={stage}>
      <PageHead
        title={theme.name}
        desc={
          <>
            {cls.name} · {date || (weekKey ? `Tuần ${weekKey}` : 'Toàn chủ đề')} <EduStatusBadge status={doc.status} />
          </>
        }
        actions={
          <>
            <Link className="btn btn--ghost" to={back}>
              Quay lại kế hoạch
            </Link>
            <button
              type="button"
              className="btn btn--primary"
              onClick={async () => {
                try {
                  if (document.fullscreenElement) await document.exitFullscreen();
                  else await stage.current.requestFullscreen();
                  setFullError('');
                } catch {
                  setFullError('Trình duyệt chưa cho mở toàn màn hình. Bạn vẫn có thể dạy học trong trang này.');
                }
              }}
            >
              Toàn màn hình
            </button>
          </>
        }
      />
      {doc.status !== 'approved' && doc.status !== 'APPROVED' && (
        <Notice tone="warn">Đây là bản chưa hoàn tất phê duyệt. Chế độ dạy học không thay đổi trạng thái hồ sơ.</Notice>
      )}
      {fullError && <Notice tone="warn">{fullError}</Notice>}
      {!scopeValid ? (
        <Notice tone="warn">Không tìm thấy tuần/ngày thuộc chủ đề này. Quay lại kế hoạch để chọn ngày.</Notice>
      ) : (
        <div className="ga-teaching-layout">
          <aside className="ga-teaching-nav" aria-label="Hoạt động dạy học">
            <h2>
              Hoạt động <span className="muted">({activities.length})</span>
            </h2>
            {activities.map((a, i) => (
              <button
                type="button"
                key={`${a.id}/${i}`}
                className={`ga-teaching-activity ${i === safeIndex ? 'is-selected' : ''}`}
                aria-current={i === safeIndex ? 'step' : undefined}
                onClick={() => {
                  setIndex(i);
                  setMediaIndex(0);
                }}
              >
                <span className="ga-teaching-mt">{a.unlinked ? 'Nội dung giáo án' : `MT${a.goalNo || '—'}`}</span>
                <span>{a.text}</span>
                {a.stale && <small>Cần kiểm tra lại</small>}
              </button>
            ))}
          </aside>
          <section className="ga-teaching-stage" aria-label="Nội dung trình chiếu">
            {!activity ? (
              <Notice>Chưa có hoạt động trong phạm vi đã chọn. Quay lại kế hoạch để soạn và xếp hoạt động.</Notice>
            ) : (
              <>
                <p className="muted">
                  Hoạt động {safeIndex + 1}/{activities.length} ·{' '}
                  {activity.unlinked ? 'Nội dung nhập trong giáo án' : `MT${activity.goalNo || '—'}`}
                </p>
                <h1 className="ga-teaching-title">{activity.text}</h1>
                {activity.stale && (
                  <Notice tone="warn">
                    Hoạt động đã xếp trong ngày không còn khớp kế hoạch chủ đề hiện tại. Giữ nguyên nội dung đã chọn; kiểm tra lại giáo án
                    trước khi dùng học liệu.
                  </Notice>
                )}
                {error ? (
                  <Notice tone="warn">Chưa tải được học liệu: {error}</Notice>
                ) : loading ? (
                  <p role="status">Đang tải danh sách học liệu…</p>
                ) : (
                  <>
                    {!!media.length && (
                      <div className="ga-teaching-files" aria-label="Chọn học liệu">
                        {media.map((r, i) => (
                          <button
                            type="button"
                            className={`btn ${chosen?.id === r.id ? 'btn--primary' : 'btn--ghost'}`}
                            key={r.id}
                            onClick={() => setMediaIndex(i)}
                          >
                            {i + 1}. {r.fileName}
                          </button>
                        ))}
                      </div>
                    )}
                    <LearningResourceViewer key={chosen?.id || activity.id} user={user} docKey={doc.id} resource={chosen} />
                    {media.length > 1 && (
                      <nav className="ga-teaching-controls" aria-label="Điều hướng học liệu">
                        <button type="button" className="btn" disabled={mediaIndex <= 0} onClick={() => setMediaIndex((i) => i - 1)}>
                          Tệp trước
                        </button>
                        <span>
                          {mediaIndex + 1}/{media.length} học liệu
                        </span>
                        <button
                          type="button"
                          className="btn"
                          disabled={mediaIndex >= media.length - 1}
                          onClick={() => setMediaIndex((i) => i + 1)}
                        >
                          Tệp tiếp
                        </button>
                      </nav>
                    )}
                  </>
                )}
                <nav className="ga-teaching-controls" aria-label="Điều hướng hoạt động">
                  <button type="button" className="btn" disabled={safeIndex === 0} onClick={() => move(-1)}>
                    ← Hoạt động trước
                  </button>
                  <span className="muted">Phím ← → khi không thao tác với học liệu</span>
                  <button type="button" className="btn btn--primary" disabled={safeIndex >= activities.length - 1} onClick={() => move(1)}>
                    Hoạt động tiếp →
                  </button>
                </nav>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
