# 🛡️ VN Anti-Scam Guard — Hệ thống Cảnh báo Cuộc gọi Lừa đảo Thời gian thực (< 1s)

**VN Anti-Scam Guard** là giải pháp bảo mật di động đa tầng (Multi-tier Security Architecture) giúp nhận diện, phân loại và cảnh báo các cuộc gọi lừa đảo ngay khi chuông vừa reo với độ trễ **dưới 1 giây**.

## ✨ Tính năng Cốt lõi (Tầng 0 - On-Device Edge Engine)
1. **Kiểm tra Danh bạ Cục bộ Tốc độ cao (~5ms):** Bỏ qua ngay lập tức các số người quen mà không cần gửi dữ liệu ra ngoài.
2. **Nén Danh sách Đen bằng Bloom Filter (~0.05ms):** Nén **500.000 số lừa đảo** vào chỉ **~600 KB RAM** với tỷ lệ sai số 0.1%. Hỗ trợ **Cập nhật vi sai (Differential Update)** theo từng giờ (~2 KB/lần).
3. **Định danh Tổ chức Uy tín (Verified Brandname):** Xác thực tức thì đầu số ngân hàng, ví điện tử (Vietcombank, Techcombank, MoMo...) thông qua bộ nhớ đệm nội bộ và API định danh bất đồng bộ (Hard Timeout 450ms).
4. **Kiến trúc Bảo mật Tuyệt đối (Zero-PII):** Toàn bộ số điện thoại lạ đều được chuẩn hóa E.164 và băm một chiều **SHA-256 + Pepper Salt** ngay trên thiết bị trước khi gửi lên Backend. Không thu thập danh bạ, không lưu nhật ký số thô.

## 🚀 Hướng dẫn Cài đặt & Chạy thử (Demo Thuyết trình)

### Yêu cầu môi trường
* Flutter SDK `>= 3.19.0` | Dart `>= 3.3.0`
* Android Studio / VS Code + Thiết bị Android (hoặc Emulator Android 10+)

### Các bước chạy ứng dụng
1. **Khởi tạo và tải thư viện:**
   ```bash
   flutter pub get