'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Receipt, Users, PieChart, FileText, Plus, ChevronRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Avatar, Card, SectionLabel, EmptyState } from './ui'
import TransactionRow from './TransactionRow'
import { BankCard, EmvChip, ContactlessWave } from './BankCard'
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
  const totalSlides = 1 + accounts.length + 1 // [Total, ...accounts, Add]

  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const w = el.clientWidth
    const scrollLeft = el.scrollLeft
    const newIdx = Math.round(scrollLeft / Math.max(1, w))
    setIdx(Math.max(0, Math.min(newIdx, totalSlides - 1)))
  }, [totalSlides])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [onScroll])

  const scrollToSlide = (i) => {
    const el = ref.current
    if (!el) return
    const child = el.children[i]
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    } else {
      const w = el.clientWidth
      el.scrollTo({ left: i * w, behavior: 'smooth' })
    }
  }

  const mask = (v) => (hideBalance ? '••••••' : v)

  return (
    <div className="mt-5">
      {/* Elastic spring-paging horizontal container */}
      <div
        ref={ref}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-5 px-5 gap-3.5 scroll-px-5 touch-pan-x py-3 -my-3"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Slide 1: Total Balance Card — standardized aspect-[1.58/1] min-h-[185px] */}
        <div className="w-full aspect-[1.58/1] min-h-[185px] shrink-0 snap-center">
          <div
            className="w-full h-full rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between shadow-lg select-none bg-white text-zinc-950 border border-zinc-200 dark:bg-[#0c0c0e] dark:text-white dark:border-white/10"
            data-testid="balance-card"
          >
            {/* Background subtle decoration */}
            <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-zinc-100 dark:bg-white/[0.04] pointer-events-none" />
            <div className="absolute right-12 -bottom-12 w-36 h-36 rounded-full bg-zinc-50 dark:bg-white/[0.02] pointer-events-none" />

            {/* Top row: Chip EMV + Wave & Eye toggle */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <EmvChip isLight={false} />
                <ContactlessWave className="w-4 h-4 text-white/70 dark:text-white/70" />
              </div>
              <button
                type="button"
                onClick={() => setHideBalance(!hideBalance)}
                className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white p-1 rounded-lg transition-colors active:scale-95"
                aria-label="toggle balance"
              >
                {hideBalance ? <EyeOff size={9} /> : <Eye size={9} />}
              </button>
            </div>

            {/* Middle row: Label Total Saldo & Nominal */}
            <div className="relative z-10 my-auto py-1 flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 mb-0.5">
                {t('total_balance')}
              </span>
              <p
                className="text-[26px] sm:text-3xl font-extrabold tabular-nums tracking-tight text-zinc-950 dark:text-white truncate"
                data-testid="total-balance"
              >
                {mask(fmt(stats?.totalBalance || 0, home))}
              </p>
            </div>

            {/* Bottom row: Income & Spending Pills */}
            <div className="grid grid-cols-2 gap-2 relative z-10 pt-1">
              {/* Kotak Pemasukan */}
              <div className="rounded-xl bg-zinc-100/90 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/5 p-2 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-[8.5px] font-semibold uppercase tracking-wider">
                  <ArrowDownLeft size={9} className="text-emerald-500 stroke-[2.5] shrink-0" />
                  <span>{t('income')}</span>
                </div>
                <p className="font-bold text-[10px] sm:text-[8.5px] tabular-nums text-zinc-950 dark:text-white mt-0.5">
                  {mask(fmt(stats?.income || 0, home))}
                </p>
              </div>

              {/* Kotak Pengeluaran */}
              <div className="rounded-xl bg-zinc-100/90 dark:bg-white/[0.06] border border-zinc-200/70 dark:border-white/5 p-2 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 text-[8.5px] font-semibold uppercase tracking-wider">
                  <ArrowUpRight size={9} className="text-rose-500 stroke-[2.5] shrink-0" />
                  <span>{t('spending')}</span>
                </div>
                <p className="font-bold text-[10px] sm:text-[8.5px] tabular-nums text-zinc-950 dark:text-white mt-0.5">
                  {mask(fmt(stats?.spending || 0, home))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Slide 2..N: Physical motif Bank Cards with exact uniform aspect ratio */}
        {accounts.map((a) => (
          <div key={a.id} className="w-full aspect-[1.58/1] min-h-[185px] shrink-0 snap-center">
            <BankCard
              name={a.name}
              balance={a.balance}
              currency={a.currency}
              theme={a.theme}
              logo={a.logo}
              icon={a.icon}
              type={a.type}
              id={a.id}
              fmt={fmt}
              hideBalance={hideBalance}
              approxHome={a.currency !== home ? fmt(convertToHome(a.balance, a.currency), home) : null}
              className="h-full"
            />
          </div>
        ))}

        {/* Slide N+1: Add Account Card — matching uniform aspect ratio */}
        <div className="w-full aspect-[1.58/1] min-h-[185px] shrink-0 snap-center">
          <button
            type="button"
            onClick={() => open('newAccount')}
            className="w-full h-full rounded-2xl border-2 border-dashed border-zinc-300 dark:border-white/15 bg-zinc-50/60 dark:bg-[#121214]/60 flex flex-col items-center justify-center text-zinc-600 dark:text-zinc-400 gap-3 hover:border-zinc-400 dark:hover:border-white/30 transition-all active:scale-[0.99] group shadow-sm"
            data-testid="add-account-card"
          >
            <div className="h-12 w-12 rounded-full bg-zinc-200/80 dark:bg-white/10 text-zinc-900 dark:text-white flex items-center justify-center group-hover:scale-105 transition-transform">
              <Plus size={22} strokeWidth={2.2} />
            </div>
            <span className="text-sm font-bold text-zinc-900 dark:text-white">{t('new_account')}</span>
          </button>
        </div>
      </div>

      {/* Synchronized Spring Carousel Dots */}
      <div className="flex justify-center items-center gap-1.5 mt-3.5">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollToSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300 cursor-pointer',
              i === idx
                ? 'w-6 bg-zinc-950 dark:bg-white'
                : 'w-1.5 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600'
            )}
          />
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

