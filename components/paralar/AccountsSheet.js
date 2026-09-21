'use client'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  AlertCircle,
  ArrowUpDown,
  CreditCard,
  Wallet,
  Banknote,
  Landmark,
  Smartphone,
  BarChart3,
  Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, EmptyState, LogoBadge } from './ui'
import { BankCard, CardMotifTexture } from './BankCard'
import { getTheme, ACCOUNT_TYPES } from '@/lib/categories'
import { convert } from '@/lib/rates'
import { cn } from '@/lib/utils'
import NewAccountSheet from './NewAccountSheet'

const ICON_MAP = {
  card: CreditCard,
  wallet: Wallet,
  cash: Banknote,
  bankbuilding: Landmark,
  phone: Smartphone,
  chart: BarChart3,
  business: Briefcase,
}

// Stacked background card header: only shows top logo/icon + bold name + category. Right side is clean.
function StackedCardBehind({ account }) {
  const th = getTheme(account.theme)
  const isGlacier = th.isLight || th.id === 'glacier'
  const motif = th.motif || 'parang'
  const FallbackIcon = ICON_MAP[account.icon] || CreditCard
  const typeLabel = ACCOUNT_TYPES.find((x) => x.id === account.type)?.label || (account.type ? account.type.toUpperCase() : 'ACCOUNT')

  const titleCls = isGlacier ? 'text-zinc-950' : 'text-zinc-950 dark:text-white'
  const subCls = isGlacier ? 'text-zinc-600' : 'text-zinc-600 dark:text-zinc-400'

  return (
    <div
      className={cn(
        'w-full h-[68px] rounded-2xl px-5 py-3 relative overflow-hidden flex items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.12)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] select-none border border-black/5 dark:border-white/10 transition-shadow',
        th.className
      )}
    >
      {/* 1) Physical Motif Texture */}
      <CardMotifTexture motif={motif} isLight={isGlacier} />

      {/* 2) Header baris atas: logo bank / ikon + nama akun tebal di kiri, kategori akun di bawahnya */}
      <div className="flex items-center gap-3 relative z-10 min-w-0 flex-1">
        <div className="shrink-0">
          {account.logo ? (
            <LogoBadge logoId={account.logo} size="sm" />
          ) : (
            <div
              className={cn(
                'h-8 w-8 rounded-xl flex items-center justify-center border shrink-0 backdrop-blur-sm',
                isGlacier
                  ? 'bg-zinc-950/5 border-zinc-300 text-zinc-900'
                  : 'bg-zinc-900/10 border-zinc-300 text-zinc-900 dark:bg-white/10 dark:border-white/20 dark:text-white'
              )}
            >
              <FallbackIcon size={16} strokeWidth={2} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={cn('font-bold text-sm tracking-tight truncate leading-tight', titleCls)}>
            {account.name || '—'}
          </p>
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider truncate leading-tight mt-0.5', subCls)}>
            {typeLabel}
          </p>
        </div>
      </div>

      {/* Sisi kanan atas bersih — tanpa label tiruan luar, tanpa chip, saldo, nomor kartu, atau ikon sampah */}
    </div>
  )
}

export default function AccountsSheet({ open, onClose }) {
  const { t, accounts = [], fmt, rates, home, store, refresh, open: openSheet } = useApp()
  const [selectedId, setSelectedId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [orderedAccounts, setOrderedAccounts] = useState([])
  const [sortMode, setSortMode] = useState(null) // null | 'balance_desc' | 'balance_asc' | 'name_asc'

  // Sync and persist card order
  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      setOrderedAccounts([])
      return
    }
    const savedOrderJson = typeof window !== 'undefined' ? localStorage.getItem('paralar_accounts_order') : null
    let savedOrder = []
    if (savedOrderJson) {
      try {
        savedOrder = JSON.parse(savedOrderJson)
      } catch (e) {
        savedOrder = []
      }
    }
    if (Array.isArray(savedOrder) && savedOrder.length > 0) {
      const map = new Map(accounts.map((a) => [a.id, a]))
      const sorted = []
      for (const id of savedOrder) {
        if (map.has(id)) {
          sorted.push(map.get(id))
          map.delete(id)
        }
      }
      map.forEach((acc) => sorted.push(acc))
      setOrderedAccounts(sorted)
    } else {
      setOrderedAccounts(accounts)
    }
  }, [accounts])

  const handleReorder = (newOrder) => {
    setOrderedAccounts(newOrder)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('paralar_accounts_order', JSON.stringify(newOrder.map((a) => a.id)))
      } catch (e) {
        // ignore
      }
    }
  }

  // Reset states when closed
  useEffect(() => {
    if (!open) {
      setSelectedId(null)
      setConfirmDeleteId(null)
      setIsDeleting(false)
      setEditingAccount(null)
    }
  }, [open])

  // Total balance across all accounts converted to home currency
  const totalBalance = useMemo(() => {
    return (accounts || []).reduce((sum, a) => {
      return sum + convert(Number(a.balance) || 0, a.currency || home, home, rates)
    }, 0)
  }, [accounts, home, rates])

  const formattedTotal = useMemo(() => {
    return fmt ? fmt(totalBalance, home) : `${home} ${Number(totalBalance || 0).toLocaleString()}`
  }, [totalBalance, home, fmt])

  const handleToggleSort = () => {
    if (sortMode === 'balance_desc') {
      setSortMode('balance_asc')
      const sorted = [...orderedAccounts].sort((a, b) => (Number(a.balance) || 0) - (Number(b.balance) || 0))
      handleReorder(sorted)
      toast.success('Urutkan: Saldo Terendah')
    } else if (sortMode === 'balance_asc') {
      setSortMode('name_asc')
      const sorted = [...orderedAccounts].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      handleReorder(sorted)
      toast.success('Urutkan: Nama (A-Z)')
    } else if (sortMode === 'name_asc') {
      setSortMode(null)
      toast.info('Urutan: Drag kustom diaktifkan')
    } else {
      setSortMode('balance_desc')
      const sorted = [...orderedAccounts].sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0))
      handleReorder(sorted)
      toast.success('Urutkan: Saldo Tertinggi')
    }
  }

  const remove = async (a) => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      await store.deleteAccount(a.id)
      await refresh()
      toast.success(t('deleted') || 'Kartu dihapus dari akun')
      setSelectedId(null)
      setConfirmDeleteId(null)
    } catch (e) {
      toast.error(e?.message || t('error') || 'Gagal menghapus kartu')
    } finally {
      setIsDeleting(false)
    }
  }

  const selectedIdx = orderedAccounts.findIndex((a) => a.id === selectedId)
  const hasFocus = selectedId !== null

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        full
        title="Account (Card)"
        left={
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            {t('done') || 'Done'}
          </button>
        }
        right={
          <button
            type="button"
            onClick={() => {
              onClose?.()
              setTimeout(() => openSheet('newAccount'), 120)
            }}
            className="h-8 w-8 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm"
            aria-label="Add account"
          >
            <Plus size={18} strokeWidth={2.2} />
          </button>
        }
      >
        {/* Baris 2: Drag card to reorder hint (left) + Sort button (right) */}
        <div className="flex items-center justify-between py-1.5 border-b border-border/40 mb-2.5">
          <span className="text-xs text-muted-foreground/60 font-medium select-none">
            Drag card to reorder
          </span>
          <button
            type="button"
            onClick={handleToggleSort}
            className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors py-0.5 px-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95"
          >
            <ArrowUpDown size={12} className="shrink-0" />
            <span>↓↑ Sort</span>
          </button>
        </div>

        {/* Baris 3: ACCOUNTS section label (left) + Total accumulated balance (right) */}
        <div className="flex items-center justify-between py-1 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 select-none">
            ACCOUNTS
          </span>
          <span className="text-xs font-bold text-foreground tabular-nums select-none">
            {formattedTotal}
          </span>
        </div>

        {orderedAccounts.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={t('no_transactions') || 'Belum ada kartu'}
            subtitle={t('new_account') || 'Tambahkan kartu atau akun pertama Anda'}
          />
        ) : (
          <div
            onClick={() => {
              if (selectedId) {
                setSelectedId(null)
                setConfirmDeleteId(null)
              }
            }}
            className="relative pt-1 pb-28 px-0.5 select-none min-h-[360px]"
          >
            {/* Apple Wallet Reorderable Card Stack */}
            <Reorder.Group
              axis="y"
              values={orderedAccounts}
              onReorder={handleReorder}
              className="relative space-y-0"
            >
              {orderedAccounts.map((a, idx) => {
                const isFocused = selectedId === a.id
                // When no card is clicked, the frontmost card (the last card in DOM order) shows full physical card,
                // while cards behind it only show their top header bar!
                // If a card IS clicked (selectedId !== null), that clicked card is the only one rendered full.
                const isFrontCard = !hasFocus && idx === orderedAccounts.length - 1
                const showFullCard = isFocused || isFrontCard

                // Stacking offset calculation
                let marginTop = '0px'
                if (!hasFocus) {
                  marginTop = idx === 0 ? '0px' : '-20px'
                } else {
                  if (idx === selectedIdx) {
                    marginTop = idx === 0 ? '0px' : '16px'
                  } else if (idx < selectedIdx) {
                    marginTop = idx === 0 ? '0px' : '-20px'
                  } else if (idx > selectedIdx) {
                    marginTop = idx === selectedIdx + 1 ? '20px' : '-20px'
                  }
                }

                return (
                  <Reorder.Item
                    key={a.id}
                    value={a}
                    dragListener={!hasFocus}
                    layout
                    initial={false}
                    animate={{
                      scale: isFocused ? 1.02 : hasFocus ? 0.97 : 1,
                      opacity: hasFocus && !isFocused ? 0.55 : 1,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 32,
                      mass: 0.8,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedId(isFocused ? null : a.id)
                      setConfirmDeleteId(null)
                    }}
                    style={{
                      zIndex: isFocused ? 50 : 10 + idx,
                      marginTop,
                    }}
                    className={cn(
                      'relative cursor-pointer select-none will-change-transform transition-shadow duration-200',
                      isFocused && 'z-50'
                    )}
                  >
                    {showFullCard ? (
                      /* Tampilan Kartu Terdepan / Terpilih: utuh dengan gaya kartu fisik standar */
                      <div className="relative rounded-2xl shadow-[0_16px_36px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.65)] ring-1 ring-black/10 dark:ring-white/20 overflow-hidden">
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
                          className="shadow-none border-0"
                        />
                      </div>
                    ) : (
                      /* Kartu yang Sedang Tertumpuk di Belakang: HANYA baris header atasnya saja */
                      <StackedCardBehind account={a} />
                    )}

                    {/* Saat kartu diklik/difokuskan: tampilkan 3 tombol aksi tepat di bawahnya */}
                    <AnimatePresence>
                      {isFocused && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: 14 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                          onClick={(e) => e.stopPropagation()}
                          className="overflow-hidden"
                        >
                          {confirmDeleteId === a.id ? (
                            /* Dialog konfirmasi sebelum hapus dari Supabase */
                            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2.5">
                              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400">
                                <AlertCircle size={15} className="shrink-0" />
                                <span>Hapus kartu ini dari akun?</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-tight">
                                Kartu ini akan dihapus secara permanen dari Supabase. Tindakan ini tidak dapat dibatalkan.
                              </p>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => remove(a)}
                                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                  <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isDeleting}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors"
                                >
                                  {t('cancel') || 'Batal'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* 3 Tombol Aksi: [Hapus], [Edit], [Selesai] */
                            <div className="flex items-center gap-2">
                              {/* 1) [Hapus]: Aksen merah */}
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(a.id)}
                                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20"
                              >
                                <Trash2 size={14} />
                                <span>{t('delete') || 'Hapus'}</span>
                              </button>

                              {/* 2) [Edit]: Aksen netral */}
                              <button
                                type="button"
                                onClick={() => setEditingAccount(a)}
                                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] bg-muted hover:bg-muted/80 text-foreground border border-border/40"
                              >
                                <Pencil size={14} />
                                <span>{t('edit') || 'Edit'}</span>
                              </button>

                              {/* 3) [Selesai]: Aksen kontras */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedId(null)
                                  setConfirmDeleteId(null)
                                }}
                                className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] bg-foreground text-background shadow-xs"
                              >
                                <Check size={14} strokeWidth={2.5} />
                                <span>{t('done') || 'Selesai'}</span>
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Reorder.Item>
                )
              })}
            </Reorder.Group>
          </div>
        )}
      </Sheet>

      {/* Edit Account Modal (opens when [Edit] is clicked) */}
      {editingAccount && (
        <NewAccountSheet
          open={!!editingAccount}
          onClose={() => {
            setEditingAccount(null)
            refresh?.()
          }}
          initial={editingAccount}
          zIndex={70}
        />
      )}
    </>
  )
}
