import { planLevel, planRoute } from '@/models/education-plan/planLevel.mjs';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, YearPlanStatusBadge, fmtDateTime } from '@/components/education-plan/eduUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { ROLES } from '@/models/User';
import { AGE_GROUPS, ageRangeOptions, sameAgeRange } from '@/models/education-plan/educationPlanConstants';
import { useAsync } from '@/hooks/useAsync';
import { usePolling } from '@/hooks/usePolling';
import { DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { getClassDocSummaries, getReviewQueue } from '@/services/education-plan/educationPlanService';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { CLASS_DOC_LABELS } from '@/models/education-plan/classPlan';
import { mixedPage } from '@/models/education-plan/classDocSummary.mjs';
import { clickableRowProps } from '@/utils/clickableRow';
import { Eye } from '@/components/ui/icons';
import { LoadingState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { FilterText } from '@/components/education-plan/planUi';
import { isReviewTurn } from '@/models/education-plan/reviewTurn.mjs';

// edu-list-paging (Tiền 25/11/2026): 5 hồ sơ/trang; hồ sơ lớp chờ duyệt theo BE (view REVIEW)
const PAGE_SIZE = 5;
const REVIEW_KINDS = ['semester', 'dossier'];
import { isEduVicePrincipal } from '@/utils/education-plan/eduPermissions';

/**
 * Hộp duyệt: kế hoạch giáo dục ngày (kế hoạch chủ đề + giáo án các nhánh) của các lớp trong khối đang chờ duyệt.
 */
export default function PlanReviewQueuePage() {
  const { user, schoolYearId, classes } = useEducationPlan();
  const navigate = useNavigate();
  const filterId = useId();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  // Kế hoạch năm/tổ chờ duyệt: BE trả riêng (danh sách thường chỉ có bản đã ban hành), tự làm mới không cần tải lại trang
  const queue = useAsync(() => getReviewQueue(user, schoolYearId), [user.id, schoolYearId], {
    enabled: !!schoolYearId,
    refreshOnDataChange: true,
  });
  const reviewGoals = queue.data || [];
  const classOf = (id) => classes.find((c) => c.id === id);

  // Lọc nhóm tuổi trước rồi lớp (spec 005 FR-022); kế hoạch năm/tổ không theo lớp
  // Hiệu trưởng lọc theo nhóm tuổi; Phó hiệu trưởng lọc thêm theo lớp của năm học đang chọn (Tiền 12/11/2026)
  const groups = ageRangeOptions();
  // Tổ trưởng chỉ duyệt nhóm tuổi của mình: nhóm tuổi hiện dạng chữ, chỉ chọn lớp
  const isLeader = user.role === ROLES.TEAM_LEADER;
  const canFilterClass = isEduVicePrincipal(user) || isLeader;
  const leaderGroup = AGE_GROUPS.find((g) => String(g.id) === String(user.ageGroupId));
  const groupClasses = classes.filter((c) =>
    isLeader ? String(c.ageGroupId) === String(user.ageGroupId) : !ageGroupId || sameAgeRange(c.ageGroupId, ageGroupId),
  );
  const scopedClassId = groupClasses.some((c) => c.id === classId) ? classId : '';
  const filterClassIds = scopedClassId ? [scopedClassId] : ageGroupId || isLeader ? groupClasses.map((c) => c.id) : [];

  // edu-list-paging (Tiền 25/11/2026): 5 hồ sơ/trang; kế hoạch năm/tổ đứng trước, tài liệu lớp lấy từng trang ở BE
  const headGoals = reviewGoals.filter((g) => !ageGroupId || sameAgeRange(g.ageGroupId != null ? String(g.ageGroupId) : '', ageGroupId));
  const slice = mixedPage(headGoals.length, page - 1, PAGE_SIZE);
  const noClass = (ageGroupId || isLeader) && !filterClassIds.length;
  const docs = useAsync(
    async () => {
      const filter = { review: true, myTurn: true, kinds: REVIEW_KINDS, classIds: filterClassIds, size: PAGE_SIZE };
      // Biết tổng số tài liệu lớp để vẽ phân trang kể cả khi trang này chỉ có kế hoạch năm/tổ
      const requests = slice.docRequests.length ? slice.docRequests : [{ page: 0, from: 0, to: 0 }];
      const pages = await Promise.all(requests.map((r) => getClassDocSummaries(schoolYearId, user, { ...filter, page: r.page })));
      return { total: pages[0].totalElements, items: pages.flatMap((p, i) => p.items.slice(requests[i].from, requests[i].to)) };
    },
    [user.id, schoolYearId, page, headGoals.length, filterClassIds.join(',')],
    { enabled: !!schoolYearId && !noClass, refreshOnDataChange: true },
  );
  usePolling(
    () => {
      queue.reload({ silent: true });
      docs.reload({ silent: true });
    },
    { enabled: !!schoolYearId },
  );
  const pageDocs = noClass ? [] : docs.data?.items || [];
  const total = headGoals.length + (noClass ? 0 : docs.data?.total || 0);

  const sentAt = (doc) => [...(doc.history || [])].reverse().find((h) => !h.tone);
  const items = [
    ...headGoals.slice(...slice.headItems).map((g) => ({
      key: `y-${g.id}`,
      kind: 'year',
      doc: g,
      cls: '—',
      ageGroupId: g.ageGroupId != null ? String(g.ageGroupId) : '',
      what: g.title,
      label: g.planTypeLabel || (planLevel(g) === 'SCHOOL_YEAR' ? 'Kế hoạch năm học' : 'Kế hoạch tổ'),
      to: `${planRoute(g)}/${g.id}?review=1`,
      by: g.sentBy?.name || submitEntryOf(g)?.by,
      at: g.sentAt ?? g.sentBy?.at,
    })),
    // Spec 003: kế hoạch giáo dục chủ đề (lịch nhánh + chủ đề theo kỳ) và kế hoạch giáo dục ngày là đơn vị duyệt
    // Spec 003: kế hoạch giáo dục chủ đề (lịch nhánh + chủ đề theo kỳ) và kế hoạch giáo dục ngày là đơn vị duyệt
    ...pageDocs.map((d) => {
      if (d.kind === 'semester')
        return {
          kind: 'semester',
          label: 'Học kỳ',
          doc: d,
          what: `Học kỳ ${d.semesterNo}: chủ đề nhánh, kế hoạch chủ đề, kế hoạch tuần · ${(d.themeIds || []).length} chủ đề`,
          to: `/education/theme-plans/${d.classId}?hk=${d.semesterNo}&plan=${encodeURIComponent(d.yearPlanId)}&review=1`,
        };
      return {
        kind: 'theme',
        label: 'Kế hoạch giáo dục ngày',
        doc: d,
        what: `Chủ đề ${d.themeNo || ''}: ${d.themeName || '—'} · kế hoạch giáo dục ngày`,
        // Mở trang xem giáo án ngày của chủ đề: xem nội dung và duyệt tại đó (EDU-93)
        to: `/education/day-plans/${d.classId}?theme=${d.themeId}&plan=${encodeURIComponent(d.yearPlanId)}&review=1`,
      };
    }),
  ].map((it) => ({
    key: `${it.kind}-${it.doc.id}`,
    cls: classOf(it.doc.classId)?.name || '—',
    ageGroupId: classOf(it.doc.classId)?.ageGroupId || '',
    by: sentAt(it.doc)?.by,
    at: sentAt(it.doc)?.at,
    note: submitEntryOf(it.doc)?.note,
    ...it,
    // Không kèm quyền (dữ liệu cũ) ⇒ coi như đúng lượt như trước
    turn: isReviewTurn(it.doc) !== false,
  }));

  const shown = items;
  // HT mặc định chỉ duyệt kế hoạch năm học, không theo lớp (EDU-54) ⇒ bỏ cột Lớp; vẫn hiện khi trường cấu hình HT duyệt tài liệu lớp
  const showClass = user.role !== ROLES.PRINCIPAL || shown.some((it) => it.cls !== '—');

  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Duyệt kế hoạch giáo dục' }]} title="Duyệt kế hoạch giáo dục" />
        <div className="card mb-16">
          <div className="filter-bar">
            {isLeader ? (
              <FilterText label="Nhóm tuổi" value={leaderGroup?.name} />
            ) : (
              <div className="field">
                <label className="field__label" htmlFor={`${filterId}-age`}>
                  Nhóm tuổi
                </label>
                <select
                  id={`${filterId}-age`}
                  className="select"
                  value={ageGroupId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setAgeGroupId(next);
                    setPage(1);
                    // Đổi nhóm tuổi: giữ lớp đang chọn nếu lớp đó thuộc nhóm mới
                    if (next && classOf(classId) && !sameAgeRange(classOf(classId).ageGroupId, next)) setClassId('');
                  }}
                >
                  <option value="">Tất cả</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {canFilterClass && (
              <div className="field">
                <label className="field__label" htmlFor={`${filterId}-class`}>
                  Lớp
                </label>
                <select
                  id={`${filterId}-class`}
                  className="select"
                  value={scopedClassId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả</option>
                  {groupClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
      <Card bodyClass={null}>
        {queue.loading || docs.loading ? (
          <LoadingState />
        ) : shown.length === 0 ? (
          <EmptyState title="Chưa có tài liệu chờ duyệt" />
        ) : (
          <div className="table-wrap">
            <table className="table ga-plan-table ga-list-table">
              <thead>
                <tr>
                  {/* Bảng ga-plan-table cho chữ trong ô xuống dòng; cột ngắn giữ bề rộng tối thiểu để không gãy chữ */}
                  <th className="min-w-150">Loại</th>
                  {showClass && <th className="w-110">Lớp</th>}
                  <th>Nội dung</th>
                  <th className="min-w-150">Người gửi</th>
                  <th>Gửi lúc</th>
                  <th className="center">Trạng thái</th>
                  <th className="center">Hạn</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => (
                  <tr key={it.key} className="row-click" {...clickableRowProps(() => navigate(it.to))}>
                    <td className="nowrap">
                      <div className="ga-cell-title">{it.label || CLASS_DOC_LABELS[it.kind]}</div>
                    </td>
                    {showClass && <td className="nowrap">{it.cls}</td>}
                    <td>
                      {it.what}
                      {it.note && <div className="ga-cell-sub">Ghi chú: {it.note}</div>}
                    </td>
                    <td className="nowrap">{it.by || '—'}</td>
                    <td className="nowrap">{it.at ? fmtDateTime(it.at) : '—'}</td>
                    <td className="center nowrap">
                      {it.kind === 'year' ? (
                        <YearPlanStatusBadge status={it.doc.status} doc={it.doc} />
                      ) : (
                        <EduStatusBadge status={it.doc.status} doc={it.doc} />
                      )}
                    </td>
                    <td className="center nowrap">
                      <DeadlineBadge doc={it.kind === 'year' ? it.doc.timeLock : it.doc} />
                    </td>
                    <td className="cell--actions">
                      {/* Cả dòng bấm được; nút cho thấy rõ chỗ mở và dùng được bằng bàn phím */}
                      <button
                        type="button"
                        className="btn btn--sm btn--outline-primary nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(it.to);
                        }}
                      >
                        <Eye size={16} aria-hidden /> {it.turn ? 'Mở duyệt' : 'Xem'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} unit="hồ sơ" />}
      </Card>
    </div>
  );
}
