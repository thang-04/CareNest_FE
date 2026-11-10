import { useState } from 'react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { usePrepClasses } from '@/hooks/school-config/useSchoolConfig';
import { useMasterData } from '@/hooks/useMasterData';
import { GENDER_LABELS } from '@/models/School';
import { formatDate } from '@/utils/format';

/**
 * Lớp năm học mới (BE CFG-YR-05): từ ngày mở chuẩn bị, giáo viên xem lớp mình dạy, tổ trưởng xem mọi lớp nhóm tuổi mình ở
 * năm sắp diễn ra, kèm trẻ đã được xếp vào (Xếp lớp năm mới). Chỉ xem; trẻ vào lớp thật, điểm danh, đánh giá từ ngày bắt đầu năm.
 */
export default function NewYearClassPage() {
  const { schoolYears } = useSchoolYear();
  const md = useMasterData();
  const preparing = schoolYears.filter((y) => y.preparing);
  const [picked, setPicked] = useState('');
  const yearId = picked || preparing[0]?.id || '';
  const { prep, loading, error, reload } = usePrepClasses(yearId);

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Quản lý trẻ' }, { label: 'Lớp năm học mới' }]} />
      <div className="page__head">
        <h1 className="page__title">Lớp năm học mới</h1>
      </div>
      {!yearId ? (
        <div className="card">
          <EmptyState
            title="Chưa có năm học đang chuẩn bị"
            description="Từ ngày mở chuẩn bị do Hiệu trưởng đặt, lớp và danh sách trẻ năm học mới hiện ở đây."
          />
        </div>
      ) : (
        <div className="card">
          <div className="filter-bar">
            {preparing.length > 1 && (
              <div className="field">
                <span className="field__label">Năm học</span>
                <select className="select" aria-label="Năm học" value={yearId} onChange={(e) => setPicked(e.target.value)}>
                  {preparing.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {prep && (
              <p className="muted text-sm">
                Năm học {prep.schoolYearName} · Đang chuẩn bị từ {formatDate(prep.prepDate)} · Bắt đầu {formatDate(prep.startDate)}. Danh
                sách theo Xếp lớp năm mới, chỉ xem; điểm danh, đánh giá mở từ ngày bắt đầu.
              </p>
            )}
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading || !prep ? (
            <LoadingState />
          ) : prep.classes.length === 0 ? (
            <EmptyState
              title="Bạn chưa được phân công lớp nào ở năm học mới"
              description="Hiệu trưởng phân công giáo viên ở màn Phân công giáo viên của năm học mới."
            />
          ) : (
            prep.classes.map((c) => (
              <section key={c.id} className="card__body">
                <h2 className="section-title">
                  {c.name}
                  {/* Tổ trưởng / BGH xem lớp không dạy: chỉ xem */}
                  {!c.teaches && ' (chỉ xem)'}
                  <span className="muted text-sm">
                    {' '}
                    · {md.campusById(c.campusId)?.name || ''} · {c.children.length} trẻ
                  </span>
                </h2>
                {c.children.length === 0 ? (
                  <p className="muted text-sm">Chưa có trẻ được xếp vào lớp.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="table table--grid table--compact">
                      <thead>
                        <tr>
                          <th className="num">STT</th>
                          <th>Họ và tên</th>
                          <th>Ngày sinh</th>
                          <th>Giới tính</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.children.map((ch, i) => (
                          <tr key={ch.id}>
                            <td className="num">{i + 1}</td>
                            <td>{ch.fullName}</td>
                            <td>{formatDate(ch.dateOfBirth)}</td>
                            <td>{GENDER_LABELS[ch.gender] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
