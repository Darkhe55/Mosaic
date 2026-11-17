/**
 * 马赛克 —— 逻辑解题回放（支持 strict / standard 规则变体）
 */

import type { GameState, LogicPlan, Move, PlaybackFrame, Puzzle } from '../core/types'
import { checkSolution, propagate } from './rules'
import { findSolution } from './solver'
import {
  asMinesweeperPuzzle,
  asMinesweeperState,
  variantOf,
  type MinesweeperState,
} from './types'

export function planLogicSolve(puzzle: Puzzle, initialState: GameState): LogicPlan {
  const p = asMinesweeperPuzzle(puzzle)
  const s = asMinesweeperState(initialState)
  const w = p.width
  const h = p.height
  const clues = p.clues ?? []
  const total = w * h
  const mode = variantOf(p)

  const frames: PlaybackFrame[] = []
  // 工作盘面从「当前盘面」开始：玩家已涂黑的格子（1）是已知信息，
  // 其余（0 = 界面上还没涂黑）保持 -1 未知，由规则继续推理。
  const displayed: number[] = s.mines.map((v) => (v === 1 ? 1 : 0))
  const grid: number[] = displayed.map((v) => (v === 1 ? 1 : -1))
  let streak = 0

  // 注意：rules.propagate 会先写盘面再回调，所以这里用 displayed 记录「当前可见值」，
  // 帧的 from 必须取当前值，而不是已写入的工作盘面。
  const onSet = (index: number, value: number, label: string): void => {
    grid[index] = value
    const from = displayed[index] ?? 0
    if (from === value) return
    displayed[index] = value
    streak++
    const move: Move = { index, from, to: value }
    frames.push({ rule: value === 1 ? 1 : 2, label, move, streak })
  }

  if (!propagate(grid, clues, w, h, onSet, mode)) {
    return { puzzleId: p.id, frames: [], finalState: null, ruleSteps: 0, saturated: false }
  }

  let saturated = true
  if (grid.some((v) => v === -1)) {
    saturated = false
    const solution = findSolution(clues, w, h, 2_000_000, mode)
    if (!solution) {
      return { puzzleId: p.id, frames: [], finalState: null, ruleSteps: 0, saturated: false }
    }
    for (let i = 0; i < total; i++) {
      if (grid[i] !== -1) continue
      onSet(i, solution[i]!, '回溯试探：该格最终状态')
    }
  }

  const mines = grid.map((v) => (v === 1 ? 1 : 0))
  if (!checkSolution(mines, clues, w, h, mode).ok) {
    return { puzzleId: p.id, frames: [], finalState: null, ruleSteps: 0, saturated: false }
  }
  const finalState: MinesweeperState = {
    puzzleId: s.puzzleId,
    width: w,
    height: h,
    mines,
  }
  return { puzzleId: p.id, frames, finalState, ruleSteps: frames.length, saturated }
}
