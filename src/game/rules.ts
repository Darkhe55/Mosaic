/**
 * 扫雷 —— 规则传播
 */

import { neighbors } from './types.ts'

export type SetCallback = (index: number, value: number, rule: string) => void

/** mines 就地修改：-1 未知 / 0 安全 / 1 雷 */
export function propagate(
  mines: number[],
  clues: ArrayLike<number>,
  w: number,
  h: number,
  onSet?: SetCallback,
): boolean {
  const size = w * h
  let changed = true
  const set = (i: number, value: number, rule: string): boolean => {
    if (mines[i] === value) return true
    if (mines[i] !== -1) return false
    mines[i] = value
    onSet?.(i, value, rule)
    changed = true
    return true
  }

  while (changed) {
    changed = false

    // 数字格自身不能是雷
    for (let i = 0; i < size; i++) {
      if ((clues[i] ?? -1) < 0) continue
      if (mines[i] === 1) return false
      if (mines[i] === -1 && !set(i, 0, '数字格不能是雷')) return false
    }

    for (let i = 0; i < size; i++) {
      const clue = clues[i] ?? -1
      if (clue < 0) continue
      const near = neighbors(i, w, h)
      let knownMines = 0
      let unknown: number[] = []
      for (const n of near) {
        const v = mines[n]!
        if (v === 1) knownMines++
        else if (v === -1) unknown.push(n)
      }
      const need = clue - knownMines
      if (need < 0 || need > unknown.length) return false
      if (need === 0) {
        for (const n of unknown) if (!set(n, 0, '数字周围雷数已满足')) return false
      } else if (need === unknown.length) {
        for (const n of unknown) if (!set(n, 1, '数字周围剩余格全是雷')) return false
      }
    }
  }
  return true
}

export interface MinesweeperCheck {
  ok: boolean
  badCells: number[]
  issues: Array<{ cell: number; expected: number; actual: number }>
}

export function checkSolution(
  mines: ArrayLike<number>,
  clues: ArrayLike<number>,
  w: number,
  h: number,
): MinesweeperCheck {
  const bad = new Set<number>()
  const issues: Array<{ cell: number; expected: number; actual: number }> = []
  for (let i = 0; i < w * h; i++) {
    const clue = clues[i] ?? -1
    if (clue < 0) continue
    if (mines[i] === 1) {
      bad.add(i)
      continue
    }
    let count = 0
    for (const n of neighbors(i, w, h)) if (mines[n] === 1) count++
    if (count !== clue) {
      issues.push({ cell: i, expected: clue, actual: count })
      bad.add(i)
    }
  }
  return { ok: issues.length === 0, badCells: Array.from(bad), issues }
}
