# MAISON LE PARIA — Bàn giao

> Tài liệu này là **nguồn duy nhất** mô tả trạng thái dự án. Dán nguyên văn vào một
> đoạn chat mới là đủ để hiểu toàn bộ cơ chế.
>
> Cập nhật: 2026-08-29 · Commit `6d6a51c` · Cây làm việc sạch, đã đẩy lên GitHub.

---

## 1. Mục tiêu

Website ảnh cá nhân của một nhiếp ảnh gia Việt Nam, phải cho cảm giác **một triển lãm
nghệ thuật số**, không phải trang dịch vụ chụp ảnh cưới.

Ràng buộc đã chốt qua quá trình làm:

| | |
|---|---|
| Ngôn ngữ | **Chỉ tiếng Việt.** Không đa ngữ, không chuyển ngữ |
| Ảnh | Ảnh thật của chủ nhân, lấy từ `~/Desktop/ảnh web` |
| Chủ thể | Ảnh là nhân vật chính. Giao diện lùi lại, không cạnh tranh |
| Tông màu | Nền tối, ít chi tiết, chữ thưa |
| Nội dung | Do dữ liệu điều khiển — thêm bộ ảnh **không cần sửa mã** |
| Người dùng cuối | Chủ nhân tự thay ảnh/nhạc và tự đăng, **không mở terminal** |

---

## 2. Công nghệ

```
React 18 + Vite 5      — không router, không thư viện state, không UI kit
Sharp                  — xử lý ảnh lúc build (chạy trên máy, không phải trên web)
Swift + WKWebView      — app quản trị macOS (260KB)
Node http (thuần)      — server nội bộ của app quản trị
GitHub Pages + Actions — nơi xuất bản
```

**Không dùng, và là chủ ý:** three.js / R3F (đã gỡ), Electron, thư viện animation,
Tailwind, CMS ngoài. Toàn bộ phụ thuộc runtime chỉ có `react` + `react-dom`.

Bundle hiện tại: **JS 193 KB (gzip 70 KB)**, CSS 29 KB (gzip 6 KB).

---

## 3. Cấu trúc thư mục

```
maison-le-paria/
├── src/
│   ├── App.jsx                    điều phối màn hình, quyết định layout hẹp/rộng
│   ├── data/
│   │   ├── site.js                ⭐ TÊN, TAGLINE, LIÊN HỆ, GIỚI THIỆU — sửa ở đây
│   │   ├── projects.js            mô tả từng bộ ảnh (tên, câu chuyện)
│   │   └── generated/images.json  ⚠️ MÁY SINH — đừng sửa tay
│   ├── lib/
│   │   ├── media.js               ⭐ khớp nối duy nhất tới nơi chứa ảnh
│   │   ├── router.js              điều hướng, có xử lý base path của GitHub Pages
│   │   ├── scenes.js              dựng 5 chương của trang Tổng quan
│   │   ├── constellation.js       bố cục Thư viện
│   │   ├── transition.js          màn chờ khi chuyển tab
│   │   └── math.js
│   ├── components/
│   │   ├── universe/  Universe.jsx (Tổng quan) · Plate.jsx · Photo.jsx · FocusLabel.jsx
│   │   ├── screens/   LibraryPanel · AboutPanel · ContactPanel
│   │   ├── viewer/    Viewer.jsx (xem ảnh full màn hình)
│   │   └── chrome/    Nav · Intro · Curtain · Dust · SoundToggle
│   ├── hooks/useImageReady.js     ⚠️ đọc kỹ trước khi sửa — xem mục 6
│   ├── store/experience.js        useSyncExternalStore
│   ├── audio/sound.js             nhạc nền
│   └── styles/                    tokens · base · universe · screens · viewer · chrome · fonts
│
├── scripts/
│   ├── import-images.mjs          ⭐ ảnh gốc → WebP + LQIP + images.json
│   ├── sources.json               trỏ tới thư mục ảnh gốc (đường dẫn tương đối)
│   ├── add-music.mjs
│   └── fetch-fonts.mjs
│
├── studio/                        APP QUẢN TRỊ
│   ├── server.mjs                 server nội bộ (thêm/xóa ảnh, nhạc, deploy)
│   ├── app.html                   giao diện
│   └── mac/Studio.swift + build.mjs
│
├── content/                       ⚠️ DỮ LIỆU NGƯỜI DÙNG — sửa từng khóa, đừng ghi đè cả tệp
│   ├── sets.json                  bộ ảnh nào hiện, thứ tự, ảnh bìa
│   └── sound.json                 nhạc nền đang chọn
│
├── public/images/ (22M) · public/audio/ (2.5M) · public/fonts/ (444K)
├── attic/                         thiết kế đã bỏ, giữ lại để tham khảo
└── Maison Le Paria Studio.app     app đã build
```

### Lệnh

```bash
npm run dev      # phát triển
npm run build    # đóng gói
npm run images   # nạp lại ảnh từ ~/Desktop/ảnh web
npm run studio   # server quản trị (không cần app)
npm run app      # build lại app macOS
npm run music <đường-dẫn>
```

> **Máy này không có Node hệ thống.** Mọi phiên terminal phải chạy trước:
> `export PATH="$HOME/.local/node/bin:$PATH"`

---

## 4. Đã hoàn thành

### Website

- **Tổng quan** — ngôi nhà trong năm màn hình (xem mục 6). Con lăn / kéo / phím ←→ /
  Home / End / bấm vạch chỉ vị trí.
- **Thư viện** — trưng bày toàn bộ 41 ảnh. Ảnh ngang và ảnh dọc đều giữ đúng tỉ lệ
  và kích thước thật, không cắt vuông.
- **Xem ảnh** — bấm ảnh nào mở ảnh đó ở bản 2400px, có phím mũi tên và Escape.
- **Giới thiệu · Liên hệ** — nội dung thật của chủ nhân đã điền.
- **Màn chờ** khi chuyển tab.
- **Nhạc nền** bật/tắt bằng nút ở góc.
- **Bố cục hẹp** cho điện thoại.

### Đường ống ảnh (`npm run images`)

1. Xoay theo EXIF
2. Sinh WebP ba cỡ — 1000 (ô), 1600 (rộng), 2400 (xem full)
3. Sinh LQIP base64 40px nhúng thẳng vào JSON → không có ô trắng lúc chờ
4. Băm tri giác 8×8 aHash, Hamming ≤ 6 → **tự loại ảnh trùng**
5. Rút màu chủ đạo làm nền cho từng ô

Quy tắc: **một thư mục = một bộ ảnh, không đệ quy xuống thư mục con.**

### Studio (app macOS)

Thêm / thay / xóa ảnh · đổi nhạc · xem trước · **một nút deploy lên GitHub**.
Xác thực bằng **SSH** (`~/.ssh/id_ed25519`, không mật khẩu).

### Xuất bản

GitHub Actions tự build và đăng mỗi lần push.
Repo: `git@github.com:tranmanhhoang01/maison-le-paria.git`

---

## 5. Chưa hoàn thành

| Việc | Ai làm | Ghi chú |
|---|---|---|
| **Gắn tên miền riêng** | Bạn | Trỏ DNS + Settings → Pages → Custom domain |
| **Nhạc có bản quyền** | Bạn | Tệp đang dùng do bạn thêm. Trang này công khai — hãy chắc bạn có quyền dùng |
| Ảnh mở đồ hoạ mạng xã hội | — | Chưa có `og:image`, chia sẻ lên Facebook sẽ trống |
| `sitemap.xml`, `robots.txt` | — | Chưa có |
| Studio trên máy khác | — | Chạy được, nhưng máy đó cần khoá SSH riêng |

---

## 6. Lỗi đang tồn tại và bẫy đã biết

### ⚠️ Bẫy môi trường — đọc trước khi "sửa lỗi" trang Tổng quan

Khung xem trước của công cụ **bóp nghẹt `requestAnimationFrame` và co về 0×0 khi
chạy JavaScript**. Hệ quả: mọi chuyển động trông như hỏng, số đo trả về bằng 0.
Tôi đã hai lần đi săn lỗi không tồn tại vì chuyện này.

**Chỉ ảnh chụp màn hình mới đẩy được khung hình.** Khung dưới 820px thì chuột bị tắt.
Muốn biết trang có chạy thật không, hãy mở trên trình duyệt thật.

### Bẫy đã từng cắn, đã sửa, đừng lặp lại

| Triệu chứng | Nguyên nhân thật |
|---|---|
| "Ảnh chất lượng kém" trên GitHub Pages | Không phải ảnh xấu — ảnh 404, cái nhìn thấy là LQIP. `media.js` ghi cứng `/images` thay vì `import.meta.env.BASE_URL` |
| Trang treo cứng khi mở ảnh | Vòng lặp render vô hạn: `ref` inline tạo mảng mới mỗi lần render |
| Ảnh đã cache không bao giờ hiện | `onLoad` không bắn cho ảnh trong cache → phải kiểm `img.complete`, đó là lý do có `useImageReady.js` |
| Điện thoại hoá trên cửa sổ 1280px | `pointer: coarse` và `innerWidth === 0` lúc chưa đo được |
| Menu nhảy ra ngoài site | Router đọc `location.pathname` thô, quên base path |
| Ảnh ngang tràn sang chương kế | Neo theo mép trái → ảnh càng rộng càng đẩy ra ngoài. Phải neo **mép phải** |
| Studio deploy lỗi 128 | Remote còn chứa placeholder `TÊN-BẠN` |
| Font "đạt" nhưng thiếu dấu tiếng Việt | Phép kiểm ngây thơ luôn báo đạt. Phải kiểm từng ký tự có dấu |

### Còn lại, chưa nghiêm trọng

- `/thu-vien` trả **HTTP 404** trên GitHub Pages dù trang vẫn hiện đúng — giới hạn
  của SPA trên Pages. Không ảnh hưởng người xem, ảnh hưởng SEO.
- Hai bộ `fn` và `fn-buoi-1` là **cùng một buổi chụp**, ảnh gốc chỉ rộng 1365px nên
  hơi mềm khi phóng rất lớn.
- `attic/` là mã chết có chủ ý. Đừng import từ đó.

---

## 7. Quyết định kỹ thuật quan trọng

**1. Tổng quan ≠ Thư viện.** Đây là bài học đắt nhất của dự án. Bảy bản nháp:

```
mặt phẳng Apple Watch → vũ trụ thiên hà → ba tầng trôi → một dải trôi
→ tường ảnh cách đều → tường một-tác-phẩm → NGÔI NHÀ NĂM MÀN HÌNH
```

Bốn bản đầu sai vì **thêm thứ cạnh tranh với ảnh**. Hai bản tường sai vì **trùng việc
với Thư viện** — cũng chỉ là một hàng ảnh để lướt, vậy có hai trang để làm gì.

Bản hiện tại trả lời những câu hỏi của người ghé lần đầu:

| Màn hình | Nói gì |
|---|---|
| Mở đầu | Đây là ai — tên nhà, tuyên ngôn, một ảnh lùi ra sau ở 16% độ mờ làm căn phòng |
| Ba chương bộ ảnh | Làm gì — tên bộ, câu chuyện, **ba tấm** dựng thành bố cục, đường vào Thư viện |
| Kết | Tìm ở đâu — lời mời và ba kênh liên hệ |

Mỗi bộ chỉ khoe **ba tấm**: ảnh bìa giữ mắt, cộng hai tấm rải đều cho thấy phạm vi
(`pickPlates` trong `lib/scenes.js`). Đủ để muốn xem tiếp, không đủ để thay Thư viện.

**2. Không có vòng lặp animation.** Cả trang trượt bằng **một CSS transition duy nhất**
trên `.overview__track`. Bố cục ba tấm do CSS lo (`.plate[data-slot]`), không phải
script tính. Điều này xoá luôn cả một họ lỗi: lệch pha, số đo sai, hiệu ứng bắt gặp
lúc còn dở dang.

**3. Xử lý ảnh lúc build, không phải lúc chạy.** Người xem chỉ nhận WebP đã tối ưu.
Không có thư viện xử lý ảnh nào lọt vào bundle.

**4. `media.js` là khớp nối duy nhất tới nơi chứa ảnh.** Muốn chuyển sang CDN, chỉ sửa
một tệp này.

**5. Ba màn hình con trong `App.jsx`, không dùng router.** Đủ cho ba trang, và giữ
được màn chờ chuyển cảnh.

**6. Studio bọc Node bằng WKWebView, không dùng Electron.** 260KB thay vì 200MB.
Cần `-target arm64-apple-macos13.0` khi build, và **phải có menu Edit** thì ⌘C/⌘V
mới hoạt động (macOS gắn phím tắt vào menu).

**7. `content/*.json` là dữ liệu của người dùng.** Tôi từng ghi đè cả tệp
`sound.json` và xoá mất lựa chọn nhạc của chủ nhân. **Luôn sửa từng khóa.**

---

## 8. Hướng phát triển tiếp

**Nên làm trước:**

1. **Gắn tên miền** — việc còn lại duy nhất để trang thật sự "xong"
2. **`og:image` + thẻ meta** — hiện chia sẻ lên mạng xã hội ra ô trống, đây là cách
   phần lớn người ta gặp trang này lần đầu
3. **Xác nhận nhạc có quyền dùng** trước khi quảng bá

**Có thể làm:**

- Tách `fn` và `fn-buoi-1` thành một bộ, vì cùng buổi chụp
- Cho Studio sửa được `projects.js` (tên bộ, câu chuyện) — hiện phải sửa tay
- Nạp ảnh lười (`loading="lazy"`) ở Thư viện; 41 ảnh thì chưa cần, 200 ảnh thì cần
- `sitemap.xml`

**Đừng làm, trừ khi có lý do mới:**

- Đưa three.js / WebGL trở lại. Đã thử, đã gỡ: nó làm ảnh mờ đi và cạnh tranh với ảnh
- Biến Tổng quan thành một hàng ảnh để lướt. Đã sai sáu lần
- Thêm animation chạy theo khung hình vào Tổng quan

---

## 9. Sửa nội dung ở đâu

| Muốn đổi | Tệp |
|---|---|
| Tên, tagline, email, Instagram, giới thiệu | `src/data/site.js` |
| Tên bộ ảnh, câu chuyện từng bộ | `src/data/projects.js` |
| Ảnh | Studio, hoặc bỏ vào `~/Desktop/ảnh web` rồi `npm run images` |
| Nhạc | Studio, hoặc `npm run music <đường-dẫn>` |
| Bộ nào hiện, thứ tự, ảnh bìa | Studio → ghi vào `content/sets.json` |
| Màu, khoảng cách, cỡ chữ | `src/styles/tokens.css` |
