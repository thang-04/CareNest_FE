import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { menuAiDraftApi } from '@/services/menuAiDraftApi';
import { MENU_AI_KIND, MENU_AI_SOURCE } from '@/models/menu-planning/menuPlanningConstants';
import { isPendingDraft } from '@/utils/menu-planning/menuAiDraft';
import {
  candidatesBySlot,
  cellsOf,
  editedCount,
  rankSwaps,
  replaceCell,
  swapOutcome,
  swapPool,
  toGridRequest,
} from '@/utils/menu-planning/menuAiDraftGrid';

const EVALUATE_DELAY_MS = 400;
const SWAP_CONCURRENCY = 4;

// Chạy `task` cho từng phần tử, tối đa `limit` việc cùng lúc; kết quả giữ đúng thứ tự đầu vào
const mapLimit = async (items, limit, task) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const fromDraft = (draft) => ({
  total: draft?.source === MENU_AI_SOURCE.AI ? draft?.score?.ai : draft?.score?.baseline,
  feasible: draft?.feasible !== false,
  issues: draft?.issues || [],
  checks: draft?.checks || [],
  evaluations: [],
});

/**
 * Trạng thái sửa món trên nháp gợi ý tuần (AI-02): lưới đang sửa, lịch sử để hoàn tác, món ứng viên theo ô và kết quả
 * BE chấm lại sau mỗi lần đổi món. FE không tự tính dinh dưỡng (NUT-05): mọi điểm, lỗi, bảng kiểm lấy từ BE.
 * `editable` chỉ đúng với gợi ý tuần đang chờ duyệt.
 */
export function useMenuAiDraftEditor(draft, api = menuAiDraftApi) {
  const editable = draft?.kind === MENU_AI_KIND.WEEKLY && isPendingDraft(draft);
  const original = useMemo(() => cellsOf(draft), [draft]);
  const [cells, setCells] = useState(original);
  const [history, setHistory] = useState([]);
  const [candidates, setCandidates] = useState(null);
  const [candidatesError, setCandidatesError] = useState(null);
  const [assessment, setAssessment] = useState(() => fromDraft(draft));
  const [evaluating, setEvaluating] = useState(false);
  const [evaluateError, setEvaluateError] = useState(null);
  const [swap, setSwap] = useState(null);
  const seq = useRef(0);
  const swapSeq = useRef(0);

  useEffect(() => {
    setCells(original);
    setHistory([]);
    setAssessment(fromDraft(draft));
    setEvaluateError(null);
    setCandidates(null);
    setCandidatesError(null);
    setSwap(null);
  }, [draft, original]);

  const loadCandidates = useCallback(async () => {
    if (!editable) return;
    setCandidatesError(null);
    try {
      setCandidates(await api.getCandidates(draft.id));
    } catch (err) {
      setCandidatesError(err);
    }
  }, [api, draft, editable]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Chỉ nhận kết quả của yêu cầu mới nhất: kết quả cũ về muộn không đè lên lưới đang hiển thị
  const evaluate = useCallback(
    async (grid) => {
      const mine = ++seq.current;
      setEvaluating(true);
      try {
        const result = await api.evaluateDraft(draft.id, toGridRequest(grid));
        if (mine !== seq.current) return;
        setAssessment({
          total: result.score?.total,
          feasible: result.feasible,
          issues: result.issues || [],
          checks: result.checks || [],
          evaluations: result.evaluations || [],
        });
        setEvaluateError(null);
      } catch (err) {
        if (mine === seq.current) setEvaluateError(err);
      } finally {
        if (mine === seq.current) setEvaluating(false);
      }
    },
    [api, draft],
  );

  // Lần đầu cũng chấm để có số liệu theo ngày; sau đó chờ người dùng ngừng thao tác rồi mới gọi
  const first = useRef(true);
  useEffect(() => {
    if (!editable) return undefined;
    const delay = first.current ? 0 : EVALUATE_DELAY_MS;
    first.current = false;
    const timer = setTimeout(() => evaluate(cells), delay);
    return () => clearTimeout(timer);
  }, [cells, editable, evaluate]);

  // Gợi ý món thay cho một ô: BE chấm thử từng món ứng viên (không lưu, không gọi model) trên lưới hiện tại rồi xếp hạng.
  // Kết quả gắn với lưới đã chấm: đổi lưới thì gợi ý cũ không còn đúng nên bị bỏ (xem `swapFor`).
  const suggestSwaps = useCallback(
    async ({ day, slot }, ageGroup) => {
      const base = cells;
      const mine = ++swapSeq.current;
      setSwap({ cells: base, day, slot, status: 'loading', items: [] });
      try {
        const pool = swapPool({ cells: base, original, bySlot: candidatesBySlot(candidates), day, slot });
        const baselineTotal = assessment.total;
        const outcomes = await mapLimit(pool, SWAP_CONCURRENCY, async (dish) =>
          swapOutcome({
            dish,
            result: await api.evaluateDraft(draft.id, toGridRequest(replaceCell(base, day, slot, dish))),
            date: day,
            baselineTotal,
            ageGroup,
          }),
        );
        if (mine === swapSeq.current) setSwap({ cells: base, day, slot, status: 'ready', items: rankSwaps(outcomes) });
      } catch (err) {
        if (mine === swapSeq.current) setSwap({ cells: base, day, slot, status: 'error', items: [], error: err });
      }
    },
    [api, assessment.total, candidates, cells, draft, original],
  );
  const swapFor = useCallback(
    (selected) => (swap && selected && swap.cells === cells && swap.day === selected.day && swap.slot === selected.slot ? swap : null),
    [cells, swap],
  );

  const change = useCallback(
    (next) => {
      if (next === cells) return;
      setHistory((h) => [...h, cells]);
      setCells(next);
    },
    [cells],
  );
  const undo = useCallback(() => {
    if (!history.length) return;
    setCells(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  }, [history]);
  const reset = useCallback(() => {
    setHistory([]);
    setCells(original);
  }, [original]);

  return {
    editable,
    cells,
    original,
    change,
    undo,
    reset,
    canUndo: history.length > 0,
    edited: editedCount(cells, original),
    candidates,
    bySlot: useMemo(() => candidatesBySlot(candidates), [candidates]),
    candidatesError,
    reloadCandidates: loadCandidates,
    assessment,
    evaluating,
    evaluateError,
    reevaluate: () => evaluate(cells),
    suggestSwaps,
    swapFor,
  };
}
