'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Pencil, Check, ArrowUpDown, CreditCard, X } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { BankCard } from './BankCard'
import { EmptyState } from './ui'
import { CARD_THEMES, ACCOUNT_TYPES } from '@/lib/categories'
import { cn } from '@/lib/utils'

export default function AccountsSheet({ open, onClose }) {
  const {
    t,
    accounts = [],
    setAccounts,
    fmt,
    store,
    refresh,
    open: openSheet,
    session,
  } = useApp()

  const scope = session?.user?.id || 'guest'
  const orderKey = `paralar_accounts_order_${scope}`

  // State: Ordered accounts for drag-to-reorder
  const [orderedAccounts, setOrderedAccounts] = useState([])
  const [expandedCardId, setExpandedCardId] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [sortIndex, setSortIndex] = useState(0)

  // Ref to always track latest reordered accounts (avoids stale closures during onDragEnd)
  const orderedAccountsRef = useRef(orderedAccounts)
  useEffect(() => {
    orderedAccountsRef.current = orderedAccounts
  }, [orderedAccounts])

  // Modals inside full-page wallet
  const [editingAccount, setEditingAccount] = useState(null)
  const [deletingAccount, setDeletingAccount] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editTheme, setEditTheme] = useState('parang')
  const [editType, setEditType] = useState('bank')

  // Sync ordered accounts with incoming accounts & preserved localStorage order
  useEffect(() => {
    if (!Array.isArray(accounts)) return

    let savedOrder = []
    try {
      const raw = localStorage.getItem(orderKey)
      if (raw) savedOrder = JSON.parse(raw)
    } catch {}

    if (Array.isArray(savedOrder) && savedOrder.length > 0) {
      const sorted = [...accounts].sort((a, b) => {
        const ia = savedOrder.indexOf(a.id)
        const ib = savedOrder.indexOf(b.id)
        if (ia === -1 && ib === -1) return 0
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      setOrderedAccounts(sorted)
    } else {
      setOrderedAccounts(accounts)
    }
  }, [accounts, orderKey])

  // Body scroll lock management with safe cleanup
  useEffect(() => {
    if (!open) return

    document.body.style.overflow = 'hidden'
    document.body.setAttribute('data-paralar-sheet-open', 'true')
    try {
      window.dispatchEvent(new CustomEvent('paralar-sheet-toggle', { detail: { open: true } }))
    } catch {}

    return () => {
      document.body.style.overflow = ''
      document.body.removeAttribute('data-paralar-sheet-open')
      try {
        window.dispatchEvent(new CustomEvent('paralar-sheet-toggle', { detail: { open: false } }))
      } catch {}
    }
  }, [open])

  // Lightweight reorder handler during active drag:
  // ONLY updates local React state without triggering parent re-renders or synchronous disk I/O
  const handleReorder = useCallback((newOrder) => {
    setOrderedAccounts(newOrder)
  }, [])

  // Commit order to persistent storage and parent context when drag completes or sort finishes
  const commitOrder = useCallback(
    (finalOrder) => {
      if (!Array.isArray(finalOrder)) return
      try {
        const ids = finalOrder.map((a) => a.id)
        localStorage.setItem(orderKey, JSON.stringify(ids))
      } catch {}

      if (typeof setAccounts === 'function') {
        setAccounts(finalOrder)
      }
    },
    [orderKey, setAccounts]
  )

  // Sort shortcut cycle
  const sortOptions = [
    { label: '↓↑ Sort', fn: null },
    { label: 'Saldo ↓', fn: (a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0) },
    { label: 'Saldo ↑', fn: (a, b) => (Number(a.balance) || 0) - (Number(b.balance) || 0) },
    { label: 'Nama A-Z', fn: (a, b) => (a.name || '').localeCompare(b.name || '') },
  ]

  const handleSortCycle = () => {
    const nextIdx = (sortIndex + 1) % sortOptions.length
    setSortIndex(nextIdx)
    const opt = sortOptions[nextIdx]
    if (opt.fn) {
      const sorted = [...orderedAccounts].sort(opt.fn)
      setOrderedAccounts(sorted)
      commitOrder(sorted)
      toast.success(`Diurutkan berdasarkan ${opt.label}`)
    } else {
      // Revert to initial accounts order
      const original = [...accounts]
      setOrderedAccounts(original)
      commitOrder(original)
      toast.info('Urutan kartu dikembalikan semula')
    }
  }

  // Open Edit Modal
  const handleEdit = (a) => {
    setEditingAccount(a)
    setEditName(a.name || '')
    setEditTheme(a.theme || 'parang')
    setEditType(a.type || 'bank')
  }

  // Save Edit
  const saveEdit = async () => {
    if (!editingAccount || !editName.trim()) return
    setSavingEdit(true)
    try {
      const patch = {
        name: editName.trim(),
        theme: editTheme,
        type: editType,
      }
      if (store?.updateAccount) {
        await store.updateAccount(editingAccount.id, patch)
      }
      if (refresh) await refresh()
      setEditingAccount(null)
      toast.success(t('saved_msg') || 'Perubahan disimpan')
    } catch (e) {
      toast.error(e?.message || t('error'))
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete Account
  const confirmDelete = async () => {
    if (!deletingAccount?.id) return
    const id = deletingAccount.id
    setDeletingAccount(null)
    try {
      if (store?.deleteAccount) {
        await store.deleteAccount(id)
      }
      if (refresh) await refresh()
      const updated = orderedAccounts.filter((x) => x.id !== id)
      setOrderedAccounts(updated)
      commitOrder(updated)
      if (expandedCardId === id) setExpandedCardId(null)
      toast.success(t('deleted'))
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
        className="h-[100dvh] w-full fixed inset-0 z-50 bg-background flex flex-col overflow-hidden select-none transform-gpu will-change-transform"
      >
        {/* ======================================================================
            1. NAVIGASI ATAS (SAFE AREA HEADER NATIVE IOS)
           ====================================================================== */}
        <div className="pt-safe safe-top shrink-0 bg-background/95 backdrop-blur-md z-30 border-b border-border/40">
          <div className="flex items-center justify-between px-5 h-14">
            {/* Kiri: Teks "Selesai" untuk menutup */}
            <button
              type="button"
              onClick={onClose}
              className="text-[15px] font-semibold text-zinc-950 dark:text-white hover:opacity-70 transition-opacity cursor-pointer py-1 pr-2"
              data-testid="wallet-done-btn"
            >
              {t('done') || 'Selesai'}
            </button>

            {/* Tengah: Judul "Wallet" / "Akun" */}
            <h1 className="text-base font-bold text-foreground tracking-tight text-center">
              {t('wallet') || t('accounts_cards') || 'Wallet'}
            </h1>

            {/* Kanan: Ikon "+" untuk tambah kartu */}
            <button
              type="button"
              onClick={() => {
                onClose?.()
                setTimeout(() => openSheet('newAccount'), 120)
              }}
              className="h-8 w-8 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center transition-transform active:scale-95 shadow-sm cursor-pointer"
              aria-label="Add account"
              data-testid="wallet-add-btn"
            >
              <Plus size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* Sub-header Utilitas: "Drag card to reorder" & "↓↑ Sort" */}
          <div className="flex items-center justify-between px-5 pb-3 pt-0.5">
            <span className="text-xs text-muted-foreground font-medium">
              Drag card to reorder
            </span>
            <button
              type="button"
              onClick={handleSortCycle}
              className="text-xs font-semibold text-foreground/80 hover:text-foreground flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted transition-colors active:scale-95 cursor-pointer"
              data-testid="wallet-sort-btn"
            >
              <ArrowUpDown size={12} strokeWidth={2} />
              <span>{sortOptions[sortIndex].label}</span>
            </button>
          </div>
        </div>

        {/* ======================================================================
            2. DAFTAR KARTU APPLE WALLET DENGAN DRAG-TO-REORDER
           ====================================================================== */}
        {orderedAccounts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <EmptyState
              icon={CreditCard}
              title={t('no_transactions') || 'Belum ada kartu'}
              subtitle={t('new_account') || 'Tambah kartu atau rekening pertama Anda'}
            />
            <button
              type="button"
              onClick={() => {
                onClose?.()
                setTimeout(() => openSheet('newAccount'), 120)
              }}
              className="mt-6 flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={18} strokeWidth={2.2} />
              <span>{t('new_account') || 'Tambah Akun'}</span>
            </button>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={orderedAccounts}
            onReorder={handleReorder}
            className="relative flex flex-col px-5 pt-3 pb-56 overflow-y-auto flex-1 no-scrollbar touch-pan-y"
          >
            {orderedAccounts.map((a, index) => {
              const isExpanded = expandedCardId === a.id || orderedAccounts.length === 1
              const isDragging = draggingId === a.id

              return (
                <Reorder.Item
                  key={a.id}
                  value={a}
                  layout
                  onDragStart={() => {
                    setDraggingId(a.id)
                    // Auto-collapse open card when dragging starts to preserve uniform deck math
                    if (expandedCardId) setExpandedCardId(null)
                  }}
                  onDragEnd={() => {
                    setDraggingId(null)
                    // Smoothly commit the finalized order once drag finishes
                    commitOrder(orderedAccountsRef.current)
                  }}
                  whileDrag={{
                    scale: 1.03,
                    cursor: 'grabbing',
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 30,
                    mass: 0.5,
                  }}
                  style={{
                    zIndex: isDragging ? 60 : isExpanded ? 50 : index + 1,
                  }}
                  className={cn(
                    'relative select-none will-change-transform',
                    // Clean Apple Wallet uniform slot height without negative margin jumps:
                    // Each collapsed card occupies a fixed 64px header slot.
                    // The rest of the card overflows down into the deck.
                    // When expanded, height becomes auto to show full card + action bar.
                    isExpanded ? 'h-auto mb-6' : 'h-[64px]',
                    isDragging && 'shadow-2xl'
                  )}
                  data-testid={`wallet-card-item-${a.id}`}
                >
                  {/* Komponen Fisik Kartu */}
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
                    isCollapsed={!isExpanded}
                    onClick={() => {
                      if (orderedAccounts.length > 1) {
                        setExpandedCardId(isExpanded ? null : a.id)
                      }
                    }}
                    className={cn(
                      'cursor-pointer active:scale-[0.99]',
                      isExpanded && 'ring-2 ring-white/20'
                    )}
                  />

                  {/* 
                    Laci Aksi Dinamis (Dynamic Action Bar):
                    Muncul tepat di bawah kartu saat expanded (isCollapsed === false),
                    dan otomatis mendorong sisa tumpukan kartu lain ke bawah tanpa tumpang tindih.
                  */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        layout
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.6 }}
                        className="mt-3.5 mb-2 px-1 flex items-center justify-between gap-2 z-20"
                      >
                        {/* Tombol Hapus Kartu */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingAccount(a)
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold active:scale-95 transition cursor-pointer"
                          data-testid={`wallet-delete-${a.id}`}
                        >
                          <Trash2 size={14} />
                          <span>{t('delete') || 'Hapus'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {/* Tombol Ubah / Edit */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(a)
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-foreground text-xs font-bold active:scale-95 transition cursor-pointer"
                            data-testid={`wallet-edit-${a.id}`}
                          >
                            <Pencil size={14} />
                            <span>{t('edit') || 'Ubah'}</span>
                          </button>

                          {/* Tombol Selesai (Tutup Kartu Ini jika lebih dari 1) */}
                          {orderedAccounts.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedCardId(null)
                              }}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-bold active:scale-95 transition cursor-pointer shadow-xs"
                              data-testid={`wallet-collapse-${a.id}`}
                            >
                              <Check size={14} strokeWidth={2.5} />
                              <span>{t('done') || 'Selesai'}</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reorder.Item>
              )
            })}
          </Reorder.Group>
        )}

        {/* ======================================================================
            MODAL EDIT AKUN / KARTU
           ====================================================================== */}
        {editingAccount && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  {t('edit') || 'Ubah'} {editingAccount.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Input Nama Akun */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('account_name') || 'Nama Akun'}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-sm font-semibold text-foreground outline-none focus:border-zinc-400 dark:focus:border-white/20"
                />
              </div>

              {/* Pilihan Tema Kartu (6 Tema Solid) */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('theme') || 'Tema Kartu'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CARD_THEMES.map((th) => {
                    const active = editTheme === th.id
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setEditTheme(th.id)}
                        className={cn(
                          'p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer',
                          active
                            ? 'border-zinc-950 dark:border-white ring-2 ring-zinc-950/20 dark:ring-white/20'
                            : 'border-zinc-200 dark:border-white/10 hover:border-zinc-400'
                        )}
                      >
                        <div className={cn('w-full h-6 rounded-md shadow-xs', th.swatchClass)} />
                        <span className="text-[10px] font-bold truncate max-w-full text-foreground">
                          {th.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pilihan Tipe Akun */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('account_type') || 'Tipe Akun'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ACCOUNT_TYPES.map((ty) => (
                    <button
                      key={ty.id}
                      type="button"
                      onClick={() => setEditType(ty.id)}
                      className={cn(
                        'py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                        editType === ty.id
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {ty.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tombol Simpan & Batal */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 text-xs transition active:scale-95 cursor-pointer"
                >
                  {t('cancel') || 'Batal'}
                </button>
                <button
                  type="button"
                  disabled={savingEdit || !editName.trim()}
                  onClick={saveEdit}
                  className="w-full rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold py-2.5 text-xs transition active:scale-95 cursor-pointer disabled:opacity-40"
                >
                  {savingEdit ? 'Menyimpan...' : t('save') || 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================
            MODAL KONFIRMASI HAPUS AKUN
           ====================================================================== */}
        {deletingAccount && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/10 p-6 shadow-2xl text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
                <Trash2 size={26} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                  {t('delete_account') || 'Hapus Akun'} "{deletingAccount.name}"?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                  Semua transaksi yang tertaut dengan akun ini mungkin terpengaruh. Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingAccount(null)}
                  className="w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold py-2.5 text-xs transition active:scale-95 cursor-pointer"
                >
                  {t('cancel') || 'Batal'}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="w-full rounded-xl bg-rose-600 text-white font-bold py-2.5 text-xs transition active:scale-95 cursor-pointer hover:bg-rose-700"
                >
                  {t('delete') || 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
