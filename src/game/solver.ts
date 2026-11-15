/**
 * 扫雷 —— 回溯求解器
 */

import type { Puzzle, SolveResult } from '../core/types'
import { checkSolution, propagate } from './rules.ts'
import { type MinesweeperPuzzle, type MinesweeperState } from './types.ts'

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
    if (!propagate(vals, clues, w, h)) return

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
      if (checkSolution(out, clues, w, h).ok) solutions.push(out)
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
): CountOutcome {
  const out = search(clues, w, h, limit, maxNodes)
  return { count: out.solutions.length, nodes: out.nodes, timedOut: out.timedOut }
}

export function findSolution(
  clues: number[],
  w: number,
  h: number,
  maxNodes = 2_000_000,
): number[] | null {
  const out = search(clues, w, h, 1, maxNodes)
  return out.solutions[0] ?? null
}

export function solvePuzzle(puzzle: Puzzle, maxNodes = 1_500_000): SolveResult {
  const p = puzzle as MinesweeperPuzzle
  if (!p.clues || p.clues.length !== p.width * p.height) {
    return { solved: false, solution: null, nodes: 0, timedOut: false }
  }
  const out = search(p.clues, p.width, p.height, 1, maxNodes)
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
