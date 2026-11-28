import { childNameWithHistory } from '@/utils/childHistory';
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { formatDate } from '@/utils/format';
import { approveRow, defaultSigners, signerCell } from '@/utils/assessment/docSignatures';
import { contentWidth, gridOpen, pageCss, share } from '@/utils/assessment/docLayout';
const esc = (v = '') =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const semesterLabel = (n) => (n === 1 ? 'Học kỳ I' : 'Học kỳ II');
const tick = (value, option) => (value === option ? '✓' : '');
const signingPlace = DEFAULT_PRINT_TEMPLATE.address.match(/xã ([^,]+)/i)?.[1] || '';

function signingDate(confirmedAt) {
  if (!confirmedAt) return 'ngày ..... tháng ..... năm ..........';
  const date = new Date(confirmedAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [day, month, year] = date.split('/').map(Number);
  return `ngày ${day} tháng ${month} năm ${year}`;
}
export function semesterAssessmentRows(board) {
  return [
    ['BẢNG TỔNG HỢP ĐÁNH GIÁ SỰ PHÁT TRIỂN CỦA TRẺ'],
    [`${semesterLabel(board.semester)} · ${board.className} · ${board.yearName}`],
    [`${formatDate(board.startDate)} – ${formatDate(board.endDate)}`],
    ['STT', 'Họ tên trẻ', ...board.domains.flatMap((d) => [`${d.name} · Đạt`, `${d.name} · Chưa đạt`])],
    ...board.rows.map((r, i) => [
      i + 1,
      childNameWithHistory(r.fullName, r.historyStatus),
      ...board.domains.flatMap((d) => {
        const cell = r.domains.find((c) => c.domainId === d.domainId);
        return [tick(cell?.met, true), tick(cell?.met, false)];
      }),
    ]),
    [],
    ['Một số lưu ý', board.note || ''],
  ];
}
/** signers: [{ title, name }] (mặc định giáo viên phụ trách lớp, tổ trưởng, PHT từ BE); người đầu ký trên, còn lại ở "Duyệt kế hoạch". */
export function semesterAssessmentFile(board, signers = defaultSigners(board.signers)) {
  const [head, ...approvers] = signers;
  const body = board.rows
    .map(
      (r, i) =>
        `<tr><td>${i + 1}</td><td class="name">${esc(childNameWithHistory(r.fullName, r.historyStatus))}</td>${board.domains
          .map((d) => {
            const c = r.domains.find((x) => x.domainId === d.domainId);
            return `<td>${tick(c?.met, true)}</td><td>${tick(c?.met, false)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  // Chừa 2pt cho viền ngoài khỏi bị cắt khi in
  const width = contentWidth('landscape', 42.5, 42.5) - 2;
  const cells = board.domains.length * 2;
  const widths = [30, cells ? 166 : width - 30, ...Array(cells).fill(share(width - 196, cells))];
  const cell = (label) => `<th style="width:${widths[2]}pt">${label}</th>`;
  const headers = board.domains.map((d) => `<th colspan="2" style="width:${widths[2] * 2}pt">${esc(d.name)}</th>`).join('');
  const sub = board.domains.map(() => cell('Đạt') + cell('Chưa đạt')).join('');
  const periodStart = esc(formatDate(board.startDate));
  const periodEnd = esc(formatDate(board.endDate));
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Đánh giá học kỳ</title>
<style>
${pageCss('landscape', '15mm')}
body { font-family: 'Times New Roman', serif; color: black; font-size: 12pt; }
h1 { font-size: 14pt; text-align: center; }
p { text-align: center; }
table { border-collapse: collapse; width: 100%; }
.grid td, .grid th { border: 1px solid black; padding: 2pt; text-align: center; font-size: 11pt; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
.grid .name, .note, .status { text-align: left; }
.note { white-space: pre-wrap; overflow-wrap: anywhere; }
.signatures { margin-top: 8pt; break-inside: avoid; page-break-inside: avoid; }
.signatures td { text-align: center; vertical-align: top; }
.signatures p { margin: 0 0 3pt; }
</style></head><body><div class="Section1">
<h1>BẢNG TỔNG HỢP ĐÁNH GIÁ SỰ PHÁT TRIỂN CỦA TRẺ</h1>
<p>${esc(semesterLabel(board.semester))} · ${esc(board.className)} · Năm học ${esc(board.yearName)}</p>
<p>${periodStart} – ${periodEnd}</p>
${gridOpen(widths)}
<thead><tr><th rowspan="2" style="width:${widths[0]}pt">STT</th><th rowspan="2" style="width:${widths[1]}pt">Họ tên trẻ</th>${headers}</tr><tr>${sub}</tr></thead><tbody>${body}</tbody></table>
<p class="note"><b>Một số lưu ý:</b> ${esc(board.note)}</p>
<p class="status">${board.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Bản nháp · Chưa xác nhận'}</p>
<table class="signatures"><tbody><tr><td style="width:55%"></td><td>
<p><i>${esc(signingPlace ? `${signingPlace}, ` : '')}${signingDate(board.confirmedAt)}</i></p>
${head ? signerCell(head, { upper: true }) : ''}
</td></tr></tbody></table>
${
  // Bỏ hết người duyệt ở hộp xem trước thì bỏ luôn phần "Duyệt kế hoạch"
  approvers.length
    ? `<div class="signatures">
<p><b>DUYỆT KẾ HOẠCH</b></p>
<p>Từ ngày ${periodStart} đến ngày ${periodEnd}</p>
<table><tbody>${approveRow(approvers)}</tbody></table>
</div>`
    : ''
}</div></body></html>`;
  return {
    html,
    name: `Danh-gia-hoc-ky-${board.semester}-${board.className}`,
    signers,
    withSigners: (next) => semesterAssessmentFile(board, next).html,
  };
}
