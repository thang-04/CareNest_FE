/**
 * Trạng thái hiển thị của useAsync theo phạm vi (deps): dữ liệu/lỗi của phạm vi cũ không lộ ra như của phạm vi mới,
 * để màn đổi điểm trường/năm học không thao tác được trên dữ liệu sai phạm vi.
 * scope: token phạm vi hiện tại; dataScope / errorScope: phạm vi của lần tải đã xong gần nhất.
 */
export function deriveAsyncState({ scope, enabled = true, data = null, dataScope, error = null, errorScope, loading = false }) {
  const ready = dataScope === scope;
  const failed = errorScope === scope && error != null;
  const stale = ready ? null : data;
  // Phạm vi mới chưa có kết quả nào ⇒ coi như đang tải ngay từ render đầu (trước khi effect kịp bật loading)
  const busy = loading || (enabled && !ready && !failed);
  const current = ready ? data : null;
  const initialLoading = busy && current == null && stale == null;
  return {
    data: current,
    stale,
    error: failed ? error : null,
    loading: busy,
    initialLoading,
    refreshing: busy && !initialLoading,
  };
}
