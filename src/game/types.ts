/**
 * 扫雷 —— 类型
 *
 * clues[i]：-1 无数字，0..9 数字线索。
 * mines[i]：0 白格，1 黑格。
 *
 * 规则变体（向后兼容字段 mode）：
 *   strict   —— 旧题默认：数字格本身不能涂黑，因此数字范围 0..8；
 *   standard —— 标准 Mosaic：数字格自身也可以是黑格，数字范围 0..9。
 * 缺省（没有 mode 字段）一律按 strict 处理，旧题库行为不变。
 */

import type { GameState, Puzzle, ValidationResult } from '../core/types'

/** 规则变体：strict = 数字格不能涂黑；standard = 数字格可为黑格 */
export type RuleVariant = 'strict' | 'standard'

export interface MinesweeperPuzzle extends Puzzle {
  clues: number[]
  solutionMines?: string
  /** 规则变体，缺省 strict（旧题） */
  mode?: RuleVariant
}

/** 读取题目规则变体，缺省/未知值一律 strict（向后兼容） */
export function variantOf(puzzle: Puzzle): RuleVariant {
  return (puzzle as MinesweeperPuzzle).mode === 'standard' ? 'standard' : 'strict'
}

export interface MinesweeperState extends GameState {
  mines: number[]
}

export interface ClueIssue {
  cell: number
  expected: number
  actual: number
}

export interface MinesweeperResult extends ValidationResult {
  badCells: number[]
  clueIssues: ClueIssue[]
  remaining: number
}

export function asMinesweeperPuzzle(p: Puzzle): MinesweeperPuzzle {
  return p as MinesweeperPuzzle
}

export function asMinesweeperState(s: GameState): MinesweeperState {
  return s as MinesweeperState
}

/** 马赛克：中心格自身 + 周围八格 */
export function neighbors(cell: number, w: number, h: number): number[] {
  const x = cell % w
  const y = (cell / w) | 0
  const out: number[] = [cell]
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      out.push(ny * w + nx)
    }
  }
  return out
}

export function encodeClues(clues: ArrayLike<number>): string {
  let out = ''
  for (let i = 0; i < clues.length; i++) {
    const v = clues[i]!
    out += v < 0 ? '.' : String(v)
  }
  return out
}

export function decodeClues(text: string, expected: number): number[] | null {
  if (typeof text !== 'string' || text.length !== expected) return null
  const out = new Array<number>(expected).fill(-1)
  for (let i = 0; i < expected; i++) {
    const ch = text[i]!
    if (ch === '.') continue
    const v = ch.charCodeAt(0) - 48
    // 0..9：standard 变体的数字格自身可为黑格，因此会出现 9
    if (v < 0 || v > 9) return null
    out[i] = v
  }
  return out
}

export function encodeMines(mines: ArrayLike<number>): string {
  let out = ''
  for (let i = 0; i < mines.length; i++) out += mines[i] ? '1' : '0'
  return out
}

export function decodeMines(text: string, expected: number): number[] | null {
  if (typeof text !== 'string' || text.length !== expected) return null
  const out = new Array<number>(expected)
  for (let i = 0; i < expected; i++) {
    if (text[i] === '1') out[i] = 1
    else if (text[i] === '0') out[i] = 0
    else return null
  }
  return out
}
