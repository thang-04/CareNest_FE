import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Card, PageHead } from '@/components/education-plan/eduUi';
import { GoalPicker } from '@/components/education-plan/GoalPicker';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useCurriculum } from '@/hooks/education-plan/useCurriculum';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { curriculumPickTree, curriculumTree } from '@/models/education-plan/curriculum.mjs';

const fmtIso = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * Trang đối chiếu nguồn Chương trình GDMN của Bộ (BE:EDU-28). Giao diện như hộp "Lấy từ Chương trình của Bộ" (Tiền 03/11):
 * cùng danh sách (lĩnh vực con / kết quả cần đạt / mã MT), cùng bộ lọc gợi ý nội dung, chỉ xem.
 */
export default function CurriculumSourcesPage() {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const ageGroupId = AGE_GROUPS.some((a) => a.id === params.get('ageGroup')) ? params.get('ageGroup') : 'ag-3';
  const tab = params.get('tab') === 'contents' ? 'contents' : 'goals';
  const data = useCurriculum(ageGroupId);
  const tree = useMemo(() => curriculumTree(data.goals), [data.goals]);
  // Mục tiêu giữ id cg-{id} để đường dẫn đối chiếu (#cg-…) từ kế hoạch vẫn cuộn đúng chỗ
  const pickTree = useMemo(() => curriculumPickTree(tree, (id) => `cg-${id}`), [tree]);
  const [domainFilter, setDomainFilter] = useState('');
  const [subFilter, setSubFilter] = useState('');
  const source = data.sources[0];
  const inDomain = data.contents.filter((c) => !domainFilter || c.domainName === domainFilter);
  const subDomains = [...new Set(inDomain.map((c) => c.subDomain).filter(Boolean))];
  const suggestions = inDomain.filter((c) => !subFilter || c.subDomain === subFilter);

  useEffect(() => {
    if (!data.loading && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'center' });
  }, [data.loading, hash]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="page ga-page ga-cur-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Nguồn chương trình của Bộ' }]} title="Nguồn chương trình của Bộ" />
      <Card bodyClass={null}>
        <div className="card__body stack">
          <div className="ga-cur-meta">
            <select
              className="select ga-cur-age"
              aria-label="Nhóm tuổi"
              value={ageGroupId}
              onChange={(e) => {
                setParam('ageGroup', e.target.value);
                setDomainFilter('');
                setSubFilter('');
              }}
            >
              {AGE_GROUPS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {source && (
              <span className="muted text-sm ga-cur-meta__source" title={`${source.title} — ${source.issuer}`}>
                {source.documentNo} · {fmtIso(source.issuedDate)}
              </span>
            )}
            {source?.officialUrl && (
              <a className="text-sm" href={source.officialUrl} target="_blank" rel="noopener noreferrer">
                Bản gốc
              </a>
            )}
          </div>
          <Tabs
            ariaLabel="Danh mục"
            value={tab}
            onChange={(key) => setParam('tab', key)}
            items={[
              { key: 'goals', label: 'Mục tiêu', count: data.goals.length || null },
              { key: 'contents', label: 'Gợi ý nội dung', count: data.contents.length || null },
            ]}
          />
          {data.loading ? (
            <LoadingState />
          ) : data.error ? (
            <ErrorState error={data.error} onRetry={data.reload} />
          ) : tab === 'goals' ? (
            !data.goals.length ? (
              <EmptyState title="Chưa có dữ liệu của Bộ cho nhóm tuổi này" />
            ) : (
              <GoalPicker tree={pickTree} readOnly kindLabels={{ sub: 'Lĩnh vực con', group: 'Kết quả cần đạt' }} />
            )
          ) : !data.contents.length ? (
            <EmptyState title="Chưa có gợi ý nội dung cho nhóm tuổi này" />
          ) : (
            <>
              <div className="ga-cur-toolbar ga-cur-filters ga-cur-content-filters">
                <div className="field">
                  <label className="field__label" htmlFor="src-domain">
                    Lĩnh vực
                  </label>
                  <select
                    id="src-domain"
                    className="select"
                    value={domainFilter}
                    title={domainFilter || 'Tất cả lĩnh vực'}
                    onChange={(e) => {
                      setDomainFilter(e.target.value);
                      setSubFilter('');
                    }}
                  >
                    <option value="">Tất cả lĩnh vực</option>
                    {[...new Set(data.contents.map((c) => c.domainName))].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                {subDomains.length > 0 && (
                  <div className="field">
                    <label className="field__label" htmlFor="src-sub">
                      Lĩnh vực con
                    </label>
                    <select
                      id="src-sub"
                      className="select"
                      value={subFilter}
                      title={subFilter || 'Tất cả'}
                      onChange={(e) => setSubFilter(e.target.value)}
                    >
                      <option value="">Tất cả</option>
                      {subDomains.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="ga-cur-list ga-cur-content-list">
                {!suggestions.length && (
                  <p className="muted" role="status">
                    Không có nội dung phù hợp với bộ lọc.
                  </p>
                )}
                {suggestions.map((c, i) => {
                  const head = `${c.subDomain ? `${c.subDomain} › ` : ''}${c.categoryNo ? `${c.categoryNo}. ` : ''}${c.category}`;
                  const prev = suggestions[i - 1];
                  const showHead = !prev || `${prev.subDomain}|${prev.category}` !== `${c.subDomain}|${c.category}`;
                  return (
                    <div key={c.id} id={`cc-${c.id}`} className="ga-cur-suggestion">
                      {showHead && <div className="ga-cur-sub__name">{head}</div>}
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
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
