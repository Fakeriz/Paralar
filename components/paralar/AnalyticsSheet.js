'use client'
import { useMemo } from 'react'
import { useApp } from './context'
import { Sheet, CategoryBadge, EmptyState } from './ui'
import { PieChart as PieIcon } from 'lucide-react'
import { convert } from '@/lib/rates'

export default function AnalyticsSheet({ open, onClose }) {
  const { t, home, fmt, transactions = [], rates } = useApp()
  const data = useMemo(() => {
    const now = new Date()
    const inMonth = transactions.filter((tx) => { const d = new Date(tx.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && tx.type === 'expense' })
    const byCat = {}
    inMonth.forEach((tx) => { byCat[tx.category] = (byCat[tx.category] || 0) + convert(tx.amount, tx.currency, home, rates) })
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    const total = rows.reduce((s, [, v]) => s + v, 0)
    return { rows, total }
  }, [transactions, home, rates])

  return (
    <Sheet open={open} onClose={onClose} full title={t('analytics')}>
      {data.rows.length === 0 ? (
        <EmptyState icon={PieIcon} title={t('no_transactions')} subtitle={t('no_transactions_sub')} />
      ) : (
        <div className="pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 text-center">{t('spending')} · {t('this_month')}</p>
          <p className="text-center text-4xl font-extrabold mt-1 tabular-nums text-zinc-950 dark:text-white">{fmt(data.total, home)}</p>
          <div className="mt-6 space-y-3">
            {data.rows.map(([cat, val]) => {
              const pct = Math.round((val / Math.max(1, data.total)) * 100)
              return (
                <div key={cat}>
                  <div className="flex items-center gap-3">
                    <CategoryBadge id={cat} size="sm" />
                    <span className="flex-1 font-semibold text-sm text-zinc-950 dark:text-white">{t(`cat_${cat}`)}</span>
                    <span className="text-sm font-bold tabular-nums text-zinc-950 dark:text-white">{fmt(val, home)}</span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium w-9 text-right">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 mt-1.5 ml-12 overflow-hidden"><div className="h-full bg-zinc-950 dark:bg-white rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Sheet>
  )
}
