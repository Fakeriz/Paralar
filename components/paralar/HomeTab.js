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
          <p className="text-lg font-bold leading-tight" data-testid="greeting">{t('hi')}, {first || t('user')}</p>
          {isGuest ? <p className="text-[11px] text-muted-foreground">{t('guest_mode')}</p> : null}
        </div>
      </div>
      <button type="button" onClick={() => open('notifications')} className="h-10 w-10 rounded-full bg-card border border-border/50 dark:border-white/5 flex items-center justify-center" aria-label="notifications">
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
        {/* Total card */}
        <div className="snap-center shrink-0 w-full">
          <div className="relative rounded-2xl bg-[#0A0A0B] text-white p-5 min-h-[190px] border border-white/10 overflow-hidden" data-testid="balance-card">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.04]" />
            <div className="absolute right-10 -bottom-16 h-40 w-40 rounded-full bg-white/[0.03]" />
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">{t('total_balance')} · {home}</p>
              <button type="button" onClick={() => setHideBalance(!hideBalance)} className="text-white/70 p-1" aria-label="toggle balance" data-testid="toggle-balance">
                {hideBalance ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-4xl font-bold mt-3 tabular-nums tracking-tight" data-testid="total-balance">{mask(fmt(stats?.totalBalance || 0, home))}</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="rounded-xl bg-white/[0.07] p-3">
                <div className="flex items-center gap-1.5 text-white/60 text-[10px] font-semibold uppercase tracking-wider"><ArrowDownLeft size={12} /> {t('income')}</div>
                <p className="font-bold mt-1 tabular-nums">{mask(fmt(stats?.income || 0, home))}</p>
              </div>
              <div className="rounded-xl bg-white/[0.07] p-3">
                <div className="flex items-center gap-1.5 text-white/60 text-[10px] font-semibold uppercase tracking-wider"><ArrowUpRight size={12} /> {t('spending')}</div>
                <p className="font-bold mt-1 tabular-nums">{mask(fmt(stats?.spending || 0, home))}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Account cards */}
        {accounts.map((a) => {
          const th = getTheme(a.theme)
          const cur = getCurrency(a.currency)
          return (
            <div key={a.id} className="snap-center shrink-0 w-full">
              <div className={cn('relative rounded-2xl p-5 min-h-[190px] overflow-hidden border border-white/10', th.className)}>
                <div className="flex items-center justify-between">
                  <p className={cn('text-[11px] font-semibold uppercase tracking-[0.12em]', th.dark ? 'text-slate-600' : 'text-white/60')}>{a.name}</p>
                  <LogoBadge logoId={a.logo} />
                </div>
                <p className="text-4xl font-bold mt-3 tabular-nums tracking-tight">{mask(fmt(a.balance, a.currency))}</p>
                {a.currency !== home ? (
                  <p className={cn('text-xs mt-1', th.dark ? 'text-slate-600' : 'text-white/60')}>≈ {mask(fmt(convertToHome(a.balance, a.currency), home))}</p>
                ) : null}
                <div className={cn('absolute bottom-5 left-5 right-5 flex items-center justify-between text-xs', th.dark ? 'text-slate-600' : 'text-white/60')}>
                  <span>{cur.flag} {a.currency} · {cur.name}</span>
                  <span className="font-mono tracking-widest">•••• {String(a.id || '').slice(-4).toUpperCase()}</span>
                </div>
              </div>
            </div>
          )
        })}
        {/* Add account card */}
        <div className="snap-center shrink-0 w-full">
          <button type="button" onClick={() => open('newAccount')} className="w-full rounded-2xl border-2 border-dashed border-border min-h-[190px] flex flex-col items-center justify-center text-muted-foreground gap-2" data-testid="add-account-card">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center"><Plus size={22} /></div>
            <span className="text-sm font-semibold">{t('new_account')}</span>
          </button>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 mt-3">
        {[...slides, { id: 'add' }].map((s, i) => (
          <span key={s.id || i} className={cn('h-1.5 rounded-full transition-all', i === idx ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/30')} />
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
          <div className="h-14 w-14 rounded-2xl bg-card border border-border/40 dark:border-white/5 flex items-center justify-center active:scale-95 transition">
            <it.icon size={22} />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">{it.label}</span>
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
        <div className="mt-4 rounded-xl bg-muted/70 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2"><Sparkles size={12} /> {t('demo_banner')}</div>
      ) : null}
      <BalanceCarousel />
      <QuickGrid />

      <div className="flex items-center justify-between mt-8 mb-1">
        <SectionLabel>{t('recent_transactions')}</SectionLabel>
        <button type="button" onClick={() => setTab('transactions')} className="text-xs font-semibold flex items-center gap-0.5">{t('see_all')} <ChevronRight size={14} /></button>
      </div>
      <Card className="px-4 divide-y divide-border/40">
        {recent.length === 0 ? (
          <EmptyState icon={Receipt} title={t('no_transactions')} subtitle={t('no_transactions_sub')} />
        ) : (
          recent.map((tx) => <TransactionRow key={tx.id} tx={tx} onClick={() => open('txDetail', tx)} />)
        )}
      </Card>
    </div>
  )
}
