'use client'
import { useApp } from './context'
import { CategoryBadge } from './ui'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { ArrowLeftRight } from 'lucide-react'

export default function TransactionRow({ tx, onClick, showDate = false }) {
  const { t, fmt, accounts = [], home, lang, convertToHome } = useApp()
  if (!tx) return null
  const isExpense = tx.type === 'expense'
  const isTransfer = tx.type === 'transfer'
  const acc = accounts.find((a) => a.id === tx.account_id)
  const toAcc = accounts.find((a) => a.id === tx.to_account_id)
  const title = tx.merchant || tx.note || t(`cat_${tx.category || 'other'}`)
  const foreign = tx.currency && tx.currency !== home
  const homeAmount = convertToHome ? convertToHome(tx.amount, tx.currency) : tx.home_currency_amount
  const d = tx.date ? new Date(tx.date) : null
  const timeStr = d ? d.toLocaleTimeString(lang === 'en' ? 'en-US' : 'id-ID', { hour: '2-digit', minute: '2-digit' }) : ''
  const dateStr = d && showDate ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''

  const sub = [
    isTransfer ? `${acc?.name || '?'} → ${toAcc?.name || '?'}` : t(`cat_${tx.category || 'other'}`),
    !isTransfer && acc?.name,
    dateStr || timeStr,
  ].filter(Boolean).join(' · ')

  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left active:opacity-70 transition" data-testid="transaction-row">
      {isTransfer ? (
        <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0"><ArrowLeftRight size={18} /></div>
      ) : (
        <CategoryBadge id={tx.category} className={cn(!isExpense && 'bg-muted text-foreground')} />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('font-bold text-[15px] tabular-nums', isExpense ? 'text-foreground' : isTransfer ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400')}>
          {isExpense ? '-' : isTransfer ? '' : '+'}{fmt(tx.amount, tx.currency)}
        </p>
        {foreign ? (
          <span className="inline-block mt-0.5 text-[10px] font-semibold rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground tabular-nums">
            ≈ {fmt(homeAmount, home)} {getCurrency(tx.currency)?.flag}
          </span>
        ) : null}
      </div>
    </button>
  )
}
