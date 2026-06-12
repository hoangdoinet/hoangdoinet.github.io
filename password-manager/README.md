# 🔐 Trình quản lý mật khẩu (Password Manager)

Ứng dụng giúp **quản lý và mã hóa mật khẩu an toàn**, có thể cài đặt trên các thiết bị di động (Android/iOS) và máy tính để sử dụng ngoại tuyến (offline).  
Dữ liệu của bạn được bảo vệ bằng chuẩn mã hóa cao cấp **AES-GCM 256-bit** kết hợp thuật toán dẫn xuất khóa **PBKDF2** thông qua **Mật khẩu chính** và chỉ lưu trữ cục bộ trên thiết bị.

---

## 🚀 Tính năng chính
- **Bảo mật cấp độ cao:** Sử dụng chuẩn Web Crypto API (AES-GCM 256-bit) và PBKDF2 (210.000 vòng lặp), chống tấn công Brute-force hiệu quả.
- **Bảo vệ toàn vẹn dữ liệu:** Cơ chế tự động khôi phục (rollback) an toàn nếu quá trình đổi Mật khẩu chính gặp sự cố.
- **Trải nghiệm mượt mà:** Giao diện UI/UX hiện đại, tối ưu hóa hiển thị và hoạt động offline ổn định qua kiến trúc PWA (Service Worker).
- **Quản lý toàn diện:** Thêm, sửa, xóa và tìm kiếm tài khoản cực nhanh.
- **Tạo mật khẩu:** Tích hợp công cụ tạo mật khẩu ngẫu nhiên với độ an toàn cao.
- **Cơ chế phòng vệ:** Khóa tạm thời ứng dụng khi nhập sai Mật khẩu chính quá nhiều lần; tự động ẩn mật khẩu sau khi xem.
- **Kiểm soát dữ liệu:** Dễ dàng sao lưu (Export) và khôi phục (Import) dữ liệu bằng file JSON mã hóa.
- **Cập nhật thông minh:** Tự động kiểm tra và thông báo khi có phiên bản mới.

---

## ⚙️ Cách sử dụng
1. Nhấn **＋ Thêm tài khoản** để tạo mục lưu trữ mới.  
2. Đặt **Mật khẩu chính** (dùng để mã hóa/giải mã toàn bộ dữ liệu).  
3. Khi xem, sao chép hoặc chỉnh sửa, ứng dụng sẽ yêu cầu bạn nhập lại Mật khẩu chính.  
4. Mở Menu (biểu tượng ☰ hoặc ＋) để truy cập các chức năng: Sao lưu, Khôi phục, Đổi mật khẩu chính, Thông tin ứng dụng và Cài đặt ứng dụng (PWA).

> ⚠️ **LƯU Ý QUAN TRỌNG:**  
> **Quên Mật khẩu chính = Mất toàn bộ dữ liệu.** Ứng dụng không có cửa hậu (backdoor) hay máy chủ để khôi phục mật khẩu thay bạn. Hãy ghi nhớ thật kỹ Mật khẩu chính của mình!

---

## 📄 Thông tin phát hành
- Phiên bản: **v2.0.0**  
- Ngày phát hành: **2026-06-12**  
- Tác giả: **Hoàng Đợi**  
- Website: [https://hoangdoinet.github.io/password-manager/](https://hoangdoinet.github.io/password-manager/)

---

*🔐 Ứng dụng hoạt động độc lập trên thiết bị sau khi cài đặt, **100% Client-side**, tuyệt đối không lưu trữ, theo dõi hoặc gửi bất kỳ dữ liệu nào của người dùng lên máy chủ.*
