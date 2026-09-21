'use client'
import { useMemo, useState } from 'react'
import { Share2, ChevronLeft, ChevronRight, PieChart as PieIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, CategoryBadge } from './ui'
import { convert } from '@/lib/rates'
import { cn } from '@/lib/utils'

export default function AnalyticsSheet({ open, onClose }) {
  const { t, home, fmt, transactions = [], accounts = [], rates } = useApp()

  const [period, setPeriod] = useState('Month') // 'Week' | 'Month' | 'Quarter' | 'Year'
  const [cursorDate, setCursorDate] = useState(() => new Date())
  const [selectedAcc, setSelectedAcc] = useState('all')

  // Date range based on selected period and cursorDate
  const range = useMemo(() => {
    const y = cursorDate.getFullYear()
    const m = cursorDate.getMonth()
    const d = cursorDate.getDate()

    if (period === 'Week') {
      const day = cursorDate.getDay()
      const diff = d - day + (day === 0 ? -6 : 1) // Monday start
      const start = new Date(y, m, diff, 0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    if (period === 'Quarter') {
      const q = Math.floor(m / 3)
      const start = new Date(y, q * 3, 1, 0, 0, 0, 0)
      const end = new Date(y, (q + 1) * 3, 0, 23, 59, 59, 999)
      return { start, end }
    }

    if (period === 'Year') {
      const start = new Date(y, 0, 1, 0, 0, 0, 0)
      const end = new Date(y, 11, 31, 23, 59, 59, 999)
      return { start, end }
    }

    // Default: Month
    const start = new Date(y, m, 1, 0, 0, 0, 0)
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }, [cursorDate, period])

  // Formatted period title for the < September 2026 > navigation bar
  const periodLabel = useMemo(() => {
    if (period === 'Week') {
      const s = range.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      const e = range.end.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      return `${s} – ${e}`
    }
    if (period === 'Quarter') {
      const q = Math.floor(cursorDate.getMonth() / 3) + 1
      return `Q${q} ${cursorDate.getFullYear()}`
    }
    if (period === 'Year') {
      return `${cursorDate.getFullYear()}`
    }
    return cursorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [cursorDate, period, range])

  const handlePrev = () => {
    const next = new Date(cursorDate)
    if (period === 'Week') next.setDate(next.getDate() - 7)
    else if (period === 'Quarter') next.setMonth(next.getMonth() - 3)
    else if (period === 'Year') next.setFullYear(next.getFullYear() - 1)
    else next.setMonth(next.getMonth() - 1)
    setCursorDate(next)
  }

  const handleNext = () => {
    const next = new Date(cursorDate)
    if (period === 'Week') next.setDate(next.getDate() + 7)
    else if (period === 'Quarter') next.setMonth(next.getMonth() + 3)
    else if (period === 'Year') next.setFullYear(next.getFullYear() + 1)
    else next.setMonth(next.getMonth() + 1)
    setCursorDate(next)
  }

  // All-time cash position
  const allTimeCash = useMemo(() => {
    if ((accounts || []).length > 0) {
      if (selectedAcc === 'all') {
        return (accounts || []).reduce((acc, a) => acc + convert(a?.balance ?? 0, a?.currency || home, home, rates), 0)
      }
      const target = (accounts || []).find((a) => a?.id === selectedAcc)
      return convert(target?.balance ?? 0, target?.currency || home, home, rates)
    }
    return (transactions || []).reduce((sum, tx) => {
      const amt = convert(tx?.amount ?? 0, tx?.currency || home, home, rates)
      return tx?.type === 'income' ? sum + amt : tx?.type === 'expense' ? sum - amt : sum
    }, 0)
  }, [accounts, selectedAcc, home, rates, transactions])

  // Transactions filtered by period and account
  const filteredTxs = useMemo(() => {
    return (transactions || []).filter((tx) => {
      if (selectedAcc !== 'all' && tx?.account_id !== selectedAcc) return false
      const d = new Date(tx?.date || tx?.created_at || 0)
      if (isNaN(d.getTime())) return false
      return d >= range.start && d <= range.end
    })
  }, [transactions, selectedAcc, range])

  // Financial calculations
  const periodIncome = useMemo(() => {
    return filteredTxs
      .filter((tx) => tx?.type === 'income')
      .reduce((sum, tx) => sum + convert(tx?.amount ?? 0, tx?.currency || home, home, rates), 0)
  }, [filteredTxs, home, rates])

  const periodExpense = useMemo(() => {
    return filteredTxs
      .filter((tx) => tx?.type === 'expense')
      .reduce((sum, tx) => sum + convert(tx?.amount ?? 0, tx?.currency || home, home, rates), 0)
  }, [filteredTxs, home, rates])

  const net = periodIncome - periodExpense
  const entryCount = filteredTxs.length

  const openingBal = Math.max(0, allTimeCash - periodIncome + periodExpense)

  const avgPerDay = useMemo(() => {
    const now = new Date()
    let days = Math.max(1, Math.round((range.end - range.start) / (1000 * 60 * 60 * 24)))
    if (now >= range.start && now <= range.end) {
      days = Math.max(1, Math.round((now - range.start) / (1000 * 60 * 60 * 24)) + 1)
    }
    return periodExpense > 0 ? periodExpense / days : 0
  }, [periodExpense, range])

  const topDayLabel = useMemo(() => {
    const expenseByDay = {}
    filteredTxs.forEach((tx) => {
      if (tx?.type === 'expense') {
        const dayKey = (tx?.date || '').slice(0, 10)
        if (dayKey) {
          expenseByDay[dayKey] = (expenseByDay[dayKey] || 0) + convert(tx?.amount ?? 0, tx?.currency || home, home, rates)
        }
      }
    })
    const sorted = Object.entries(expenseByDay).sort((a, b) => b[1] - a[1])
    if (!sorted.length || sorted[0][1] === 0) return '-'
    const d = new Date(sorted[0][0])
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
  }, [filteredTxs, home, rates])

  const catRows = useMemo(() => {
    const byCat = {}
    filteredTxs.forEach((tx) => {
      if (tx?.type === 'expense' && tx?.category) {
        byCat[tx.category] = (byCat[tx.category] || 0) + convert(tx?.amount ?? 0, tx?.currency || home, home, rates)
      }
    })
    return Object.entries(byCat).sort((a, b) => b[1] - a[1])
  }, [filteredTxs, home, rates])

  const handleShare = async () => {
    const text = `Paralar Report (${periodLabel})\nCash: ${fmt(allTimeCash, home)}\nIncome: +${fmt(periodIncome, home)}\nExpense: -${fmt(periodExpense, home)}\nNet: ${fmt(net, home)}`
    try {
      if (typeof navigator !== 'undefined' && navigator?.share) {
        await navigator.share({
          title: `Paralar Report - ${periodLabel}`,
          text
        })
      } else if (typeof navigator !== 'undefined' && navigator?.clipboard) {
        await navigator.clipboard.writeText(text)
        toast.success('Ringkasan laporan disalin ke clipboard!')
      } else {
        toast.info('Laporan siap diekspor')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.info('Ringkasan laporan siap')
      }
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      title=""
      left={
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          {t('cancel') || 'Batal'}
        </button>
      }
    >
      <div className="pt-1 pb-10">
        {/* Header Halaman */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Reports</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Personal income, spending, and cash flow</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-muted/60 border border-border/50 px-3 py-1 text-xs font-semibold text-foreground">
              Personal
            </span>
            <button
              type="button"
              onClick={handleShare}
              className="h-8 w-8 rounded-full bg-muted/60 border border-border/50 flex items-center justify-center text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              aria-label="Bagikan laporan"
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>

        {/* Filter Periode Waktu (Pill Bar Atas) */}
        <div className="flex bg-muted/40 border border-border/40 rounded-2xl p-1 gap-1 mb-4">
          {[
            { id: 'Week', label: 'Week' },
            { id: 'Month', label: 'Month' },
            { id: 'Quarter', label: 'Quarter' },
            { id: 'Year', label: 'Year' },
          ].map((p) => {
            const active = period === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'flex-1 py-2 text-xs transition-all rounded-xl text-center cursor-pointer',
                  active
                    ? 'bg-foreground text-background font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground font-semibold'
                )}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Selector Bulan & Periode (< September 2026 >) */}
        <div className="flex items-center justify-between px-2 mb-3">
          <button
            type="button"
            onClick={handlePrev}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            aria-label="Periode sebelumnya"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="font-bold text-[15px] text-foreground tracking-tight select-none">
            {periodLabel}
          </p>
          <button
            type="button"
            onClick={handleNext}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            aria-label="Periode berikutnya"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Filter Akun (Pills horizontal) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
          <button
            type="button"
            onClick={() => setSelectedAcc('all')}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
              selectedAcc === 'all'
                ? 'bg-foreground text-background font-bold shadow-sm'
                : 'bg-muted/40 border border-border/40 text-muted-foreground hover:text-foreground'
            )}
          >
            All accounts
          </button>
          {(accounts || []).map((acc) => (
            <button
              key={acc?.id}
              type="button"
              onClick={() => setSelectedAcc(acc?.id)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer',
                selectedAcc === acc?.id
                  ? 'bg-foreground text-background font-bold shadow-sm'
                  : 'bg-muted/40 border border-border/40 text-muted-foreground hover:text-foreground'
              )}
            >
              {acc?.name || 'Account'}
            </button>
          ))}
        </div>

        {/* Kartu Finansial Utama (ALL-TIME CASH POSITION) */}
        <div className="rounded-3xl bg-muted/30 border border-border/40 p-5 space-y-1 mb-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            ALL-TIME CASH POSITION
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
            {fmt(allTimeCash, home)}
          </p>
          <p className="text-xs text-muted-foreground font-medium pt-0.5 tabular-nums">
            Opening {fmt(openingBal, home)} + In {fmt(periodIncome, home)} - Out {fmt(periodExpense, home)}
          </p>
        </div>

        {/* Grid Metrik Finansial (2 Baris x 3 Kolom) */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {/* Baris 1: Income, Expense, Net */}
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Income</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
              +{fmt(periodIncome, home)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Expense</p>
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums truncate">
              -{fmt(periodExpense, home)}
            </p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Net</p>
            <p className={cn('text-sm font-bold tabular-nums truncate', net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {net >= 0 ? '+' : ''}{fmt(net, home)}
            </p>
          </div>

          {/* Baris 2: Entries, Avg / day, Top day */}
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Entries</p>
            <p className="text-sm font-bold text-foreground tabular-nums truncate">{entryCount}</p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Avg / day</p>
            <p className="text-sm font-bold text-foreground tabular-nums truncate">{fmt(avgPerDay, home)}</p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 flex flex-col justify-between min-h-[64px]">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">Top day</p>
            <p className="text-sm font-bold text-foreground tabular-nums truncate">{topDayLabel}</p>
          </div>
        </div>

        {/* Section SPENDING PACE */}
        <div className="mb-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            SPENDING PACE
          </p>
          <div className="rounded-3xl bg-muted/30 border border-border/40 p-5 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              SPENT SO FAR
            </p>
            <p className="text-2xl font-extrabold text-foreground tabular-nums">
              {fmt(periodExpense, home)}
            </p>
            <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Rata-rata: {fmt(avgPerDay, home)} / hari</span>
              <span>{entryCount} transaksi</span>
            </div>
          </div>
        </div>

        {/* TOP CATEGORIES breakdown */}
        {catRows.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              TOP CATEGORIES
            </p>
            <div className="space-y-3 rounded-3xl bg-muted/20 border border-border/40 p-4">
              {catRows.map(([cat, val]) => {
                const pct = Math.round((val / Math.max(1, periodExpense)) * 100)
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-3">
                      <CategoryBadge id={cat} size="sm" />
                      <span className="flex-1 font-semibold text-sm text-foreground truncate">
                        {t(`cat_${cat}`) || cat}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {fmt(val, home)}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium w-9 text-right tabular-nums">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted mt-1.5 ml-12 overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  )
}
