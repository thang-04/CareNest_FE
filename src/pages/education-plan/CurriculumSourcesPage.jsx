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
    <div className="page ga-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Nguồn chương trình của Bộ' }]} title="Nguồn chương trình của Bộ" />
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
                  {source.documentNo} · {fmtIso(source.issuedDate)} · {source.issuer}
                </dd>
                <dt>Bản gốc</dt>
                <dd>
                  <a href={source.officialUrl} target="_blank" rel="noopener noreferrer">
                    {source.officialUrl}
                  </a>
                </dd>
                <dt>Nơi lấy dữ liệu</dt>
                <dd>
                  <a href={source.retrievedFromUrl} target="_blank" rel="noopener noreferrer">
                    Toàn văn văn bản hợp nhất
                  </a>{' '}
                  <span className="muted text-sm">· {fmtIso(source.retrievedAt)}</span>
                </dd>
                <dt>Phạm vi</dt>
                <dd className="text-sm">
                  <details>
                    <summary className="muted">Xem</summary>
                    {source.scopeNote}
                  </details>
                </dd>
              </dl>
            </Card>
          )}
          <Card className="mt-16" bodyClass={null}>
            <div className="filter-bar">
              <select className="select" aria-label="Nhóm tuổi" value={ageGroupId} onChange={(e) => setParam('ageGroup', e.target.value)}>
                {AGE_GROUPS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <Tabs
              ariaLabel="Danh mục"
              value={tab}
              onChange={(key) => setParam('tab', key)}
              items={[
                { key: 'goals', label: 'Mục tiêu', count: data.goals.length },
                { key: 'contents', label: 'Gợi ý nội dung', count: data.contents.length },
              ]}
            />
            <div className="card__body">
              {tab === 'goals' ? (
                !data.goals.length ? (
                  <EmptyState title="Chưa có dữ liệu của Bộ cho nhóm tuổi này" />
                ) : (
                  <div className="ga-cur-list">
                    {tree.map((domain) => (
                      <section key={domain.name} className="ga-cur-domain">
                        <h2 className="ga-cur-domain__head">{domain.name}</h2>
                        {domain.subs.map((sub) => (
                          <div key={sub.key || '-'} id={sub.id ? `cs-${sub.id}` : undefined} className="ga-cur-sub">
                            {sub.name && <div className="ga-cur-sub__name">{sub.name}</div>}
                            {sub.groups.map((group) => (
                              <div key={group.key} id={group.id ? `cgr-${group.id}` : undefined} className="ga-cur-group">
                                <div className="ga-cur-group__head">
                                  {group.no ? `${group.no}. ` : ''}
                                  {group.text}
                                </div>
                                {group.goals.map((goal) => (
                                  <div key={goal.id} id={`cg-${goal.id}`} className="ga-cur-item ga-cur-row">
                                    <div className="ga-cur-row__text">
                                      {goal.goalNo && <span className="ga-goal-code">{goal.goalNo}</span>} {goal.goalText}{' '}
                                      <span className="muted text-xs">({goal.sectionRef})</span>
                                      {goal.contents.length > 0 && (
                                        <ul className="muted text-sm">
                                          {goal.contents.map((c) => (
                                            <li key={c}>{c}</li>
                                          ))}
                                        </ul>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                )
              ) : !data.contents.length ? (
                <EmptyState title="Chưa có gợi ý nội dung cho nhóm tuổi này" />
              ) : (
                <div className="ga-cur-list">
                  {data.contents.map((c, i) => {
                    const prev = data.contents[i - 1];
                    const head =
                      !prev || `${prev.domainName}|${prev.subDomain}|${prev.category}` !== `${c.domainName}|${c.subDomain}|${c.category}`;
                    return (
                      <div key={c.id} id={`cc-${c.id}`}>
                        {head && (
                          <div className="ga-cur-sub__name">
                            {c.domainName}
                            {c.subDomain ? ` › ${c.subDomain}` : ''} › {c.categoryNo ? `${c.categoryNo}. ` : ''}
                            {c.category} ({c.sectionRef})
                          </div>
                        )}
                        <div className="ga-cur-row">
                          <span className="ga-cur-row__text">
                            {c.label && <span className="muted">{c.label}: </span>}
                            {c.text}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
