'use client'
import { useState, useEffect } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { Pencil, Trash2 } from 'lucide-react'
import TransactionRow from './TransactionRow'

export default function SwipeTransactionRow({ tx, isOpen, onOpenChange, onOpenDetail, onEdit, onDelete }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const controls = useAnimation()
  const ACTION_WIDTH = 110

  useEffect(() => {
    if (isOpen !== undefined) {
      setInternalOpen(isOpen)
      controls.start({
        x: isOpen ? -ACTION_WIDTH : 0,
        transition: { type: 'spring', stiffness: 400, damping: 32 },
      })
    }
  }, [isOpen, controls])

  const handleDragEnd = async (_, info) => {
    if (info.offset.x < -40 || info.velocity.x < -250) {
      await controls.start({ x: -ACTION_WIDTH, transition: { type: 'spring', stiffness: 400, damping: 32 } })
      setInternalOpen(true)
      onOpenChange?.(true)
    } else {
      await controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } })
      setInternalOpen(false)
      onOpenChange?.(false)
    }
  }

  const closeSwipe = () => {
    controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } })
    setInternalOpen(false)
    onOpenChange?.(false)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl select-none my-2 touch-pan-y" data-testid="tx-swipe-row">
      {/* Background Actions */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-3 gap-2 w-full z-0 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            closeSwipe()
            onEdit?.()
          }}
          className="w-9 h-9 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-foreground flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
          aria-label="edit transaction"
          data-testid="tx-swipe-edit"
        >
          <Pencil size={17} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => {
            closeSwipe()
            onDelete?.()
          }}
          className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-xs active:scale-90 transition-transform cursor-pointer"
          aria-label="delete transaction"
          data-testid="tx-swipe-delete"
        >
          <Trash2 size={17} strokeWidth={2} />
        </button>
      </div>

      {/* Draggable Foreground Card */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -110, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="relative z-10 w-full bg-card bg-white dark:bg-[#18181b] border border-border/40 dark:border-white/10 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-xs transition-colors"
      >
        <div className="w-full">
          <TransactionRow
            tx={tx}
            onClick={() => {
              if (internalOpen) {
                closeSwipe()
              } else {
                onOpenDetail?.()
              }
            }}
          />
        </div>
      </motion.div>
    </div>
  )
}
