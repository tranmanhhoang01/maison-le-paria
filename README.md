# MAISON LE PARIA

Một không gian triển lãm nhiếp ảnh kỹ thuật số. Toàn bộ ảnh nằm trên một mặt phẳng tối
duy nhất — rê chuột tới đâu, ảnh ở đó lớn lên và sáng lên; bấm một lần là ảnh mở toàn
màn hình ở độ phân giải đầy đủ.

**Trang này không cuộn.** Bánh xe chuột là một núm xoay: cuộn để thu phóng cả vũ trụ
quanh chỗ con trỏ đang chỉ, kéo để đi, bấm để mở. Trên điện thoại: chụm hai ngón để
phóng, một ngón để kéo.

---

## Chạy

Máy này **chưa cài Node**, nên bản Node dùng để dựng site nằm ở `~/.local/node`.
Thêm nó vào PATH trước khi chạy bất kỳ lệnh nào:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

(Muốn gọn hơn về sau: cài Node chính thức từ nodejs.org hoặc Homebrew, rồi xoá `~/.local/node`.)

```bash
npm install      # đã chạy sẵn
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # xem thử bản build
npm run images   # dựng lại toàn bộ ảnh từ ~/Desktop/ảnh web
npm run studio   # app quản trị trong trình duyệt — http://localhost:5199
npm run app      # dựng app macOS "Maison Le Paria Studio.app"
```

---

## Kiến trúc

```
src/
  data/            projects.js (tên các bộ), site.js (nội dung nhà)
    generated/     images.json — do pipeline sinh ra, không sửa tay
  hooks/           useImageReady (bắt ảnh đã nằm trong cache)
  lib/             constellation (bố cục), media, router, transition, math
  store/           experience.js — state rời rạc
  components/
    universe/      Universe (mặt phẳng + vòng lặp animation), Photo, FocusLabel
    chrome/        Nav, Intro, Curtain, Dust, SoundToggle
    screens/       About, Contact, Library
    viewer/        Viewer — ảnh toàn màn hình
  audio/           ambience.js — room tone tổng hợp, không có file nhạc
scripts/           import-images.mjs, fetch-fonts.mjs, sources.json
studio/            server.mjs + app.html (giao diện quản trị)
  mac/             Studio.swift + build.mjs (vỏ app macOS)
content/           sets.json — tên và mô tả các bộ ảnh
attic/             bản 3D cũ (hành lang + phòng project), không nằm trong build
```

**Ba quyết định định hình bản này:**

1. **Không dùng WebGL.** Ảnh là `<img>` thật. Bản trước vẽ ảnh bằng texture
   640px trong three.js — GPU lọc mipmap cộng shader grain là lý do ảnh nhòe.
   Bỏ three.js còn giúp bundle giảm từ ~320 kb xuống ~61 kb gzip.

2. **Một mặt phẳng, tất cả ảnh, một cú bấm.** Không còn hành lang → cánh cửa →
   phòng → ảnh (bốn bước). Toàn bộ 47 ảnh nằm trên một mặt phẳng; rê chuột tới
   đâu ảnh ở đó lớn lên và sáng lên, bấm một lần là mở toàn màn hình.

   Không có thanh cuộn ở đâu cả. Bánh xe chuột thu phóng quanh con trỏ (như núm
   xoay Apple Watch), kéo để di chuyển, chụm hai ngón trên điện thoại. Bàn phím:
   `+` `-` để phóng, `0` về mặc định, mũi tên để đi.

3. **Chuyển động không đi qua React.** Vị trí mặt phẳng và tỉ lệ của từng ảnh
   được ghi thẳng vào DOM trong một vòng `requestAnimationFrame` duy nhất.
   React render 47 ô đúng một lần rồi đứng ngoài — đó là lý do 47 ảnh phóng to
   mượt ở 60fps.

**Thu phóng không bao giờ làm vỡ ảnh.** Mỗi ảnh có hai bản: `tile` 1000px dùng
thường ngày, và `full` 2400px được nạp đè lên **đúng lúc** khung ảnh sắp bị kéo
rộng quá bản 1000px (kích hoạt ở 78% ngưỡng, để ảnh nét kịp về trước khi cần) —
cùng nguyên lý kim tự tháp độ phân giải mà bản đồ dùng.

Cả hai đầu của núm xoay đều **tính từ chính bộ ảnh**, không phải số phỏng đoán:

- **Trần** = điểm mà khung rộng nhất sắp phải vẽ nhiều pixel hơn bản 2400px chứa.
  Vượt qua đó là vỡ, nên nó dừng ở đúng đó.
- **Sàn** = điểm mà một khung cỡ trung bình co xuống dưới 128px (84px trên điện
  thoại) — nhỏ hơn nữa thì không còn đọc được là một bức ảnh.

Thực tế: desktop `0.51 → 2.66` (dải 5.2 lần), điện thoại `0.58 → 4.57`. Đổi kích
thước ảnh trong pipeline thì hai giới hạn này tự đi theo.

Thấu kính phóng to dưới con trỏ **nhạt dần khi zoom vào** — khi một bức ảnh đã
chiếm một phần ba màn hình thì phóng thêm chỉ là nhiễu. Đó cũng chính là thứ cho
phép trần zoom được đặt cao đúng bằng mức bản 2400px cho phép.

**Bố cục chòm sao** (`src/lib/constellation.js`): ảnh được gieo trên một xoắn ốc
góc vàng (đặc ở giữa, thưa dần ra ngoài, không thẳng hàng), gieo *chật hơn* mức
chứa được, rồi chạy vòng lặp đẩy các khung ra cho hết chồng lấn. Kết quả là một
cụm đặc tự nhiên, không cột không hàng, và mỗi ảnh giữ đúng tỉ lệ gốc — không
cắt vuông, không cắt tròn.

## Studio — app quản trị

Một app macOS thật: có cửa sổ riêng, icon riêng trong Dock, mở bằng cách bấm đúp.

**Dựng app** (chỉ cần làm một lần, hoặc khi sửa code Studio):

```bash
export PATH="$HOME/.local/node/bin:$PATH" && cd ~/Desktop/maison-le-paria && npm run app
```

Xong sẽ có **`Maison Le Paria Studio.app`** ngay trong thư mục dự án — kéo vào
`Applications` là nó nằm trong Launchpad như mọi app khác.

App tự khởi động server quản trị khi mở và **tự tắt server khi bạn thoát**, nên không bao
giờ có tiến trình bỏ quên chạy nền.

Không dùng Electron: app là một tệp Swift biên dịch bằng chính Xcode có sẵn trên máy, nặng
**240 KB** thay vì 250 MB. Việc chọn tệp và kéo thả ảnh do macOS lo — đó là phần một trang
web không làm tốt được.

Nếu muốn chạy trong trình duyệt thay vì app:

```bash
npm run studio   # http://localhost:5199
```

Cả hai chạy cùng một giao diện. App chỉ chạy trên máy bạn, không bao giờ nằm trong site
đã xuất bản.

Nó làm được:

| | |
|---|---|
| **Bộ ảnh mới** | Tạo một bộ; app tự tạo thư mục tương ứng trong `ảnh web` |
| **Kéo thả ảnh** | Kéo thẳng từ Finder vào cửa sổ app; ảnh được chép rồi dựng luôn các bản cho web |
| **Bỏ ảnh** | Ảnh được chuyển sang thư mục `.đã bỏ` bên trong bộ — **không xoá hẳn** |
| **Sửa tên, mô tả, năm, địa điểm** | Ghi vào `content/sets.json` |
| **Nhạc nền** | Thêm, thay, gỡ nhạc; chỉnh âm lượng; nghe thử ngay trong app |
| **Tên miền** | Ghi `public/CNAME` cho GitHub Pages |
| **Triển khai** | Dựng ảnh → build → commit → push. GitHub tự xuất bản phần còn lại |

Cửa sổ nhật ký hiện trực tiếp từng dòng đang chạy, kể cả khi lỗi — không có bước nào
diễn ra sau lưng bạn.

### Một bộ ảnh = một thư mục

Mỗi thư mục con trong `~/Desktop/ảnh web` là một bộ. **Thư mục con bên trong bộ bị bỏ
qua** — thư mục ảnh của thợ ảnh luôn có những thư mục phụ (bản xuất cho Facebook, ảnh
cắt, file raw), và hút hết chúng vào là triển lãm đầy những thứ không định trưng bày.

App phân biệt rõ hai chuyện: *tệp mới chưa xử lý* (chấm vàng — cần bấm Cập nhật) và *tệp
đã xem xét rồi loại vì trùng ảnh khác* (chỉ ghi chú, không phải việc cần làm).

### Tổng quan và Thư viện dùng chung một kho

Không có thao tác riêng cho từng trang. Thêm ảnh vào một bộ là ảnh xuất hiện ở **cả hai**:
Tổng quan trải toàn bộ ảnh trên một mặt phẳng, Thư viện xếp cũng ảnh đó theo bộ.

## Đổi ảnh bằng tay (không cần app)

Vẫn làm được như cũ: sửa thư mục trong `~/Desktop/ảnh web` rồi chạy

```bash
export PATH="$HOME/.local/node/bin:$PATH" && cd ~/Desktop/maison-le-paria && npm run images
```

Pipeline tự phát hiện thư mục con, lọc ảnh trùng bằng perceptual hash, xoay theo EXIF, và
xuất `tile` 1000px / `wide` 1600px / `full` 2400px kèm ảnh nền tạm 40px.

Đặt tên hiển thị cho bộ mới trong `content/sets.json` — khoá là tên thư mục đã bỏ dấu
("FN Buổi 1" → `fn-buoi-1`). Chưa đặt thì bộ đó vẫn hiện, chỉ là lấy luôn tên thư mục.

## Đưa lên GitHub lần đầu

1. Tạo một kho **rỗng** trên GitHub (đừng thêm README).
2. Trong Studio, bấm **Triển khai** → app sẽ hỏi địa chỉ kho, dán vào.
3. Lần push đầu có thể cần bạn đăng nhập GitHub. Nếu cửa sổ nhật ký báo lỗi xác thực,
   mở Terminal chạy `git push` một lần trong thư mục dự án và làm theo hướng dẫn — macOS
   sẽ nhớ cho những lần sau.
4. Trên GitHub: **Settings → Pages → Source: GitHub Actions**.

Từ đó về sau, mỗi lần bấm **Triển khai** là site tự cập nhật sau khoảng một phút.

### Tên miền

1. Trong Studio bấm **Tên miền**, nhập tên miền của bạn.
2. Ở nhà cung cấp tên miền, trỏ DNS về GitHub Pages:
   - tên miền gốc (`tenban.com`): bốn bản ghi `A` → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - tên miền con (`www.tenban.com`): một bản ghi `CNAME` → `<tài-khoản>.github.io`
3. Trên GitHub: **Settings → Pages → Custom domain**, nhập tên miền, bật **Enforce HTTPS**.

Workflow tự biết: có `public/CNAME` thì đường dẫn gốc là `/`, chưa có thì là
`/<tên-repo>/`. Nó cũng tạo `404.html` để tải lại trang `/thu-vien` không bị lỗi.

### Ảnh gốc không nằm trong repo

Chỉ các bản đã dựng cho web (`public/images`, ~29 MB) được đẩy lên GitHub. Ảnh gốc ở lại
`~/Desktop/ảnh web` trên máy bạn. Nghĩa là: **giữ thư mục đó cẩn thận và có bản sao lưu**
— nó là bản gốc duy nhất.

## Âm thanh

Hai lớp, cùng bật/tắt bằng một nút. Cấu hình trong **`content/sound.json`**.

| Lớp | Nguồn | Chỉnh ở đâu |
|---|---|---|
| **Tiếng phòng** | Tổng hợp trong trình duyệt — nhiễu nâu qua bộ lọc, một "hơi thở" 40 giây. Không tệp nào phải tải. | `ambience` trong sound.json |
| **Nhạc nền** | Tệp của bạn | App Studio → mục **Âm thanh**, hoặc `npm run music <đường-dẫn>` |

### Thêm hoặc đổi nhạc nền

**Cách dễ nhất: mở app Studio → mục "Âm thanh"** → bấm *Chọn tệp nhạc*, hoặc kéo thẳng tệp
từ Finder vào cửa sổ. Nghe thử ngay tại chỗ, chỉnh âm lượng, rồi bấm *Triển khai* — giống
hệt quy trình với ảnh.

Hoặc bằng dòng lệnh:

```bash
export PATH="$HOME/.local/node/bin:$PATH" && cd ~/Desktop/maison-le-paria
npm run music ~/Music/ban-nhac.wav    # thêm hoặc thay nhạc
npm run music --off                   # gỡ nhạc, quay về chỉ có tiếng phòng
```

Nhận wav, mp3, m4a, aiff, flac — tự chuyển thành AAC gọn nhẹ. Nhạc lặp vô hạn và vào dần
trong 6 giây. Âm lượng mặc định `0.32`: nhạc nền cho một trang ảnh nên nằm dưới ngưỡng chú
ý, để ảnh vẫn là nhân vật chính.

Nếu giấy phép của bản nhạc yêu cầu ghi nguồn, điền vào ô **Ghi nguồn nhạc** trong app
(`music.credit`).

### Vì sao nhạc không tự bật ngay khi trang mở

**Không trình duyệt nào cho phép.** Chrome và Safari đều chặn mọi âm thanh cho tới khi
người xem chạm vào trang — và chặn đúng: một website có thể tự phát tiếng khi mở là một
website sẽ tự phát tiếng khi mở.

Nên nhạc bật ở **cử chỉ đầu tiên** — bấm màn hình mở đầu, kéo mặt phẳng ảnh, mở một bức
ảnh. Thực tế là một hai giây sau khi vào. Màn hình mở đầu có dòng "BẤM ĐỂ VÀO · CÓ ÂM
THANH" để ai muốn nghe ngay thì biết chỗ bấm.

Một lưu ý đã kiểm chứng: **phím Escape không được tính là cử chỉ hợp lệ**, nên code chỉ
"dùng hết" lần thử khi âm thanh thật sự chạy — bấm Escape rồi click vẫn bật được.

Lựa chọn bật/tắt được nhớ trong `localStorage`.

## Chuyển trang

Mọi lần chuyển tab đều đi qua một màn chờ mang tên nhà (`lib/transition.js`):

1. màn đóng lại **tức thì** (chậm hơn là thấy trang cũ đang bị thay dở),
2. trang đổi phía sau màn,
3. màn chờ thêm một nhịp **và** chờ một khung hình đã vẽ thật sự rồi mới mở ra.

Không phải trang trí: Thư viện chứa 47 ảnh cỡ lớn, Tổng quan chứa cả một mặt phẳng ảnh —
cắt thẳng sang là rơi vào một trang mới vẽ được một nửa. Có một chốt an toàn 3 giây: một
tấm màn không chịu mở còn tệ hơn không có màn nào.

## Thư viện

Trang `/thu-vien` là nơi để *ngắm* ảnh, khác với vũ trụ là nơi để *tìm* ảnh.

Mỗi ảnh hiện nguyên khung, không cắt xén, và lớn hết mức khung hình cho phép:

- **Ảnh ngang** rộng đúng bằng chiều rộng trang.
- **Ảnh dọc** cao đúng 90% chiều cao màn hình.

Một quy tắc chung không phục vụ được cả hai — nếu giới hạn theo chiều cao thì ảnh ngang
bị co lại, nếu giới hạn theo chiều rộng thì ảnh dọc cao quá màn hình. Nên mỗi ảnh được
gắn `data-orient` theo tỉ lệ của chính nó (ngưỡng 1.15) và nhận đúng quy tắc của mình.

Ảnh dùng `srcset` 1600px/2400px với `sizes` khớp bố cục, nên điện thoại không phải tải
bản 2400px còn màn hình lớn không phải kéo giãn bản nhỏ.

**Không có hiệu ứng mờ dần ở trang này** — một bức ảnh mất một giây để hiện ra là một
bức ảnh chưa xem được. Ảnh nền tạm 40px giữ chỗ, ảnh thật phủ lên khi vẽ xong.

## Chuyển ảnh lên cloud (R2 / Supabase / Cloudinary / CMS)

Toàn bộ ranh giới nằm trong `src/lib/media.js`. Upload thư mục `public/images` lên
storage rồi đặt biến môi trường:

```bash
# .env
VITE_MEDIA_BASE=https://media.maisonleparia.com
```

Nếu dùng dịch vụ có resize on-the-fly (Cloudinary, imgix), sửa `mediaUrlAt()` để
chèn tham số width. Không component nào phải đổi.

---

## Nội dung cần bạn cập nhật

- `src/data/site.js` → **email, Instagram, Facebook, số điện thoại** hiện đang là chỗ trống
  (`xin.chao@maisonleparia.com`, `+84 000 000 000`).
- `src/data/projects.js` → tên project, năm, địa điểm, mô tả. Bốn tiêu đề hiện tại
  (TỊNH / HỒI / MẶT NƯỚC / CỬA) là đề xuất, đổi thoải mái.

---

## Về bộ ảnh đang dùng

Nguồn: `~/Desktop/ảnh web`

| Thư mục | Tên trên web | Số ảnh |
|---|---|---|
| `JPEG` | HỒI — Áo dài / Yên Tử / Kiến trúc cổ | 24 |
| `FN` | TỊNH — Áo dài / Sen / Ánh sáng trong nhà | 14 |
| `FN Buổi 1` | MẶT NƯỚC — Thử nghiệm / Phản chiếu | 9 |

Tổng 47 ảnh (đã tự loại 3 ảnh trùng). Ba bộ được **trộn xen kẽ** trên mặt phẳng chứ
không xếp thành ba cụm rời — để vũ trụ đọc như một khối tác phẩm, không phải ba thư mục
đặt cạnh nhau.

## Hiệu năng

| | |
|---|---|
| JS | ~72 kb gzip, một bundle, không WebGL |
| CSS | ~5 kb gzip |
| Ảnh nền tạm | 40px nhúng thẳng vào JS (~25 kb gzip cho cả 47 ảnh) — mặt phẳng hiện ra ngay |
| `tile` | 1000px WebP, ~160 kb/ảnh — chỉ tải ảnh sắp vào màn hình |
| `full` | 2400px WebP, ~1 mb/ảnh — chỉ tải khi bấm mở |

14 ảnh gần tâm cụm được tải ngay với `fetchpriority="high"`; phần còn lại chờ
IntersectionObserver. Ảnh ngoài màn hình được đặt `visibility: hidden` nên trình duyệt
không phải vẽ chúng.

Vòng lặp animation ghi thẳng `transform` vào DOM cho 47 ô mỗi frame, không qua React và
không tạo layout reflow. Ai bật "giảm chuyển động" trong hệ điều hành sẽ không thấy hạt
bụi và tiêu đề mở đầu.

## Ghi chú kỹ thuật

- **Vì sao bỏ three.js.** Bản đầu vẽ ảnh bằng texture WebGL 640px: GPU lọc mipmap cộng
  shader grain là nguyên nhân ảnh nhòe. `<img>` thật cho ảnh đúng từng pixel, và bundle
  giảm từ ~320 kb xuống ~72 kb gzip. Bản 3D cũ vẫn nằm trong `attic/`.
- **Không dùng `backdrop-filter`.** Một lớp blur toàn màn hình tốn cả frame GPU trên máy
  yếu, và làm mờ một rừng ảnh phía sau một tấm ảnh thì chẳng thêm được gì.
- **Kéo và bấm không giẫm chân nhau.** Mặt phẳng cố tình không gọi `setPointerCapture`
  (nó sẽ cướp mất sự kiện click của ảnh), và một thao tác kéo quá 2px sẽ không mở ảnh.
- **Viewer** dùng lại chính ảnh `tile` đang có trong cache làm lớp đệm, nên chuyển ảnh
  không có khoảng đen và không có giai đoạn nhòe.
- **Âm thanh** tổng hợp bằng WebAudio (nhiễu nâu qua lowpass + LFO 40 giây), không có
  file audio nào phải tải. Không bao giờ tự phát.
- Trong dev, không expose gì ra `window`; bản production sạch.
# maisonleparia
