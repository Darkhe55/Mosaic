/**
 * 扫雷 —— 状态
 */

import type { GameState, HitTarget, Move, Puzzle } from '../core/types'
import {
  asMinesweeperPuzzle,
  asMinesweeperState,
  decodeMines,
  encodeMines,
  type MinesweeperState,
} from './types'

export function createEmptyState(puzzle: Puzzle): MinesweeperState {
  const p = asMinesweeperPuzzle(puzzle)
  return {
    puzzleId: p.id,
    width: p.width,
    height: p.height,
    mines: new Array<number>(p.width * p.height).fill(0),
  }
}

export function cloneState(state: GameState): MinesweeperState {
  const s = asMinesweeperState(state)
  return {
    puzzleId: s.puzzleId,
    width: s.width,
    height: s.height,
    mines: s.mines.slice(),
  }
}

export function cycleValue(state: GameState, target: HitTarget): number {
  const s = asMinesweeperState(state)
  return (s.mines[target.index] ?? 0) ? 0 : 1
}

export function rightClickValue(state: GameState, target: HitTarget): number {
  const s = asMinesweeperState(state)
  return (s.mines[target.index] ?? 0) ? 0 : 1
}

export function applyMove(state: GameState, move: Move): void {
  const s = asMinesweeperState(state)
  if (move.index < 0 || move.index >= s.mines.length) return
  s.mines[move.index] = move.to ? 1 : 0
}

export function invertMove(move: Move): Move {
  return { index: move.index, from: move.to, to: move.from }
}

export function valueAt(state: GameState, index: number): number {
  return asMinesweeperState(state).mines[index] ?? 0
}

export function serializeState(state: GameState): Record<string, unknown> {
  const s = asMinesweeperState(state)
  return {
    version: 1,
    puzzleId: s.puzzleId,
    width: s.width,
    height: s.height,
    mines: encodeMines(s.mines),
  }
}

export function deserializeState(data: Record<string, unknown>): MinesweeperState | null {
  if (typeof data.puzzleId !== 'string') return null
  if (typeof data.width !== 'number' || typeof data.height !== 'number') return null
  if (data.width < 2 || data.height < 2) return null
  const expected = data.width * data.height
  let mines: number[] | null = null
  if (typeof data.mines === 'string') mines = decodeMines(data.mines, expected)
  else if (Array.isArray(data.mines) && data.mines.length === expected) {
    mines = data.mines.map((v) => (Number(v) ? 1 : 0))
  }
  if (!mines) return null
  return { puzzleId: data.puzzleId, width: data.width, height: data.height, mines }
}

export function firstHintMove(state: GameState, solution: GameState): Move | null {
  const s = asMinesweeperState(state)
  const sol = asMinesweeperState(solution)
  for (let i = 0; i < s.mines.length; i++) {
    if ((s.mines[i] ?? 0) !== (sol.mines[i] ?? 0)) {
      return { index: i, from: s.mines[i] ?? 0, to: sol.mines[i] ?? 0 }
    }
  }
  return null
}
