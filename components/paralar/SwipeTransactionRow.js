'use client'
import { motion } from 'framer-motion'
import { Pencil, Trash2 } from 'lucide-react'
import TransactionRow from './TransactionRow'

// Horizontal swipe-to-reveal Edit/Delete actions. Vertical scroll stays free (touchAction pan-y).
export default function SwipeTransactionRow({ tx, isOpen, onOpenChange, onOpenDetail, onEdit, onDelete }) {
  const handleDragEnd = (_e, info) => {
    const off = info?.offset?.x || 0
    const vel = info?.velocity?.x || 0
    if (off < -60 || vel < -400) onOpenChange?.(true)
    else onOpenChange?.(false)
  }

  return (
    <div className="relative">
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-0.5">
        <button type="button" onClick={() => { onOpenChange?.(false); onEdit?.() }} className="h-11 w-11 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-foreground flex items-center justify-center active:scale-95 transition" aria-label="edit" data-testid="tx-swipe-edit"><Pencil size={17} strokeWidth={1.75} /></button>
        <button type="button" onClick={() => { onOpenChange?.(false); onDelete?.() }} className="h-11 w-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center active:scale-95 transition" aria-label="delete" data-testid="tx-swipe-delete"><Trash2 size={17} strokeWidth={1.75} /></button>
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.06}
        style={{ touchAction: 'pan-y' }}
        animate={{ x: isOpen ? -140 : 0 }}
        transition={{ type: 'spring', damping: 34, stiffness: 340 }}
        onDragEnd={handleDragEnd}
        className="relative bg-card"
      >
        <TransactionRow tx={tx} onClick={() => { if (isOpen) onOpenChange?.(false); else onOpenDetail?.() }} />
      </motion.div>
    </div>
  )
}
