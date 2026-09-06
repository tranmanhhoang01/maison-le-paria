import { useEffect, useMemo, useRef, useState } from 'react'
import { Plate } from './Plate.jsx'
import { OrnFrame } from '../chrome/Ornament.jsx'
import { sourceFor } from '../../lib/media.js'

/**
 * The three frames of a chapter, and the frame drawn around them.
 *
 * This is the one place in the site that measures anything.
 *
 * It was built in CSS first: a flex row wrapping into columns, each frame
 * taking its width from its own height and aspect ratio. That is elegant and
 * it is also unreliable — the intrinsic width of a column-wrapping flex
 * container is not something engines agree on, `flex-shrink` does nothing
 * along the cross axis, and the result was a mount that fitted the
 * photographs in one browser and was smaller than them in another. A frame
 * that does not enclose its picture is worse than no frame.
 *
 * So the arrangement is worked out here, once, from the ratios and the space
 * available: every frame gets an exact pixel box, the group gets an exact
 * size, and the mount around it can only be right. It runs on layout changes
 * (a resize), never per animation frame — the overview still has no loop.
 */
const GAP = 12
const TALLEST = 780

/**
 * Where each photograph goes, given a height to work with.
 *
 * The group always comes out as an exact rectangle: the supporting frames
 * share one width and take their heights from their own ratios, so the column
 * beside the lead frame ends precisely where the lead frame ends. A block with
 * a step in it leaves a wedge of empty mount in one corner, and then the frame
 * looks like it is enclosing air rather than photographs.
 */
function arrange(ratios, H) {
  const n = ratios.length
  const [r0, r1, r2] = ratios

  if (n === 1) return { w: H * r0, items: [{ x: 0, y: 0, w: H * r0, h: H }] }

  // A lying photograph cannot lead at full height without becoming half the
  // room wide, so it leads across the top instead and the others sit beneath.
  if (r0 >= 1.05) {
    if (n === 2) {
      const W = (H - GAP) / (1 / r0 + 1 / r1)
      const heroH = W / r0
      return {
        w: W,
        items: [
          { x: 0, y: 0, w: W, h: heroH },
          { x: 0, y: heroH + GAP, w: W, h: W / r1 },
        ],
      }
    }
    const pair = r1 + r2
    const W = (H - GAP + GAP / pair) / (1 / r0 + 1 / pair)
    const heroH = W / r0
    const restH = (W - GAP) / pair
    return {
      w: W,
      items: [
        { x: 0, y: 0, w: W, h: heroH },
        { x: 0, y: heroH + GAP, w: restH * r1, h: restH },
        { x: restH * r1 + GAP, y: heroH + GAP, w: restH * r2, h: restH },
      ],
    }
  }

  const heroW = H * r0
  if (n === 2) {
    return {
      w: heroW + GAP + H * r1,
      items: [
        { x: 0, y: 0, w: heroW, h: H },
        { x: heroW + GAP, y: 0, w: H * r1, h: H },
      ],
    }
  }

  // One width for both supporting frames, heights from their own ratios —
  // and the two heights plus the gap come to exactly the lead frame's height.
  const colW = (H - GAP) / (1 / r1 + 1 / r2)
  const h1 = colW / r1
  return {
    w: heroW + GAP + colW,
    items: [
      { x: 0, y: 0, w: heroW, h: H },
      { x: heroW + GAP, y: 0, w: colW, h: h1 },
      { x: heroW + GAP, y: h1 + GAP, w: colW, h: H - h1 - GAP },
    ],
  }
}

/**
 * Trên màn hẹp thì xếp dọc, và **không cắt ảnh**.
 *
 * Bản trước ép ba ảnh vào một khối lấp kín bề ngang, cắt theo tỉ lệ ô lưới —
 * nghĩa là một tấm ảnh dọc bị xén thành ảnh ngang. Với ảnh áo dài thì đó là
 * xén mất tà áo, tức là xén mất bức ảnh. Thà ít ảnh mà nguyên vẹn.
 *
 * Ảnh lớn ăn trọn bề ngang. Hai ảnh phụ chỉ ở lại nếu còn đủ chỗ cho chúng
 * bên dưới — ảnh lớn nằm ngang thì còn, nằm dọc thì thôi, và đường "XEM CẢ
 * BỘ" ngay bên trên đã là lối vào đủ rộng cho phần còn lại.
 */
function stack(ratios, room) {
  const [r0, r1, r2] = ratios
  const W = room.w
  const heroH = W / r0

  if (ratios.length > 2) {
    const rowH = (W - GAP) / (r1 + r2)
    if (heroH + GAP + rowH <= room.h) {
      return {
        width: W,
        height: heroH + GAP + rowH,
        items: [
          { x: 0, y: 0, w: W, h: heroH },
          { x: 0, y: heroH + GAP, w: rowH * r1, h: rowH },
          { x: rowH * r1 + GAP, y: heroH + GAP, w: rowH * r2, h: rowH },
        ],
      }
    }
  }
  if (ratios.length === 2) {
    const h2 = W / r1
    if (heroH + GAP + h2 <= room.h) {
      return {
        width: W,
        height: heroH + GAP + h2,
        items: [
          { x: 0, y: 0, w: W, h: heroH },
          { x: 0, y: heroH + GAP, w: W, h: h2 },
        ],
      }
    }
  }

  // Chỉ còn ảnh lớn: rộng hết bề ngang nếu cao vừa, không thì cao hết chỗ.
  if (heroH <= room.h) return { width: W, height: heroH, items: [{ x: 0, y: 0, w: W, h: heroH }] }
  const w = room.h * r0
  return { width: w, height: room.h, items: [{ x: 0, y: 0, w, h: room.h }] }
}

/** Take the room available, give back a group that fits inside it. */
function layoutFor(plates, room, compact) {
  if (!room || room.w < 60 || room.h < 60) return null
  const ratios = plates.map((p) => p.ratio || 0.667)
  if (compact) return stack(ratios, room)
  let H = Math.min(room.h, TALLEST)
  let out = arrange(ratios, H)
  // Too wide for the room: bring the whole group down together, so every
  // photograph keeps its shape and the group keeps its composition.
  if (out.w > room.w) {
    H *= room.w / out.w
    out = arrange(ratios, H)
  }
  return { width: out.w, height: H, items: out.items }
}

export function PlateCluster({ plates, compact, onOpen }) {
  const area = useRef(null)
  const probe = useRef(null)
  const frame = useRef(null)
  const [room, setRoom] = useState(null)

  useEffect(() => {
    /**
     * Đo **cái thước**, không đo cái hộp.
     *
     * `.plate-probe` nằm tuyệt đối, trùng khít vùng trống dành cho cụm ảnh, và
     * quan trọng nhất: nó **không bị nội dung ảnh hưởng**. Bản trước đo thẳng
     * `.plate-area` — mà cụm ảnh lại nằm trong đó, nên có lúc số đo đọc được
     * chính là chiều cao do cụm ảnh vừa dựng ra (750px thay vì 448px), rồi
     * bố cục cứ giữ nguyên con số sai ấy. Đo một phần tử không chứa gì thì
     * không có vòng lặp đó.
     */
    const el = probe.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const read = () => {
      const box = el.getBoundingClientRect()
      if (box.width < 1 || box.height < 1) return
      // The mount's own margin comes out of the room the photographs get.
      const pad = frame.current ? parseFloat(getComputedStyle(frame.current).paddingLeft) || 0 : 0
      const next = { w: box.width - pad * 2, h: box.height - pad * 2 }
      setRoom((cur) =>
        cur && Math.abs(cur.w - next.w) < 1 && Math.abs(cur.h - next.h) < 1 ? cur : next)
    }

    read()
    // Lần đo đầu có thể rơi vào lúc kiểu dáng chưa áp xong — đo lại một nhịp.
    const again = setTimeout(read, 0)
    const ro = new ResizeObserver(read)
    ro.observe(el)
    window.addEventListener('resize', read)
    return () => {
      clearTimeout(again)
      ro.disconnect()
      window.removeEventListener('resize', read)
    }
  }, [compact])

  const layout = useMemo(
    () => layoutFor(plates, room, compact),
    [compact, plates, room],
  )

  const shown = layout ? layout.items.length : plates.length

  return (
    <div className="plate-area" ref={area}>
      <span className="plate-probe" ref={probe} aria-hidden="true" />
      <div
        className="plate-frame"
        ref={frame}
        data-ready={!!layout}
        style={layout ? { width: 'fit-content' } : undefined}
      >
        <OrnFrame />
        <div
          className="plate-cluster"
          data-count={shown}
          style={layout ? { width: `${layout.width}px`, height: `${layout.height}px` } : undefined}
        >
          {plates.slice(0, shown).map((image, n) => (
            <Plate
              key={image.id}
              image={image}
              slot={n}
              onOpen={() => onOpen(image)}
              eager
              src={layout ? sourceFor(image, layout.items[n].w, window.devicePixelRatio) : undefined}
              style={layout ? {
                position: 'absolute',
                left: `${layout.items[n].x}px`,
                top: `${layout.items[n].y}px`,
                width: `${layout.items[n].w}px`,
                height: `${layout.items[n].h}px`,
              } : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
