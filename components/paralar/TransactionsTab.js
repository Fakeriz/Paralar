'use client'
import { useMemo, useState } from 'react'
import { Search, Receipt } from 'lucide-react'
import { useApp } from './context'
import { Segmented, Card, EmptyState, TextInput } from './ui'
import TransactionRow from './TransactionRow'

function dayKey(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export default function TransactionsTab() {
  const { t, transactions = [], open, fmt, home, convertToHome, lang } = useApp()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const list = transactions
      .filter((tx) => filter === 'all' || tx.type === filter)
      .filter((tx) => {
        if (!q) return true
        const s = `${tx.note || ''} ${tx.merchant || ''} ${tx.category || ''} ${tx.amount}`.toLowerCase()
        return s.includes(q.toLowerCase())
      })
    const map = new Map()
    list.forEach((tx) => {
      const k = dayKey(tx.date || tx.created_at)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(tx)
    })
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [transactions, filter, q])

  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  const labelFor = (k) => {
    if (k === today) return t('today')
    if (k === yesterday) return t('yesterday')
    const d = new Date(k)
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'tr' ? 'tr-TR' : 'id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="px-5 pb-28">
      <h1 className="text-2xl font-extrabold tracking-tight pt-6">{t('transactions')}</h1>
      <div className="relative mt-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
        groups.map(([k, list]) => {
          const net = list.reduce((s, tx) => {
            const v = convertToHome(tx.amount, tx.currency)
            return tx.type === 'expense' ? s - v : tx.type === 'income' ? s + v : s
          }, 0)
          return (
            <div key={k} className="mt-5">
              <div className="flex items-center justify-between mb-1 px-1">
                <p className="label-upper">{labelFor(k)}</p>
                <p className="text-xs font-semibold tabular-nums text-muted-foreground">{net < 0 ? '-' : '+'}{fmt(Math.abs(net), home)}</p>
              </div>
              <Card className="px-4 divide-y divide-border/40">
                {list.map((tx) => <TransactionRow key={tx.id} tx={tx} onClick={() => open('txDetail', tx)} />)}
              </Card>
            </div>
          )
        })
      )}
    </div>
  )
}
