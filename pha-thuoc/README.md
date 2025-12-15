# 🧪 Tính lượng thuốc sát trùng – Ứng dụng PWA Offline

**Tính lượng thuốc sát trùng** là ứng dụng web PWA giúp **tính nhanh lượng thuốc sát trùng cần dùng** theo tỷ lệ pha và dạng thuốc (nước hoặc bột). Có thể **cài đặt app trên Android/iOS** để sử dụng **offline hoàn toàn** sau khi cài đặt lần đầu.

---

## 🚀 Tính năng nổi bật

- 🔢 **Tính toán tức thì** lượng thuốc sát trùng theo số lít nước và tỷ lệ pha.
- 💧 Hỗ trợ **thuốc nước** và **thuốc bột**.
- 📱 Có thể **cài đặt ứng dụng trên Android/iOS** – hoạt động **offline hoàn toàn** sau lần đầu truy cập.
- ⚙️ **Tự động kiểm tra và thông báo cập nhật** khi có phiên bản mới.
- 📂 **Lưu trữ dữ liệu bền vững (Persistent Storage)** giúp ứng dụng không bị xóa dữ liệu khi hệ thống dọn dẹp bộ nhớ.
- 🔄 Hỗ trợ **Add to Home Screen (A2HS)** với nút cài đặt trong giao diện.
- ⚡ Hỗ trợ **Shortcut (Quick Actions)** từ màn hình chính với các tỷ lệ pha thông dụng.
- 🌐 Hoạt động như **ứng dụng native** với chế độ `standalone` và `fullscreen`.

---

## 📥 Cài đặt ứng dụng

1. Truy cập trang web:  
   👉 https://hoangdoinet.github.io/pha-thuoc
2. Nhấn nút **📥 Cài đặt ứng dụng** khi trình duyệt gợi ý  
   *(hoặc chọn “Thêm vào màn hình chính”)*.
3. Sau khi cài đặt, ứng dụng hoạt động **100% offline** kể cả khi không có kết nối mạng.

---

## 🛠️ Yêu cầu hệ thống

- Trình duyệt hỗ trợ PWA: Chrome, Edge, Safari, Firefox (phiên bản mới)
- Thiết bị: Android, iOS, Windows, macOS
- Cần kết nối mạng **lần đầu** để tải cache ứng dụng

---

## 📜 Lịch sử cập nhật (Changelog)

### 🆕 v1.0.6 – 15/12/2025
- 🧹 **Loại bỏ Splash Screen** → vào nhanh giao diện sử dụng.
- 🔐 **Tự động xin quyền Persistent Storage** khi ứng dụng khởi chạy.
- 📦 **Nâng cấp Service Worker**: cache đầy đủ tài nguyên quan trọng, đảm bảo **offline 100%**.
- ⚡ **Cải thiện cơ chế cập nhật**: phát hiện phiên bản mới và cho người dùng chủ động cập nhật.
- 🎨 **Tinh chỉnh giao diện**, tối ưu trải nghiệm trên thiết bị di động.
- 🔗 **Hỗ trợ Shortcut (Quick Actions)** từ màn hình chính với các tỷ lệ pha nhanh (1:200, 1:400, 1:800).

---

### 🆕 v1.0.5 – 30/11/2025
- 🔄 **Hoàn thiện cơ chế cập nhật có kiểm soát** thông qua `version.json`.
- 📂 **Tối ưu chiến lược cache offline**: ưu tiên `index.html` và icon quan trọng.
- 📱 **Đồng bộ lại manifest PWA**: icon đầy đủ (any + maskable), hiển thị tốt trên Android & iOS.
- 🐞 **Sửa lỗi nhỏ** khi chuyển trạng thái online/offline.

---

### 🆕 v1.0.4 – 21/10/2025
- 🛠️ Tối ưu giao diện và cải thiện trải nghiệm di động.

---

### 🆕 v1.0.3 – 20/10/2025
- 🛠️ Cải tiến **Service Worker**: xử lý ổn định hơn khi thiết bị **offline lâu ngày** (giảm lỗi `ERR_FAILED`).
- 💾 Thêm **Persistent Storage API** để giữ dữ liệu không bị xóa.
- 📱 Cập nhật **manifest**: hỗ trợ `display_override` & `orientation`.
- 📦 Bổ sung fallback HTML khi chưa có cache và không có mạng.
- 🧰 Đồng bộ nút cài đặt giữa giao diện chính và modal thông tin.

---

### 📦 v1.0.2 – 18/10/2025
- ✨ Thêm modal hiển thị thông tin ứng dụng (phiên bản, tác giả, mô tả).
- 📥 Bổ sung nút cài đặt ứng dụng trong modal.
- 🐞 Sửa lỗi giao diện nhỏ.

---

### 🚀 v1.0.1 – 11/10/2025
- 🌐 Triển khai PWA để ứng dụng hoạt động **offline** sau khi cài đặt.
- 📱 Giao diện tối ưu cho mọi kích thước màn hình.
- 🔄 Tự động cập nhật khi có phiên bản mới.

---

### 🚀 v1.0.0 – 10/10/2025
- 🌐 Triển khai phiên bản online đầu tiên.

---

## 👨‍💻 Tác giả

- 👤 **Hoàng Đợi**  
- 📧 Email: hoangdoivn.cntt@gmail.com  
- 🌐 Website: https://hoangdoinet.github.io

---