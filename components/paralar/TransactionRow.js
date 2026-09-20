'use client'
import { useApp } from './context'
import { CategoryBadge } from './ui'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { ArrowLeftRight } from 'lucide-react'

// Safe time/date formatting — never throws on null/invalid values.
const safeTime = (dateStr, locale) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
const safeDay = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  } catch {
    return 'Recent'
  }
}

export default function TransactionRow({ tx, onClick, showDate = false }) {
  const { t, fmt, accounts, home, lang, convertToHome } = useApp()
  if (!tx) return null

  const accList = Array.isArray(accounts) ? accounts : []
  const isExpense = tx?.type === 'expense'
  const isTransfer = tx?.type === 'transfer'
  const acc = accList.find((a) => a?.id === tx?.account_id)
  const toAcc = accList.find((a) => a?.id === tx?.to_account_id)
  const title = tx?.merchant || tx?.note || (t ? t(`cat_${tx?.category || 'other'}`) : (tx?.category || 'Other'))
  const foreign = tx?.currency && tx?.currency !== home

  // Guard conversion — only show ≈ home amount when we actually have a number.
  let homeAmount = null
  try {
    homeAmount = typeof convertToHome === 'function' ? convertToHome(tx?.amount, tx?.currency) : tx?.converted_amount
  } catch { homeAmount = null }
  const showHomeApprox = foreign && typeof homeAmount === 'number' && !isNaN(homeAmount)

  const locale = lang === 'en' ? 'en-US' : lang === 'tr' ? 'tr-TR' : lang === 'ms' ? 'ms-MY' : 'id-ID'
  const timeStr = safeTime(tx?.date, locale)
  const dateStr = showDate ? safeDay(tx?.date) : ''

  const safeFmt = (amount, code) => {
    try { return typeof fmt === 'function' ? fmt(amount, code) : String(amount ?? '') } catch { return String(amount ?? '') }
  }

  const sub = [
    isTransfer ? `${acc?.name || '?'} → ${toAcc?.name || '?'}` : (t ? t(`cat_${tx?.category || 'other'}`) : (tx?.category || 'Other')),
    !isTransfer && acc?.name,
    dateStr || timeStr,
  ].filter(Boolean).join(' · ')

  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-3 text-left active:opacity-70 transition" data-testid="transaction-row">
      {isTransfer ? (
        <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center shrink-0"><ArrowLeftRight size={18} /></div>
      ) : (
        <CategoryBadge id={tx?.category} className={cn(!isExpense && 'bg-muted text-foreground')} />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{sub}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('font-bold text-[15px] tabular-nums', isExpense ? 'text-foreground' : isTransfer ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400')}>
          {isExpense ? '-' : isTransfer ? '' : '+'}{safeFmt(tx?.amount, tx?.currency)}
        </p>
        {showHomeApprox ? (
          <span className="inline-block mt-0.5 text-[10px] font-semibold rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground tabular-nums">
            ≈ {safeFmt(homeAmount, home)} {getCurrency(tx?.currency)?.flag || ''}
          </span>
        ) : null}
      </div>
    </button>
  )
}
