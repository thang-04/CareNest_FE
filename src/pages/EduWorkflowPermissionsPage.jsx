import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useEduWorkflowPermissions } from '@/hooks/account/usePermissions';
import { saveEduWorkflowPermissions } from '@/services/account/permissionService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { PermissionTabs } from '@/components/permissions/PermissionTabs';
import { ReasonModal } from '@/components/permissions/ReasonModal';
import { SortHandle, SortableList, SortableRow } from '@/components/ui/Sortable';
import { moveItem } from '@/hooks/useSortableList';
import { Button, Checkbox, SelectField } from '@/components';
import { X } from '@/components/ui/icons';
import { ROLE_LABELS } from '@/models/User';
import {
  EDU_DOC_LABELS,
  EDU_WORKFLOW_COLUMNS,
  canTick,
  creatorOptions,
  reviewerOptions,
  toEduWorkflowRequest,
  toggleCell,
  validateEduWorkflow,
} from '@/utils/account/eduWorkflowPermissions';
import { permissionCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/permissions.css';

const ROWS = [
  { key: 'edit', label: 'Soạn', field: 'editRoles' },
  { key: 'approve', label: 'Duyệt', field: 'approveRoles' },
];

/** Tab Soạn / duyệt hồ sơ (BE EDU-108): HT tích mã soạn/duyệt theo vai trò, chọn người soạn và thứ tự duyệt. */
export default function EduWorkflowPermissionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useEduWorkflowPermissions();
  const [docs, setDocs] = useState([]);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDocs(data.documents);
  }, [data]);

  const update = (docType, fn) => setDocs((all) => all.map((d) => (d.docType === docType ? fn(d) : d)));
  const errors = validateEduWorkflow(docs);
  const dirty = !!data && JSON.stringify(docs) !== JSON.stringify(data.documents);

  const save = async (reason) => {
    setSaving(true);
    try {
      await saveEduWorkflowPermissions(toEduWorkflowRequest(data.revision, docs, reason), user);
      toast('Đã lưu phân quyền soạn / duyệt hồ sơ');
      setAsking(false);
      await reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Chưa lưu được phân quyền soạn / duyệt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page permission-center">
      <Breadcrumb items={permissionCrumbs('Soạn / duyệt hồ sơ')} />
      <div className="page__head permission-page-head">
        <div>
          <h1 className="page__title">Soạn / duyệt hồ sơ kế hoạch giáo dục</h1>
          <p className="text-sm text-2">
            Tích vai trò được soạn, được duyệt từng loại hồ sơ. Chọn người soạn và sắp thứ tự duyệt trong các vai trò đã tích. Hiệu trưởng luôn có
            quyền.
          </p>
        </div>
        <Button variant="primary" disabled={!dirty || Object.keys(errors).length > 0} onClick={() => setAsking(true)}>
          Lưu
        </Button>
      </div>
      <PermissionTabs />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        docs.map((doc) => (
          <section key={doc.docType} className="card stack gap-2">
            <h2 className="card__title">{EDU_DOC_LABELS[doc.docType] || doc.docType}</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">&nbsp;</th>
                    {EDU_WORKFLOW_COLUMNS.map((role) => (
                      <th key={role} scope="col">
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      {EDU_WORKFLOW_COLUMNS.map((role) => (
                        <td key={role}>
                          <Checkbox
                            aria-label={`${row.label} ${EDU_DOC_LABELS[doc.docType]}: ${ROLE_LABELS[role]}`}
                            checked={doc[row.field].includes(role)}
                            disabled={!canTick(row.key, role)}
                            onChange={(e) => update(doc.docType, (d) => toggleCell(d, row.key, role, e.target.checked))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SelectField
              label="Người soạn"
              value={doc.creators[0] || ''}
              onChange={(e) => update(doc.docType, (d) => ({ ...d, creators: e.target.value ? [e.target.value] : [] }))}
            >
              <option value="">-- Chọn vai trò soạn --</option>
              {[...new Set([...doc.creators, ...creatorOptions(doc)])].map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </SelectField>

            <div className="stack gap-1" aria-label={`Thứ tự duyệt ${EDU_DOC_LABELS[doc.docType]}`}>
              <span className="text-sm fw-600">Thứ tự duyệt</span>
              <SortableList
                ids={doc.reviewers}
                onMove={(from, to) => update(doc.docType, (d) => ({ ...d, reviewers: moveItem(d.reviewers, from, to) }))}
                labelOf={(index) => ROLE_LABELS[doc.reviewers[index]]}
              >
                {doc.reviewers.map((role, index) => (
                  <SortableRow key={role} id={role} as="div" className="row gap-2">
                    <span>{index + 1}.</span>
                    <SortHandle label={ROLE_LABELS[role]} />
                    <span>{ROLE_LABELS[role]}</span>
                    <Button
                      variant="icon"
                      aria-label={`Bỏ ${ROLE_LABELS[role]} khỏi thứ tự duyệt`}
                      onClick={() => update(doc.docType, (d) => ({ ...d, reviewers: d.reviewers.filter((r) => r !== role) }))}
                    >
                      <X size={16} aria-hidden />
                    </Button>
                  </SortableRow>
                ))}
              </SortableList>
              {reviewerOptions(doc).length > 0 && (
                <SelectField
                  label="Thêm người duyệt"
                  value=""
                  onChange={(e) => e.target.value && update(doc.docType, (d) => ({ ...d, reviewers: [...d.reviewers, e.target.value] }))}
                >
                  <option value="">+ Thêm người duyệt</option>
                  {reviewerOptions(doc).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>
            {errors[doc.docType] && (
              <p className="text-sm text-danger" role="alert">
                {errors[doc.docType]}
              </p>
            )}
          </section>
        ))
      )}

      {asking && <ReasonModal saving={saving} onClose={() => setAsking(false)} onSubmit={save} />}
    </div>
  );
}
