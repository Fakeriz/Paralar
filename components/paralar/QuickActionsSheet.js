'use client'
import { PlusCircle, ScanLine, PiggyBank, Mic, CreditCard } from 'lucide-react'
import { useApp } from './context'
import { Sheet } from './ui'

export default function QuickActionsSheet({ open, onClose }) {
  const { t, open: openSheet, setTab } = useApp()
  const go = (fn) => { onClose?.(); setTimeout(fn, 120) }
  const tiles = [
    { id: 'add', label: t('add_transaction'), icon: PlusCircle, onClick: () => go(() => openSheet('addTx', {})) },
    { id: 'scan', label: t('scan_receipt'), icon: ScanLine, onClick: () => go(() => openSheet('scan')) },
    { id: 'savings', label: t('add_to_savings'), icon: PiggyBank, onClick: () => go(() => setTab('goals')) },
    { id: 'voice', label: t('voice_log'), icon: Mic, onClick: () => go(() => openSheet('voice')) },
  ]
  return (
    <Sheet open={open} onClose={onClose} title={t('quick_actions')}>
      <div className="grid grid-cols-2 gap-3 pt-2">
        {tiles.map((tile) => (
          <button key={tile.id} type="button" onClick={tile.onClick} className="rounded-2xl bg-card border border-border/40 dark:border-white/5 p-5 flex flex-col items-start gap-3 active:scale-[0.98] transition text-left" data-testid={`qa-${tile.id}`}>
            <div className="h-11 w-11 rounded-xl bg-foreground text-background flex items-center justify-center"><tile.icon size={20} /></div>
            <span className="font-semibold">{tile.label}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => go(() => openSheet('newAccount'))} className="w-full mt-3 rounded-2xl bg-card border border-border/40 dark:border-white/5 p-4 flex items-center gap-3 active:scale-[0.98] transition" data-testid="qa-account">
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center"><CreditCard size={18} /></div>
        <span className="font-semibold">{t('new_account')}</span>
      </button>
      <div className="h-4" />
    </Sheet>
  )
}
