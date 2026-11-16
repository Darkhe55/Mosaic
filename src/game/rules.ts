/**
 * 扫雷 —— 规则传播
 *
 * 规则变体：
 *   strict   —— 数字格本身不能涂黑（旧题默认，数字最大 8）；
 *   standard —— 数字格自身也可以是黑格（标准 Mosaic，数字最大 9）。
 * 两种变体的计数范围都是「以数字格为中心的 3×3（含自身）」。
 */

import { neighbors, type RuleVariant } from './types.ts'

export type SetCallback = (index: number, value: number, rule: string) => void

/** mines 就地修改：-1 未知 / 0 白格 / 1 黑格 */
export function propagate(
  mines: number[],
  clues: ArrayLike<number>,
  w: number,
  h: number,
  onSet?: SetCallback,
  mode: RuleVariant = 'strict',
): boolean {
  const size = w * h
  const strict = mode !== 'standard'
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

    // 严格版：数字格自身不能是黑格（标准版允许，故跳过）
    if (strict) {
      for (let i = 0; i < size; i++) {
        if ((clues[i] ?? -1) < 0) continue
        if (mines[i] === 1) return false
        if (mines[i] === -1 && !set(i, 0, '数字格不能是黑格')) return false
      }
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
        for (const n of unknown) if (!set(n, 0, '数字周围黑格数已满足')) return false
      } else if (need === unknown.length) {
        for (const n of unknown) if (!set(n, 1, '数字周围剩余格全是黑格')) return false
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
  mode: RuleVariant = 'strict',
): MinesweeperCheck {
  const strict = mode !== 'standard'
  const bad = new Set<number>()
  const issues: Array<{ cell: number; expected: number; actual: number }> = []
  for (let i = 0; i < w * h; i++) {
    const clue = clues[i] ?? -1
    if (clue < 0) continue
    // 严格版：数字格不能是黑格；标准版：允许，并计入 3×3（neighbors 含自身）
    if (strict && mines[i] === 1) {
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
