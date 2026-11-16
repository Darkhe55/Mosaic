/**
 * 马赛克题库审计（内置题库 + 图片导入题库）
 *
 * 按每题的规则变体（缺省 strict，standard 允许数字格为黑格）校验：
 * 参考解合法、解唯一、规则传播无矛盾。
 */

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { decodeClues, decodeMines } from '../src/game/types.ts'
import { checkSolution, propagate } from '../src/game/rules.ts'
import { countSolutions } from '../src/game/solver.ts'

const DATA_FILES = [
  path.resolve('src/game/puzzles-data.ts'),
  path.resolve('src/game/imported-puzzles.ts'),
]

/** 从文件里抠出 `{ ... }` 条目，再逐个字段解析（兼容单/双引号、可选 mode） */
function parseEntries(text) {
  const entries = []
  for (const block of text.match(/\{[^{}]*\}/g) ?? []) {
    const id = block.match(/id:\s*"([^"]*)"/)?.[1]
    const board = block.match(/board:\s*"([^"]*)"/)?.[1]
    if (!id || board === undefined) continue
    const num = (re, fallback = 0) => {
      const m = block.match(re)
      return m ? Number(m[1]) : fallback
    }
    entries.push({
      id,
      name: block.match(/name:\s*"([^"]*)"/)?.[1] ?? id,
      width: num(/width:\s*(\d+)/),
      height: num(/height:\s*(\d+)/),
      difficulty: block.match(/difficulty:\s*'([^']*)'/)?.[1] ?? 'custom',
      series: block.match(/series:\s*"([^"]*)"/)?.[1] ?? '',
      mode: block.match(/mode:\s*['"]([^'"]*)['"]/)?.[1] ?? 'strict',
      board,
      solution: block.match(/solution:\s*"([^"]*)"/)?.[1] ?? '',
    })
  }
  return entries
}

const entries = []
for (const file of DATA_FILES) {
  if (!existsSync(file)) continue
  const parsed = parseEntries(readFileSync(file, 'utf8'))
  if (parsed.length) console.log(`[check] 读取 ${path.basename(file)}：${parsed.length} 题`)
  entries.push(...parsed)
}

let errors = 0
let warnings = 0
const ids = new Set()

for (const e of entries) {
  const mode = e.mode === 'standard' ? 'standard' : 'strict'
  if (ids.has(e.id)) {
    console.error(`[check] 重复 id: ${e.id}`)
    errors++
  }
  ids.add(e.id)
  const cells = e.width * e.height
  const clues = decodeClues(e.board, cells)
  const mines = decodeMines(e.solution, cells)
  if (!clues || !mines) {
    console.error(`[check] ${e.id} 题面/解编码非法`)
    errors++
    continue
  }
  if (mode === 'strict' && clues.some((v) => v > 8)) {
    console.error(`[check] ${e.id} strict 变体出现 9 线索（数字格不能涂黑时不可能满足）`)
    errors++
    continue
  }
  const ref = checkSolution(mines, clues, e.width, e.height, mode)
  if (!ref.ok) {
    console.error(`[check] ${e.id} 参考解不合法`)
    errors++
    continue
  }

  const counted = countSolutions(clues, e.width, e.height, 2, 1_000_000, mode)
  if (counted.timedOut) {
    console.warn(`[check] ${e.id} 唯一解检查超时（${counted.nodes} 节点）`)
    warnings++
  } else if (counted.count !== 1) {
    console.error(`[check] ${e.id} 解不唯一：找到 ${counted.count} 个`)
    errors++
    continue
  }

  const vals = new Array(cells).fill(-1)
  const sat = propagate(vals, clues, e.width, e.height, undefined, mode)
  const decided = vals.every((v) => v !== -1)
  if (!sat) {
    console.error(`[check] ${e.id} 规则传播矛盾`)
    errors++
    continue
  }
  if (!decided) warnings++

  const clueCount = clues.filter((v) => v >= 0).length
  const blackCount = mines.filter((v) => v === 1).length
  console.log(
    `[check] ${e.id} ${e.width}×${e.height} ${mode} · 线索 ${clueCount} 黑格 ${blackCount} · 解唯一 · 逻辑${decided ? '可推满' : '需回溯'} · ${counted.nodes} 节点`,
  )
}

console.log(`[check] 共 ${entries.length} 题，错误 ${errors}，警告 ${warnings}`)
if (entries.length === 0) console.warn('[check] 题库为空，请先运行 npm run gen。')
if (errors > 0) process.exitCode = 1
