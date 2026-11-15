/**
 * 扫雷题库生成器
 *
 * 1. 随机布雷并计算所有非雷格的数字；
 * 2. 先把全部数字作为线索，再随机移除仍保持唯一解的数字。
 */

import type { Difficulty } from '../core/types'
import { countSolutions } from './solver.ts'
import { encodeClues, encodeMines, neighbors } from './types.ts'

interface GenSpec {
  seed: number
  difficulty: Difficulty
  name: string
  series: string
  mines: number
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const SPECS: GenSpec[] = [
  { seed: 0x4d534701, difficulty: 'easy', name: '初识马赛克', series: '入门', mines: 14 },
  { seed: 0x4d534702, difficulty: 'easy', name: '黑白方格', series: '入门', mines: 16 },
  { seed: 0x4d534703, difficulty: 'medium', name: '九宫计数', series: '进阶', mines: 18 },
  { seed: 0x4d534704, difficulty: 'medium', name: '三三之窗', series: '进阶', mines: 20 },
  { seed: 0x4d534705, difficulty: 'hard', name: '马赛克之壁', series: '挑战', mines: 22 },
  { seed: 0x4d534706, difficulty: 'hard', name: '终局马赛克', series: '挑战', mines: 24 },
]

export interface GeneratedPuzzle {
  id: string
  name: string
  width: number
  height: number
  difficulty: Difficulty
  series: string
  board: string
  solution: string
}

function attempt(spec: GenSpec, rng: () => number, w: number, h: number): GeneratedPuzzle | null {
  const total = w * h
  const mines = new Array<number>(total).fill(0)
  const order = shuffle(
    Array.from({ length: total }, (_, i) => i),
    rng,
  )
  for (let k = 0; k < spec.mines; k++) mines[order[k]!] = 1

  const clues = new Array<number>(total).fill(-1)
  for (let i = 0; i < total; i++) {
    if (mines[i]) continue
    let count = 0
    for (const n of neighbors(i, w, h)) if (mines[n]) count++
    clues[i] = count
  }

  let counted = countSolutions(clues, w, h, 2, 400_000)
  if (counted.timedOut || counted.count !== 1) return null

  const clueOrder = shuffle(
    Array.from({ length: total }, (_, i) => i).filter((i) => clues[i] >= 0),
    rng,
  )
  for (const i of clueOrder) {
    const save = clues[i]!
    clues[i] = -1
    counted = countSolutions(clues, w, h, 2, 400_000)
    if (counted.timedOut) return null
    if (counted.count === 1) continue
    clues[i] = save
  }

  return {
    id: `mosaic-${w}x${h}-${spec.seed.toString(36)}`,
    name: spec.name,
    width: w,
    height: h,
    difficulty: spec.difficulty,
    series: spec.series,
    board: encodeClues(clues),
    solution: encodeMines(mines),
  }
}

export function generatePuzzles(): GeneratedPuzzle[] {
  const out: GeneratedPuzzle[] = []
  for (const spec of SPECS) {
    const t0 = Date.now()
    const rng = mulberry32(spec.seed)
    let made: GeneratedPuzzle | null = null
    for (let tries = 0; tries < 60 && !made; tries++) made = attempt(spec, rng, 8, 8)
    if (!made) throw new Error(`[马赛克 gen] ${spec.name} 生成失败`)
    const clueCount = made.board.split('').filter((c) => c !== '.').length
    console.log(`[马赛克 gen] ${spec.name}：线索 ${clueCount}，${Date.now() - t0}ms`)
    out.push(made)
  }
  return out
}
