import { useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Card, PageHead } from '@/components/education-plan/eduUi';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useCurriculum } from '@/hooks/education-plan/useCurriculum';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { curriculumTree } from '@/models/education-plan/curriculum.mjs';

const fmtIso = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

/** Trang đối chiếu nguồn Chương trình GDMN của Bộ (BE:EDU-28): văn bản, link gốc, danh mục theo nhóm tuổi. */
export default function CurriculumSourcesPage() {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const ageGroupId = AGE_GROUPS.some((a) => a.id === params.get('ageGroup')) ? params.get('ageGroup') : 'ag-3';
  const tab = params.get('tab') === 'contents' ? 'contents' : 'goals';
  const data = useCurriculum(ageGroupId);
  const tree = useMemo(() => curriculumTree(data.goals), [data.goals]);
  const source = data.sources[0];

  // Mở từ nhãn "Theo Bộ" (#cg-{id}): cuộn tới đúng mục tiêu
  useEffect(() => {
    if (!data.loading && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' });
  }, [data.loading, hash]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Nguồn chương trình của Bộ' }]}
        title="Nguồn chương trình của Bộ"
        desc="Đối chiếu mục tiêu, nội dung lấy vào kế hoạch năm với văn bản của Bộ Giáo dục và Đào tạo."
      />
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} onRetry={data.reload} />
      ) : (
        <>
          {source && (
            <Card title="Văn bản nguồn">
              <dl className="info-list">
                <dt>Văn bản</dt>
                <dd>{source.title}</dd>
                <dt>Số hiệu, ngày</dt>
                <dd>
                  {source.documentNo} ngày {fmtIso(source.issuedDate)} · {source.issuer}
                </dd>
                <dt>Bản gốc chính thức</dt>
                <dd>
                  <a href={source.officialUrl} target="_blank" rel="noopener noreferrer">
                    {source.officialUrl}
                  </a>{' '}
                  <span className="muted text-sm">(tra theo số hiệu {source.documentNo})</span>
                </dd>
                <dt>Nơi lấy dữ liệu</dt>
                <dd>
                  <a href={source.retrievedFromUrl} target="_blank" rel="noopener noreferrer">
                    Toàn văn văn bản hợp nhất
                  </a>{' '}
                  <span className="muted text-sm">· cập nhật {fmtIso(source.retrievedAt)}</span>
                </dd>
                <dt>Phạm vi, cách lấy</dt>
                <dd className="text-sm">{source.scopeNote}</dd>
              </dl>
            </Card>
          )}
          <Card
            title="Danh mục theo nhóm tuổi"
            actions={
              <select className="select" aria-label="Nhóm tuổi" value={ageGroupId} onChange={(e) => setParam('ageGroup', e.target.value)}>
                {AGE_GROUPS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            }
          >
            <Tabs
              ariaLabel="Danh mục"
              value={tab}
              onChange={(key) => setParam('tab', key)}
              items={[
                { key: 'goals', label: 'Kết quả mong đợi (mục tiêu)', count: data.goals.length },
                { key: 'contents', label: 'Nội dung giáo dục (gợi ý)', count: data.contents.length },
              ]}
            />
            {tab === 'goals' ? (
              !data.goals.length ? (
                <EmptyState title="Chưa có dữ liệu của Bộ cho nhóm tuổi này" />
              ) : (
                tree.map((domain) => (
                  <section key={domain.name}>
                    <h2 className="section-title">{domain.name}</h2>
                    {domain.subs.map((sub) =>
                      sub.groups.map((group) => (
                        <div key={`${sub.name}-${group.key}`} className="mb-8">
                          <p className="fw-600">
                            {sub.name && <span className="muted">{sub.name} › </span>}
                            {group.no ? `${group.no}. ` : ''}
                            {group.text}
                          </p>
                          <ul>
                            {group.goals.map((goal) => (
                              <li key={goal.id} id={`cg-${goal.id}`}>
                                {goal.goalNo && <span className="ga-goal-code">{goal.goalNo}</span>} {goal.goalText}{' '}
                                <span className="muted text-xs">({goal.sectionRef})</span>
                                {goal.contents.length > 0 && (
                                  <ul className="muted text-sm">
                                    {goal.contents.map((c) => (
                                      <li key={c}>{c}</li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )),
                    )}
                  </section>
                ))
              )
            ) : !data.contents.length ? (
              <EmptyState title="Chưa có gợi ý nội dung cho nhóm tuổi này" />
            ) : (
              <ul>
                {data.contents.map((c, i) => {
                  const prev = data.contents[i - 1];
                  const head =
                    !prev || `${prev.domainName}|${prev.subDomain}|${prev.category}` !== `${c.domainName}|${c.subDomain}|${c.category}`;
                  return (
                    <li key={c.id} id={`cc-${c.id}`}>
                      {head && (
                        <p className="fw-600">
                          {c.domainName}
                          {c.subDomain ? ` › ${c.subDomain}` : ''} › {c.categoryNo ? `${c.categoryNo}. ` : ''}
                          {c.category} <span className="muted text-xs">({c.sectionRef})</span>
                        </p>
                      )}
                      {c.label && <span className="muted">{c.label}: </span>}
                      {c.text}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
