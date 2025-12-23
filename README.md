# FB Content Blocker

Chrome Extension chặn nội dung Facebook theo từ khóa. Tự động ẩn bài viết quảng cáo, spam và nội dung không mong muốn.

## Tính năng chính

- **Tự động chặn quảng cáo** - Block "Được tài trợ", "Sponsored" mà không cần thêm keyword
- **Chặn theo từ khóa** - Thêm từ khóa tùy chỉnh để block
- **Hỗ trợ tiếng Việt** - Nhận diện từ có/không dấu ("Được tài trợ" = "Duoc tai tro")
- **Whitelist** - Danh sách ngoại lệ không bị chặn
- **Import/Export** - Backup và restore danh sách từ khóa
- **Thống kê** - Theo dõi số bài đã chặn

---

## Cài đặt

1. Download hoặc clone repository này
2. Mở `chrome://extensions/` trong Chrome
3. Bật **Developer mode** (góc phải trên)
4. Click **Load unpacked** → chọn folder extension

---

## Hướng dẫn sử dụng

### 1. Chặn quảng cáo tự động

Extension tự động chặn các bài có:
- "Được tài trợ"
- "Sponsored"
- "Đề xuất cho bạn"
- "Suggested for you"

**Không cần làm gì** - chỉ cần cài extension và bật lên.

### 2. Thêm từ khóa chặn

**Cách 1: Thêm từng từ**
1. Click icon extension
2. Gõ từ khóa (ví dụ: "bitcoin")
3. Chọn category (nếu muốn)
4. Click **Thêm**

**Cách 2: Thêm nhiều từ cùng lúc**
1. Click **Thêm nhiều từ khóa**
2. Paste danh sách (mỗi dòng 1 từ):
   ```
   bitcoin
   crypto
   tiền ảo
   đầu tư
   ```
3. Click **Thêm tất cả**

### 3. Ví dụ từ khóa hữu ích

**Chặn quảng cáo/spam:**
```
giảm giá
khuyến mãi
sale
freeship
mua ngay
đặt hàng
link bio
shopee
lazada
```

**Chặn nội dung chính trị:**
```
bầu cử
chính trị
đảng
```

**Chặn clickbait:**
```
không thể tin
gây sốc
bất ngờ
ai cũng phải xem
```

**Chặn bài về crypto:**
```
bitcoin
ethereum
crypto
tiền ảo
NFT
airdrop
```

### 4. Whitelist (Ngoại lệ)

Nếu từ khóa chặn nhầm bài bạn muốn xem:

1. Mở **Options** (chuột phải icon → Options)
2. Kéo xuống phần **Whitelist**
3. Thêm từ khóa ngoại lệ

**Ví dụ:** Bạn chặn "sale" nhưng muốn xem bài của shop yêu thích:
- Whitelist: "Thời trang ABC"

### 5. Import/Export

**Export (Backup):**
1. Mở Options
2. Click **Export JSON**
3. Lưu file backup

**Import (Restore):**
1. Mở Options
2. Click **Import JSON**
3. Chọn file backup

**Chia sẻ danh sách:**
- Export file JSON
- Gửi cho bạn bè
- Họ Import vào extension của họ

### 6. Xem bài đã ẩn

Khi extension ẩn bài, bạn thấy placeholder:
```
[Nội dung đã bị ẩn bởi FB Content Blocker] [Hiện]
```

Click **Hiện** để xem lại bài đó.

---

## Cài đặt nâng cao

### Options Page
Chuột phải icon extension → **Options**

| Cài đặt | Mô tả |
|---------|-------|
| Bật extension | Tắt/bật toàn bộ chức năng |
| Chặn bình luận | Ẩn cả comments chứa từ khóa |
| Phân biệt hoa/thường | "SPAM" khác "spam" |
| Hiển thị placeholder | Tắt = xóa hoàn toàn bài (không thể xem lại) |

### Regex Pattern
Cho người dùng nâng cao - dùng regex để match phức tạp hơn:

1. Tick **Regex** khi thêm từ khóa
2. Nhập pattern (ví dụ: `\d{10,11}` để chặn số điện thoại)

**Ví dụ regex hữu ích:**
```
\d{10,11}          # Số điện thoại 10-11 số
https?://\S+       # Tất cả link
#\w+               # Tất cả hashtag
@\w+               # Tất cả mention
```

---

## FAQ

**Q: Extension có chặn được quảng cáo không?**
A: Có, tự động chặn bài "Được tài trợ" mà không cần thêm keyword.

**Q: Sao bài quảng cáo vẫn hiện?**
A:
1. Reload extension: `chrome://extensions` → click icon reload
2. Refresh Facebook: Cmd+Shift+R (Mac) hoặc Ctrl+Shift+R (Windows)
3. Bật DEBUG mode và gửi log cho dev

**Q: Extension có an toàn không?**
A:
- Không thu thập dữ liệu
- Không gửi thông tin ra ngoài
- Chỉ chạy trên facebook.com
- Open source, có thể kiểm tra code

**Q: Làm sao báo lỗi?**
A: Mở issue trên GitHub với:
1. Screenshot bài không bị chặn
2. Console log (F12 → Console → filter "FB Blocker")

---

## Debug

Nếu extension không hoạt động:

1. Mở file `content.js`
2. Đổi `const DEBUG = false;` thành `const DEBUG = true;`
3. Reload extension
4. Mở Facebook, F12 → Console
5. Filter: `FB Blocker`
6. Copy log và báo cáo

---

## Phiên bản

| Version | Thay đổi |
|---------|----------|
| 2.1.0 | Tự động chặn quảng cáo, fuzzy matching tiếng Việt |
| 2.0.0 | i18n, whitelist, regex, comment blocking |
| 1.0.0 | Phiên bản đầu tiên |

---

## License

MIT - Tự do sử dụng và chỉnh sửa.
