/**
 * 轻量 CDCL SAT 求解器 + 马赛克基数约束编码
 *
 * 为什么需要它：50×50 的马赛克题面（1192 条线索、2500 格）远超朴素回溯的
 * 搜索能力，`solver.ts` 的 DFS 会超时。这里把每条线索「3×3 内黑格数 = k」
 * 编码成 CNF（至多 k + 至少 k 的基数约束），再用带子句学习的 CDCL 求解。
 *
 * 只在棋盘较大时启用（见 solver.ts 的 SAT_MIN_CELLS），旧的小题仍走原 DFS，
 * 保证既有题库行为不变。
 */

/* ────────────────────────── CNF 构建 ────────────────────────── */

export interface Cnf {
  nVars: number
  clauses: number[][]
}

/** 组合：从 arr 里取 k 个的全部组合（k 很小，直接递归） */
export function combinations(arr: number[], k: number): number[][] {
  const out: number[][] = []
  if (k < 0 || k > arr.length) return out
  if (k === 0) return [[]]
  const cur: number[] = []
  const walk = (start: number): void => {
    if (cur.length === k) {
      out.push(cur.slice())
      return
    }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]!)
      walk(i + 1)
      cur.pop()
    }
  }
  walk(0)
  return out
}

/**
 * 单条线索的基数约束编码：
 *   at-most-k ：任意 k+1 个格子里至少一个不是黑格
 *   at-least-k：任意 (m-k+1) 个格子里至少一个是黑格
 * m ≤ 9，子句数量最多 210 条，规模可接受。
 */
function addCardinalityEquality(clauses: number[][], cells: number[], k: number): void {
  const m = cells.length
  if (k < 0 || k > m) {
    clauses.push([]) // 空子句 = 立即不可满足
    return
  }
  if (k < m) {
    for (const sub of combinations(cells, k + 1)) {
      clauses.push(sub.map((v) => -v))
    }
  }
  if (k > 0) {
    for (const sub of combinations(cells, m - k + 1)) {
      clauses.push(sub.slice())
    }
  }
}

/**
 * 把整盘题面编码成 CNF。
 * 变量 v（1 基）为真表示该格是黑格。
 * mode = strict 时数字格自身加单元子句 ¬v（数字格不能涂黑）。
 */
export function buildMosaicCnf(
  clues: ArrayLike<number>,
  w: number,
  h: number,
  mode: 'strict' | 'standard',
): Cnf {
  const nVars = w * h
  const clauses: number[][] = []
  const strict = mode !== 'standard'
  for (let i = 0; i < nVars; i++) {
    const k = clues[i] ?? -1
    if (k < 0) continue
    const x = i % w
    const y = (i / w) | 0
    const cells: number[] = []
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy
      if (ny < 0 || ny >= h) continue
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        if (nx < 0 || nx >= w) continue
        cells.push(ny * w + nx + 1)
      }
    }
    if (strict) clauses.push([-(i + 1)])
    addCardinalityEquality(clauses, cells, k)
  }
  return { nVars, clauses }
}

/* ────────────────────────── CDCL 求解器 ────────────────────────── */

export interface SatOptions {
  /** 冲突数上限（0 = 不限） */
  maxConflicts?: number
  /** 墙钟时间上限（毫秒，0 = 不限） */
  timeLimitMs?: number
}

export interface SatResult {
  sat: boolean
  /** sat=true 时给出完整赋值（未决定的变量填 false） */
  model: boolean[] | null
  conflicts: number
  timedOut: boolean
}

interface Clause {
  lits: number[]
  w0: number
  w1: number
  learnt: boolean
}

const LIT_UNDEF = 0

class CdclSolver {
  private nVars: number
  private clauses: Clause[] = []
  private watches: number[][]
  private assigns: Int8Array
  private levels: Int32Array
  private reasons: Int32Array
  private phase: Int8Array
  private activity: Float64Array
  private seen: Uint8Array
  private trail: number[] = []
  private trailLim: number[] = []
  private qhead = 0
  private varInc = 1
  private ok = true
  private conflicts = 0
  private maxConflicts: number
  private timeLimitMs: number
  private startTime: number

  constructor(cnf: Cnf, opts: SatOptions = {}) {
    this.nVars = cnf.nVars
    this.watches = Array.from({ length: 2 * cnf.nVars }, () => [])
    this.assigns = new Int8Array(cnf.nVars)
    this.levels = new Int32Array(cnf.nVars)
    this.reasons = new Int32Array(cnf.nVars).fill(-1)
    this.phase = new Int8Array(cnf.nVars)
    this.activity = new Float64Array(cnf.nVars)
    this.seen = new Uint8Array(cnf.nVars)
    this.maxConflicts = opts.maxConflicts ?? 0
    this.timeLimitMs = opts.timeLimitMs ?? 0
    this.startTime = Date.now()
    for (const lits of cnf.clauses) this.addClause(lits, false)
  }

  private litIndex(lit: number): number {
    return lit > 0 ? 2 * (lit - 1) : 2 * (-lit - 1) + 1
  }

  private valueOf(lit: number): number {
    const v = this.assigns[Math.abs(lit) - 1]!
    if (v === 0) return 0
    return lit > 0 ? v : -v
  }

  private decisionLevel(): number {
    return this.trailLim.length
  }

  private addClause(raw: number[], learnt: boolean): boolean {
    // 去重 + 去掉恒真子句
    const seen = new Set<number>()
    const lits: number[] = []
    for (const l of raw) {
      if (seen.has(l)) continue
      if (seen.has(-l)) return true // 恒真，忽略
      seen.add(l)
      lits.push(l)
    }
    if (lits.length === 0) {
      this.ok = false
      return false
    }
    if (lits.length === 1) {
      if (!this.enqueue(lits[0]!, -1)) {
        this.ok = false
        return false
      }
      return true
    }
    const c: Clause = { lits, w0: 0, w1: 1, learnt }
    const ci = this.clauses.length
    this.clauses.push(c)
    this.watches[this.litIndex(lits[0]!)]!.push(ci)
    this.watches[this.litIndex(lits[1]!)]!.push(ci)
    return true
  }

  private enqueue(lit: number, reason: number): boolean {
    const v = Math.abs(lit) - 1
    const want = lit > 0 ? 1 : -1
    const cur = this.assigns[v]!
    if (cur !== 0) return cur === want
    this.assigns[v] = want
    this.levels[v] = this.decisionLevel()
    this.reasons[v] = reason
    this.trail.push(lit)
    return true
  }

  /** 返回冲突子句下标，-1 表示无冲突 */
  private propagate(): number {
    while (this.qhead < this.trail.length) {
      const p = this.trail[this.qhead++]!
      const falseLit = -p
      const ws = this.watches[this.litIndex(falseLit)]!
      let i = 0
      while (i < ws.length) {
        const ci = ws[i]!
        const c = this.clauses[ci]!
        const wpos = c.lits[c.w0] === falseLit ? c.w0 : c.w1
        const otherPos = wpos === c.w0 ? c.w1 : c.w0
        const other = c.lits[otherPos]!
        if (this.valueOf(other) === 1) {
          i++
          continue
        }
        let newWatch = -1
        for (let k = 0; k < c.lits.length; k++) {
          if (k === c.w0 || k === c.w1) continue
          if (this.valueOf(c.lits[k]!) !== -1) {
            newWatch = k
            break
          }
        }
        if (newWatch >= 0) {
          if (wpos === c.w0) c.w0 = newWatch
          else c.w1 = newWatch
          // 从当前 watch 列表移除（swap-pop），加到新 literal 的列表
          ws[i] = ws[ws.length - 1]!
          ws.pop()
          this.watches[this.litIndex(c.lits[newWatch]!)]!.push(ci)
          continue
        }
        if (this.valueOf(other) === -1) return ci
        if (!this.enqueue(other, ci)) return ci
        i++
      }
    }
    return -1
  }

  private cancelUntil(level: number): void {
    if (this.trailLim.length <= level) return
    const bound = this.trailLim[level]!
    for (let i = this.trail.length - 1; i >= bound; i--) {
      const lit = this.trail[i]!
      const v = Math.abs(lit) - 1
      this.assigns[v] = 0
      this.reasons[v] = -1
      this.phase[v] = lit > 0 ? 1 : 0
    }
    this.trail.length = bound
    this.trailLim.length = level
    this.qhead = bound
  }

  private bumpVar(v: number): void {
    this.activity[v] = this.activity[v]! + this.varInc
    if (this.activity[v]! > 1e100) {
      for (let i = 0; i < this.nVars; i++) this.activity[i] = this.activity[i]! * 1e-100
      this.varInc *= 1e-100
    }
  }

  /** 1UIP 冲突分析，返回学到的子句与回跳层 */
  private analyze(confl: number): { learnt: number[]; backtrack: number } {
    const learnt: number[] = []
    let pathCount = 0
    let p = LIT_UNDEF
    let clause = this.clauses[confl]!
    let idx = this.trail.length - 1
    const toClear: number[] = []

    for (;;) {
      for (let j = 0; j < clause.lits.length; j++) {
        const q = clause.lits[j]!
        const v = Math.abs(q) - 1
        if (p !== LIT_UNDEF && v === Math.abs(p) - 1) continue
        if (this.seen[v] || this.levels[v] === 0) continue
        this.seen[v] = 1
        toClear.push(v)
        this.bumpVar(v)
        if (this.levels[v]! >= this.decisionLevel()) pathCount++
        else learnt.push(q)
      }
      while (!this.seen[Math.abs(this.trail[idx]!) - 1]) idx--
      p = this.trail[idx]!
      idx--
      const pv = Math.abs(p) - 1
      this.seen[pv] = 0
      pathCount--
      if (pathCount <= 0) break
      const r = this.reasons[pv]!
      if (r < 0) break
      clause = this.clauses[r]!
    }
    learnt.unshift(-p)
    for (const v of toClear) this.seen[v] = 0
    let backtrack = 0
    for (let i = 1; i < learnt.length; i++) {
      const lv = this.levels[Math.abs(learnt[i]!) - 1]!
      if (lv > backtrack) backtrack = lv
    }
    return { learnt, backtrack }
  }

  private pickBranchVar(): number {
    let best = -1
    let bestAct = -1
    for (let v = 0; v < this.nVars; v++) {
      if (this.assigns[v] !== 0) continue
      if (this.activity[v]! > bestAct) {
        bestAct = this.activity[v]!
        best = v
      }
    }
    return best
  }

  private outOfBudget(): boolean {
    if (this.maxConflicts > 0 && this.conflicts > this.maxConflicts) return true
    if (this.timeLimitMs > 0 && (this.conflicts & 63) === 0 && Date.now() - this.startTime > this.timeLimitMs) {
      return true
    }
    return false
  }

  solve(): SatResult {
    if (!this.ok) return { sat: false, model: null, conflicts: 0, timedOut: false }
    if (!this.propagate()) {
      this.ok = false
      return { sat: false, model: null, conflicts: 0, timedOut: false }
    }
    let restartCount = 0
    let nextRestart = 100
    for (;;) {
      const confl = this.propagate()
      if (confl >= 0) {
        this.conflicts++
        if (this.decisionLevel() === 0) {
          this.ok = false
          return { sat: false, model: null, conflicts: this.conflicts, timedOut: false }
        }
        const { learnt, backtrack } = this.analyze(confl)
        this.cancelUntil(backtrack)
        const ci = this.clauses.length
        const okAdd = this.addClause(learnt, true)
        if (!okAdd) {
          this.ok = false
          return { sat: false, model: null, conflicts: this.conflicts, timedOut: false }
        }
        if (learnt.length > 1) {
          // 学习子句的第一个文字是断言文字，直接入队
          this.enqueue(learnt[0]!, ci)
        }
        this.varInc *= 1 / 0.95
        if (this.outOfBudget()) {
          return { sat: false, model: null, conflicts: this.conflicts, timedOut: true }
        }
        if (this.conflicts >= nextRestart) {
          restartCount++
          this.cancelUntil(0)
          nextRestart = this.conflicts + 100 * this.luby(2, restartCount)
        }
        continue
      }
      if (this.outOfBudget()) {
        return { sat: false, model: null, conflicts: this.conflicts, timedOut: true }
      }
      const v = this.pickBranchVar()
      if (v < 0) {
        const model = new Array<boolean>(this.nVars)
        for (let i = 0; i < this.nVars; i++) model[i] = this.assigns[i] === 1
        return { sat: true, model, conflicts: this.conflicts, timedOut: false }
      }
      this.trailLim.push(this.trail.length)
      this.enqueue(this.phase[v] ? v + 1 : -(v + 1), -1)
    }
  }

  private luby(base: number, i: number): number {
    let k = 1
    while ((1 << k) - 1 < i + 1) k++
    if ((1 << k) - 1 === i + 1) return Math.pow(base, k - 1)
    return this.luby(base, i - ((1 << (k - 1)) - 1))
  }
}

export function solveCnf(cnf: Cnf, opts: SatOptions = {}): SatResult {
  return new CdclSolver(cnf, opts).solve()
}

/** 在已有 CNF 上追加「排除某个赋值」的子句，用于求第二组解 */
export function blockModel(cnf: Cnf, model: boolean[]): Cnf {
  const blocking = model.map((b, i) => (b ? -(i + 1) : i + 1))
  return { nVars: cnf.nVars, clauses: [...cnf.clauses, blocking] }
}
