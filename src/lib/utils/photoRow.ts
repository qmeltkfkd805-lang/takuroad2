/* 사진 나란히 놓기(콜라주) — 커뮤니티 글쓰기 (2026-10-15)
   사진을 끌어 다른 사진 왼쪽·오른쪽에 놓으면 한 줄(<div data-photo-row>)에 나란히 놓인다(한 줄 최대 3장).
   한 줄 안의 사진은 원래 비율을 flex-grow 로 줘서 높이가 저절로 같아진다(가로 폭은 비율대로 나눠 가짐).
   줄 밖(글 줄 사이)으로 끌어 놓으면 다시 한 장짜리 사진이 된다.
   전부 인라인 스타일로 저장 → 글 화면·모바일에서도 같은 모양. */

export const PHOTO_ROW_MAX = 3
const ROW_STYLE = 'display:flex;gap:6px;align-items:flex-start;margin:8px 0;'
const SINGLE_IMG_STYLE = 'max-width:100%;border-radius:10px;'

const ratioOf = (img: HTMLImageElement) => (img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1)

function styleRowImg(img: HTMLImageElement) {
  img.setAttribute('style', `flex:${ratioOf(img).toFixed(4)} 1 0;width:0;min-width:0;height:auto;max-width:none;border-radius:8px;margin:0;display:block;`)
  img.removeAttribute('width'); img.removeAttribute('height')
}

/** 한 장짜리 사진 줄로 감싸기 */
function singleLine(img: HTMLImageElement): HTMLElement {
  img.setAttribute('style', SINGLE_IMG_STYLE)
  const p = document.createElement('p')
  p.appendChild(img)
  return p
}

/** 줄에 사진이 0·1장 남으면 정리 */
export function normalizeRow(row: HTMLElement) {
  const imgs = Array.from(row.querySelectorAll('img'))
  if (imgs.length === 0) { row.remove(); return }
  if (imgs.length === 1) { row.replaceWith(singleLine(imgs[0])); return }
  row.setAttribute('style', ROW_STYLE)
  imgs.forEach(styleRowImg)
}

/** 사진을 지금 자리에서 빼낸다(빈 줄이 남으면 그 줄도 지움) */
export function detachImg(img: HTMLImageElement, root: HTMLElement) {
  const row = img.closest<HTMLElement>('[data-photo-row]')
  const parent = img.parentElement
  img.remove()
  if (row) { normalizeRow(row); return }
  if (parent && parent !== root && !parent.textContent?.trim() && !parent.querySelector('img,video,iframe')) parent.remove()
}

export function rowOf(img: HTMLElement): HTMLElement | null { return img.closest<HTMLElement>('[data-photo-row]') }

/** target 사진의 왼쪽/오른쪽에 img 를 붙인다. 성공하면 true */
export function dropBeside(img: HTMLImageElement, target: HTMLImageElement, side: 'left' | 'right', root: HTMLElement): boolean {
  if (img === target) return false
  const targetRow = rowOf(target)
  const sameRow = targetRow && targetRow === rowOf(img)
  if (targetRow && !sameRow && targetRow.querySelectorAll('img').length >= PHOTO_ROW_MAX) return false
  detachImg(img, root)
  let row = rowOf(target)
  if (!row) {
    row = document.createElement('div')
    row.setAttribute('data-photo-row', '1')
    // target 이 혼자 든 줄이면 그 줄을 통째로 사진 줄로 바꾸고, 글과 같이 있으면 그 줄 바로 아래에 새 줄
    const holder = target.parentElement
    const alone = holder && holder !== root && holder.querySelectorAll('img').length === 1 && !holder.textContent?.trim()
    if (alone) holder!.replaceWith(row)
    else (target.closest('p,div,li') ?? target).insertAdjacentElement('afterend', row)
    row.appendChild(target)
  }
  if (side === 'left') target.before(img); else target.after(img)
  normalizeRow(row)
  return true
}

/** 글 줄(block) 앞/뒤에 한 장짜리 사진으로 놓는다 */
export function dropAsLine(img: HTMLImageElement, block: HTMLElement | null, before: boolean, root: HTMLElement) {
  if (block && (block === img || block.contains(img)) && !rowOf(img)) return   // 제자리
  detachImg(img, root)
  const line = singleLine(img)
  if (!block || !block.isConnected) root.appendChild(line)
  else block.insertAdjacentElement(before ? 'beforebegin' : 'afterend', line)
}
