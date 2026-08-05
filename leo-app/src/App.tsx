import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'
import './App.css'

interface Cat { l1: string; l2: string }
interface Expense {
  id: number; amount: number; l1: string; l2: string
  note: string; spentAt: string; createdAt: string
}
interface L1Sum { l1: string; amount: number }
interface DaySum { day: string; amount: number }
interface WeekSum { weekLabel: string; amount: number }
interface MonthSum { month: string; amount: number }
interface L2Sum { l1: string; l2: string; amount: number }

const L1_META: Record<string, { icon: string; color: string }> = {
  '餐饮美食': { icon: '🍔', color: '#FF7D00' },
  '交通出行': { icon: '🚗', color: '#165DFF' },
  '购物消费': { icon: '🛍️', color: '#F5319D' },
  '居家生活': { icon: '🏠', color: '#00B42A' },
  '娱乐休闲': { icon: '🎮', color: '#722ED1' },
  '医疗健康': { icon: '🏥', color: '#F53F3F' },
  '人情社交': { icon: '🎁', color: '#FF9A2E' },
  '学习成长': { icon: '📚', color: '#00B5D8' },
  '金融保险': { icon: '💎', color: '#14C9C9' },
  '其他支出': { icon: '📦', color: '#86909C' }
}

const QUICK_PRESETS = [
  { label: '早餐 ¥15', l1: '餐饮美食', l2: '早餐', amount: 15 },
  { label: '午餐 ¥30', l1: '餐饮美食', l2: '午餐', amount: 30 },
  { label: '外卖 ¥40', l1: '餐饮美食', l2: '外卖', amount: 40 },
  { label: '地铁公交 ¥6', l1: '交通出行', l2: '地铁公交', amount: 6 },
  { label: '打车 ¥25', l1: '交通出行', l2: '打车网约车', amount: 25 },
  { label: '日用百货 ¥50', l1: '购物消费', l2: '日用百货', amount: 50 },
  { label: '咖啡饮料 ¥18', l1: '餐饮美食', l2: '零食饮料', amount: 18 }
]

function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function currentYM(): string { return today().slice(0, 7) }

function formatDayOfWeek(dateStr: string): string {
  const weeks = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const d = new Date(dateStr + 'T00:00:00')
  return weeks[d.getDay()] || ''
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [cats, setCats] = useState<Cat[]>([])
  const [l1, setL1] = useState('')
  const [l2, setL2] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [spentAt, setSpentAt] = useState(today())
  const [editingId, setEditingId] = useState<number | null>(null)

  const [ym, setYm] = useState(currentYM())
  const [months, setMonths] = useState<string[]>([currentYM()])
  
  // 列表筛选与搜索
  const [fL1, setFL1] = useState('')
  const [fL2, setFL2] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')

  // 统计数据
  const [list, setList] = useState<Expense[]>([])
  const [l1sum, setL1sum] = useState<L1Sum[]>([])
  const [daySum, setDaySum] = useState<DaySum[]>([])
  const [weekSum, setWeekSum] = useState<WeekSum[]>([])
  const [monthSum, setMonthSum] = useState<MonthSum[]>([])
  const [l2sum, setL2sum] = useState<L2Sum[]>([])
  const [trendMode, setTrendMode] = useState<'day' | 'week' | 'month'>('day')
  const [total, setTotal] = useState(0)
  const [monthlyBudget, setMonthlyBudget] = useState(3000)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [tempBudgetInput, setTempBudgetInput] = useState('3000')
  const [msg, setMsg] = useState('')

  const l1Options = useMemo(() => [...new Set(cats.map(c => c.l1))], [cats])
  const l2Options = useMemo(() => cats.filter(c => c.l1 === l1).map(c => c.l2), [cats, l1])
  const fL2Options = useMemo(() => cats.filter(c => c.l1 === fL1).map(c => c.l2), [cats, fL1])

  // 加载主题与初始化设置
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 加载分类与预算
  useEffect(() => {
    void (async () => {
      if (window.leo) {
        const c = await window.leo.categories()
        setCats(c)
        const b = await window.leo.getSetting('monthly_budget')
        if (b) {
          const bNum = Number(b)
          if (bNum > 0) {
            setMonthlyBudget(bNum)
            setTempBudgetInput(String(bNum))
          }
        }
      }
    })()
  }, [])

  useEffect(() => { if (l1Options.length && !l1) setL1(l1Options[0]) }, [l1Options, l1])
  useEffect(() => { if (l2Options.length && !l2) setL2(l2Options[0]) }, [l2Options, l2])

  // 刷新所有数据
  async function refresh(): Promise<void> {
    if (!window.leo) return
    const [ls, ms, l1s, ds, ws, mos, l2s, tot] = await Promise.all([
      window.leo.listExpenses({ yearMonth: ym, l1: fL1 || undefined, l2: fL2 || undefined }),
      window.leo.availableMonths(),
      window.leo.summaryByL1(ym),
      window.leo.summaryByDay(ym),
      window.leo.summaryByWeek(ym),
      window.leo.summaryByMonth(12),
      window.leo.summaryByL2(ym),
      window.leo.monthTotal(ym)
    ])
    setList(ls)
    setMonths(ms.length ? ms : [currentYM()])
    setL1sum(l1s)
    setDaySum(ds)
    setWeekSum(ws)
    setMonthSum(mos)
    setL2sum(l2s)
    setTotal(tot)
  }

  useEffect(() => { void refresh() }, [ym, fL1, fL2])

  // 列表本地过滤与排序
  const filteredList = useMemo(() => {
    let result = [...list]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(e =>
        e.note.toLowerCase().includes(q) ||
        e.l1.toLowerCase().includes(q) ||
        e.l2.toLowerCase().includes(q) ||
        String(e.amount).includes(q)
      )
    }
    result.sort((a, b) => {
      if (sortBy === 'date_desc') return b.spentAt.localeCompare(a.spentAt) || b.id - a.id
      if (sortBy === 'date_asc') return a.spentAt.localeCompare(b.spentAt) || a.id - b.id
      if (sortBy === 'amount_desc') return b.amount - a.amount
      if (sortBy === 'amount_asc') return a.amount - b.amount
      return 0
    })
    return result
  }, [list, search, sortBy])

  // KPI 统计指标计算
  const listTotal = useMemo(() => filteredList.reduce((s, e) => s + e.amount, 0), [filteredList])
  const maxExpense = useMemo(() => (list.length ? Math.max(...list.map(e => e.amount)) : 0), [list])
  const daysInMonth = useMemo(() => {
    const [y, m] = ym.split('-').map(Number)
    const now = new Date()
    if (y === now.getFullYear() && m === now.getMonth() + 1) {
      return now.getDate()
    }
    return new Date(y, m, 0).getDate()
  }, [ym])
  const dailyAverage = useMemo(() => (daysInMonth ? total / daysInMonth : 0), [total, daysInMonth])
  const budgetPercent = useMemo(() => (monthlyBudget > 0 ? Math.min(100, Math.round((total / monthlyBudget) * 100)) : 0), [total, monthlyBudget])

  function resetForm(): void {
    setAmount('')
    setNote('')
    setSpentAt(today())
    setEditingId(null)
    setMsg('')
  }

  async function onSave(): Promise<void> {
    const n = Number(amount)
    if (!n || n <= 0) { setMsg('请输入有效金额'); return }
    if (!l1 || !l2) { setMsg('请选择完分类'); return }
    const payload = { amount: n, l1, l2, note: note.trim(), spentAt }
    if (editingId) {
      await window.leo.updateExpense(editingId, payload)
      setMsg('已成功修改 ✓')
    } else {
      await window.leo.addExpense(payload)
      setMsg('记账成功 ✓')
    }
    resetForm()
    void refresh()
  }

  function onApplyPreset(p: typeof QUICK_PRESETS[0]): void {
    setL1(p.l1)
    setL2(p.l2)
    setAmount(String(p.amount))
    setMsg(`已套用预设: ${p.label}`)
  }

  function onEdit(e: Expense): void {
    setEditingId(e.id)
    setAmount(String(e.amount))
    setL1(e.l1)
    setL2(e.l2)
    setNote(e.note)
    setSpentAt(e.spentAt)
    setMsg('正在修改该笔记录')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onDelete(id: number): Promise<void> {
    if (confirm('确认删除这笔支出记录吗？')) {
      await window.leo.deleteExpense(id)
      if (editingId === id) resetForm()
      void refresh()
    }
  }

  async function onSaveBudget(): Promise<void> {
    const val = Number(tempBudgetInput)
    if (val > 0) {
      setMonthlyBudget(val)
      await window.leo.setSetting('monthly_budget', String(val))
      setShowBudgetModal(false)
    }
  }

  async function onExportCSV(): Promise<void> {
    const ok = await window.leo.exportCSV(ym)
    if (ok) setMsg('CSV 导出成功 ✓')
  }

  async function onGenerateSampleData(): Promise<void> {
    const currentYearMonth = ym
    const sampleExpenses = [
      { amount: 16.5, l1: '餐饮美食', l2: '早餐', note: '肉包 + 豆浆', spentAt: `${currentYearMonth}-01` },
      { amount: 35.0, l1: '餐饮美食', l2: '午餐', note: '黄焖鸡米饭', spentAt: `${currentYearMonth}-01` },
      { amount: 6.0, l1: '交通出行', l2: '地铁公交', note: '通勤地铁', spentAt: `${currentYearMonth}-02` },
      { amount: 128.0, l1: '购物消费', l2: '日用百货', note: '纸巾与洗发水', spentAt: `${currentYearMonth}-03` },
      { amount: 45.0, l1: '娱乐休闲', l2: '电影演出', note: '周末电影票', spentAt: `${currentYearMonth}-04` },
      { amount: 260.0, l1: '人情社交', l2: '请客吃饭', note: '朋友小聚', spentAt: `${currentYearMonth}-05` },
      { amount: 15.0, l1: '餐饮美食', l2: '零食饮料', note: '冰美式咖啡', spentAt: `${currentYearMonth}-06` },
      { amount: 28.5, l1: '交通出行', l2: '打车网约车', note: '加班打车', spentAt: `${currentYearMonth}-07` },
      { amount: 99.0, l1: '学习成长', l2: '知识付费', note: '技术书籍买一送一', spentAt: `${currentYearMonth}-08` },
      { amount: 1500.0, l1: '居家生活', l2: '房租房贷', note: '月度房租合租', spentAt: `${currentYearMonth}-10` },
      { amount: 88.0, l1: '医疗健康', l2: '药店买药', note: '感冒药与维生素C', spentAt: `${currentYearMonth}-12` },
      { amount: 42.0, l1: '餐饮美食', l2: '外卖', note: '麻辣烫外卖', spentAt: `${currentYearMonth}-14` }
    ]
    await window.leo.importExpenses(sampleExpenses)
    setMsg('示例体验数据生成完成 ✓')
    void refresh()
  }

  const ymLabel = `${ym.slice(0, 4)}年${ym.slice(5)}月`

  return (
    <div className="app-container">
      {/* 顶栏 Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-logo">💰</div>
          <div className="brand-text">
            <h1>Leo记账</h1>
            <span className="brand-sub">本地优先 · 智能个人理财助手</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-secondary btn-sm" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
            {theme === 'light' ? '🌙 深色模式' : '☀️ 浅色模式'}
          </button>
          <button className="btn-secondary btn-sm" onClick={onExportCSV}>
            📥 导出CSV
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowBudgetModal(true)}>
            ⚙️ 设置预算
          </button>
        </div>
      </header>

      {/* KPI 数据卡片 */}
      <section className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-header">
            <span className="kpi-title">本月总支出 ({ymLabel})</span>
            <span className="kpi-icon">💸</span>
          </div>
          <div className="kpi-value">¥{total.toFixed(2)}</div>
          <div className="budget-bar-wrapper">
            <div className="budget-info">
              <span>预算 ¥{monthlyBudget}</span>
              <span>已用 {budgetPercent}%</span>
            </div>
            <div className="budget-progress-track">
              <div
                className={`budget-progress-fill ${budgetPercent > 90 ? 'danger' : budgetPercent > 75 ? 'warning' : ''}`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">日均支出</span>
            <span className="kpi-icon">📅</span>
          </div>
          <div className="kpi-value">¥{dailyAverage.toFixed(2)}</div>
          <div className="kpi-sub">按该月 {daysInMonth} 天计算</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">最高单笔花销</span>
            <span className="kpi-icon">🏷️</span>
          </div>
          <div className="kpi-value">¥{maxExpense.toFixed(2)}</div>
          <div className="kpi-sub">本月最大开销</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">记账总笔数</span>
            <span className="kpi-icon">📝</span>
          </div>
          <div className="kpi-value">{list.length} <span className="unit">笔</span></div>
          <div className="kpi-sub">已记录的有效消费</div>
        </div>
      </section>

      {/* 主面板: 记一笔表单 & 快速预设 */}
      <section className="card glass-card form-section">
        <div className="card-header">
          <h2>{editingId ? '✏️ 编辑记录' : '➕ 记一笔'}</h2>
          {editingId && <button className="btn-text" onClick={resetForm}>取消编辑</button>}
        </div>

        {/* 快捷按钮 */}
        {!editingId && (
          <div className="preset-bar">
            <span className="preset-label">快捷小记:</span>
            <div className="preset-chips">
              {QUICK_PRESETS.map((p, idx) => (
                <button key={idx} className="preset-chip" onClick={() => onApplyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-grid">
          <div className="form-group">
            <label>金额 (人民币 ¥)</label>
            <div className="input-with-symbol">
              <span className="symbol">¥</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label>消费日期</label>
            <input type="date" value={spentAt} onChange={e => setSpentAt(e.target.value)} />
          </div>

          <div className="form-group">
            <label>一级分类</label>
            <select value={l1} onChange={e => { setL1(e.target.value); setL2('') }}>
              {l1Options.map(x => <option key={x} value={x}>{(L1_META[x]?.icon || '') + ' ' + x}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>二级分类</label>
            <select value={l2} onChange={e => setL2(e.target.value)}>
              {l2Options.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row-bottom">
          <div className="form-group flex-grow">
            <label>备注 (可选)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="添加买物说明、商户名称等..."
            />
          </div>
          <button className="btn-primary" onClick={onSave}>
            {editingId ? '保存修改' : '确认记一笔'}
          </button>
        </div>

        {msg && <div className="toast-msg">{msg}</div>}
      </section>

      {/* 账单列表与筛选 */}
      <section className="card glass-card">
        <div className="card-header list-header">
          <div className="list-title">
            <h2>📜 消费明细</h2>
            <select value={ym} onChange={e => setYm(e.target.value)} className="select-month">
              {(months.includes(ym) ? months : [ym, ...months]).map(m =>
                <option key={m} value={m}>{m.slice(0, 4)}年{m.slice(5)}月</option>
              )}
            </select>
          </div>
          <span className="list-subtotal">筛选小计: <strong>¥{listTotal.toFixed(2)}</strong></span>
        </div>

        {/* 筛选过滤工具条 */}
        <div className="filter-toolbar">
          <div className="filter-item">
            <input
              type="text"
              placeholder="🔍 搜索备注、分类或金额..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-item">
            <select value={fL1} onChange={e => { setFL1(e.target.value); setFL2('') }}>
              <option value="">全部分类</option>
              {l1Options.map(x => <option key={x} value={x}>{(L1_META[x]?.icon || '') + ' ' + x}</option>)}
            </select>
          </div>

          <div className="filter-item">
            <select value={fL2} onChange={e => setFL2(e.target.value)} disabled={!fL1}>
              <option value="">{fL1 ? '子类全选' : '先选一级分类'}</option>
              {fL2Options.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="filter-item">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
              <option value="date_desc">📅 日期从新到旧</option>
              <option value="date_asc">📅 日期从旧到新</option>
              <option value="amount_desc">💰 金额从高到低</option>
              <option value="amount_asc">💰 金额从低到高</option>
            </select>
          </div>

          {(fL1 || fL2 || search) && (
            <button className="btn-text" onClick={() => { setFL1(''); setFL2(''); setSearch('') }}>
              重置筛选
            </button>
          )}
        </div>

        {/* 明细列表表格 */}
        {filteredList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <p>该筛选条件下暂无记账记录</p>
            {list.length === 0 && (
              <button className="btn-secondary btn-sm" onClick={onGenerateSampleData}>
                ✨ 试一试：生成示例体验数据
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>消费日期</th>
                  <th>分类</th>
                  <th>金额</th>
                  <th>备注说明</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(e => {
                  const meta = L1_META[e.l1] || { icon: '🏷️', color: '#86909C' }
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="date-badge">
                          <span className="date-main">{e.spentAt}</span>
                          <span className="date-sub">{formatDayOfWeek(e.spentAt)}</span>
                        </div>
                      </td>
                      <td>
                        <span className="category-tag" style={{ backgroundColor: `${meta.color}15`, color: meta.color, borderColor: `${meta.color}30` }}>
                          <span className="tag-icon">{meta.icon}</span>
                          {e.l1} · {e.l2}
                        </span>
                      </td>
                      <td>
                        <span className="amount-text">¥{e.amount.toFixed(2)}</span>
                      </td>
                      <td>
                        <span className="note-text">{e.note || '—'}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btns">
                          <button className="btn-action edit" title="编辑" onClick={() => onEdit(e)}>
                            ✏️
                          </button>
                          <button className="btn-action del" title="删除" onClick={() => onDelete(e.id)}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 图表分析 */}
      {l1sum.length > 0 && (
        <section className="charts-grid">
          {/* 饼图 */}
          <div className="card glass-card chart-card">
            <h3>📊 大类支出占比 ({ymLabel})</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={l1sum} dataKey="amount" nameKey="l1" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={4} label>
                  {l1sum.map(entry => (
                    <Cell key={entry.l1} fill={L1_META[entry.l1]?.color || '#86909C'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 趋势柱状图 */}
          <div className="card glass-card chart-card">
            <div className="chart-header">
              <h3>📈 消费趋势分析</h3>
              <div className="tab-group">
                {(['day', 'week', 'month'] as const).map(m => (
                  <button
                    key={m}
                    className={`tab-btn ${trendMode === m ? 'active' : ''}`}
                    onClick={() => setTrendMode(m)}
                  >
                    {m === 'day' ? '按日' : m === 'week' ? '按周' : '按月对比'}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              {trendMode === 'day' ? (
                <BarChart data={daySum}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#165DFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : trendMode === 'week' ? (
                <BarChart data={weekSum}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#722ED1" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={monthSum}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                  <Bar dataKey="amount" fill="#00B42A" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* 二级分类条形图 */}
      {l2sum.length > 0 && (
        <section className="card glass-card">
          <h3>📌 细分小类排行明细 ({ymLabel})</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, l2sum.length * 30)}>
            <BarChart data={l2sum} layout="vertical" margin={{ left: 16, right: 24, top: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="l2" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
              <Bar dataKey="amount" fill="#F5319D" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* 设置预算弹窗 */}
      {showBudgetModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h3>⚙️ 设置月度预算</h3>
            <p className="modal-desc">设定每月预算开支上限，助手将为您提示消费进度。</p>
            <div className="form-group" style={{ margin: '16px 0' }}>
              <label>每月预算 (元)</label>
              <input
                type="number"
                value={tempBudgetInput}
                onChange={e => setTempBudgetInput(e.target.value)}
                placeholder="如: 3000"
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBudgetModal(false)}>取消</button>
              <button className="btn-primary" onClick={onSaveBudget}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
