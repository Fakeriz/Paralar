'use client'
import { useRef, useState } from 'react'
import { Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Receipt, Users, PieChart, FileText, Plus, ChevronRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Avatar, Card, SectionLabel, LogoBadge, EmptyState } from './ui'
import TransactionRow from './TransactionRow'
import { getTheme } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'

function Header() {
  const { t, profile, open, isGuest } = useApp()
  const first = (profile?.full_name || '').trim().split(' ')[0]
  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-3">
        <Avatar profile={profile} onClick={() => open('profile')} data-testid="avatar" />
        <div>
          <p className="text-lg font-bold leading-tight text-zinc-950 dark:text-white" data-testid="greeting">{t('hi')}, {first || t('user')}</p>
          {isGuest ? <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{t('guest_mode')}</p> : null}
        </div>
      </div>
      <button type="button" onClick={() => open('notifications')} className="h-10 w-10 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-900 dark:bg-[#1c1c1e] dark:border-white/10 dark:text-white flex items-center justify-center transition-colors" aria-label="notifications">
        <Bell size={18} />
      </button>
    </div>
  )
}

function BalanceCarousel() {
  const { t, fmt, home, stats, accounts = [], hideBalance, setHideBalance, open, convertToHome } = useApp()
  const ref = useRef(null)
  const [idx, setIdx] = useState(0)
  const slides = [{ id: 'total' }, ...accounts]
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const w = el.clientWidth
    setIdx(Math.round(el.scrollLeft / Math.max(1, w)))
  }
  const mask = (v) => (hideBalance ? '••••••' : v)

  return (
    <div className="mt-5">
      <div ref={ref} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-5 px-5 gap-3 scroll-px-5">
        {/* Total card - Light mode is crisp white with deep black text, dark mode is deep obsidian with clean white text */}
        <div className="snap-center shrink-0 w-full">
          <div className="relative rounded-2xl bg-white text-zinc-950 border border-zinc-200 dark:bg-[#0A0A0B] dark:text-white dark:border-white/10 p-5 min-h-[190px] overflow-hidden shadow-sm dark:shadow-none" data-testid="balance-card">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-zinc-100 dark:bg-white/[0.04] pointer-events-none" />
            <div className="absolute right-10 -bottom-16 h-40 w-40 rounded-full bg-zinc-50 dark:bg-white/[0.03] pointer-events-none" />
            <div className="flex items-center justify-between relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">{t('total_balance')} · {home}</p>
              <button type="button" onClick={() => setHideBalance(!hideBalance)} className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white p-1 transition-colors" aria-label="toggle balance" data-testid="toggle-balance">
                {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-4xl font-bold mt-3 tabular-nums tracking-tight text-zinc-950 dark:text-white relative" data-testid="total-balance">{mask(fmt(stats?.totalBalance || 0, home))}</p>
            <div className="grid grid-cols-2 gap-3 mt-6 relative">
              <div className="rounded-xl bg-zinc-100 dark:bg-white/[0.07] border border-zinc-200/60 dark:border-white/5 p-3">
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold uppercase tracking-wider"><ArrowDownLeft size={12} className="text-emerald-600 dark:text-emerald-400" /> {t('income')}</div>
                <p className="font-bold mt-1 tabular-nums text-zinc-950 dark:text-white">{mask(fmt(stats?.income || 0, home))}</p>
              </div>
              <div className="rounded-xl bg-zinc-100 dark:bg-white/[0.07] border border-zinc-200/60 dark:border-white/5 p-3">
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold uppercase tracking-wider"><ArrowUpRight size={12} className="text-rose-600 dark:text-rose-400" /> {t('spending')}</div>
                <p className="font-bold mt-1 tabular-nums text-zinc-950 dark:text-white">{mask(fmt(stats?.spending || 0, home))}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Account cards */}
        {accounts.map((a) => {
          const th = getTheme(a.theme)
          const cur = getCurrency(a.currency)
          const isGlacier = th.id === 'glacier'
          const isObsidian = th.id === 'obsidian'
          const titleCls = isGlacier ? 'text-zinc-950' : isObsidian ? 'text-white' : 'text-zinc-950 dark:text-white'
          const subCls = isGlacier ? 'text-zinc-600' : isObsidian ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-400'
          return (
            <div key={a.id} className="snap-center shrink-0 w-full">
              <div className={cn('relative rounded-2xl p-5 min-h-[190px] overflow-hidden shadow-sm flex flex-col justify-between', th.className)}>
                <div>
                  <div className="flex items-center justify-between">
                    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.12em]', subCls)}>{a.name}</p>
                    <LogoBadge logoId={a.logo} />
                  </div>
                  <p className={cn('text-4xl font-bold mt-3 tabular-nums tracking-tight', titleCls)}>{mask(fmt(a.balance, a.currency))}</p>
                  {a.currency !== home ? (
                    <p className={cn('text-xs mt-1 font-medium', subCls)}>≈ {mask(fmt(convertToHome(a.balance, a.currency), home))}</p>
                  ) : null}
                </div>
                <div className={cn('flex items-center justify-between text-xs font-medium pt-4', subCls)}>
                  <span>{cur.flag} {a.currency} · {cur.name}</span>
                  <span className="font-mono tracking-widest">•••• {String(a.id || '').slice(-4).toUpperCase()}</span>
                </div>
              </div>
            </div>
          )
        })}
        {/* Add account card */}
        <div className="snap-center shrink-0 w-full">
          <button type="button" onClick={() => open('newAccount')} className="w-full rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 min-h-[190px] flex flex-col items-center justify-center text-zinc-600 dark:text-zinc-400 gap-2 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors" data-testid="add-account-card">
            <div className="h-12 w-12 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center"><Plus size={22} /></div>
            <span className="text-sm font-semibold">{t('new_account')}</span>
          </button>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 mt-3">
        {[...slides, { id: 'add' }].map((s, i) => (
          <span key={s.id || i} className={cn('h-1.5 rounded-full transition-all', i === idx ? 'w-5 bg-zinc-950 dark:bg-white' : 'w-1.5 bg-zinc-300 dark:bg-zinc-700')} />
        ))}
      </div>
    </div>
  )
}

function QuickGrid() {
  const { t, open } = useApp()
  const items = [
    { id: 'bills', label: t('bills'), icon: FileText, onClick: () => toast(t('coming_soon')) },
    { id: 'receipts', label: t('receipts'), icon: Receipt, onClick: () => open('scan') },
    { id: 'split', label: t('bill_split'), icon: Users, onClick: () => open('split') },
    { id: 'analytics', label: t('analytics'), icon: PieChart, onClick: () => open('analytics') },
  ]
  return (
    <div className="grid grid-cols-4 gap-3 mt-6">
      {items.map((it) => (
        <button key={it.id} type="button" onClick={it.onClick} className="flex flex-col items-center gap-2" data-testid={`quick-${it.id}`}>
          <div className="h-14 w-14 rounded-2xl bg-zinc-100 border border-zinc-200/70 text-zinc-900 dark:bg-[#1c1c1e] dark:border-white/10 dark:text-white flex items-center justify-center active:scale-95 transition">
            <it.icon size={22} />
          </div>
          <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function HomeTab() {
  const { t, transactions = [], setTab, open, isGuest } = useApp()
  const recent = transactions.slice(0, 6)
  return (
    <div className="px-5 pb-28">
      <Header />
      {isGuest ? (
        <div className="mt-4 rounded-xl bg-zinc-100 border border-zinc-200 dark:bg-zinc-900 dark:border-white/10 px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2"><Sparkles size={12} /> {t('demo_banner')}</div>
      ) : null}
      <BalanceCarousel />
      <QuickGrid />

      <div className="flex items-center justify-between mt-8 mb-1">
        <SectionLabel>{t('recent_transactions')}</SectionLabel>
        <button type="button" onClick={() => setTab('transactions')} className="text-xs font-semibold flex items-center gap-0.5 text-zinc-950 dark:text-white">{t('see_all')} <ChevronRight size={14} /></button>
      </div>
      <Card className="px-4 divide-y divide-zinc-200/60 dark:divide-white/5">
        {recent.length === 0 ? (
          <EmptyState icon={Receipt} title={t('no_transactions')} subtitle={t('no_transactions_sub')} />
        ) : (
          recent.map((tx) => <TransactionRow key={tx.id} tx={tx} onClick={() => open('txDetail', tx)} />)
        )}
      </Card>
    </div>
  )
}
