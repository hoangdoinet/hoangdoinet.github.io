# 🧪 Tính lượng thuốc sát trùng – Ứng dụng PWA Offline

**Tính lượng thuốc sát trùng** là ứng dụng web Progressive Web App (PWA) giúp **tính nhanh lượng thuốc sát trùng cần dùng** theo tỷ lệ pha và dạng thuốc (nước hoặc bột). Ứng dụng có khả năng **cài đặt trực tiếp trên Android/iOS** để sử dụng **offline hoàn toàn** ngay sau lần truy cập đầu tiên.

---

## 🚀 Tính năng nổi bật

- 🔢 **Tính toán tức thì** lượng thuốc sát trùng dựa trên số lít nước và tỷ lệ pha được chọn.
- 💧 Hỗ trợ linh hoạt cho cả **thuốc nước (đơn vị ml)** và **thuốc bột (đơn vị gram)**.
- 📱 **Khả năng cài đặt cao (PWA)**: Hoạt động ngoại tuyến 100%, không phụ thuộc vào kết nối mạng sau lần tải đầu.
- 🔄 **Cơ chế cập nhật tự động (Auto-Sync)**: Tự động kiểm tra file cấu hình phiên bản ngầm, thông báo bản cập nhật trực quan thông qua thanh Banner và tự động làm mới giao diện (`controllerchange`).
- 📂 **Lưu trữ dữ liệu bền vững (Persistent Storage)**: Chủ động xin quyền hệ thống để bảo vệ ứng dụng không bị xóa bộ nhớ đệm tự động khi thiết bị rơi vào trạng thái dung lượng thấp.
- 📥 Hỗ trợ **Add to Home Screen (A2HS)** với nút cài đặt thông minh tự động ẩn/hiện tùy biến theo trạng thái thiết bị.
- ⚡ **PWA Shortcuts (Quick Actions)**: Cho phép nhấn giữ biểu tượng ứng dụng từ màn hình chính để truy cập nhanh các tỷ lệ pha thông dụng (`1:200`, `1:400`, `1:800`).
- 🌐 Trải nghiệm như **ứng dụng Native** nhờ thiết lập chế độ hiển thị `standalone`, hỗ trợ cả `maskable icon` chống vỡ hình trên các dòng launcher Android hiện đại.

---

## 📁 Cấu trúc mã nguồn chuẩn hóa

Dự án được tinh gọn trong một kiến trúc khép kín bao gồm:
* `index.html`: Chứa toàn bộ giao diện điều khiển (Tailwind CSS) và lớp logic `AppUpdater` quản lý vòng đời ứng dụng.
* `service-worker.js`: Trình xử lý chạy ngầm, chịu trách nhiệm quản lý bộ nhớ đệm (`CACHE_STATIC`), định tuyến mạng ngoại tuyến (`Cache-First`) và kiểm tra phiên bản.
* `manifest.webmanifest`: File cấu hình định danh ứng dụng, màu sắc chủ đạo (`#0d9488`), hệ thống biểu tượng và liên kết lối tắt (Shortcuts).
* `version.json`: File đặc tả cấu trúc dữ liệu phiên bản trên máy chủ nhằm phục vụ cơ chế dò tìm cập nhật tự động.

---

## 📥 Hướng dẫn cài đặt

1. Truy cập liên kết ứng dụng chính thức:  
   👉 [https://hoangdoinet.github.io/pha-thuoc](https://hoangdoinet.github.io/pha-thuoc)
2. **Trên Android / Máy tính:** Nhấn trực tiếp vào nút **📥 Cài đặt ứng dụng** nổi ngay góc phải giao diện.
3. **Trên iOS (iPhone/iPad):** Sử dụng trình duyệt **Safari** → Nhấn vào biểu tượng **Chia sẻ (Share)** → Chọn **Thêm vào màn hình chính (Add to Home Screen)**.

---

## 🛠️ Yêu cầu hệ thống

- Trình duyệt lõi Chromium phiên bản mới (Chrome, Edge, Opera, Samsung Internet) hoặc Safari trên iOS.
- Hệ điều hành: Android, iOS/iPadOS, Windows, macOS.
- Thiết bị cần kết nối Internet ở **lần đầu tiên truy cập** để Service Worker tiến hành nạp đầy đủ gói tài nguyên lõi (`CRITICAL_ASSETS`).

---

## 📜 Lịch sử cập nhật (Changelog)

### 🆕 v1.0.7 – 11/06/2026
- ⚡ **Chuẩn hóa quy trình cập nhật tự động**: Đồng bộ hóa toàn diện lớp `AppUpdater` trên giao diện với vòng đời kích hoạt của Service Worker thông qua kênh truyền thông điệp `BroadcastMessage`.
- 🔄 **Tối ưu cơ chế chiếm quyền (Claiming)**: Ép ứng dụng tự động Reload giao diện thông qua sự kiện `controllerchange` ngay sau khi người dùng nhấn "Cập nhật" trên thanh thông báo, giảm thiểu tối đa hiện tượng xung đột tài nguyên đệm cũ.
- 🔗 **Khớp nối Shortcuts hoàn chỉnh**: Đồng bộ dữ liệu tham số URL của PWA Shortcuts từ dấu mã hóa `%3A` về chuỗi thô `:`, giúp ứng dụng nhận diện và highlight chính xác các chip tỷ lệ khi khởi động từ màn hình chính.
- 🎨 **Đồng bộ hóa sắc diện thương hiệu**: Điều chỉnh tham số màu `theme_color` trong tệp Manifest về mã màu Teal (`#0d9488`), trùng khớp hoàn toàn với thanh trạng thái và phong cách thiết kế giao diện chính.

### 🆕 v1.0.6 – 15/12/2025
- 🧹 **Loại bỏ Splash Screen** → vào thẳng giao diện sử dụng không độ trễ.
- 🔐 **Tự động yêu cầu quyền Persistent Storage** ngay khi ứng dụng khởi chạy lần đầu.
- 📦 **Nâng cấp Service Worker**: Đảm bảo cache an toàn 100% tài nguyên cốt lõi.
- ⚡ **Cải thiện cơ chế cập nhật**: Phát hiện phiên bản mới dựa trên tương tác luồng thông tin.
- 🎨 **Tinh chỉnh giao diện**, tối ưu trải nghiệm chạm trên thiết bị di động.
- 🔗 **Hỗ trợ Shortcut (Quick Actions)** từ màn hình chính với các tỷ lệ pha nhanh (1:200, 1:400, 1:800).

### 🆕 v1.0.5 – 30/11/2025
- 🔄 Hoàn thiện cơ chế cập nhật có kiểm soát thông qua cấu trúc tệp `version.json`.
- 📂 Tối ưu chiến lược cache offline: Ưu tiên nạp và bảo vệ tập tin `index.html`.
- 📱 Đồng bộ lại manifest PWA: Cập nhật hệ thống biểu tượng đầy đủ thuộc tính `any` và `maskable`.

### 🆕 v1.0.4 – 21/10/2025
- 🛠️ Tối ưu hóa UI/UX, tinh gọn khoảng cách hiển thị và cải thiện trải nghiệm nhập liệu trên bàn phím di động.

### 🆕 v1.0.3 – 20/10/2025
- 🛠️ Cải tiến cơ chế xử lý lỗi mạng của **Service Worker** khi thiết bị ngắt kết nối trong thời gian dài (khắc phục mã lỗi `ERR_FAILED`).
- 💾 Tích hợp thử nghiệm **Persistent Storage API**.
- 📦 Bổ sung trang giao diện phản hồi Fallback HTML khi không có mạng và bộ nhớ đệm bị lỗi.

### 📦 v1.0.2 – 18/10/2025
- ✨ Thêm bảng thông tin ứng dụng (Hiển thị phiên bản, tác giả, mục đích sử dụng).
- 🐞 Khắc phục các lỗi hiển thị CSS cục bộ.

### 🚀 v1.0.1 – 11/10/2025
- 🌐 Triển khai giải pháp PWA biến trang web thành ứng dụng có khả năng chạy độc lập ngoại tuyến.

### 🚀 v1.0.0 – 10/10/2025
- 🌐 Phát hành phiên bản trực tuyến đầu tiên.

---

## 👨‍💻 Tác giả

- 👤 **Hoàng Đợi** - 📧 Email: [hoangdoivn.cntt@gmail.com](mailto:hoangdoivn.cntt@gmail.com)  
- 🌐 Dự án trên GitHub: [https://github.com/hoangdoinet/pha-thuoc](https://github.com/hoangdoinet/pha-thuoc)  