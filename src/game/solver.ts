/**
 * 马赛克 —— 回溯求解器（支持 strict / standard 规则变体）
 *
 * 小棋盘（旧 8×8 题）沿用朴素 DFS；大棋盘（如 50×50 图片导入题）自动改用
 * CDCL SAT 求解（src/game/sat.ts），否则朴素搜索会超时。
 */

import type { Puzzle, SolveResult } from '../core/types'
import { checkSolution, propagate } from './rules.ts'
import { blockModel, buildMosaicCnf, solveCnf } from './sat.ts'
import { type MinesweeperPuzzle, type MinesweeperState, type RuleVariant, variantOf } from './types.ts'

/** 超过该格数改用 SAT；旧 8×8 题不受影响 */
const SAT_MIN_CELLS = 144
/** SAT 求解时间上限（毫秒） */
const SAT_TIME_LIMIT_MS = 10_000

export interface CountOutcome {
  count: number
  nodes: number
  timedOut: boolean
}

function search(
  clues: number[],
  w: number,
  h: number,
  limit: number,
  maxNodes: number,
  mode: RuleVariant = 'strict',
): { solutions: number[][]; nodes: number; timedOut: boolean } {
  const size = w * h
  const vals = new Array<number>(size).fill(-1)
  const solutions: number[][] = []
  let nodes = 0
  let timedOut = false

  const dfs = (): void => {
    if (solutions.length >= limit || timedOut) return
    nodes++
    if (nodes > maxNodes) {
      timedOut = true
      return
    }
    if (!propagate(vals, clues, w, h, undefined, mode)) return

    let target = -1
    let bestUnknown = 9
    for (let i = 0; i < size; i++) {
      if (vals[i] !== -1) continue
      // 优先选择靠近数字线索的未定格
      let score = 0
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const x = (i % w) + dx
        const y = ((i / w) | 0) + dy
        if (x >= 0 && y >= 0 && x < w && y < h && (clues[y * w + x] ?? -1) >= 0) score++
      }
      if (score > 0 && score < bestUnknown) {
        bestUnknown = score
        target = i
        if (score === 1) break
      }
    }
    if (target < 0) {
      for (let i = 0; i < size; i++) {
        if (vals[i] === -1) {
          target = i
          break
        }
      }
    }
    if (target < 0) {
      const out = vals.map((v) => (v === 1 ? 1 : 0))
      if (checkSolution(out, clues, w, h, mode).ok) solutions.push(out)
      return
    }

    for (const value of [1, 0]) {
      const backup = vals.slice()
      vals[target] = value
      dfs()
      for (let i = 0; i < size; i++) vals[i] = backup[i]!
      if (solutions.length >= limit || timedOut) break
    }
  }

  dfs()
  return { solutions, nodes, timedOut }
}

export function countSolutions(
  clues: number[],
  w: number,
  h: number,
  limit = 2,
  maxNodes = 300_000,
  mode: RuleVariant = 'strict',
): CountOutcome {
  if (w * h > SAT_MIN_CELLS) {
    const cnf = buildMosaicCnf(clues, w, h, mode)
    const first = solveCnf(cnf, { timeLimitMs: SAT_TIME_LIMIT_MS })
    if (first.timedOut) return { count: 0, nodes: first.conflicts, timedOut: true }
    if (!first.sat || !first.model) return { count: 0, nodes: first.conflicts, timedOut: false }
    if (limit <= 1) return { count: 1, nodes: first.conflicts, timedOut: false }
    const second = solveCnf(blockModel(cnf, first.model), { timeLimitMs: SAT_TIME_LIMIT_MS })
    const nodes = first.conflicts + second.conflicts
    if (second.timedOut) return { count: 1, nodes, timedOut: true }
    return { count: second.sat ? 2 : 1, nodes, timedOut: false }
  }
  const out = search(clues, w, h, limit, maxNodes, mode)
  return { count: out.solutions.length, nodes: out.nodes, timedOut: out.timedOut }
}

export function findSolution(
  clues: number[],
  w: number,
  h: number,
  maxNodes = 2_000_000,
  mode: RuleVariant = 'strict',
): number[] | null {
  if (w * h > SAT_MIN_CELLS) {
    const out = solveCnf(buildMosaicCnf(clues, w, h, mode), { timeLimitMs: SAT_TIME_LIMIT_MS })
    return out.sat && out.model ? out.model.map((v) => (v ? 1 : 0)) : null
  }
  const out = search(clues, w, h, 1, maxNodes, mode)
  return out.solutions[0] ?? null
}

export function solvePuzzle(puzzle: Puzzle, maxNodes = 1_500_000): SolveResult {
  const p = puzzle as MinesweeperPuzzle
  if (!p.clues || p.clues.length !== p.width * p.height) {
    return { solved: false, solution: null, nodes: 0, timedOut: false }
  }
  const mode = variantOf(p)
  if (p.width * p.height > SAT_MIN_CELLS) {
    const out = solveCnf(buildMosaicCnf(p.clues, p.width, p.height, mode), {
      timeLimitMs: SAT_TIME_LIMIT_MS,
    })
    if (!out.sat || !out.model) {
      return { solved: false, solution: null, nodes: out.conflicts, timedOut: out.timedOut }
    }
    return {
      solved: true,
      solution: makeState(
        p,
        out.model.map((v) => (v ? 1 : 0)),
      ),
      nodes: out.conflicts,
      timedOut: false,
    }
  }
  const out = search(p.clues, p.width, p.height, 1, maxNodes, mode)
  const mines = out.solutions[0]
  if (!mines) return { solved: false, solution: null, nodes: out.nodes, timedOut: out.timedOut }
  return { solved: true, solution: makeState(p, mines), nodes: out.nodes, timedOut: out.timedOut }
}

export function makeState(puzzle: MinesweeperPuzzle, mines: number[]): MinesweeperState {
  return {
    puzzleId: puzzle.id,
    width: puzzle.width,
    height: puzzle.height,
    mines: mines.map((v) => (v ? 1 : 0)),
  }
}
