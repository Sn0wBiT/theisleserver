# TPN Dino

Ứng dụng Next.js dùng để đăng nhập bằng Steam, theo dõi nhiệm vụ The Isle, xem tiến độ trực tiếp và quản lý kết nối với TPNIsleControlHUD.

## Bắt đầu phát triển

Cài đặt các gói phụ thuộc và khởi chạy máy chủ phát triển:

```bash
npm ci
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong trình duyệt. Giao diện chính nằm trong `app/page.tsx`; Next.js tự động cập nhật trang khi mã nguồn thay đổi.

## Cấu hình môi trường

Sao chép `.env.example` thành `.env.local`, sau đó cấu hình:

- `QUEST_API_URL`: địa chỉ dịch vụ bridge nhiệm vụ;
- `QUEST_API_TOKEN`: token quản trị chỉ dùng ở phía máy chủ;
- `ISLE_SERVER_IP` và `ISLE_SERVER_PORT`: địa chỉ server The Isle mà launcher sẽ kết nối trực tiếp;
- `SESSION_SECRET`: khóa ký phiên đăng nhập web;
- `DATABASE_URL`: chuỗi kết nối PostgreSQL;
- `HUD_ACCESS_TOKEN_SECRET`: khóa riêng để ký access token của HUD;
- `STEAM_WEB_API_KEY`: khóa Steam Web API để bổ sung thông tin hồ sơ công khai;
- `PUBLIC_ORIGIN`: origin công khai của ứng dụng dùng cho Steam OpenID, ví dụ `http://113.172.117.131:3000`;
- `HUD_ORIGIN`: origin CORS của HUD nhúng, mặc định `http://dino.tpnrp.local`.

Không đưa `QUEST_API_TOKEN`, khóa ký hoặc thông tin kết nối cơ sở dữ liệu vào mã frontend.

## Kiểm tra và đóng gói

```bash
npm test
npm run lint
npm run build
```

Ứng dụng sử dụng App Router, Route Handlers và `next/font` của Next.js. Các route `/api/hud-auth/*` phục vụ quy trình đăng nhập HUD; `/api/quests/*` và `/api/minimap/*` yêu cầu danh tính người chơi hợp lệ.

## Triển khai

Sau khi tạo bản dựng production, khởi chạy bằng:

```bash
npm start
```

Đảm bảo PostgreSQL đã được migrate, dịch vụ bridge đang hoạt động và origin HUD production được cấu hình chính xác trước khi phát hành.
