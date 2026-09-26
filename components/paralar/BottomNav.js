'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useHaptic } from '@/hooks/useHaptic'
import { useApp } from './context'
import {
  Home6Outline,
  Home6Filled,
  TransactionMinusOutline,
  TransactionMinusFilled,
  PlusOutline,
  FlameOutline,
  FlameFilled,
  UserOutline,
  UserFilled,
} from './ReiconIcons'

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
    try {
      if (typeof window !== 'undefined' && window?.navigator?.vibrate) {
        window.navigator.vibrate(10)
      }
    } catch {}
    haptic?.toggleTab?.()
    onTab?.(id)
  }

  const handleAdd = (e) => {
    e?.stopPropagation?.()
    try {
      if (typeof window !== 'undefined' && window?.navigator?.vibrate) {
        window.navigator.vibrate(10)
      }
    } catch {}
    haptic?.buttonPress?.()
    if (open) {
      open?.('quickActions')
    } else if (onPlus) {
      onPlus?.()
    }
  }

  return (
    <nav className="fixed bottom-6 inset-x-0 z-50 flex items-center justify-center px-4 pointer-events-none select-none">
      {/* 
        Kontainer Dock Utama (Floating Capsule ala Instagram / Threads dengan Glossy Liquid Glass)
      */}
      <div className="pointer-events-auto relative flex items-center justify-between w-full max-w-[340px] h-[58px] px-2 rounded-full bg-white/80 backdrop-blur-2xl border border-white/60 border-t-white/95 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.9),0_10px_30px_rgba(0,0,0,0.08)] dark:bg-[#121214]/85 dark:backdrop-blur-2xl dark:border-white/10 dark:border-t-white/20 dark:shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.15),0_12px_40px_rgba(0,0,0,0.6)]">
        
        {/* 1. Home */}
        <button
          type="button"
          onClick={() => handleTabClick('home')}
          data-testid="nav-home"
          aria-label={t?.('home') || 'Home'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-150 group"
        >
          {tab === 'home' && (
            <motion.div
              layoutId="reiconActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 440,
                damping: 32,
                mass: 0.75,
              }}
              className="absolute inset-1 rounded-full bg-black/[0.06] dark:bg-[#26262a] border border-black/[0.04] dark:border-white/15 shadow-xs dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            {tab === 'home' ? (
              <Home6Filled className="w-[22px] h-[22px] text-zinc-950 dark:text-white scale-105 opacity-100 transition-all duration-200" />
            ) : (
              <Home6Outline className="w-[22px] h-[22px] text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 opacity-70 transition-all duration-200" />
            )}
          </span>
        </button>

        {/* 2. Transactions */}
        <button
          type="button"
          onClick={() => handleTabClick('transactions')}
          data-testid="nav-transactions"
          aria-label={t?.('transactions') || 'Transactions'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-150 group"
        >
          {tab === 'transactions' && (
            <motion.div
              layoutId="reiconActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 440,
                damping: 32,
                mass: 0.75,
              }}
              className="absolute inset-1 rounded-full bg-black/[0.06] dark:bg-[#26262a] border border-black/[0.04] dark:border-white/15 shadow-xs dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            {tab === 'transactions' ? (
              <TransactionMinusFilled className="w-[22px] h-[22px] text-zinc-950 dark:text-white scale-105 opacity-100 transition-all duration-200" />
            ) : (
              <TransactionMinusOutline className="w-[22px] h-[22px] text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 opacity-70 transition-all duration-200" />
            )}
          </span>
        </button>

        {/* 3. Add (+) Button */}
        <button
          type="button"
          onClick={handleAdd}
          data-testid="fab-add"
          aria-label={t?.('add') || 'Add transaction'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-150 group"
        >
          <span className="relative z-10 flex items-center justify-center">
            <PlusOutline className="w-[22px] h-[22px] stroke-[2.6] text-zinc-950 dark:text-white transition-transform duration-200 group-hover:scale-110 active:scale-90" />
          </span>
        </button>

        {/* 4. Goals */}
        <button
          type="button"
          onClick={() => handleTabClick('goals')}
          data-testid="nav-goals"
          aria-label={t?.('goals') || 'Goals'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-150 group"
        >
          {tab === 'goals' && (
            <motion.div
              layoutId="reiconActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 440,
                damping: 32,
                mass: 0.75,
              }}
              className="absolute inset-1 rounded-full bg-black/[0.06] dark:bg-[#26262a] border border-black/[0.04] dark:border-white/15 shadow-xs dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            {tab === 'goals' ? (
              <FlameFilled className="w-[22px] h-[22px] text-zinc-950 dark:text-white scale-105 opacity-100 transition-all duration-200" />
            ) : (
              <FlameOutline className="w-[22px] h-[22px] text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 opacity-70 transition-all duration-200" />
            )}
          </span>
        </button>

        {/* 5. Profile / More */}
        <button
          type="button"
          onClick={() => handleTabClick('more')}
          data-testid="nav-more"
          aria-label={t?.('profile') || t?.('more') || 'Profile'}
          className="relative flex items-center justify-center flex-1 h-full rounded-full cursor-pointer focus:outline-none select-none active:scale-90 transition-transform duration-150 group"
        >
          {tab === 'more' && (
            <motion.div
              layoutId="reiconActiveBubble"
              transition={{
                type: 'spring',
                stiffness: 440,
                damping: 32,
                mass: 0.75,
              }}
              className="absolute inset-1 rounded-full bg-black/[0.06] dark:bg-[#26262a] border border-black/[0.04] dark:border-white/15 shadow-xs dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_12px_rgba(0,0,0,0.3)] pointer-events-none"
            />
          )}
          <span className="relative z-10 flex items-center justify-center">
            {tab === 'more' ? (
              <UserFilled className="w-[22px] h-[22px] text-zinc-950 dark:text-white scale-105 opacity-100 transition-all duration-200" />
            ) : (
              <UserOutline className="w-[22px] h-[22px] text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 opacity-70 transition-all duration-200" />
            )}
          </span>
        </button>

      </div>
    </nav>
  )
}