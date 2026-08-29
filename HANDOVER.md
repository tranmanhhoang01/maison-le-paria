# MAISON LE PARIA — Bàn giao

> Tài liệu này là **nguồn duy nhất** mô tả trạng thái dự án. Dán nguyên văn vào một
> đoạn chat mới là đủ để hiểu toàn bộ cơ chế.
>
> Cập nhật: 2026-08-29 (bản thiết kế "giấy dó") · Có thay đổi **chưa commit, chưa đẩy** —
> xem mục 4. Commit gần nhất trước đó: `792f6d2`.

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

Bundle hiện tại: **JS 198 KB (gzip 71 KB)**, CSS 31 KB (gzip 6.5 KB), chữ 24 tệp woff2
(Playfair Display + Be Vietnam Pro, chỉ latin + vietnamese).

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
│   ├── fonts/                     ⚠️ MÁY TẢI VỀ — không để ở public/, xem mục 6
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
│   ├── sets.json                  bộ ảnh nào hiện, thứ tự, mô tả, **covers** (ảnh đại diện)
│   ├── home.json                  ảnh nền trang mở đầu + độ chìm
│   └── sound.json                 nhạc nền đang chọn
│
├── public/images/ (22M) · public/audio/ (2.5M)
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

### Bản thiết kế "giấy dó" (đợt sửa mới nhất — chưa commit)

Trước đây trang đứng trên nền đen. Nền đen là mặc định của mọi mẫu portfolio, và
nó không nói gì về nơi những tấm ảnh này được chụp. Bản mới đứng trên **giấy dó**:

| | |
|---|---|
| Nền | Ngà ấm `#f0e7d7`, có vân giấy rất nhẹ (`--fibre`, nhân multiply 4%) |
| Chữ | Mực nho `#241a13` |
| Điểm nhấn | **Đỏ son** `#9b2c1c` — chỉ dùng cho con triện, số chương, gạch chân đang chọn |
| Chỉ vàng | `#a98442` — gạch dưới tiêu đề, hoa văn hồi văn |
| Trang xem ảnh | Vẫn tối, nhưng là **sơn mài ấm** `#1a1410`, không phải đen |
| Chữ tiêu đề | **Playfair Display** (đủ dấu tiếng Việt, đã kiểm bằng máy) |
| Chữ nội dung | Be Vietnam Pro 300 |
| Hoa văn | **Hồi văn** (`--meander`, SVG lặp) và **con triện** đỏ chữ M (`.seal`) |

Ảnh nền trang mở đầu **nhân (multiply) vào giấy** chứ không phủ mờ lên trên: trên nền
sáng, hạ opacity chỉ làm ảnh bợt màu, còn multiply để giấy giữ vùng sáng và ảnh giữ
vùng tối — đọc ra như ảnh in trên giấy.

### Website

- **Tổng quan** — ngôi nhà trong năm màn hình (xem mục 6). Con lăn / kéo / phím ←→ /
  Home / End / bấm vạch chỉ vị trí. Kéo thì **khung hình bám tay theo thời gian thực**,
  thả ra mới trượt tiếp; con lăn có khoá 700ms nên một cú vuốt trackpad chỉ sang **một**
  màn, không nhảy ba màn.
- **Ảnh đại diện từng bộ** — chọn tối đa 3 ảnh trong Studio; ảnh số 1 là ảnh lớn nhất.
  Chưa chọn thì web tự lấy (ảnh bìa + 2 ảnh rải đều). Bố cục: ảnh lớn cao hết khung,
  hai ảnh phụ **bằng nửa** ảnh lớn xếp cạnh — không chồng nhau, không rời rạc. Trên
  điện thoại ba ảnh chiếm trọn bề ngang.
- **Ảnh nền trang mở đầu** — chọn trong Studio, kèm thanh "độ chìm".
- **Thư viện hai tầng** — tầng dưới là mục lục **zíc-zắc**: mỗi bộ một ảnh đại diện,
  câu chuyện nằm bên cạnh, trái–phải–trái. Bấm vào mới mở cả bộ ở `/thu-vien/<bộ>`
  (địa chỉ thật, nút Back của trình duyệt chạy đúng). Ảnh ngang và ảnh dọc đều giữ
  đúng tỉ lệ và kích thước thật, không cắt vuông.
- **Xem ảnh** — bấm ảnh nào mở ảnh đó ở bản 2400px, có phím mũi tên và Escape.
- **Giới thiệu · Liên hệ** — nội dung thật của chủ nhân đã điền.
- **Màn chờ** khi chuyển tab.
- **Nhạc nền** bật/tắt bằng nút ở góc.
- **Bố cục hẹp** cho điện thoại. Trên điện thoại tắt lớp vân giấy và lớp bụi
  (canvas chạy mỗi khung hình) — đổi chút không khí lấy cuộn mượt.

### Đường ống ảnh (`npm run images`)

1. Xoay theo EXIF
2. Sinh WebP ba cỡ — 1000 (ô), 1600 (rộng), 2400 (xem full)
3. Sinh LQIP base64 40px nhúng thẳng vào JSON → không có ô trắng lúc chờ
4. Băm tri giác 8×8 aHash, Hamming ≤ 6 → **tự loại ảnh trùng**
5. Rút màu chủ đạo làm nền cho từng ô

Quy tắc: **một thư mục = một bộ ảnh, không đệ quy xuống thư mục con.**

### Studio (app macOS)

Thêm / thay / xóa ảnh · **chọn ảnh đại diện của bộ** · **chọn ảnh nền trang mở đầu +
độ chìm** · đổi nhạc · xem trước · **một nút deploy lên GitHub**.
Xác thực bằng **SSH** (`~/.ssh/id_ed25519`, không mật khẩu).

> App `.app` đã build **không cần build lại**: nó chỉ mở `studio/server.mjs` và
> `studio/app.html` từ thư mục dự án, nên sửa giao diện Studio là có hiệu lực ngay.

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

**Chỉ ảnh chụp màn hình mới đẩy được khung hình.** Khung dưới 820px thì chuột bị tắt,
và **ảnh chụp ngay sau khi cuộn bằng JavaScript thường trả về một trang trắng** dù DOM
vẫn đúng — đo bằng `getBoundingClientRect` thay vì tin vào ảnh chụp.
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
| Trang thật hiện bằng font hệ thống, không phải font đã chọn | `fonts.css` ghi `url('/fonts/…')` trong khi site nằm ở `/maison-le-paria/` → **mọi tệp chữ 404 im lặng**. Đã sửa: chữ nằm ở `src/fonts/`, đường dẫn tương đối, Vite tự gắn base. Đừng chuyển ngược về `public/` |

### Còn lại, chưa nghiêm trọng

- `/thu-vien` và `/thu-vien/<bộ>` trả **HTTP 404** trên GitHub Pages dù trang vẫn hiện
  đúng (workflow chép `index.html` thành `404.html`) — giới hạn của SPA trên Pages.
  Không ảnh hưởng người xem, ảnh hưởng SEO.
- Trên điện thoại, ba ảnh đại diện **có bị cắt** để lấp kín bề ngang (`object-position:
  50% 32%`, ưu tiên giữ phần đầu và vai). Đây là đánh đổi có chủ ý: giữ đúng tỉ lệ trên
  màn hẹp thì ảnh chỉ còn hơn trăm pixel bề ngang.
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
trên `.overview__track`. Bố cục ba tấm do CSS lo, không phải script tính. Điều này xoá
luôn cả một họ lỗi: lệch pha, số đo sai, hiệu ứng bắt gặp lúc còn dở dang.

Ngoại lệ duy nhất: **trong lúc ngón tay đang kéo**, `Universe.jsx` ghi thẳng
`transform` lên phần tử track (và bật `data-dragging` để tắt transition). Đó vẫn không
phải vòng lặp — chỉ là một phép ghi trong mỗi sự kiện `pointermove`. Cũng vì thế
`transform` **không** được truyền qua prop `style` của React: hai chủ sở hữu cho cùng
một thuộc tính là cách nhanh nhất để trang bắt đầu giật.

**3. Xử lý ảnh lúc build, không phải lúc chạy.** Người xem chỉ nhận WebP đã tối ưu.
Không có thư viện xử lý ảnh nào lọt vào bundle.

**4. `media.js` là khớp nối duy nhất tới nơi chứa ảnh.** Muốn chuyển sang CDN, chỉ sửa
một tệp này.

**5. Ba màn hình con trong `App.jsx`, không dùng thư viện router.** `lib/router.js`
(~70 dòng) hiểu năm địa chỉ, kể cả `/thu-vien/<bộ>`. Đủ cho từng ấy trang, và giữ được
màn chờ chuyển cảnh.

**6. Studio bọc Node bằng WKWebView, không dùng Electron.** 260KB thay vì 200MB.
Cần `-target arm64-apple-macos13.0` khi build, và **phải có menu Edit** thì ⌘C/⌘V
mới hoạt động (macOS gắn phím tắt vào menu).

**7. Ba ảnh đại diện là bố cục, không phải lưới.** Cả chương là một hàng flex
`column wrap`: ảnh lớn cao hết khung, hai ảnh phụ tràn sang cột thứ hai, và **chiều
rộng mỗi ảnh do chính tỉ lệ của nó quyết định** (`aspect-ratio`). Không đo, không
script — nên không có gì để lệch pha. Ảnh dọc thì hai ảnh phụ xếp dọc bên cạnh, ảnh
ngang thì ảnh lớn chỉ cao 68% (`data-hang` trong `lib/scenes.js`), vì một ảnh ngang
cao hết khung sẽ rộng bằng nửa căn phòng.

**8. Thư viện là mục lục trước, bộ ảnh sau.** Mở thẳng 41 ảnh nghĩa là bộ thứ hai nằm
đâu đó dưới một cuộn rất dài và không ai gặp nó. Mục lục zíc-zắc cho thấy cả nhà trong
một trang, rồi mới chọn.

**9. `content/*.json` là dữ liệu của người dùng.** Tôi từng ghi đè cả tệp
`sound.json` và xoá mất lựa chọn nhạc của chủ nhân. **Luôn sửa từng khóa.**

---

## 8. Hướng phát triển tiếp

**Nên làm trước:**

1. **Chọn ảnh đại diện cho từng bộ và ảnh nền trang mở đầu** trong Studio — hiện mới
   chọn ảnh nền (`jpeg-05`), ba bộ vẫn để web tự lấy
2. **Gắn tên miền** — việc còn lại duy nhất để trang thật sự "xong"
3. **`og:image` + thẻ meta** — hiện chia sẻ lên mạng xã hội ra ô trống, đây là cách
   phần lớn người ta gặp trang này lần đầu
4. **Xác nhận nhạc có quyền dùng** trước khi quảng bá

**Có thể làm:**

- Tách `fn` và `fn-buoi-1` thành một bộ, vì cùng buổi chụp
- Cho Studio sửa được `projects.js` (tên bộ, câu chuyện) — hiện phải sửa tay
- Nạp ảnh lười (`loading="lazy"`) ở Thư viện; 41 ảnh thì chưa cần, 200 ảnh thì cần
- `sitemap.xml`

**Đừng làm, trừ khi có lý do mới:**

- Đưa three.js / WebGL trở lại. Đã thử, đã gỡ: nó làm ảnh mờ đi và cạnh tranh với ảnh
- Quay lại nền đen, hoặc thêm màu thứ ba. Bảng màu chỉ có giấy, mực, son, vàng — son và
  vàng dùng theo **sợi chỉ**, không bao giờ thành mảng
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
| Bộ nào hiện, thứ tự | Studio → ghi vào `content/sets.json` |
| Ảnh đại diện của bộ (tối đa 3) | Studio → chọn ngay trên lưới ảnh → `covers` trong `content/sets.json` |
| Ảnh nền trang mở đầu + độ chìm | Studio → tab **Trang mở đầu** → `content/home.json` |
| Màu, khoảng cách, cỡ chữ, hoa văn | `src/styles/tokens.css` |
| Bộ chữ | `scripts/fetch-fonts.mjs` rồi chạy `node scripts/fetch-fonts.mjs` (tự từ chối font thiếu dấu tiếng Việt) |
