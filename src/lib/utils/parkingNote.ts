// 주차 안내 메모(parking_note)는 사장님이 자유 입력한 텍스트라
// "무료주차 : 30분 ~ 1~3만원 : 1시간 ~ 3~5만원 : 2시간" 처럼
// 여러 줄 정보가 한 줄로 뭉쳐 들어오는 경우가 많다.
// 이를 보기 좋은 행 목록으로 쪼갠다.

export interface ParkingRow {
  /** "1~3만원" 처럼 조건/구간 (콜론 앞). 콜론이 없으면 null */
  label: string | null
  /** "1시간" 처럼 값 (콜론 뒤). 콜론이 없으면 줄 전체 */
  value: string
}

export function parseParkingRows(note: string): ParkingRow[] {
  return note
    .replace(/：/g, ':') // 전각 콜론 → 반각
    // 줄바꿈, 또는 공백으로 둘러싸인 하이픈/물결표/슬래시/막대(- ~ ～ 〜 / |),
    // 또는 가운뎃점·세미콜론·모점(· ; ； 、) 기준으로 행을 나눈다.
    // 물결표는 ASCII(~)뿐 아니라 전각(～)·물결대시(〜)도 포함.
    // "1~3만원"·"1-3만원" 처럼 공백 없이 붙은 기호는 나뉘지 않는다.
    .split(/\r?\n|\s+[-~～〜/|]\s+|\s*[·;；、]\s*/)
    .map(s => s.replace(/^\s*[-•*]\s*/, '').trim()) // 앞머리 불릿 제거
    .filter(Boolean)
    .map(row => {
      const ci = row.indexOf(':')
      if (ci < 0) return { label: null, value: row }
      return { label: row.slice(0, ci).trim(), value: row.slice(ci + 1).trim() }
    })
}
