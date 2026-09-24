'use client'
import { PlusCircle, ScanLine, PiggyBank, Mic, CreditCard, FileText } from 'lucide-react'
import { useApp } from './context'
import { Sheet } from './ui'

export default function QuickActionsSheet({ open, onClose }) {
  const { t, open: openSheet, setTab, isAiAllowed } = useApp()
  const go = (fn) => { onClose?.(); setTimeout(fn, 120) }
  const tiles = [
    { id: 'add', label: t('add_transaction'), icon: PlusCircle, onClick: () => go(() => openSheet('addTx', {})) },
    {
      id: 'scan',
      label: t('scan_receipt'),
      icon: ScanLine,
      onClick: () => go(() => {
        if (!isAiAllowed) {
          openSheet('aiPremium')
        } else {
          openSheet('scan')
        }
      }),
    },
    { id: 'savings', label: t('add_to_savings'), icon: PiggyBank, onClick: () => go(() => setTab('goals')) },
    {
      id: 'voice',
      label: t('voice_log'),
      icon: Mic,
      onClick: () => go(() => {
        if (!isAiAllowed) {
          openSheet('aiPremium')
        } else {
          openSheet('voice')
        }
      }),
    },
  ]
  return (
    <Sheet open={open} onClose={onClose} title={t('quick_actions')}>
      <div className="grid grid-cols-2 gap-3 pt-2">
        {tiles.map((tile) => (
          <button key={tile.id} type="button" onClick={tile.onClick} className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-5 flex flex-col items-start gap-3 active:scale-[0.98] transition text-left" data-testid={`qa-${tile.id}`}>
            <div className="h-11 w-11 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center"><tile.icon size={20} /></div>
            <span className="font-bold text-sm text-zinc-950 dark:text-white">{tile.label}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => go(() => openSheet('bills'))} className="w-full mt-3 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-4 flex items-center gap-3 active:scale-[0.98] transition" data-testid="qa-bills">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><FileText size={18} /></div>
        <div className="flex-1 text-left">
          <span className="font-bold text-zinc-950 dark:text-white text-sm block">{t('bills_tracker') || t('bills')}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('bills_checklist_subtitle')}</span>
        </div>
      </button>
      <button type="button" onClick={() => go(() => openSheet('newAccount'))} className="w-full mt-2 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-4 flex items-center gap-3 active:scale-[0.98] transition" data-testid="qa-account">
        <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center"><CreditCard size={18} /></div>
        <span className="font-bold text-zinc-950 dark:text-white text-sm">{t('new_account')}</span>
      </button>
      <div className="h-4" />
    </Sheet>
  )
}
