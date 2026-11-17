/**
 * 马赛克 —— 规则传播
 *
 * 只做「可证明」的局部推理，直到规则不动点；不做猜测（猜测由 solver.ts 回溯兜底）。
 *
 * 规则变体：
 *   strict   —— 数字格本身不能涂黑（旧题默认，数字最大 8）；
 *   standard —— 数字格自身也可以是黑格（标准 Mosaic，数字最大 9）。
 * 两种变体的计数范围都是「以数字格为中心的 3×3（含自身）」。
 *
 * 规则 1  strict 变体：数字格自身不能是黑格。
 * 规则 2  单窗口计数：need = clue - 窗口内已确定黑格数
 *           need === 0        → 窗口内未知格全是白格（数字已满足）
 *           need === 未知格数  → 窗口内未知格全是黑格（未知格全黑）
 *           need 越界          → 矛盾
 * 规则 3  相邻窗口重叠差分：
 *           设 A、B 为两个数字窗口各自的「未知格」集合，a、b 为它们还差的黑格数，
 *           U = A\B，V = B\A，d = a - b。因为
 *             sum(U) + sum(A∩B) = a
 *             sum(V) + sum(A∩B) = b
 *           两式相减得 sum(U) - sum(V) = d，且 0 ≤ sum(U) ≤ |U|、0 ≤ sum(V) ≤ |V|：
 *             d > |U| 或 d < -|V| → 矛盾
 *             d === |U|           → U 全是黑格、V 全是白格
 *             d === -|V|          → V 全是黑格、U 全是白格
 *           U 为空（A⊆B）或 V 为空时即「窗口包含」差分；U、V 各只有一个格子时
 *           正好是边框 / 角落窗口互推的局部定式。
 *
 * 说明：题面只给窗口数字，没有给总黑格数或行列黑格数，因此不存在可用的
 * 「全局计数上下界」；规则 3 里 d 与 |U|、|V| 的比较就是局部计数的整数上下界推理。
 */

import { neighbors, type RuleVariant } from './types.ts'

export type SetCallback = (index: number, value: number, rule: string) => void

interface WindowConstraint {
  /** 这个窗口还差的黑格数 */
  need: number
  /** 窗口内还没确定的格子 */
  cells: number[]
}

/** 扫描所有数字窗口，得到「还差几格黑 / 未知格」；发现越界立即返回 null 表示矛盾 */
function collectConstraints(
  mines: ArrayLike<number>,
  clues: ArrayLike<number>,
  w: number,
  h: number,
): WindowConstraint[] | null {
  const size = w * h
  const out: WindowConstraint[] = []
  for (let i = 0; i < size; i++) {
    const clue = clues[i] ?? -1
    if (clue < 0) continue
    const near = neighbors(i, w, h)
    let knownMines = 0
    const unknown: number[] = []
    for (const n of near) {
      const v = mines[n]!
      if (v === 1) knownMines++
      else if (v === -1) unknown.push(n)
    }
    const need = clue - knownMines
    if (need < 0 || need > unknown.length) return null
    out.push({ need, cells: unknown })
  }
  return out
}

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
  const mark = new Uint8Array(size)
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

    // 规则 1：严格版数字格自身不能是黑格
    if (strict) {
      for (let i = 0; i < size; i++) {
        if ((clues[i] ?? -1) < 0) continue
        if (mines[i] === 1) return false
        if (mines[i] === -1 && !set(i, 0, '数字格不能是黑格')) return false
      }
    }

    // 规则 2：单窗口计数
    let cons = collectConstraints(mines, clues, w, h)
    if (!cons) return false
    for (const c of cons) {
      if (c.need === 0) {
        for (const n of c.cells) if (!set(n, 0, '数字窗口黑格数已满足')) return false
      } else if (c.need === c.cells.length) {
        for (const n of c.cells) if (!set(n, 1, '数字窗口剩余格全是黑格')) return false
      }
    }

    // 规则 3：相邻窗口重叠差分
    cons = collectConstraints(mines, clues, w, h)
    if (!cons) return false
    // 只对「同一个未知格所涉及」的窗口对做差分，避免 O(窗口数²)
    const cellCons: number[][] = Array.from({ length: size }, () => [])
    for (let ci = 0; ci < cons.length; ci++) {
      for (const cell of cons[ci]!.cells) cellCons[cell]!.push(ci)
    }
    const seenPairs = new Set<number>()
    for (let cell = 0; cell < size; cell++) {
      const list = cellCons[cell]!
      if (list.length < 2) continue
      for (let p = 0; p < list.length; p++) {
        const ai = list[p]!
        for (let q = p + 1; q < list.length; q++) {
          const bi = list[q]!
          const key = ai * cons.length + bi
          if (seenPairs.has(key)) continue
          seenPairs.add(key)
          const A = cons[ai]!
          const B = cons[bi]!
          const d = A.need - B.need
          // 标记 B 的格子：2 = 属于 B；随后扫 A 时把 A 的格子改成 1
          for (const x of B.cells) mark[x] = 2
          const u: number[] = []
          for (const x of A.cells) {
            if (mark[x] !== 2) u.push(x)
            mark[x] = 1
          }
          const v: number[] = []
          for (const x of B.cells) if (mark[x] !== 1) v.push(x)
          for (const x of A.cells) mark[x] = 0
          for (const x of B.cells) mark[x] = 0

          if (d > u.length || d < -v.length) return false
          if (u.length + v.length === 0) continue
          if (d === u.length) {
            // U 全为黑格，V 全为白格
            const blackRule = v.length === 0 ? '窗口包含推理：差集格必为黑格' : '重叠窗口差分：差集格必为黑格'
            const whiteRule = u.length === 0 ? '窗口包含推理：差集格必为白格' : '重叠窗口差分：差集格必为白格'
            for (const x of u) if (!set(x, 1, blackRule)) return false
            for (const x of v) if (!set(x, 0, whiteRule)) return false
          } else if (d === -v.length) {
            // V 全为黑格，U 全为白格
            const blackRule = u.length === 0 ? '窗口包含推理：差集格必为黑格' : '重叠窗口差分：差集格必为黑格'
            const whiteRule = v.length === 0 ? '窗口包含推理：差集格必为白格' : '重叠窗口差分：差集格必为白格'
            for (const x of v) if (!set(x, 1, blackRule)) return false
            for (const x of u) if (!set(x, 0, whiteRule)) return false
          }
        }
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
