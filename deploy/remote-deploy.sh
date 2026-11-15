#!/usr/bin/env bash
# Chạy trên VPS, trong thư mục app FE (production hoặc dev), do .github/workflows/deploy.yml gọi.
#   prepare           chạy TRƯỚC khi rsync source: giữ image đang chạy (tag :previous) và compose.yaml cũ
#   deploy            build image mới, chạy, chờ HTTP 200; không đạt ⇒ tự quay về bản đã giữ, exit 1
#   rollback [lý do]  quay về bản đã giữ (bước smoke HTTPS gọi khi fail), luôn exit 1
# Biến bắt buộc: COMPOSE_PROJECT, WEB_CONTAINER, WEB_IMAGE, WEB_LISTEN (deploy cần thêm VITE_* cho bước build).
set -euo pipefail

MODE="${1:-deploy}"
: "${COMPOSE_PROJECT:?}" "${WEB_CONTAINER:?}" "${WEB_IMAGE:?}" "${WEB_LISTEN:?}"
export WEB_CONTAINER WEB_IMAGE WEB_LISTEN

STATE_DIR=.rollback
PREV_IMAGE="${WEB_IMAGE%:*}:previous"

log() { echo "[deploy] $*"; }

healthy() {
  for _ in $(seq 1 10); do
    if curl -fsS -o /dev/null "http://$WEB_LISTEN/"; then return 0; fi
    sleep 2
  done
  return 1
}

prepare() {
  mkdir -p "$STATE_DIR"
  # Xóa trạng thái lần trước: không để rollback nhầm về bản cũ hơn bản đang chạy
  rm -f "$STATE_DIR/image" "$STATE_DIR/compose.yaml"
  local old
  old=$(docker inspect -f '{{.Image}}' "$WEB_CONTAINER" 2>/dev/null || true)
  if [ -z "$old" ] || [ ! -f compose.yaml ]; then
    log "no running container or compose.yaml, nothing to keep (first deploy)"
    return 0
  fi
  docker tag "$old" "$PREV_IMAGE"
  cp -p compose.yaml "$STATE_DIR/compose.yaml"
  echo "$old" > "$STATE_DIR/image"
  log "kept $old as $PREV_IMAGE"
}

# Mỗi bước tự kiểm lỗi: hàm này được gọi dạng `rollback ... || true` nên `set -e` không có tác dụng bên trong
rollback() {
  log "rolling back: $1"
  if [ ! -s "$STATE_DIR/image" ] || [ ! -f "$STATE_DIR/compose.yaml" ]; then
    log "ROLLBACK FAILED: no previous version kept"
    return 1
  fi
  if ! docker image inspect "$PREV_IMAGE" > /dev/null 2>&1; then
    log "ROLLBACK FAILED: image $PREV_IMAGE not found"
    return 1
  fi
  # compose.yaml cũ đi cùng image cũ (tên biến, cổng có thể đã đổi ở bản mới)
  cp -p "$STATE_DIR/compose.yaml" compose.yaml || { log "ROLLBACK FAILED: cannot restore compose.yaml"; return 1; }
  docker tag "$PREV_IMAGE" "$WEB_IMAGE" || { log "ROLLBACK FAILED: cannot retag image"; return 1; }
  if ! docker compose -p "$COMPOSE_PROJECT" up -d --no-build --force-recreate; then
    log "ROLLBACK FAILED: compose up failed"
    return 1
  fi
  if healthy; then
    log "ROLLED BACK to $(cat "$STATE_DIR/image")"
  else
    log "ROLLBACK FAILED: previous image does not answer on $WEB_LISTEN"
    return 1
  fi
}

deploy() {
  # Build lỗi ⇒ dừng ở đây, container cũ chưa bị đụng
  docker compose -p "$COMPOSE_PROJECT" build
  if ! docker compose -p "$COMPOSE_PROJECT" up -d --no-build --remove-orphans || ! healthy; then
    docker logs --tail 50 "$WEB_CONTAINER" 2>&1 || true
    rollback "new version does not answer on $WEB_LISTEN" || true
    exit 1
  fi
  # Sau khi bản mới đạt mới dọn; image :previous còn tag nên không bị xóa
  docker image prune -f
  log "deployed"
}

case "$MODE" in
  prepare) prepare ;;
  deploy) deploy ;;
  rollback)
    rollback "${2:-requested}" || true
    exit 1
    ;;
  *)
    echo "usage: $0 prepare|deploy|rollback [reason]" >&2
    exit 2
    ;;
esac
