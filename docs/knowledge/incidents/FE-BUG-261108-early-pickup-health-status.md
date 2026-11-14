---
id: FE-BUG-261108-early-pickup-health-status
type: bug
screens: [attendance-entry]
be_modules: [attendance]
rules: []
status: open
date: 2026-11-08
keywords: [đón sớm, handedOverAt, earlyPickup, sức khỏe]
similar_to: []
---

# Sức khỏe vẫn báo chờ đón sau khi trẻ đã được đón sớm

## Symptom

GET sức khỏe trả handedOverAt nhưng nhãn hành động vẫn là `Chờ đón sớm`.

## Điều kiện tái hiện

Dữ liệu giả có canRecord=false, handedOverAt khác null và một entry có actions=[EARLY_PICKUP]. Gọi createDailyHealthBeApi.getDailyHealth rồi actionSummary với entries trả về.

## Attempts

| Cách thử | Kết quả |
| --- | --- |
| Đọc adapter và phần lịch sử DailyHealthPanel | Adapter gán earlyPickup=null cho mọi entry |
| Node fixture qua test loader và actionSummary | handedOver=true, entryPickup=null, label=Chờ đón sớm |

## Root cause

`src/services/daily-health/api/dailyHealthApi.js:34` bỏ trạng thái đón sớm của entry. getDailyHealth chỉ trả handedOverAt ở cấp ngày, trong khi actionSummary và lịch sử đọc entry.earlyPickup.

## Fix

Chưa sửa. Đề xuất ánh xạ trạng thái đã trả trẻ vào hành động đón sớm, dùng dữ liệu BE cho giờ/người đón khi có. Không tự dựng tên người đón.

## Regression test

Fixture nêu trên phải hiện đã đón sớm sau khi sửa, fixture chưa có handedOverAt vẫn hiện chờ đón. Hiện chỉ chạy inline để xác minh, chưa thêm test vào source.

## Ảnh hưởng

Lịch sử sức khỏe và tổng hợp cho BGH. Chặn ghi sức khỏe sau trả trẻ ở BE là đường kiểm tra khác, không bị chứng minh sai bởi lỗi ánh xạ này.
