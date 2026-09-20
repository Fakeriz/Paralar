'use client'
import { Plus, Trash2, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, EmptyState } from './ui'
import { PreviewCard } from './NewAccountSheet'

export default function AccountsSheet({ open, onClose }) {
  const { t, accounts = [], fmt, store, refresh, open: openSheet } = useApp()
  const remove = async (a) => {
    try { await store.deleteAccount(a.id); await refresh(); toast.success(t('deleted')) } catch (e) { toast.error(e?.message || t('error')) }
  }
  return (
    <Sheet open={open} onClose={onClose} full title={t('accounts_cards')} right={<button type="button" onClick={() => { onClose?.(); setTimeout(() => openSheet('newAccount'), 120) }} className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center"><Plus size={18} /></button>}>
      {accounts.length === 0 ? (
        <EmptyState icon={CreditCard} title={t('no_transactions')} subtitle={t('new_account')} />
      ) : (
        <div className="space-y-4 pt-2">
          {accounts.map((a) => (
            <div key={a.id} className="relative">
              <PreviewCard name={a.name} balance={a.balance} currency={a.currency} theme={a.theme} logo={a.logo} fmt={fmt} />
              <button type="button" onClick={() => remove(a)} className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/30 backdrop-blur text-white flex items-center justify-center" aria-label="delete"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
