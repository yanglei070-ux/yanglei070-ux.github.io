// 数据访问层:唯一与具体 SQLite 驱动耦合的地方。
// 目前用 sql.js(纯 WebAssembly 实现,Windows 上无需 C++ 工具链即可运行)。
// 将来若改为 better-sqlite3,只改本文件内部实现即可,不影响上层调用。
import type { Database, SqlJsStatic } from 'sql.js'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

// 本文件打包为 CommonJS,require 由运行时提供。
// sql.js 是巨型 Emscripten CJS 文件,用 require 加载(而非 import)可避开 ESM 预解析。
type InitSqlJs = (cfg: { locateFile: () => string }) => Promise<SqlJsStatic>
const initSqlJs = require('sql.js') as InitSqlJs

let SQL: SqlJsStatic | null = null
let db: Database | null = null
// 数据库文件保存在用户数据目录下,跟随用户而非代码目录
function dbPath(): string {
  const dir = app.getPath('userData')
  const file = path.join(dir, 'leo.db')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return file
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,
  l1 TEXT NOT NULL,
  l2 TEXT NOT NULL,
  note TEXT,
  spent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS categories (
  l1 TEXT NOT NULL,
  l2 TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (l1, l2)
)`,
  `CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`
]

const DEFAULT_CATEGORIES: Array<[string, string]> = [
  ['餐饮美食', '早餐'], ['餐饮美食', '午餐'], ['餐饮美食', '晚餐'], ['餐饮美食', '夜宵'], ['餐饮美食', '零食饮料'], ['餐饮美食', '外卖'], ['餐饮美食', '聚餐'],
  ['交通出行', '地铁公交'], ['交通出行', '打车网约车'], ['交通出行', '共享单车'], ['交通出行', '火车机票'], ['交通出行', '加油停车'], ['交通出行', '过路费'],
  ['购物消费', '日用百货'], ['购物消费', '服装鞋帽'], ['购物消费', '数码电器'], ['购物消费', '美妆护肤'], ['购物消费', '书本文具'], ['购物消费', '母婴用品'],
  ['居家生活', '房租房贷'], ['居家生活', '水电燃气'], ['居家生活', '物业宽带'], ['居家生活', '家具家居'], ['居家生活', '清洁保洁'], ['居家生活', '绿植宠物'],
  ['娱乐休闲', '电影演出'], ['娱乐休闲', '游戏充值'], ['娱乐休闲', '旅行度假'], ['娱乐休闲', '运动健身'], ['娱乐休闲', '爱好收藏'], ['娱乐休闲', '会员订阅'],
  ['医疗健康', '门诊看病'], ['医疗健康', '药店买药'], ['医疗健康', '体检保健'], ['医疗健康', '牙科眼科'], ['医疗健康', '心理咨询'],
  ['人情社交', '红白喜事'], ['人情社交', '礼物红包'], ['人情社交', '请客吃饭'], ['人情社交', '聚会活动'], ['人情社交', '捐赠公益'],
  ['学习成长', '培训课程'], ['学习成长', '书本资料'], ['学习成长', '考试报名'], ['学习成长', '知识付费'], ['学习成长', '技能工具'],
  ['金融保险', '保险保费'], ['金融保险', '理财投资'], ['金融保险', '信用卡年费'], ['金融保险', '贷款还款'], ['金融保险', '税费'],
  ['其他支出', '杂项'], ['其他支出', '待调整']
]

export async function openDatabase(): Promise<void> {
  if (db) return
  // 用 createRequire 从主进程定位 sql.js 的真实安装路径,避免 __dirname 在打包后失效
  const sqljsDir = path.dirname(require.resolve('sql.js'))
  const wasmPath = path.join(sqljsDir, 'sql-wasm.wasm')
  SQL = await initSqlJs({ locateFile: () => wasmPath })
  const file = dbPath()
  if (fs.existsSync(file)) {
    const buf = fs.readFileSync(file)
    db = new SQL.Database(new Uint8Array(buf))
  } else {
    db = new SQL.Database()
    SCHEMA.forEach(sql => runRaw(sql))
    seedCategories()
    persist()
  }
  SCHEMA.forEach(sql => runRaw(sql)) // 已有库也确保表存在
}

function runRaw(sql: string, params: unknown[] = []): void {
  if (!db) throw new Error('database not open')
  db.run(sql, params as never)
}

export function persist(): void {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(dbPath(), Buffer.from(data))
}

function seedCategories(): void {
  for (const [l1, l2] of DEFAULT_CATEGORIES) {
    runRaw('INSERT OR IGNORE INTO categories (l1, l2, sort) VALUES (?, ?, 0)', [l1, l2])
  }
}

// ---- 对外 API ----

export function listCategories(): { l1: string; l2: string }[] {
  if (!db) return []
  const stmt = db.prepare('SELECT l1, l2 FROM categories ORDER BY l1, sort, l2')
  const rows: { l1: string; l2: string }[] = []
  while (stmt.step()) {
    const o = stmt.getAsObject() as { l1: string; l2: string }
    rows.push(o)
  }
  stmt.free()
  return rows
}

export interface Expense {
  id?: number
  amount: number    // 元(对外用元,内部存分)
  l1: string
  l2: string
  note?: string
  spentAt: string
  createdAt?: string
}

export function addExpense(e: Omit<Expense, 'id' | 'createdAt'>): number {
  if (!db) throw new Error('database not open')
  const cents = Math.round(e.amount * 100)
  const createdAt = new Date().toISOString()
  runRaw(
    'INSERT INTO expenses (amount, l1, l2, note, spent_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [cents, e.l1, e.l2, e.note ?? '', e.spentAt, createdAt]
  )
  const r = db.exec('SELECT last_insert_rowid() AS id')[0]
  const id = r ? Number(r.values[0][0]) : 0
  persist()
  return id
}

export function deleteExpense(id: number): void {
  runRaw('DELETE FROM expenses WHERE id = ?', [id])
  persist()
}

export function listExpenses(filter?: { yearMonth?: string; l1?: string; l2?: string }): Expense[] {
  if (!db) return []
  let sql = 'SELECT id, amount, l1, l2, note, spent_at, created_at FROM expenses'
  const params: unknown[] = []
  const where: string[] = []
  if (filter?.yearMonth) {
    where.push("strftime('%Y-%m', spent_at) = ?")
    params.push(filter.yearMonth)
  }
  if (filter?.l1) {
    where.push('l1 = ?')
    params.push(filter.l1)
  }
  if (filter?.l2) {
    where.push('l2 = ?')
    params.push(filter.l2)
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ')
  sql += ' ORDER BY spent_at DESC, id DESC'
  const stmt = db.prepare(sql)
  // sql.js 的 bind 只接受「数组」或「对象」;传单个值会静默不绑,导致条件恒为 NULL 查不到数据
  stmt.bind(params as never)
  const rows: Expense[] = []
  while (stmt.step()) {
    const o = stmt.getAsObject() as Record<string, number | string>
    rows.push({
      id: Number(o.id),
      amount: Number(o.amount) / 100,
      l1: String(o.l1),
      l2: String(o.l2),
      note: String(o.note ?? ''),
      spentAt: String(o.spent_at),
      createdAt: String(o.created_at)
    })
  }
  stmt.free()
  return rows
}

export function updateExpense(id: number, e: Omit<Expense, 'id' | 'createdAt'>): void {
  const cents = Math.round(e.amount * 100)
  runRaw(
    'UPDATE expenses SET amount=?, l1=?, l2=?, note=?, spent_at=? WHERE id=?',
    [cents, e.l1, e.l2, e.note ?? '', e.spentAt, id]
  )
  persist()
}

export interface L1Summary { l1: string; amount: number }
export function summaryByL1(yearMonth: string): L1Summary[] {
  if (!db) return []
  const stmt = db.prepare(
    `SELECT l1, SUM(amount) AS s FROM expenses
     WHERE strftime('%Y-%m', spent_at)=?
     GROUP BY l1 ORDER BY s DESC`
  )
  stmt.bind([yearMonth])
  const rows: L1Summary[] = []
  while (stmt.step()) {
    const o = stmt.getAsObject() as { l1: string; s: number }
    rows.push({ l1: String(o.l1), amount: Number(o.s) / 100 })
  }
  stmt.free()
  return rows
}

export interface DailySummary { day: string; amount: number }
export function summaryByDay(yearMonth: string): DailySummary[] {
  if (!db) return []
  const stmt = db.prepare(
    `SELECT spent_at AS day, SUM(amount) AS s FROM expenses
     WHERE strftime('%Y-%m', spent_at)=?
     GROUP BY spent_at ORDER BY spent_at`
  )
  stmt.bind([yearMonth])
  const rows: DailySummary[] = []
  while (stmt.step()) {
    const o = stmt.getAsObject() as { day: string; s: number }
    rows.push({ day: String(o.day), amount: Number(o.s) / 100 })
  }
  stmt.free()
  return rows
}

// 按本地时区格式化成 YYYY-MM-DD。不能用 toISOString(),它按 UTC 算,东八区会退回前一天
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// 周趋势:按 ISO 周分组(周一为起),返回该月内每周的合计与起止日期标签
export interface WeeklySummary { weekLabel: string; amount: number }
export function summaryByWeek(yearMonth: string): WeeklySummary[] {
  if (!db) return []
  // strftime('%w') 周日=0;转成周一为 1..7,再用日偏移归到本周一
  const stmt = db.prepare(
    `SELECT spent_at, amount FROM expenses WHERE strftime('%Y-%m', spent_at)=? ORDER BY spent_at`
  )
  stmt.bind([yearMonth])
  const buckets = new Map<string, number>()
  while (stmt.step()) {
    const o = stmt.getAsObject() as { spent_at: string; amount: number }
    const d = new Date(String(o.spent_at) + 'T00:00:00')
    const dow = (d.getDay() + 6) % 7 // 周一=0..周日=6
    const monday = new Date(d)
    monday.setDate(d.getDate() - dow)
    const key = ymd(monday)
    buckets.set(key, (buckets.get(key) ?? 0) + Number(o.amount))
  }
  stmt.free()
  const rows: Array<WeeklySummary & { monday: string }> = []
  for (const [monday, cents] of buckets) {
    const sun = new Date(monday + 'T00:00:00')
    sun.setDate(sun.getDate() + 6)
    rows.push({
      monday,
      weekLabel: `${monday.slice(5)}~${ymd(sun).slice(5)}`,
      amount: cents / 100
    })
  }
  return rows
    .sort((a, b) => a.monday.localeCompare(b.monday))
    .map(({ weekLabel, amount }) => ({ weekLabel, amount }))
}

export function monthTotal(yearMonth: string): number {
  if (!db) return 0
  const r = db.exec(
    `SELECT SUM(amount) FROM expenses WHERE strftime('%Y-%m', spent_at)=?`,
    [yearMonth]
  )
  if (!r.length) return 0
  const v = r[0].values[0][0]
  return v === null ? 0 : Number(v) / 100
}

export function availableMonths(): string[] {
  if (!db) return []
  const stmt = db.prepare(
    `SELECT DISTINCT strftime('%Y-%m', spent_at) AS ym FROM expenses ORDER BY ym DESC`
  )
  const rows: string[] = []
  while (stmt.step()) {
    const o = stmt.getAsObject() as { ym: string }
    rows.push(String(o.ym))
  }
  stmt.free()
  return rows
}

// 月趋势:不受当前所选月份限制,返回最近 N 个有记录的月份(升序)
export interface MonthlySummary { month: string; amount: number }
export function summaryByMonth(limit = 12): MonthlySummary[] {
  if (!db) return []
  const stmt = db.prepare(
    `SELECT strftime('%Y-%m', spent_at) AS m, SUM(amount) AS s FROM expenses
     GROUP BY m ORDER BY m DESC LIMIT ?`
  )
  stmt.bind([limit])
  const rows: MonthlySummary[] = []
  while (stmt.step()) {
    const o = stmt.getAsObject() as { m: string; s: number }
    rows.push({ month: String(o.m), amount: Number(o.s) / 100 })
  }
  stmt.free()
  return rows.reverse()
}

export interface L2Summary { l1: string; l2: string; amount: number }
export function summaryByL2(yearMonth: string): L2Summary[] {
  if (!db) return []
  const stmt = db.prepare(
    `SELECT l1, l2, SUM(amount) AS s FROM expenses
     WHERE strftime('%Y-%m', spent_at)=?
     GROUP BY l1, l2 ORDER BY s DESC`
  )
  stmt.bind([yearMonth])
  const rows: L2Summary[] = []
  while (stmt.step()) {
    const o = stmt.getAsObject() as { l1: string; l2: string; s: number }
    rows.push({ l1: String(o.l1), l2: String(o.l2), amount: Number(o.s) / 100 })
  }
  stmt.free()
  return rows
}

export function getSetting(key: string): string | null {
  if (!db) return null
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  stmt.bind([key])
  let val: string | null = null
  if (stmt.step()) {
    val = String((stmt.getAsObject() as { value: string }).value)
  }
  stmt.free()
  return val
}

export function setSetting(key: string, value: string): void {
  runRaw('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  persist()
}

export function exportExpensesCSV(yearMonth?: string): string {
  const expenses = listExpenses({ yearMonth })
  const headers = ['ID', '日期', '一级分类', '二级分类', '金额(元)', '备注', '创建时间']
  const rows = expenses.map(e => [
    e.id,
    e.spentAt,
    `"${e.l1.replace(/"/g, '""')}"`,
    `"${e.l2.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
    `"${(e.note || '').replace(/"/g, '""')}"`,
    e.createdAt
  ])
  return '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

export function importExpenses(list: Array<Omit<Expense, 'id' | 'createdAt'>>): number {
  if (!db) return 0
  let count = 0
  for (const e of list) {
    if (e.amount > 0 && e.l1 && e.l2 && e.spentAt) {
      addExpense(e)
      count++
    }
  }
  return count
}


