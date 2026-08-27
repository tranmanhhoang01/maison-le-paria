# Bàn giao — Maison Le Paria

Tài liệu cho người (hoặc trợ lý) tiếp nhận dự án. Đọc hết file này là đủ hiểu
toàn bộ cơ chế mà không cần đọc lại lịch sử hội thoại.

---

## 1. Dự án là gì

Website portfolio cho một xưởng ảnh Việt Nam. Nội dung **tiếng Việt**. Ba trang:

| Trang | Đường dẫn | Vai trò |
|---|---|---|
| **Tổng quan** | `/` | Bầu trời đêm; mỗi bộ ảnh là một thiên hà xoắn. Rê chuột vào thiên hà → ảnh tuôn ra khỏi lõi |
| **Thư viện** | `/thu-vien` | Ảnh lớn, không cắt xén, xếp theo bộ. Nơi để *ngắm* |
| Giới thiệu / Liên hệ | `/gioi-thieu`, `/lien-he` | Chữ |

Bấm ảnh bất kỳ → viewer toàn màn hình (phím ←/→/Esc).

**Đang chạy thật:** https://tranmanhhoang01.github.io/maison-le-paria/

---

## 2. Ràng buộc của máy này — đọc trước khi chạy lệnh

**Máy không có Node/npm/Homebrew hệ thống.** Node 22 nằm ở `~/.local/node`.
Mọi lệnh phải mở đầu bằng:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

Có sẵn: Xcode + `swiftc`, `sips`, `afconvert`, `say`, `git`.

---

## 3. Lệnh

```bash
npm run dev      # máy chủ phát triển, cổng 5173
npm run build    # → dist/
npm run images   # dựng lại ảnh từ ~/Desktop/ảnh web
npm run studio   # app quản trị trong trình duyệt, cổng 5199
npm run app      # biên dịch app macOS "Maison Le Paria Studio.app"
npm run music    # thêm/đổi/gỡ nhạc nền
```

---

## 4. Luồng dữ liệu — điều quan trọng nhất

```
~/Desktop/ảnh web/           ← ẢNH GỐC, KHÔNG nằm trong git
  JPEG/      → bộ "jpeg"        (mỗi thư mục con = một bộ)
  FN/        → bộ "fn"
  FN Buổi 1/ → bộ "fn-buoi-1"
        │
        │  npm run images  (scripts/import-images.mjs, dùng sharp)
        ↓
public/images/<bộ>/<bộ>-NN-{tile,wide,full}.webp     ← nằm trong git
src/data/generated/images.json                       ← nằm trong git
        │
        │  src/data/projects.js  ghép với content/sets.json
        ↓
sets[] và photos[] mà toàn bộ giao diện dùng
```

**Quy tắc bất di bất dịch:**

- Một bộ = **đúng một thư mục**, thư mục con bên trong **bị bỏ qua có chủ đích**
  (thư mục ảnh của thợ ảnh luôn có `bg fb`, `Raw`, `C1`… không định trưng bày).
- Pipeline lọc ảnh trùng bằng **perceptual hash** (aHash 8×8, Hamming ≤ 6).
  Bản export và bản edit của cùng một khung khác dung lượng nhưng giống hình.
- Ba kích thước: `tile` 1000px (vũ trụ), `wide` 1600px (thư viện), `full` 2400px
  (viewer + zoom sâu). Kèm ảnh nền tạm 40px nhúng base64 thẳng vào manifest.
- Manifest ghi cả `rgb` (màu chủ đạo, dùng để tô màu thiên hà) và `skipped`
  (danh sách ảnh bị loại vì trùng, để Studio phân biệt "chưa xử lý" với "đã loại").

---

## 5. Bản đồ mã nguồn

```
src/
  App.jsx                    điều phối: route → trang, mở âm thanh ở cử chỉ đầu
  main.jsx                   điểm vào + nạp CSS
  data/
    projects.js              ghép manifest + content/sets.json → sets[], photos[]
    site.js                  TOÀN BỘ chữ của website (liên hệ, giới thiệu, menu)
    generated/images.json    do pipeline sinh, KHÔNG sửa tay
  lib/
    constellation.js         vị trí thiên hà (x,y,z + độ nghiêng) và vòng bay của ảnh
    cosmos.js                vẽ sprite: chấm sáng, thiên hà xoắn, trường sao
    cosmosScene.js           scene canvas: nền, tinh vân, sao, thiên hà + phối cảnh
    media.js                 RANH GIỚI DUY NHẤT tới nơi chứa ảnh (đổi sang R2/CDN ở đây)
    router.js                router ~50 dòng, có xử lý đường dẫn gốc
    transition.js            màn chờ khi chuyển trang
    math.js                  clamp, damp, lerp, mulberry32 (random có hạt giống)
  store/experience.js        state rời rạc (viewer, focusPhoto, sound, curtain)
  hooks/useImageReady.js     bắt ảnh đã nằm sẵn trong cache
  components/
    universe/                Universe (vòng lặp), Photo, FocusLabel
    chrome/                  Nav, Intro, Curtain, Dust, SoundToggle
    screens/                 About, Contact, Library
    viewer/Viewer.jsx        ảnh toàn màn hình
  audio/sound.js             tiếng phòng tổng hợp + nhạc nền
  styles/                    tokens → base → chrome → universe → screens → viewer

content/                     DỮ LIỆU NGƯỜI DÙNG (Studio ghi vào đây)
  sets.json                  tên/mô tả/thứ tự các bộ
  sound.json                 âm lượng, đường dẫn nhạc
scripts/                     import-images.mjs, add-music.mjs, fetch-fonts.mjs, sources.json
studio/                      server.mjs + app.html (app quản trị)
  mac/                       Studio.swift + build.mjs (vỏ app macOS)
attic/                       BẢN 3D CŨ bằng three.js — không nằm trong build, đừng xoá
```

---

## 6. Cơ chế Tổng quan (phần phức tạp nhất)

Một `<canvas>` vẽ bầu trời + **DOM `<img>` thật** cho ảnh. Lý do tách đôi: ảnh
phải sắc nét từng pixel, còn vài nghìn ngôi sao thì không thể là phần tử DOM.

**Một vòng `requestAnimationFrame` duy nhất** trong `Universe.jsx` làm tất cả:
cập nhật pan/zoom → vẽ canvas → tính thiên hà nào đang được trỏ vào → ghi
`transform`/`opacity` thẳng vào từng thẻ ảnh. **React chỉ render một lần rồi
đứng ngoài** — đó là lý do 41 ảnh + 1600 sao chạy mượt.

- **Phối cảnh:** mọi vật có `z`. `persp(z) = FOCAL / (FOCAL + z)`, `FOCAL = 7`.
  Vật xa vẽ nhỏ hơn và trôi ít hơn khi kéo → chiều sâu.
- **Thiên hà nghiêng:** `translate → rotate(roll) → scale(1, cos(tilt)) → rotate(spin·t)`.
  Mỗi thiên hà có `tilt` 24–72° ngẫu nhiên-có-hạt-giống.
- **Màu thiên hà** lấy từ màu chủ đạo của chính bộ ảnh; nếu hai bộ trùng sắc thì
  tự tách hue ra.
- **Ảnh tuôn ra:** mỗi ảnh có `delay` riêng trải trên 0→0.78 nên chúng bật ra
  *lần lượt*. Vị trí đích đã được **relax cho không chồng nhau** (kiểm chứng: 0 cặp).
  Mỗi thiên hà chỉ bung 8 ảnh (6 trên điện thoại) — nhiều hơn thì hoặc chồng nhau
  hoặc văng khỏi màn hình. Toàn bộ kho nằm ở Thư viện.
- **Ống kính trôi theo** thiên hà đang mở (0.82 quãng đường, có damping), và
  focus **dính** khi đã mở để camera không kéo thiên hà ra khỏi con trỏ gây nhấp nháy.
- **Cuộn chuột = zoom**, không phải cuộn trang. Kéo để di chuyển. Chụm 2 ngón trên
  điện thoại. Phím `+` `-` `0`, mũi tên.

---

## 7. Studio — app quản trị

`npm run app` biên dịch **`Maison Le Paria Studio.app`** (Swift + WKWebView, 260KB,
không dùng Electron). App tự khởi động `studio/server.mjs` khi mở và tắt khi thoát.

Làm được: tạo bộ ảnh mới, kéo thả ảnh từ Finder, bỏ ảnh (chuyển vào `.đã bỏ`,
**không xoá hẳn**), sửa tên/mô tả, thêm/gỡ nhạc nền, đặt tên miền, và **Triển khai**
(dựng ảnh → build → commit → push).

App tìm thư mục dự án theo thứ tự: **thư mục chứa chính nó** → lựa chọn đã nhớ →
nơi biên dịch → hỏi người dùng. Nhờ vậy chép cả thư mục sang máy khác vẫn chạy.

---

## 8. Triển khai

GitHub Pages + Actions (`.github/workflows/deploy.yml`). Push lên `main` là tự build
và xuất bản. Xác thực bằng **khoá SSH** (`~/.ssh/id_ed25519`, không đặt mật khẩu).

Workflow tự đặt đường dẫn gốc: có `public/CNAME` → `/`, chưa có → `/<tên-repo>/`.
Nó cũng tạo `404.html` để tải lại `/thu-vien` không lỗi.

**Ảnh gốc không lên git.** `~/Desktop/ảnh web` là bản duy nhất — cần sao lưu.

---

## 9. Những cái bẫy đã trả giá để biết

1. **Đường dẫn gốc.** Site chạy dưới `/<tên-repo>/` trên GitHub Pages. Mọi đường dẫn
   tuyệt đối phải bám `import.meta.env.BASE_URL`. Đã dính hai lần: `media.js` viết cứng
   `/images` (ảnh 404 hết, trang chỉ hiện ảnh nền tạm → trông như "ảnh chất lượng kém"),
   và `router.js` đọc `location.pathname` thô (bấm menu là nhảy ra ngoài site).
   **Kiểm tra bằng `vite preview --base /<tên-repo>/`, đừng chỉ test ở `npm run dev`.**

2. **`onLoad` không chạy với ảnh đã nằm trong cache.** Ảnh bị giữ ở opacity 0 vĩnh viễn.
   Dùng `hooks/useImageReady.js` (kiểm tra `img.complete` trong ref callback).

3. **`content/*.json` là dữ liệu người dùng**, không phải cấu hình của lập trình viên.
   Sửa từng khoá, **đừng ghi đè cả file** — sẽ xoá mất lựa chọn họ đặt qua Studio.

4. **Biên dịch Swift:** bắt buộc `-target arm64-apple-macos13.0`. Không có nó, swiftc
   build cho macOS 28 trong khi máy chạy 27 → app không mở được, lỗi `-10825`.

5. **Không dùng `backdrop-filter` toàn màn hình** — đã gỡ vì tốn cả frame GPU.

6. **Không dùng ảnh sprite hình vuông cho tinh vân** — dù fade mép thế nào cũng lộ góc.
   Vẽ thẳng bằng `createRadialGradient` mỗi khung hình.

7. **Trình duyệt chặn âm thanh trước cử chỉ đầu tiên.** Không có cách vòng. Âm thanh bật
   ở click/tap đầu tiên. **Phím Escape KHÔNG được tính là cử chỉ hợp lệ** — code chỉ
   "dùng hết" lần thử khi `AudioContext.state === 'running'`.

8. **Môi trường preview của trợ lý chỉ chạy `requestAnimationFrame` nhấp nháy.** Mọi
   hiệu ứng dựa trên thời gian trông như bị hỏng. **Đừng đi sửa lỗi không tồn tại** —
   xác minh bằng số liệu (đọc DOM, tính toán trong Node) hoặc tạm ép trạng thái cuối
   trong code rồi chụp một ảnh, sau đó gỡ sạch móc kiểm tra.

---

## 10. Trạng thái hiện tại

**Đã xong và chạy thật:** Thư viện, viewer, Giới thiệu, Liên hệ, Studio, triển khai
GitHub Pages, âm thanh (tiếng phòng + nhạc nền), màn chờ chuyển trang.

**Đang làm dở — 4 tệp chưa commit:** phần Tổng quan kiểu vũ trụ.
`Universe.jsx`, `constellation.js`, `cosmos.js`, `cosmosScene.js`.

Đã kiểm chứng: bầu trời có màu, thiên hà nghiêng đúng (72°/57°/25°), tinh vân hết
mép vuông, ảnh **0 cặp chồng nhau**, ảnh bung ra đúng vị trí (chụp được khi ép
trạng thái).

**Chưa kiểm chứng bằng mắt:** chuyển động tuôn ra theo thời gian thật, và **ống kính
trôi theo thiên hà vừa thêm vào chưa chạy thử lần nào** — đây là chỗ dễ có lỗi
nhấp nháy (camera kéo thiên hà ra khỏi con trỏ → đóng → camera quay lại → lặp).
Cần mở `npm run dev` và rê chuột vào từng thiên hà để xác nhận.

**Việc còn lại người dùng phải tự làm:** điền email/điện thoại/Instagram thật vào
`src/data/site.js` (hiện là chỗ trống), và gán tên miền.
