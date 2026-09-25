'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Home, ArrowLeftRight, Target, MoreHorizontal, Plus } from 'lucide-react'
import { cn, triggerHaptic } from '@/lib/utils'
import { useApp } from './context'

export default function BottomNav({ tab, onTab, onPlus }) {
  const app = useApp()
  const { t, open } = app || {}

  const [sheetToggled, setSheetToggled] = useState(false)

  useEffect(() => {
    const handleToggle = (e) => {
      setSheetToggled(Boolean(e?.detail?.open))
    }
    window.addEventListener('paralar-sheet-toggle', handleToggle)
    if (typeof document !== 'undefined' && document.body.hasAttribute('data-paralar-sheet-open')) {
      setSheetToggled(true)
    }
    return () => {
      window.removeEventListener('paralar-sheet-toggle', handleToggle)
    }
  }, [])

  // Comprehensive check for any modal or sheet active
  const isAnyModalOpen = Boolean(
    sheetToggled ||
    app?.modal || 
    app?.activeModal || 
    app?.activeSheet || 
    app?.sheet || 
    app?.currentModal ||
    app?.subModal ||
    (app?.sheets && Object.values(app.sheets).some(Boolean))
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
    triggerHaptic('light')
    if (open) {
      open('addTx')
    } else if (onPlus) {
      onPlus()
    }
  }

  const handleTabClick = (id) => {
    triggerHaptic('medium')
    onTab?.(id)
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
              <motion.button
                key={it.id}
                type="button"
                onClick={() => handleTabClick(it.id)}
                whileTap={{ scale: 0.88 }}
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
                      ? 'text-white dark:text-zinc-950 scale-105'
                      : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200'
                  )}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.5 : 1.8}
                    fill={active ? 'currentColor' : 'none'}
                    className="transition-all duration-150"
                  />
                </span>
              </motion.button>
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
