# VN Anti-Scam Guard

Bản thử nghiệm mã nguồn mở giúp phân tích đầu số Việt Nam và chia sẻ cảnh báo qua một máy chủ cộng đồng do người vận hành lựa chọn. Báo cáo được đối chiếu đồng thuận trước khi trở thành cảnh báo chung; danh bạ thương hiệu xác minh được ưu tiên bảo vệ.

## Chạy ứng dụng

Yêu cầu Node.js `>=22.13.0` để sử dụng mô-đun SQLite tích hợp `node:sqlite`.

1. Cài phần phụ thuộc một lần: `cd backend` rồi chạy `npm install`.
2. Khởi động API từ thư mục `backend`: `npm start`. Cơ sở dữ liệu `backend/antiscam.db` và các bảng sẽ được tạo tự động khi máy chủ khởi động.
3. Mở một terminal khác ở thư mục gốc dự án và chạy máy chủ tệp tĩnh, ví dụ `python -m http.server 8765`.
4. Mở `http://127.0.0.1:8765/demo.html`.

## Tính năng

- Phân tích nhà mạng theo đầu số gốc, loại đường dây, một số mã vùng điện thoại cố định, đầu số MVNO và dải VoIP/SIP Trunk được cấu hình.
- Điểm rủi ro 0–100 kết hợp dữ liệu cảnh báo, báo cáo, thương hiệu xác minh và lượt quét lặp lại.
- Nhật ký quét lưu số đã che, mã băm SHA-256, mã thiết bị đã băm, nhà mạng suy luận, điểm/mức rủi ro và thời gian. Không lưu số đầy đủ trong nhật ký; API lịch sử chỉ trả về nhật ký của thiết bị có mã khớp. Tần suất quét là tín hiệu từ hoạt động tra cứu ứng dụng, không phải dữ liệu cuộc gọi hoặc phát hiện robocall thực tế.
- Quét tối đa 200 số mỗi lần; nhập danh sách cảnh báo dạng JSON, CSV hoặc mỗi dòng một số.
- Xem 15 lượt quét gần nhất, gồm mã băm rút gọn; xóa lịch sử khỏi SQLite hoặc dùng bản dự phòng trong trình duyệt khi máy chủ ngoại tuyến.
- Báo cáo được ghi vào SQLite và bộ nhớ trình duyệt; báo cáo có thể bị xóa riêng khỏi từng nơi.
- Đồng thuận cộng đồng: một thiết bị duy nhất chỉ được ghi nhận một lần cho mỗi số; 1–2 báo cáo ở trạng thái chờ, từ 3 báo cáo độc lập tạo cảnh báo cộng đồng, từ 10 báo cáo hoặc nguồn dữ liệu mở được tin cậy đánh dấu độ tin cậy cao.
- Số trong `verified_brands` không nhận báo cáo cộng đồng và không được xuất trong dữ liệu cảnh báo.
- `GET /api/v1/community/feed` xuất JSON chuẩn phiên bản 1; `POST /api/v1/community/sync` nhận JSON này để đồng bộ danh sách đạt ngưỡng vào máy chủ khác.
- Dữ liệu thương hiệu ban đầu: Vietcombank, Techcombank, MoMo và GHN. Danh sách số cảnh báo mẫu: `+842477799999` và `+842899988888`.

Để nhiều người dùng chung một mạng, triển khai API tới máy chủ do cộng đồng quản lý, cấu hình `HOST`/`PORT`, rồi đặt URL API trong thẻ meta `antiscam-api-base` của `demo.html` (ví dụ `https://api.example.org/api/v1`). Khi mở API ra mạng, cấu hình `OPEN_FEED_IMPORT_TOKEN` (tối thiểu 32 ký tự ASCII ngẫu nhiên) để khóa thao tác nạp feed; cấu hình cùng `COMMUNITY_SYNC_SECRET` (tối thiểu 32 ký tự) trên các nút tin cậy để ký/xác thực dữ liệu đồng bộ. Nếu chưa cấu hình khóa đồng bộ, dữ liệu feed vẫn xuất được nhưng endpoint đồng bộ sẽ từ chối yêu cầu. Mặc định API chỉ lắng nghe `127.0.0.1`. Không mở API ghi dữ liệu ra Internet nếu chưa có HTTPS, giới hạn tốc độ và quy trình quản trị dữ liệu phù hợp.

## API cục bộ

- `POST /api/v1/scan-number` — `{ "e164Number": "+84987654321", "localReportsCount": 0, "device_token": "<mã ngẫu nhiên lưu trên thiết bị>" }`
- `POST /api/v1/report` — `{ "e164Number": "+84987654321", "tag": "Yêu cầu cung cấp OTP", "device_token": "<mã ngẫu nhiên lưu trên thiết bị>" }`
- `POST /api/v1/bulk-scan` — `{ "numbers": ["0987654321", "+842477799999"], "device_token": "<mã ngẫu nhiên lưu trên thiết bị>" }`
- `POST /api/v1/import-feed` — `{ "content": "+842477799999, Tổng đài ảo đáng ngờ" }`
- `GET /api/v1/stats` — số thương hiệu, số cảnh báo và tổng lượt quét
- `GET /api/v1/scan-history` — gửi mã ở header `X-Device-Token`; trả về 15 lượt quét của thiết bị, chỉ gồm số đã che và mã băm rút gọn
- `DELETE /api/v1/scan-history` — gửi mã ở header `X-Device-Token` để xóa lịch sử quét riêng
- `GET /api/v1/community/feed` — xuất JSON chuẩn; có chữ ký HMAC khi cấu hình khóa đồng bộ
- `POST /api/v1/community/sync` — nhận nguyên feed đã ký từ endpoint xuất; yêu cầu `COMMUNITY_SYNC_SECRET` giống nhau giữa các nút

API chỉ lắng nghe trên `127.0.0.1` theo mặc định. `device_token` ngẫu nhiên được lưu dưới dạng băm SHA-256 và dùng để chống gửi lặp, đồng thời tách lịch sử quét theo thiết bị; token không phải xác thực phần cứng và không chống được việc cố ý tạo nhiều danh tính. Đồng thuận là bộ lọc chống lạm dụng cơ bản, không thay thế kiểm duyệt nguồn dữ liệu. Dữ liệu nhập được kiểm tra định dạng, yêu cầu mã quản trị khi API được mở ra ngoài máy cục bộ, dữ liệu đồng bộ phải có chữ ký hợp lệ và danh bạ thương hiệu được bảo vệ trước khi ghi vào SQLite. Tệp cơ sở dữ liệu và nhật ký SQLite được loại khỏi Git theo `.gitignore`; hãy bảo vệ hoặc sao lưu tệp này theo chính sách lưu trữ của bạn.

## Giới hạn

Đây là nguyên mẫu, không phải dịch vụ nhận diện người gọi hoặc kết luận an toàn chính thức. Nhà mạng suy luận từ đầu số có thể không còn chính xác sau khi chuyển mạng giữ số. Mã vùng và danh sách cảnh báo cần được cập nhật, đối chiếu từ nguồn đáng tin cậy. Không nên coi việc không có kết quả là bằng chứng số điện thoại an toàn.

Tra cứu tài khoản Zalo không được tự động hóa. Chỉ tích hợp API chính thức, có thẩm quyền và phù hợp điều khoản sử dụng nếu có.

## Đóng góp và giấy phép

Hoan nghênh đóng góp có dẫn nguồn dữ liệu, giải thích rõ cách xử lý thông tin và không gửi dữ liệu cá nhân ra dịch vụ bên ngoài nếu chưa có sự đồng ý rõ ràng. Dự án sử dụng giấy phép MIT; xem [LICENSE](LICENSE).
