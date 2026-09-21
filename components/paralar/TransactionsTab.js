'use client'
import { useMemo, useState } from 'react'
import { Search, Receipt, MoreVertical, Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Segmented, Card, EmptyState, TextInput, ErrorBoundary } from './ui'
import SwipeTransactionRow from './SwipeTransactionRow'

const LOCALE_BY_LANG = { en: 'en-GB', tr: 'tr-TR', ms: 'ms-MY', id: 'id-ID' }

// Safe date -> yyyy-mm-dd key. Never throws on null/invalid input.
function dayKey(d) {
  if (!d) return 'unknown'
  try {
    const x = new Date(d)
    if (isNaN(x.getTime())) return 'unknown'
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  } catch {
    return 'unknown'
  }
}

function TransactionsContent() {
  const { t, transactions, open, fmt, home, convertToHome, lang, store, refresh } = useApp()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [openRowId, setOpenRowId] = useState(null)

  const handleDelete = async (tx) => {
    if (!tx?.id) return
    try {
      await store?.deleteTransaction?.(tx.id)
      if (refresh) await refresh()
      toast.success(t('deleted'))
    } catch { toast.error(t('error')) }
  }

  const list = Array.isArray(transactions) ? transactions : []

  const groups = useMemo(() => {
    const filtered = (list || [])
      .filter((tx) => filter === 'all' || tx?.type === filter)
      .filter((tx) => {
        if (!q) return true
        const s = `${tx?.note || ''} ${tx?.merchant || ''} ${tx?.category || ''} ${tx?.amount ?? ''}`.toLowerCase()
        return s.includes(q.toLowerCase())
      })
    const map = new Map()
    ;(filtered || []).forEach((tx) => {
      const k = dayKey(tx?.date || tx?.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(tx)
    })
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [list, filter, q])

  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))

  // Safe label — never crashes on null / invalid dates.
  const labelFor = (k) => {
    if (!k || k === 'unknown') return t('recent') !== 'recent' ? t('recent') : 'Recent'
    if (k === today) return t('today')
    if (k === yesterday) return t('yesterday')
    try {
      const d = new Date(k)
      if (isNaN(d.getTime())) return 'Recent'
      return d.toLocaleDateString(LOCALE_BY_LANG[lang] || 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    } catch {
      return 'Recent'
    }
  }

  // Safe multi-currency net: if conversion isn't ready, fall back to raw amount.
  const safeToHome = (amount, currency) => {
    const raw = Number(amount) || 0
    if (typeof convertToHome !== 'function') return raw
    try {
      const v = convertToHome(raw, currency)
      return typeof v === 'number' && !isNaN(v) ? v : raw
    } catch {
      return raw
    }
  }

  const safeFmt = (amount, code) => {
    try {
      return typeof fmt === 'function' ? fmt(amount, code) : String(amount ?? '')
    } catch {
      return String(amount ?? '')
    }
  }

  return (
    <div className="px-5 pb-28">
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">{t('transactions')}</h1>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="h-9 w-9 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 transition" aria-label="menu" data-testid="tx-menu"><MoreVertical size={20} /></button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-[45]" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-11 z-[46] w-52 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 shadow-xl overflow-hidden py-1">
                <button type="button" onClick={() => { setMenuOpen(false); open?.('exportTx') }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold text-zinc-950 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/5" data-testid="tx-menu-export"><Download size={17} strokeWidth={1.75} /> {t('export_transactions')}</button>
                <button type="button" onClick={() => { setMenuOpen(false); open?.('importTx') }} className="w-full flex items-center gap-3 px-4 py-3 text-left text-[15px] font-semibold text-zinc-950 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/5" data-testid="tx-menu-import"><Upload size={17} strokeWidth={1.75} /> {t('import_transactions')}</button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="relative mt-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="pl-10" data-testid="tx-search" />
      </div>
      <Segmented
        className="mt-3"
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[{ id: 'all', label: t('all') }, { id: 'expense', label: t('expense') }, { id: 'income', label: t('income_tab') }, { id: 'transfer', label: t('transfer') }]}
      />

      {groups.length === 0 ? (
        <Card className="mt-4"><EmptyState icon={Receipt} title={t('no_transactions')} subtitle={t('no_transactions_sub')} /></Card>
      ) : (
        (groups || []).map(([k, dayList]) => {
          const net = (dayList || []).reduce((s, tx) => {
            const v = safeToHome(tx?.amount, tx?.currency)
            return tx?.type === 'expense' ? s - v : tx?.type === 'income' ? s + v : s
          }, 0)
          return (
            <div key={k} className="mt-5">
              <div className="flex items-center justify-between mb-1 px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">{labelFor(k)}</p>
                <p className="text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">{net < 0 ? '-' : '+'}{safeFmt(Math.abs(net), home)}</p>
              </div>
              <Card className="px-4 divide-y divide-zinc-200/60 dark:divide-white/5">
                {(dayList || []).map((tx) => (
                  <SwipeTransactionRow
                    key={tx?.id || Math.random()}
                    tx={tx}
                    isOpen={openRowId === tx?.id}
                    onOpenChange={(v) => setOpenRowId(v ? tx?.id : null)}
                    onOpenDetail={() => open?.('txDetail', tx)}
                    onEdit={() => open?.('addTx', { ...tx, editId: tx?.id })}
                    onDelete={() => handleDelete(tx)}
                  />
                ))}
              </Card>
            </div>
          )
        })
      )}
    </div>
  )
}

export default function TransactionsTab() {
  const { t } = useApp()
  const fallback = (
    <div className="px-5 pb-28">
      <h1 className="text-2xl font-extrabold tracking-tight pt-6">{t ? t('transactions') : 'Transactions'}</h1>
      <Card className="mt-6">
        <EmptyState icon={Receipt} title={t ? t('no_transactions') : 'No transactions yet'} subtitle={t ? t('no_transactions_sub') : ''} />
      </Card>
    </div>
  )
  return (
    <ErrorBoundary fallback={fallback}>
      <TransactionsContent />
    </ErrorBoundary>
  )
}
