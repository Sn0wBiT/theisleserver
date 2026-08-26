# Kế hoạch phát triển tính năng chiếm đóng lãnh thổ

## Tóm tắt

Xây dựng hệ thống bản đồ chia thành các ô hexagon cố định. Mỗi ô là một lãnh thổ thuộc về bang/nhóm, có màu hiển thị trên minimap. Cơ chế chiếm đóng không phụ thuộc vào việc đứng yên liên tục mà dựa trên “Influence” tạo ra từ nhiều hoạt động gameplay.

Mặc định:

- Mỗi lãnh thổ thuộc về một bang/nhóm.
- Quyền sở hữu kéo dài 3 ngày, sau đó phải tái chiếm.
- Toàn bộ người chơi thấy màu và trạng thái lãnh thổ.
- Phiên bản đầu ưu tiên điểm số, danh vọng và thông tin; chưa trao buff tài nguyên mạnh.

## Cơ chế gameplay

- Bản đồ được tạo thành lưới hexagon từ `worldBounds` hiện có trong calibration.
- Mỗi hex có `zoneId`, tọa độ hex, polygon hiển thị, tên, loại địa hình, điểm mốc, bang sở hữu, phe tranh chấp, Influence và thời điểm hết hạn.
- Influence đến từ hiện diện có di chuyển, chạy tới mốc và hoàn thành nhiệm vụ, đóng góp thịt/cây cỏ, hạ AI/PvP và hoàn thành nhiệm vụ khu vực.
- Áp dụng giới hạn điểm theo người chơi và diminishing returns để chống AFK hoặc việc đông người áp đảo tuyệt đối.

Trạng thái lãnh thổ:

1. `neutral` — chưa có bang sở hữu.
2. `capturing` — một bang đang tích lũy Influence.
3. `contested` — nhiều bang cùng tranh chấp.
4. `owned` — đã chiếm thành công.
5. `expired` — hết thời hạn 3 ngày và cần tái chiếm.

Khi bang khác vượt ngưỡng Influence, quyền sở hữu chuyển sang `contested` thay vì đổi màu ngay lập tức. Khi đạt ngưỡng capture, bang mới trở thành chủ sở hữu và bộ đếm 3 ngày được gia hạn.

## Thay đổi kiến trúc

### Bridge và dữ liệu

Mở rộng `TPNIsleControl/bridge` thành nơi xử lý trạng thái lãnh thổ theo thời gian thực:

- Thêm territory engine độc lập để chuyển world position sang hex, ghi nhận activity, tính Influence, xử lý contest/capture/expiration/decay và phát sự kiện.
- Thêm cấu hình cho kích thước hex, map revision, điểm mốc, ngưỡng Influence, thời hạn sở hữu và trọng số hoạt động.
- Thêm faction tối giản gồm tạo bang, mã mời, tên, màu, thành viên và role leader/member.
- Lưu faction, zone definition, zone state, Influence ledger và capture event trong PostgreSQL.

### Protocol và API

Mở rộng `POST /game/sync` để nhận event `territory_activity`, gồm Steam ID, zone ID, loại hoạt động, số lượng, timestamp và event ID chống xử lý trùng.

Các endpoint mới:

- `GET /territories`
- `GET /territories/stream`
- `GET /factions/me`
- `POST /factions`
- `POST /factions/{id}/invite`
- `POST /territories/{zoneId}/activity`
- `GET /territories/{zoneId}/history`

Next.js chỉ làm proxy authenticated cho HUD; bridge API token không được đưa xuống frontend.

### Game-side event

Bổ sung event Lua/native cho người chơi vào/rời zone, hoàn thành mốc, đóng góp thịt/cây cỏ và hạ AI/người chơi trong zone. Nếu chưa đọc được inventory trực tiếp, dùng tương tác/mốc được xác minh bởi mod thay vì tin dữ liệu tự gửi từ client.

### HUD và minimap

Mở rộng `MinimapMap` bằng các lớp Leaflet:

- Polygon hexagon trên ảnh bản đồ.
- Màu fill theo bang sở hữu.
- Viền sọc hoặc animation cho `contested`.
- Opacity biểu thị Influence.
- Highlight ô hiện tại và marker cho mốc chiếm đóng.
- Tooltip hiển thị tên zone, owner, trạng thái, thời gian còn lại và tiến độ.
- Bộ lọc theo tất cả lãnh thổ, bang mình, khu vực tranh chấp và khu vực sắp hết hạn.

Expanded minimap có panel bang với tổng số zone, Influence, zone sắp hết hạn và bảng xếp hạng. Thêm notification khi bắt đầu tranh chấp, bị chiếm, sắp hết hạn hoặc hoàn thành activity.

## Lộ trình triển khai

1. Re-index GitNexus và chốt impact analysis cho `processPosition`, `processGameSync`, `MinimapMap`, `worldToMap`, `streamPosition`.
2. Tạo hex-grid generator và zone definition theo map calibration.
3. Implement faction tối giản và migration PostgreSQL.
4. Implement territory engine, Influence ledger và expiration 72 giờ.
5. Mở rộng game sync với activity events.
6. Thêm REST/SSE API và Next.js proxy.
7. Hiển thị hex layer, trạng thái, tooltip và panel bang.
8. Thêm notification và lịch sử capture.
9. Thử nghiệm với một số zone đại diện trước khi bật toàn bản đồ.
10. Tinh chỉnh trọng số, ngưỡng capture và chống snowball bằng telemetry.

## Kiểm thử và tiêu chí nghiệm thu

- World position ánh xạ đúng vào cùng một hex ở bridge và HUD.
- Hex liền kề không có gap hoặc overlap.
- Presence không tạo điểm vô hạn khi AFK.
- Diminishing returns hoạt động với nhiều thành viên cùng bang.
- Phe đối địch làm giảm Influence và chuyển zone sang `contested`.
- Zone chuyển sang `expired` sau 72 giờ.
- Restart bridge không mất faction, ownership, Influence hoặc lịch sử.
- HTTP sync và NDJSON fallback tạo cùng kết quả gameplay.
- SSE cập nhật trạng thái mới cho người chơi.
- Activity giả hoặc ghi điểm cho bang khác bị từ chối.
- Frontend test cho tọa độ hex, render layer, tooltip, contested state và SSE reconnect.
- Bridge test cho capture, contest, decay, expiration, duplicate event và replay event.

## Giả định mặc định

- Bang/nhóm là đơn vị sở hữu.
- Thời hạn sở hữu là 3 ngày và có thể cấu hình.
- Influence được lưu theo event/ledger để audit và cân bằng.
- Toàn bộ người chơi thấy toàn bản đồ, nhưng không nhất thiết thấy vị trí chính xác của thành viên bang khác.
- Buff tài nguyên không nằm trong v1; phần thưởng ban đầu là điểm, danh vọng, bảng xếp hạng và thông tin chiến thuật.
