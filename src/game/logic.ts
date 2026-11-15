/**
 * 扫雷 —— 逻辑解题回放
 */

import type { GameState, LogicPlan, Move, PlaybackFrame, Puzzle } from '../core/types'
import { checkSolution, propagate } from './rules'
import { findSolution } from './solver'
import {
  asMinesweeperPuzzle,
  asMinesweeperState,
  type MinesweeperState,
} from './types'

export function planLogicSolve(puzzle: Puzzle, initialState: GameState): LogicPlan {
  const p = asMinesweeperPuzzle(puzzle)
  const s = asMinesweeperState(initialState)
  const w = p.width
  const h = p.height
  const clues = p.clues ?? []
  const total = w * h

  const frames: PlaybackFrame[] = []
  const grid = new Array<number>(total).fill(-1)
  let streak = 0

  const onSet = (index: number, value: number, label: string): void => {
    if (grid[index] === value) return
    const from = grid[index] === 1 ? 1 : 0
    grid[index] = value
    streak++
    const move: Move = { index, from, to: value }
    frames.push({ rule: value === 1 ? 1 : 2, label, move, streak })
  }

  if (!propagate(grid, clues, w, h, onSet)) {
    return { puzzleId: p.id, frames: [], finalState: null, ruleSteps: 0, saturated: false }
  }

  let saturated = true
  if (grid.some((v) => v === -1)) {
    saturated = false
    const solution = findSolution(clues, w, h, 2_000_000)
    if (!solution) {
      return { puzzleId: p.id, frames: [], finalState: null, ruleSteps: 0, saturated: false }
    }
    for (let i = 0; i < total; i++) {
      if (grid[i] !== -1) continue
      onSet(i, solution[i]!, '回溯试探：该格最终状态')
    }
  }

  const mines = grid.map((v) => (v === 1 ? 1 : 0))
  if (!checkSolution(mines, clues, w, h).ok) {
    return { puzzleId: p.id, frames: [], finalState: null, ruleSteps: 0, saturated: false }
  }
  // 确保回放结果与推理终态一致（补上传播阶段可能漏记的格子）
  for (let i = 0; i < total; i++) {
    const from = s.mines[i] ?? 0
    if (mines[i] === from) continue
    streak++
    frames.push({
      rule: 4,
      label: '补全：该格最终状态',
      move: { index: i, from, to: mines[i]! },
      streak,
    })
  }
  const finalState: MinesweeperState = {
    puzzleId: s.puzzleId,
    width: w,
    height: h,
    mines,
  }
  return { puzzleId: p.id, frames, finalState, ruleSteps: frames.length, saturated }
}
