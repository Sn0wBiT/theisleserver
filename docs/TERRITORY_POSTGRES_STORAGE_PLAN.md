# Kế hoạch lưu trữ PostgreSQL cho tính năng chiếm đóng

## Quyết định kiến trúc

PostgreSQL là nguồn dữ liệu duy nhất cho `tpn-dino` và `TPNIsleControl bridge`.

- Bridge dùng cùng biến môi trường `DATABASE_URL` như `tpn-dino`.
- Không sử dụng `JsonStore`, `state.json` hoặc local file để lưu trạng thái người chơi.
- NDJSON chỉ là kênh transport fallback giữa game mod và bridge; event đọc từ NDJSON phải được xử lý và ghi vào PostgreSQL.
- Memory chỉ là cache tạm thời cho live position, SSE và giảm tải truy vấn; không phải nguồn dữ liệu chính.

## Dữ liệu PostgreSQL

Mở rộng schema bằng migration mới:

- `tpn_players`: Steam ID, display name, avatar, last seen và trạng thái online gần nhất.
- `tpn_dinosaur_positions`: tọa độ gần nhất của từng dinosaur, zone hiện tại và timestamp.
- `tpn_dinosaurs`: snapshot khủng long và dữ liệu xác định loại ăn thịt/ăn cỏ.
- `tpn_factions`: tên bang, mã mời, màu và leader.
- `tpn_faction_members`: thành viên, role và thời điểm tham gia.
- `tpn_territory_zones`: zone ID, tọa độ hex, polygon, tên, loại địa hình và điểm mốc.
- `tpn_territory_states`: owner, trạng thái, Influence, thời điểm capture và hết hạn.
- `tpn_territory_influence_events`: người chơi, bang, zone, loại activity, số điểm, timestamp và metadata.
- `tpn_territory_capture_events`: lịch sử capture, contest, expiration và thay đổi owner.

Mọi event phải có idempotency key/event ID để bridge restart hoặc retry không cộng điểm hai lần.

## Bridge storage layer

Refactor bridge để mọi persistence đi qua PostgreSQL store:

- Bỏ nhánh khởi tạo `storage: "json"`.
- Bridge fail rõ ràng nếu thiếu hoặc không kết nối được `DATABASE_URL`.
- `PostgresStore` quản lý player snapshot, position, faction, territory và Influence.
- Capture, claim và expiration dùng transaction.
- Influence event và territory state được ghi trong cùng transaction khi cần.
- Worker định kỳ xử lý expiration, decay, offline status và batch position.
- `/health` báo `storage: "postgresql"` và trạng thái kết nối database.
- Xóa logic JSON import, `json_import_complete`, rollback về JSON và tài liệu local-state.

Live position có thể được cache trong memory để phản hồi nhanh, nhưng được ghi vào `tpn_dinosaur_positions` theo nhịp throttle/batch. Khi bridge restart, dữ liệu gần nhất được khôi phục từ PostgreSQL.

## Luồng dữ liệu

```text
Game mod
  → HTTP sync hoặc NDJSON fallback
  → Bridge validate/idempotency
  → PostgreSQL transaction
  → Territory engine/cache
  → SSE /territories/stream
  → HUD minimap
```

## API và HUD

Các API territory gồm:

- `GET /territories`
- `GET /territories/stream`
- `GET /territories/{zoneId}/history`
- `GET /factions/me`
- `POST /factions`
- `POST /factions/{id}/invite`
- `POST /territories/{zoneId}/activity`

Next.js dùng database của ứng dụng cho profile/auth và server-side proxy cho dữ liệu live territory. Bridge token và database credential không được gửi xuống frontend.

## Migration và vận hành

- Dùng migration PostgreSQL versioned thay vì chỉ tạo bảng khi bridge khởi động.
- Migration phải chạy được trên database hiện đang dùng bởi `tpn-dino`.
- Dùng prefix bảng rõ ràng để tránh xung đột với bảng `tpn_hud_*`.
- Backup/restore bằng `pg_dump` và kiểm thử phục hồi.
- Khi database mất kết nối, không ghi điểm hoặc thay đổi ownership giả lập trong memory; trả trạng thái stale nếu cần và retry kết nối.
- NDJSON transport fallback không được xem là bản sao khôi phục trạng thái.

## Kiểm thử và nghiệm thu

- Thiếu `DATABASE_URL` phải khiến bridge fail rõ ràng.
- Restart bridge không mất player, dinosaur, faction, membership, Influence hoặc ownership.
- Retry cùng activity event không cộng Influence hai lần.
- Transaction thất bại không tạo owner và ledger không nhất quán.
- Position được khôi phục từ PostgreSQL sau restart.
- Expiration/decay vẫn đúng sau khi bridge ngừng một thời gian.
- HTTP sync và NDJSON fallback tạo cùng dữ liệu PostgreSQL.
- Concurrent activity không làm mất cập nhật.
- Migration chạy được trên database mới và database hiện hữu.
- Backup/restore bằng `pg_dump` hoạt động.
- SSE xử lý đúng khi database reconnect hoặc cache stale.

## Giả định mặc định

- Bridge và `tpn-dino` dùng chung PostgreSQL database thông qua `DATABASE_URL`.
- PostgreSQL là authoritative source; memory chỉ là cache.
- Position 100 ms vẫn dùng cho gameplay real-time trong memory, nhưng persistence throttle/batch để tránh ghi quá nhiều.
- Không còn đường vận hành chính thức nào lưu trạng thái vào local JSON.
- Trước khi triển khai phải re-index GitNexus; sau đó chạy impact analysis trước mọi chỉnh sửa symbol và `detect_changes()` trước commit.
