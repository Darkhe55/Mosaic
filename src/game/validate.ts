/**
 * 扫雷 —— 实时校验
 */

import type { GameState, Puzzle, ValidationResult } from '../core/types'
import { checkSolution } from './rules'
import {
  asMinesweeperPuzzle,
  asMinesweeperState,
  type MinesweeperResult,
} from './types'

export function validate(state: GameState, puzzle: Puzzle): MinesweeperResult {
  const s = asMinesweeperState(state)
  const p = asMinesweeperPuzzle(puzzle)
  const out = checkSolution(s.mines, p.clues ?? [], p.width, p.height)
  return {
    solved: out.ok,
    badCells: out.badCells,
    clueIssues: out.issues,
    remaining: out.issues.length,
  }
}

export function statusBits(result: ValidationResult): string[] {
  const r = result as MinesweeperResult
  if (r.solved) return ['完成']
  if (r.clueIssues.length > 0) return [`${r.clueIssues.length} 个数字线索不满足`]
  return ['继续布置地雷']
}
