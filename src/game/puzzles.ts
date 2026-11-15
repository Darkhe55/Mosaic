/**
 * 扫雷 —— 题库
 */

import type { Difficulty, GameState, Puzzle } from '../core/types'
import { RAW_PUZZLES } from './puzzles-data'
import {
  decodeClues,
  decodeMines,
  type MinesweeperPuzzle,
  type MinesweeperState,
} from './types'

export interface RawPuzzle {
  id: string
  name: string
  width: number
  height: number
  difficulty: Difficulty
  series?: string
  board: string
  solution?: string
}

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
    clues,
    solutionMines: raw.solution,
  }
}

export const builtinPuzzles: Puzzle[] = (RAW_PUZZLES as RawPuzzle[])
  .map(decodePuzzle)
  .filter((p): p is MinesweeperPuzzle => p !== null)

export function getReferenceSolution(id: string): GameState | null {
  const raw = (RAW_PUZZLES as RawPuzzle[]).find((p) => p.id === id)
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
