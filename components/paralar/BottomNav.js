'use client'
import { motion } from 'framer-motion'
import { Home, ArrowLeftRight, Target, MoreHorizontal, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from './context'

export default function BottomNav({ tab, onTab, onPlus }) {
  // Ambil semua kemungkinan nama state modal / sheet dari Context
  const app = useApp()
  const { t, open } = app || {}

  // Context Belanje/Paralar umumnya menyimpan activeSheet, currentModal, sheet, atau modal
  const isAnyModalOpen = Boolean(
    app?.modal || 
    app?.activeModal || 
    app?.activeSheet || 
    app?.sheet || 
    app?.currentModal
  )

  // Sembunyikan navbar jika ada sheet/modal aktif
  if (isAnyModalOpen) return null
  const items = [
    { id: 'home', label: t('home') || 'Home', icon: Home },
    { id: 'transactions', label: t('transactions') || 'Transactions', icon: ArrowLeftRight },
    { id: 'goals', label: t('goals') || 'Goals', icon: Target },
    { id: 'more', label: t('more') || 'More', icon: MoreHorizontal },
  ]

  const handlePlus = (e) => {
    e?.stopPropagation?.()
    if (open) {
      open('addTx')
    } else if (onPlus) {
      onPlus()
    }
  }

  return (
    <nav className="fixed bottom-5 inset-x-0 z-50 flex items-center justify-center px-4 pointer-events-none select-none">
      <div className="flex items-center gap-2.5 max-w-[360px] w-full justify-center pointer-events-none">
        
        {/* Dock Navigasi 4 Menu Utama */}
        <div className="pointer-events-auto flex-1 h-[52px] rounded-full px-1.5 py-1 flex items-center justify-between bg-white/95 dark:bg-[#0c0c0e]/95 backdrop-blur-2xl border border-zinc-200/90 dark:border-white/10 shadow-lg shadow-black/5">
          {items.map((it) => {
            const Icon = it.icon
            const active = tab === it.id
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onTab(it.id)}
                data-testid={`nav-${it.id}`}
                aria-label={it.label}
                className="relative flex items-center justify-center w-11 h-11 rounded-full cursor-pointer focus:outline-none select-none"
              >
                {active && (
                  <motion.div
                    layoutId="activePillBubble"
                    className="absolute inset-0 rounded-full bg-zinc-950 dark:bg-white shadow-sm"
                    transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 flex items-center justify-center transition-all duration-200',
                    active
                      ? 'text-white dark:text-zinc-950 fill-current stroke-[1.2]'
                      : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200'
                  )}
                >
                  <Icon size={19} strokeWidth={active ? 2.6 : 2} />
                </span>
              </button>
            )
          })}
        </div>

        {/* Tombol Add Transaction (+) Bersanding Rapi di Sisi Kanan Tanpa Menabrak */}
        <motion.button
          type="button"
          onClick={handlePlus}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Add transaction"
          data-testid="fab-add"
          className="pointer-events-auto shrink-0 w-[52px] h-[52px] rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shadow-lg shadow-black/20 border border-white/10 cursor-pointer"
        >
          <Plus size={22} strokeWidth={2.6} />
        </motion.button>

      </div>
    </nav>
  )
}