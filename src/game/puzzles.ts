/**
 * 扫雷 —— 题库
 */

import type { Difficulty, GameState, Puzzle } from '../core/types'
import { RAW_PUZZLES } from './puzzles-data'
import { IMPORTED_PUZZLES } from './imported-puzzles'
import {
  decodeClues,
  decodeMines,
  type MinesweeperPuzzle,
  type MinesweeperState,
  type RuleVariant,
} from './types'

export interface RawPuzzle {
  id: string
  name: string
  width: number
  height: number
  difficulty: Difficulty
  series?: string
  /** 规则变体：缺省 strict（旧题）；standard = 标准 Mosaic（数字格可为黑格） */
  mode?: RuleVariant | string
  board: string
  solution?: string
}

/** 内置题库 + 图片导入题库（imported-puzzles.ts，不会被 npm run gen 覆盖） */
const ALL_RAW: RawPuzzle[] = [...(RAW_PUZZLES as RawPuzzle[]), ...IMPORTED_PUZZLES]

export function decodePuzzle(raw: RawPuzzle): MinesweeperPuzzle | null {
  const expected = raw.width * raw.height
  const clues = decodeClues(raw.board, expected)
  if (!clues) return null
  return {
    id: raw.id,
    name: raw.name,
    width: raw.width,
    height: raw.height,
    difficulty: raw.difficulty,
    // 向后兼容：没有 mode 字段的旧题一律 strict
    mode: raw.mode === 'standard' ? 'standard' : 'strict',
    clues,
    solutionMines: raw.solution,
  }
}

export const builtinPuzzles: Puzzle[] = ALL_RAW.map(decodePuzzle).filter(
  (p): p is MinesweeperPuzzle => p !== null,
)

export function getReferenceSolution(id: string): GameState | null {
  const raw = ALL_RAW.find((p) => p.id === id)
  if (!raw || typeof raw.solution !== 'string') return null
  const puzzle = decodePuzzle(raw)
  if (!puzzle) return null
  const mines = decodeMines(raw.solution, puzzle.width * puzzle.height)
  if (!mines) return null
  const state: MinesweeperState = {
    puzzleId: puzzle.id,
    width: puzzle.width,
    height: puzzle.height,
    mines,
  }
  return state
}
