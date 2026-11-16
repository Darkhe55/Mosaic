/* 自动生成，勿手改。运行 npm run gen 重新生成。 */
export interface RawPuzzle {
  id: string
  name: string
  width: number
  height: number
  difficulty: 'easy' | 'medium' | 'hard' | 'custom'
  series: string
  /** 规则变体：缺省 strict（旧题）；standard = 标准 Mosaic（数字格可为黑格，数字 0–9） */
  mode?: 'strict' | 'standard'
  /** 题面编码串（格式由 src/game/puzzles.ts 解析） */
  board: string
  /** 参考解编码串（没有则留空） */
  solution?: string
}

export const RAW_PUZZLES: RawPuzzle[] = [
  { id: "mosaic-8x8-lgdpmp", name: "初识马赛克", width: 8, height: 8, difficulty: 'easy', series: "入门", board: "0....0....1.1.1.232....2.....1....4....2.2....0..346....0....2.0", solution: "0001000100000000000000001110001100000000101100000000100000111000" },
  { id: "mosaic-8x8-lgdpmq", name: "黑白方格", width: 8, height: 8, difficulty: 'easy', series: "入门", board: ".00..2....11...2.....3.2.1.2.1....3....22...3.1.3444...1......1.", solution: "0000000100000110000100000000001010010000010100010000100011101100" },
  { id: "mosaic-8x8-lgdpmr", name: "九宫计数", width: 8, height: 8, difficulty: 'medium', series: "进阶", board: "..2...10.2.5.........2.....4...0.2...4...42.3........3.23..11..2", solution: "0001110000100000001100000000110010001000100001001101001001000010" },
  { id: "mosaic-8x8-lgdpms", name: "三三之窗", width: 8, height: 8, difficulty: 'medium', series: "进阶", board: "..1..3212.1....22....5.......5.2353.2......2.....6..21.02..2....", solution: "1000100001000110000010101010100000000110111000001001000001100100" },
  { id: "mosaic-8x8-lgdpmt", name: "马赛克之壁", width: 8, height: 8, difficulty: 'hard', series: "挑战", board: ".12232....2....1...4...233....3....33.4..5.31...2...23...3.3..21", solution: "0000000001011100100000100001110111000000101000110011001010100100" },
  { id: "mosaic-8x8-lgdpmu", name: "终局马赛克", width: 8, height: 8, difficulty: 'hard', series: "挑战", board: "2..1.2...3..2..1..3.3.2.1..3..3.....4.3.2......2...6.54.1.3.3...", solution: "0100001010100100000001000110100000100101011110100110100000010111" },
]
