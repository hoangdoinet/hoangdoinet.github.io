# 🏭 Quản lý Vôi QT (PWA)

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen)](https://hoangdoinet.github.io/quan-ly-voi/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

Ứng dụng web tiến bộ (**Progressive Web App**) chuyên dụng để quản lý xuất nhập tồn kho vôi tại các cổng (Cổng Nhập, Cổng Xuất, Cổng Chính). Được thiết kế tối ưu cho thiết bị di động với khả năng đồng bộ thời gian thực và làm việc ổn định trong môi trường thiếu mạng.

---

## ✨ Tính năng nổi bật

* **📱 Trải nghiệm App:** Cài đặt trực tiếp lên màn hình chính (Android & iOS) với giao diện tối ưu cho người dùng di động.
* **📡 Đồng bộ thời gian thực:** Kết nối Firebase giúp dữ liệu được cập nhật tức thì trên mọi thiết bị.
* **📶 Hoạt động Offline:** Hỗ trợ nhập liệu ngay cả khi mất kết nối mạng, tự động đồng bộ khi có kết nối trở lại.
* **📊 Thống kê chuyên sâu:** Báo cáo tồn kho, nhập/xuất theo tháng, theo cổng với độ chính xác cao.
* **🔍 Tìm kiếm thông minh:** Lọc nhanh lịch sử giao dịch theo nhiều tiêu chí (Ghi chú, Cổng, Loại phiếu).
* **💾 Sao lưu & Phục hồi:** Hỗ trợ tính năng Xuất/Nhập dữ liệu qua file JSON để quản trị và dự phòng dữ liệu an toàn.
* **⚡ Hiệu năng cao:** Giao diện tối giản, sử dụng bộ icon Lucide sắc nét, mượt mà.

---

## 🛠 Công nghệ sử dụng

* **Frontend:** HTML5, Tailwind CSS, JavaScript (Vanilla).
* **Backend & Database:** Firebase Firestore (Realtime Database).
* **Authentication:** Firebase Auth (Đăng nhập an toàn qua tài khoản Google).
* **PWA:** Web Manifest & Service Worker API.
* **Icons:** Lucide Icons.

---

## 📲 Hướng dẫn cài đặt

### Trên Android (Chrome)
1. Truy cập [hoangdoinet.github.io/quan-ly-voi/](https://hoangdoinet.github.io/quan-ly-voi/)
2. Chờ vài giây để nút **Cài đặt (màu vàng)** xuất hiện ở góc trên.
3. Nhấn vào nút đó và chọn **Cài đặt**.

### Trên iOS (Safari)
1. Truy cập link bằng trình duyệt Safari.
2. Nhấn vào nút **Chia sẻ (Share)** ở thanh điều hướng phía dưới.
3. Chọn **Thêm vào màn hình chính (Add to Home Screen)**.

---

## 📝 Lưu ý về dữ liệu
Dữ liệu được lưu trữ trên máy chủ Firebase để đảm bảo tính đồng nhất giữa nhiều người dùng. 
> **Khuyến nghị:** Dù dữ liệu đã được lưu trữ tập trung, bạn vẫn nên sử dụng tính năng **Phục hồi JSON** định kỳ để chủ động sao lưu dữ liệu cá nhân về thiết bị, đề phòng trường hợp cần khôi phục cấu hình hoặc lịch sử giao dịch cũ.

---

## 👤 Tác giả
* **Hoàng Đợi** - [GitHub Profile](https://github.com/hoangdoinet)
