'use client'
import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Receipt, Users, PieChart, FileText, Plus, ChevronRight, Sparkles, Trash2, WifiOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Avatar, Card, SectionLabel, EmptyState } from './ui'
import SwipeTransactionRow from './SwipeTransactionRow'
import { BankCard, EmvChip, ContactlessWave } from './BankCard'
import { cn } from '@/lib/utils'
import { applyTxToBalances } from '@/lib/ledger'
import { deriveNotifications } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { APP_VERSION } from '@/lib/version'

function Header() {
  const {
    t,
    profile,
    open,
    isGuest,
    bills = [],
    budgets = [],
    goals = [],
    transactions = [],
    home = 'USD',
    rates = {},
    fmt,
  } = useApp()
  const first = (profile?.full_name || '').trim().split(' ')[0]

  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false)
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false))
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const updateOnline = () => {
      setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false)
    }
    const handleSyncState = (e) => {
      if (e?.detail) {
        if (e.detail.isOffline !== undefined) setIsOffline(e.detail.isOffline)
        if (e.detail.isSyncing !== undefined) setIsSyncing(e.detail.isSyncing)
      }
    }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('paralar_sync_state', handleSyncState)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('paralar_sync_state', handleSyncState)
    }
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('paralar_app_version')
      if (stored !== APP_VERSION) {
        localStorage.setItem('paralar_app_version', APP_VERSION)
        toast(`Paralar diperbarui ke ${APP_VERSION}`)
      }
    } catch {}
  }, [])

  const checkUnreadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id')
        .eq('is_active', true)
      if (!error && Array.isArray(data) && data.length > 0) {
        let readIds = []
        try {
          readIds = JSON.parse(localStorage.getItem('read_announcements') || '[]')
        } catch {}
        const unread = data.some((a) => !readIds.includes(a.id))
        setHasUnreadAnnouncements(unread)
      } else {
        setHasUnreadAnnouncements(false)
      }
    } catch {
      setHasUnreadAnnouncements(false)
    }
  }, [])

  useEffect(() => {
    checkUnreadAnnouncements()
    const handleReadUpdated = () => checkUnreadAnnouncements()
    window.addEventListener('read_announcements_updated', handleReadUpdated)
    window.addEventListener('storage', handleReadUpdated)
    return () => {
      window.removeEventListener('read_announcements_updated', handleReadUpdated)
      window.removeEventListener('storage', handleReadUpdated)
    }
  }, [checkUnreadAnnouncements])

  const { hasUrgent } = useMemo(() => {
    return deriveNotifications({
      bills,
      budgets,
      goals,
      transactions,
      home,
      rates,
      fmt,
      t,
    })
  }, [bills, budgets, goals, transactions, home, rates, fmt, t])

  const hasBadge = hasUrgent || hasUnreadAnnouncements

  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-3">
        <Avatar profile={profile} onClick={() => open('profile')} data-testid="avatar" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold leading-tight text-zinc-950 dark:text-white" data-testid="greeting">{t('hi')}, {first || t('user')}</p>
            {isOffline ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 shrink-0"
                data-testid="offline-badge"
              >
                <WifiOff size={13} strokeWidth={2} />
                <span>Offline Mode</span>
              </span>
            ) : isSyncing ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 shrink-0"
                data-testid="syncing-badge"
              >
                <RefreshCw size={13} strokeWidth={2} className="animate-spin" />
                <span>Syncing...</span>
              </span>
            ) : null}
          </div>
          {isGuest ? <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mt-0.5">{t('guest_mode')}</p> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => open('notifications')}
        className="h-10 w-10 rounded-full bg-white border border-border/70 text-foreground dark:bg-[#121214] dark:border-white/10 dark:text-white flex items-center justify-center transition-colors relative shadow-xs"
        aria-label="notifications"
      >
        <Bell size={18} />
        {hasBadge && (
          <span
            className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#121214]"
            data-testid="notification-dot"
          />
        )}
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
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-5 px-5 gap-3.5 scroll-px-5 touch-pan-x"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Slide 1: Total Balance Card — standardized aspect-[1.58/1] min-h-[185px] (Finsight Obsidian Luxury) */}
        <div className="w-full aspect-[1.58/1] min-h-[185px] shrink-0 snap-center">
          <div
            className="w-full h-full rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between shadow-xl shadow-black/10 select-none bg-[#0c0c0e] text-white border border-white/10"
            data-testid="balance-card"
          >
            {/* Background subtle monochrome depth */}
            <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/[0.04] blur-2xl pointer-events-none" />
            <div className="absolute right-12 -bottom-12 w-36 h-36 rounded-full bg-white/[0.02] pointer-events-none" />

            {/* Top row: Chip EMV + Wave & Eye toggle */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <EmvChip isLight={false} />
                <ContactlessWave className="w-4 h-4 text-white/70" />
              </div>
              <button
                type="button"
                onClick={() => setHideBalance(!hideBalance)}
                className="text-white/60 hover:text-white p-1 rounded-lg transition-colors active:scale-95"
                aria-label="toggle balance"
              >
                {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Middle row: Label Total Saldo & Nominal */}
            <div className="relative z-10 my-auto py-1 flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50 mb-0.5">
                {t('total_balance')}
              </span>
              <p
                className="text-[28px] sm:text-3xl font-extrabold tabular-nums tracking-tight text-white truncate"
                data-testid="total-balance"
              >
                {mask(fmt(stats?.totalBalance || 0, home))}
              </p>
            </div>

            {/* Bottom row: Income & Spending Pills */}
            <div className="grid grid-cols-2 gap-2 relative z-10 pt-1">
              {/* Kotak Pemasukan */}
              <div className="rounded-xl bg-white/[0.08] border border-white/10 p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-white/70 text-[9px] font-semibold uppercase tracking-wider">
                  <ArrowDownLeft size={10} className="text-emerald-400 stroke-[2.5] shrink-0" />
                  <span>{t('income')}</span>
                </div>
                <p className="font-bold text-[11px] sm:text-xs tabular-nums text-white mt-0.5">
                  {mask(fmt(stats?.income || 0, home))}
                </p>
              </div>

              {/* Kotak Pengeluaran */}
              <div className="rounded-xl bg-white/[0.08] border border-white/10 p-2.5 flex flex-col justify-between">
                <div className="flex items-center gap-1 text-white/70 text-[9px] font-semibold uppercase tracking-wider">
                  <ArrowUpRight size={10} className="text-rose-400 stroke-[2.5] shrink-0" />
                  <span>{t('spending')}</span>
                </div>
                <p className="font-bold text-[11px] sm:text-xs tabular-nums text-white mt-0.5">
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

        {/* Slide N+1: Add Account Card — pure monochrome dashed card */}
        <div className="w-full aspect-[1.58/1] min-h-[185px] shrink-0 snap-center">
          <button
            type="button"
            onClick={() => open('newAccount')}
            className="w-full h-full rounded-2xl border-2 border-dashed border-border/80 bg-white dark:bg-[#121214] flex flex-col items-center justify-center text-muted-foreground gap-3 hover:border-zinc-950 dark:hover:border-white hover:text-foreground transition-all active:scale-[0.99] group shadow-xs"
            data-testid="add-account-card"
          >
            <div className="h-12 w-12 rounded-full bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-white flex items-center justify-center group-hover:scale-105 group-hover:bg-[#0c0c0e] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-[#0c0c0e] transition-all">
              <Plus size={22} strokeWidth={2.2} />
            </div>
            <span className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors">{t('new_account')}</span>
          </button>
        </div>
      </div>

      {/* Synchronized Spring Carousel Dots: Solid black active & #E4E4E7 inactive */}
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
                ? 'w-6 bg-[#0c0c0e] dark:bg-white'
                : 'w-1.5 bg-[#E4E4E7] dark:bg-zinc-700 hover:bg-zinc-400 dark:hover:bg-zinc-600'
            )}
          />
        ))}
      </div>
    </div>
  )
}

function QuickGrid() {
  const { t, open, isAiAllowed } = useApp()
  const items = [
    { id: 'bills', label: t('bills'), icon: FileText, onClick: () => open('bills') },
    {
      id: 'receipts',
      label: t('receipts'),
      icon: Receipt,
      onClick: () => open('receiptGallery'),
    },
    { id: 'split', label: t('bill_split'), icon: Users, onClick: () => open('split') },
    { id: 'analytics', label: t('analytics'), icon: PieChart, onClick: () => open('analytics') },
  ]
  return (
    <div className="grid grid-cols-4 gap-3 mt-6">
      {items.map((it) => (
        <button key={it.id} type="button" onClick={it.onClick} className="flex flex-col items-center gap-2 group" data-testid={`quick-${it.id}`}>
          <div className="h-14 w-14 rounded-2xl bg-white border border-border/70 text-foreground dark:bg-[#121214] dark:border-white/10 dark:text-white flex items-center justify-center active:scale-95 transition shadow-xs group-hover:border-foreground/40 group-hover:text-foreground">
            <it.icon size={22} />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{it.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function HomeTab() {
  const { t, transactions = [], setTab, open, isGuest, store, refresh, accounts = [], rates, deleteTransaction } = useApp()
  const [openRowId, setOpenRowId] = useState(null)
  const [deletingTx, setDeletingTx] = useState(null)

  const handleEdit = (tx) => {
    open?.('addTx', { ...tx, editId: tx?.id })
  }

  const handleDelete = (tx) => {
    setDeletingTx(tx)
  }

  const confirmDelete = async () => {
    if (!deletingTx?.id) return
    const target = deletingTx
    setDeletingTx(null) // Close modal immediately
    try {
      if (deleteTransaction) {
        await deleteTransaction(target)
      } else {
        await applyTxToBalances(store, accounts, target, -1, rates)
        await store?.deleteTransaction?.(target.id)
        if (refresh) await refresh()
      }
      toast.success(t('deleted'))
    } catch {
      toast.error(t('error'))
    }
  }

  const recent = transactions.slice(0, 6)
  return (
    <div className="px-5 pb-28">
      <Header />
      {isGuest ? (
        <div className="mt-4 rounded-xl bg-zinc-100 border border-zinc-200 dark:bg-zinc-900 dark:border-white/10 px-3 py-2 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-center gap-2"><Sparkles size={12} /> {t('demo_banner')}</div>
      ) : null}
      <BalanceCarousel />
      <QuickGrid />

      {/* Jarak atas antar section mt-6, jarak bawah ke card mb-2.5 (persis seperti Target Tabungan) */}
      <div className="flex items-center justify-between mt-6 mb-2.5">
        <SectionLabel>{t('recent_transactions')}</SectionLabel>
        <button 
          type="button" 
          onClick={() => setTab('transactions')} 
          className="text-xs font-semibold flex items-center gap-0.5 text-zinc-950 dark:text-white hover:opacity-80 transition-opacity"
        >
          {t('see_all')} <ChevronRight size={14} />
        </button>
      </div>

      {recent.length === 0 ? (
        <Card className="px-4 py-8">
          <EmptyState icon={Receipt} title={t('no_transactions')} subtitle={t('no_transactions_sub')} />
        </Card>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden divide-y divide-border/30 mb-4 touch-pan-y shadow-xs">
          {recent.map((tx) => (
            <SwipeTransactionRow
              key={tx.id}
              transaction={tx}
              isGrouped
              isOpen={openRowId === tx.id}
              onOpenChange={(v) => setOpenRowId(v ? tx.id : null)}
              onOpenDetail={() => open('txDetail', tx)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                {t('clear_confirm_title')}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                {deletingTx?.merchant || deletingTx?.note || deletingTx?.description ? `"${deletingTx.merchant || deletingTx.note || deletingTx.description}" - ` : ''}{t('clear_confirm_body')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 text-sm transition-all active:scale-95 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="w-full rounded-xl bg-rose-600 text-white font-bold py-2.5 text-sm transition-all active:scale-95 cursor-pointer hover:bg-rose-700"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

