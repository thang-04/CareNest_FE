import { readDb } from '@/mocks/mockDatabase';
import { eduError } from './eduMockErrors';
import { ROLES } from '@/models/User';
import { activitySignature, fileLimit } from '@/models/education-plan/learningResources.mjs';
import { themeActivities, themeGoalBlocks, isEditableStatus } from '@/models/education-plan/classPlan';
import { numberGoals } from '@/models/education-plan/goalTable';
import { currentPlanOf, versionOf } from '@/models/education-plan/planVersions.mjs';

let opening;
const open = () =>
  (opening ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('carenest-learning-resources', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('resources', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(new Error('Không mở được bộ nhớ học liệu trên máy này'));
    };
  }));
async function run(mode, operation) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('resources', mode);
    const request = operation(tx.objectStore('resources'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || new Error('Không lưu được học liệu'));
    tx.onabort = () => reject(tx.error || new Error('Lưu học liệu bị gián đoạn'));
  });
}
// BE giả: quyền/trạng thái theo BE EDU-12/18; binary không vào mockDatabase/localStorage.
function access(user, docKey, write = false) {
  const db = readDb();
  const doc = db.eduClassTheme?.find((d) => d.id === docKey);
  const cls = db.classes?.find((c) => c.id === doc?.classId);
  if (!doc || !cls) throw eduError('THEME_PLAN_NOT_FOUND');
  const assigned = cls.teacherIds?.includes(user?.id);
  const read =
    assigned ||
    [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(user?.role) ||
    (user?.role === ROLES.TEAM_LEADER && user.ageGroupId === cls.ageGroupId);
  if (!read || (write && !assigned)) throw eduError('CLASS_ACCESS_DENIED');
  if (write && !isEditableStatus(doc.status)) throw eduError('CLASS_DOC_LOCKED');
  const plan = db.eduGoals?.find((g) => g.id === doc.yearPlanId);
  // BE:EDU-26 — phiên bản kế hoạch năm đã bị thay thế: học liệu của tài liệu cũng chỉ xem
  const current = plan && currentPlanOf(db.eduGoals, plan.ageGroupId, plan.schoolYear);
  const superseded = !!current && versionOf(current) > versionOf(plan);
  if (write && superseded) throw eduError('YEAR_PLAN_SUPERSEDED');
  return { doc, editor: assigned && isEditableStatus(doc.status) && !superseded, plan };
}
async function active(doc, r) {
  if (!r.activityKey) return false;
  const goalId = r.activityKey.split('#')[0];
  const row = doc.rows?.[goalId];
  return (
    themeActivities([{ goals: [{ id: goalId }] }], () => row).some((a) => a.id === r.activityKey) &&
    r.activitySignature === (await activitySignature(row?.activities || ''))
  );
}
async function validate(doc, plan, binding) {
  const blocks = themeGoalBlocks(plan?.domains || [], numberGoals(plan?.domains || []), doc.themeId);
  const activities = themeActivities(blocks, (g) => doc.rows?.[g.id]);
  if (
    !activities.some((a) => a.id === binding.activityKey) ||
    binding.activitySignature !== (await activitySignature(doc.rows?.[binding.activityKey.split('#')[0]]?.activities))
  )
    throw eduError('ACTIVITY_CHANGED');
}
const metadata = async (doc, r) => {
  const { blob, ...meta } = r;
  void blob;
  return { ...meta, active: await active(doc, r) };
};
export const learningResourceMockRepository = {
  async list(user, key) {
    const { doc, editor } = access(user, key);
    const all = await run('readonly', (s) => s.getAll());
    const result = await Promise.all(all.filter((r) => r.docKey === key).map((r) => metadata(doc, r)));
    return result.filter((r) => editor || r.active);
  },
  async upload(user, key, file, binding, requestId) {
    const { doc, plan } = access(user, key, true);
    const all = await run('readonly', (s) => s.getAll());
    const replay = all.find((r) => r.docKey === key && r.requestId === requestId);
    if (replay) return metadata(doc, replay);
    await validate(doc, plan, binding);
    const extension = file.name.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'pdf', 'pptx', 'docx', 'xlsx', 'txt', 'csv'].includes(extension))
      throw eduError('UNSUPPORTED_MEDIA_TYPE');
    if (!file.size || file.size > fileLimit(file.type)) throw file.size ? eduError('FILE_TOO_LARGE') : eduError('FILE_EMPTY');
    const row = {
      id: crypto.randomUUID(),
      docKey: key,
      ...binding,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      byteSize: file.size,
      uploadedBy: user.id,
      createdAt: new Date().toISOString(),
      requestId,
      blob: file,
    };
    // Kiểm trạng thái lại sau các thao tác bất đồng bộ, trước ghi.
    access(user, key, true);
    await run('readwrite', (s) => s.put(row));
    return metadata(doc, row);
  },
  async bind(user, key, id, binding) {
    const { doc, plan } = access(user, key, true);
    await validate(doc, plan, binding);
    const row = await run('readonly', (s) => s.get(id));
    if (!row || row.docKey !== key) throw eduError('LEARNING_RESOURCE_NOT_FOUND');
    access(user, key, true);
    const next = { ...row, ...binding };
    await run('readwrite', (s) => s.put(next));
    return metadata(doc, next);
  },
  async detach(user, key, id) {
    access(user, key, true);
    const row = await run('readonly', (s) => s.get(id));
    if (!row || row.docKey !== key) throw eduError('LEARNING_RESOURCE_NOT_FOUND');
    access(user, key, true);
    await run('readwrite', (s) => s.put({ ...row, activityKey: null, activitySignature: null }));
  },
  async content(user, key, id) {
    const { doc, editor } = access(user, key);
    const row = await run('readonly', (s) => s.get(id));
    if (!row || row.docKey !== key || (!editor && !(await active(doc, row)))) throw eduError('LEARNING_RESOURCE_NOT_FOUND');
    return row.blob;
  },
};
