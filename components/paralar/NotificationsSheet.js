'use client'

import { useState, useEffect, useMemo } from 'react'
import { Bell, Calendar, Clock, AlertTriangle, Sparkles, ChevronRight, X, CheckCheck } from 'lucide-react'
import { useApp } from './context'
import { Sheet, EmptyState } from './ui'
import { deriveNotifications } from '@/lib/notifications'
import { cn } from '@/lib/utils'

export default function NotificationsSheet({ open, onClose }) {
  const {
    t,
    open: openSheet,
    setTab,
    bills: ctxBills = [],
    budgets: ctxBudgets = [],
    goals = [],
    transactions = [],
    home = 'USD',
    rates = {},
    fmt,
    store,
  } = useApp()

  const [localBills, setLocalBills] = useState([])
  const [localBudgets, setLocalBudgets] = useState([])
  const [dismissedIds, setDismissedIds] = useState([])

  // Refresh bills & budgets on sheet open to ensure live derived state
  useEffect(() => {
    if (!open) return
    let active = true

    const loadLive = async () => {
      try {
        const [b, bg] = await Promise.all([
          store?.listBills ? store.listBills() : Promise.resolve([]),
          store?.listBudgets ? store.listBudgets() : Promise.resolve([]),
        ])
        if (active) {
          if (Array.isArray(b)) setLocalBills(b)
          if (Array.isArray(bg)) setLocalBudgets(bg)
        }
      } catch (err) {
        console.warn('NotificationsSheet live load error:', err)
      }
    }

    loadLive()
    return () => {
      active = false
    }
  }, [open, store])

  const effectiveBills = localBills.length > 0 ? localBills : ctxBills
  const effectiveBudgets = localBudgets.length > 0 ? localBudgets : ctxBudgets

  const { notifications, hasUrgent } = useMemo(() => {
    return deriveNotifications({
      bills: effectiveBills,
      budgets: effectiveBudgets,
      goals,
      transactions,
      home,
      rates,
      fmt,
      t,
    })
  }, [effectiveBills, effectiveBudgets, goals, transactions, home, rates, fmt, t])

  const visibleNotifications = useMemo(() => {
    return notifications.filter((n) => !dismissedIds.includes(n.id))
  }, [notifications, dismissedIds])

  const handleNotificationClick = (n) => {
    if (!n.action) return

    onClose?.()
    if (n.action === 'bills') {
      setTimeout(() => {
        openSheet?.('bills')
      }, 150)
    } else if (n.action === 'goals') {
      setTimeout(() => {
        setTab?.('goals')
      }, 150)
    }
  }

  const dismissNotification = (e, id) => {
    e.stopPropagation()
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const clearAllNotifications = () => {
    setDismissedIds(notifications.map((n) => n.id))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('notifications')}
      right={
        visibleNotifications.length > 0 && hasUrgent ? (
          <button
            type="button"
            onClick={clearAllNotifications}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            Bersihkan
          </button>
        ) : null
      }
    >
      <div className="pt-2 pb-6">
        {visibleNotifications.length === 0 ? (
          <EmptyState icon={Bell} title={t('no_notifications')} />
        ) : (
          <div className="space-y-2.5">
            {visibleNotifications.map((n) => {
              const isClickable = Boolean(n.action)

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      handleNotificationClick(n)
                    }
                  }}
                  className={cn(
                    'bg-muted/30 border border-border/40 rounded-2xl p-4 flex gap-3.5 mb-2.5 text-left transition-all relative group',
                    isClickable
                      ? 'cursor-pointer hover:bg-muted/50 active:scale-[0.985]'
                      : 'select-none'
                  )}
                >
                  {/* Icon container */}
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl shrink-0 flex items-center justify-center border',
                      n.type === 'budget'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                        : n.isOverdue
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        : n.type === 'bill'
                        ? 'bg-zinc-100 border-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:border-white/10 dark:text-white'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:border-white/10 dark:text-white'
                    )}
                  >
                    {n.iconType === 'alert-triangle' && (
                      <AlertTriangle size={18} className="text-amber-500" strokeWidth={1.75} />
                    )}
                    {n.iconType === 'clock' && (
                      <Clock
                        size={18}
                        className={n.isOverdue ? 'text-rose-500' : 'text-zinc-900 dark:text-white'}
                        strokeWidth={1.75}
                      />
                    )}
                    {n.iconType === 'calendar' && (
                      <Calendar size={18} className="text-zinc-900 dark:text-white" strokeWidth={1.75} />
                    )}
                    {n.iconType === 'sparkles' && (
                      <Sparkles size={18} className="text-zinc-900 dark:text-white" strokeWidth={1.75} />
                    )}
                  </div>

                  {/* Body text */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                        {n.title}
                      </p>
                      {n.isUrgent && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 tracking-wide',
                            n.isOverdue
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : n.type === 'budget'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-white/10'
                          )}
                        >
                          {n.isOverdue ? 'Terlewat' : n.type === 'budget' ? 'Anggaran' : 'Mendekati Tempo'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {n.description}
                    </p>

                    {isClickable && (
                      <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-zinc-900 dark:text-white group-hover:underline">
                        <span>{n.action === 'bills' ? 'Buka Tagihan' : 'Buka Tab Goals'}</span>
                        <ChevronRight size={13} strokeWidth={2} />
                      </div>
                    )}
                  </div>

                  {/* Dismiss button */}
                  <button
                    type="button"
                    onClick={(e) => dismissNotification(e, n.id)}
                    className="absolute top-3.5 right-3.5 h-6 w-6 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-colors"
                    aria-label="Tutup notifikasi"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Sheet>
  )
}
