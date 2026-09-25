'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Home, ArrowLeftRight, Plus, Flag, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHaptic } from '@/hooks/useHaptic'
import { useApp } from './context'

export default function BottomNav({ tab, onTab, onPlus }) {
  const app = useApp()
  const { t, open } = app || {}
  const haptic = useHaptic()

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

  // Defensive check for any modal, sheet, or paywall active
  const isAnyModalOpen = Boolean(
    sheetToggled ||
    app?.modal ||
    app?.activeModal ||
    app?.activeSheet ||
    app?.sheet ||
    app?.currentModal ||
    app?.subModal ||
    app?.paywallOpen ||
    app?.isPaywallOpen ||
    (app?.sheets && Object.values(app.sheets).some(Boolean))
  )

  // Automatically hide navbar when a sheet or modal is active
  if (isAnyModalOpen) return null

  const handleTabClick = (id) => {
    haptic?.toggleTab?.()
    onTab?.(id)
  }

  const handleAdd = (e) => {
    e?.stopPropagation?.()
    haptic?.buttonPress?.()
    if (open) {
      open?.('addTx')
    } else if (onPlus) {
      onPlus?.()
    }
  }

  return (
    <nav className="fixed bottom-6 inset-x-0 z-50 flex items-center justify-center px-4 pointer-events-none select-none">
      <div className="pointer-events-auto relative flex items-center justify-between w-full max-w-[340px] h-[58px] px-2 rounded-full bg-[#18181b]/80 dark:bg-[#121214]/85 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
        
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => handleTabClick('home')}
          data-testid="nav-home"
          aria-label={t?.('home') || 'Home'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-200"
        >
          {tab === 'home' && (
            <motion.div
              layoutId="threadsActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.8,
              }}
              className="absolute inset-y-1 inset-x-0.5 rounded-full bg-zinc-800/90 dark:bg-[#27272a]/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            <Home
              size={21}
              strokeWidth={tab === 'home' ? 2.4 : 1.9}
              fill={tab === 'home' ? 'currentColor' : 'none'}
              className={cn(
                'transition-all duration-200',
                tab === 'home'
                  ? 'text-white scale-105 opacity-100'
                  : 'stroke-[1.9] text-zinc-400 opacity-70 hover:opacity-100'
              )}
            />
          </span>
        </button>

        {/* 2. Transactions */}
        <button
          type="button"
          onClick={() => handleTabClick('transactions')}
          data-testid="nav-transactions"
          aria-label={t?.('transactions') || 'Transactions'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-200"
        >
          {tab === 'transactions' && (
            <motion.div
              layoutId="threadsActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.8,
              }}
              className="absolute inset-y-1 inset-x-0.5 rounded-full bg-zinc-800/90 dark:bg-[#27272a]/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            <ArrowLeftRight
              size={20}
              strokeWidth={tab === 'transactions' ? 2.6 : 1.9}
              className={cn(
                'transition-all duration-200',
                tab === 'transactions'
                  ? 'text-white scale-105 opacity-100'
                  : 'stroke-[1.9] text-zinc-400 opacity-70 hover:opacity-100'
              )}
            />
          </span>
        </button>

        {/* 3. Add (+) Button */}
        <button
          type="button"
          onClick={handleAdd}
          data-testid="fab-add"
          aria-label="Add transaction"
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-200 group"
        >
          <span className="relative z-10 flex items-center justify-center">
            <Plus className="w-6 h-6 stroke-[3.2] text-white transition-transform duration-200 group-hover:scale-110" />
          </span>
        </button>

        {/* 4. Goals */}
        <button
          type="button"
          onClick={() => handleTabClick('goals')}
          data-testid="nav-goals"
          aria-label={t?.('goals') || 'Goals'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-200"
        >
          {tab === 'goals' && (
            <motion.div
              layoutId="threadsActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.8,
              }}
              className="absolute inset-y-1 inset-x-0.5 rounded-full bg-zinc-800/90 dark:bg-[#27272a]/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            <Flag
              size={20}
              strokeWidth={tab === 'goals' ? 2.4 : 1.9}
              fill={tab === 'goals' ? 'currentColor' : 'none'}
              className={cn(
                'transition-all duration-200',
                tab === 'goals'
                  ? 'text-white scale-105 opacity-100'
                  : 'stroke-[1.9] text-zinc-400 opacity-70 hover:opacity-100'
              )}
            />
          </span>
        </button>

        {/* 5. Profile / More */}
        <button
          type="button"
          onClick={() => handleTabClick('more')}
          data-testid="nav-more"
          aria-label={t?.('profile') || t?.('more') || 'Profile'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-200"
        >
          {tab === 'more' && (
            <motion.div
              layoutId="threadsActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 34,
                mass: 0.8,
              }}
              className="absolute inset-y-1 inset-x-0.5 rounded-full bg-zinc-800/90 dark:bg-[#27272a]/90 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            <UserRound
              size={21}
              strokeWidth={tab === 'more' ? 2.4 : 1.9}
              fill={tab === 'more' ? 'currentColor' : 'none'}
              className={cn(
                'transition-all duration-200',
                tab === 'more'
                  ? 'text-white scale-105 opacity-100'
                  : 'stroke-[1.9] text-zinc-400 opacity-70 hover:opacity-100'
              )}
            />
          </span>
        </button>

      </div>
    </nav>
  )
}
