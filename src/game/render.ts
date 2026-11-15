/**
 * 扫雷 —— SVG 渲染
 */

import { cellAtPoint, cellCenter, originOf, squareMetrics, cellSizeOf } from '../core/board'
import type { BoardMetrics, GameState, HitTarget, Puzzle, ValidationResult } from '../core/types'
import {
  asMinesweeperPuzzle,
  asMinesweeperState,
  type MinesweeperResult,
} from './types'

export function metricsFor(puzzle: Puzzle): BoardMetrics {
  return squareMetrics(puzzle.width, puzzle.height, { cell: 54, pad: 22 })
}

export function renderBoard(
  puzzle: Puzzle,
  state: GameState,
  result: ValidationResult,
): string {
  const p = asMinesweeperPuzzle(puzzle)
  const s = asMinesweeperState(state)
  const r = result as MinesweeperResult
  const m = metricsFor(puzzle)
  const o = originOf(m)
  const { w: cw, h: ch } = cellSizeOf(m)
  const bad = new Set(r.badCells ?? [])
  const parts: string[] = []

  parts.push(
    `<rect class="ms-board-bg" x="${o.x}" y="${o.y}" width="${(cw * p.width).toFixed(2)}" height="${(ch * p.height).toFixed(2)}" />`,
  )

  for (let i = 0; i < p.width * p.height; i++) {
    const x = o.x + (i % p.width) * cw
    const y = o.y + Math.floor(i / p.width) * ch
    const clue = p.clues?.[i] ?? -1
    parts.push(
      `<rect class="ms-cell${clue >= 0 ? ' clue' : ''}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" />`,
    )
    if (clue >= 0) {
      const c = cellCenter(m, i)
      parts.push(
        `<text class="ms-clue c${clue}${bad.has(i) ? ' bad' : ''}" x="${c.x.toFixed(2)}" y="${(c.y + 2).toFixed(2)}" style="font-size:${(m.cell * 0.5).toFixed(2)}px">${clue}</text>`,
      )
    }
    if (s.mines[i] === 1) {
      parts.push(
        `<rect class="ms-black" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" />`,
      )
    }
  }

  for (let i = 0; i < p.width * p.height; i++) {
    const x = o.x + (i % p.width) * cw
    const y = o.y + Math.floor(i / p.width) * ch
    parts.push(
      `<rect class="cell-hit" data-index="${i}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}" />`,
    )
  }

  return `<svg class="board-svg ms-board" viewBox="0 0 ${m.svgWidth} ${m.svgHeight}" width="${m.svgWidth}" height="${m.svgHeight}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}

export function hitTest(m: BoardMetrics, puzzle: Puzzle, x: number, y: number): HitTarget | null {
  void puzzle
  const index = cellAtPoint(m, x, y)
  return index === null ? null : { index, kind: 'cell' }
}
