/**
 * ════════════════════════════════════════════════════════════════════
 *  马赛克（Mosaic）—— 游戏适配器
 * ════════════════════════════════════════════════════════════════════
 *
 * 状态：每格 0 = 白格，1 = 黑格。
 */

import { playDrop, playPluck } from '../core/audio'
import type { CustomSupport, GameAdapter, Move, Puzzle, SolveResult } from '../core/types'
import { planLogicSolve } from './logic'
import { builtinPuzzles, getReferenceSolution } from './puzzles'
import { hitTest, metricsFor, renderBoard } from './render'
import { solvePuzzle } from './solver'
import {
  applyMove,
  cloneState,
  createEmptyState,
  cycleValue,
  deserializeState,
  firstHintMove,
  invertMove,
  rightClickValue,
  serializeState,
  valueAt,
} from './state'
import { statusBits, validate } from './validate'
import { encodeClues, type MinesweeperPuzzle } from './types'

const meta = {
  title: '马赛克',
  tagline: '数字表示以它为中心的 3×3 区域内的黑格总数',
  footerNote:
    '规则：涂黑部分格子。数字表示以它为中心的 3×3 区域内（含数字格自身）黑格的总数；数字格本身不能涂黑。点击格子在「黑格 / 白格」之间切换。',
  storageKeyPrefix: 'mosaic',
  customIdPrefix: 'mosaic-custom-',
  customMinW: 4,
  customMinH: 4,
  customMaxW: 10,
  customMaxH: 10,
  targetKind: 'cell' as const,
}

const custom: CustomSupport = {
  mode: 'none',
  valueCycle: [null, 1],
  keyForDigit: () => undefined,
  cellLabel: (v) => (v == null ? '' : String(v)),
  hint: '马赛克暂不支持自定义题板。',
  makePuzzle: (w, h, _grid, existingId) => ({
    id: existingId ?? `${meta.customIdPrefix}${w}x${h}-${Date.now()}`,
    name: `自定义 · ${w}×${h}`,
    width: w,
    height: h,
    difficulty: 'custom',
    clues: new Array<number>(w * h).fill(-1),
  } satisfies MinesweeperPuzzle),
  encodePuzzle: (p) => {
    const mp = p as MinesweeperPuzzle
    return { board: encodeClues(mp.clues ?? []) }
  },
  decodePuzzle: () => null,
}

function playForMove(move: Move, streak: number): void {
  if (move.to === 1) playDrop(streak)
  else playPluck(streak, 0.9)
}

export const adapter: GameAdapter = {
  meta,
  builtinPuzzles,
  getReferenceSolution,
  createEmptyState,
  cloneState,
  cycleValue,
  rightClickValue,
  applyMove,
  invertMove,
  valueAt,
  serializeState,
  deserializeState,
  validate,
  statusBits,
  metricsFor,
  renderBoard,
  hitTest,
  planLogicSolve,
  solvePuzzle: (puzzle: Puzzle, maxNodes?: number): SolveResult => solvePuzzle(puzzle, maxNodes),
  firstHintMove,
  custom,
  playForMove,
}
