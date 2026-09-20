'use client'
import { useState } from 'react'
import { Target, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, EmptyState, Sheet, SheetTextButton, Field, TextInput, PrimaryButton, Pill } from './ui'
import { getCurrency } from '@/lib/currencies'

const EMOJIS = ['🎯', '✈️', '🏠', '🚗', '💍', '🎓', '📱', '🕋', '🛡️', '💻', '🎁', '🐶']

export default function GoalsTab() {
  const { t, goals = [], fmt, home, store, refresh, open } = useApp()
  const [creating, setCreating] = useState(false)
  const [funding, setFunding] = useState(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [emoji, setEmoji] = useState('🎯')
  const [fund, setFund] = useState('')

  const create = async () => {
    if (!name || !Number(target)) return
    try {
      await store.createGoal({ name, emoji, target_amount: Number(target), saved_amount: 0, currency: home })
      setCreating(false); setName(''); setTarget('')
      await refresh()
      toast.success(t('saved_msg'))
    } catch (e) { toast.error(e?.message || t('error')) }
  }
  const addFunds = async () => {
    if (!funding || !Number(fund)) return
    try {
      await store.updateGoal(funding.id, { saved_amount: (Number(funding.saved_amount) || 0) + Number(fund) })
      setFunding(null); setFund('')
      await refresh()
      toast.success(t('saved_msg'))
    } catch (e) { toast.error(e?.message || t('error')) }
  }
  const remove = async (g) => {
    try { await store.deleteGoal(g.id); await refresh(); toast.success(t('deleted')) } catch (e) { toast.error(e?.message || t('error')) }
  }

  return (
    <div className="px-5 pb-28">
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('savings_goals')}</h1>
        <button type="button" onClick={() => setCreating(true)} className="h-10 w-10 rounded-full bg-foreground text-background flex items-center justify-center" data-testid="new-goal"><Plus size={20} /></button>
      </div>

      {goals.length === 0 ? (
        <Card className="mt-5"><EmptyState icon={Target} title={t('no_goals')} subtitle={t('no_goals_sub')} /></Card>
      ) : (
        <div className="mt-5 space-y-3">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round(((Number(g.saved_amount) || 0) / Math.max(1, Number(g.target_amount) || 1)) * 100))
            return (
              <Card key={g.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-2xl">{g.emoji || '🎯'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(g.saved_amount, g.currency || home)} {t('of')} {fmt(g.target_amount, g.currency || home)}</p>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{pct}%</p>
                </div>
                <div className="h-2 rounded-full bg-muted mt-3 overflow-hidden"><div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setFunding(g)} className="flex-1 rounded-xl bg-foreground text-background text-sm font-semibold py-2.5">{t('add_funds')}</button>
                  <button type="button" onClick={() => remove(g)} className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center" aria-label="delete"><Trash2 size={16} /></button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('new_goal')} left={<SheetTextButton muted onClick={() => setCreating(false)}>{t('cancel')}</SheetTextButton>} right={<SheetTextButton bold onClick={create}>{t('save')}</SheetTextButton>}>
        <div className="space-y-5 pt-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
            {EMOJIS.map((e) => <Pill key={e} active={emoji === e} onClick={() => setEmoji(e)} className="text-lg px-3">{e}</Pill>)}
          </div>
          <Field label={t('goal_name')}><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('goal_placeholder')} data-testid="goal-name" /></Field>
          <Field label={`${t('target_amount')} (${home})`}><TextInput type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" data-testid="goal-target" /></Field>
          <PrimaryButton onClick={create} disabled={!name || !Number(target)}>{t('create')}</PrimaryButton>
        </div>
      </Sheet>

      <Sheet open={!!funding} onClose={() => setFunding(null)} title={t('add_funds')}>
        <div className="space-y-5 pt-2">
          <p className="text-center text-4xl">{funding?.emoji}</p>
          <p className="text-center font-bold">{funding?.name}</p>
          <Field label={`${t('amount')} (${getCurrency(funding?.currency || home).code})`}><TextInput type="number" inputMode="decimal" value={fund} onChange={(e) => setFund(e.target.value)} placeholder="0" autoFocus /></Field>
          <PrimaryButton onClick={addFunds} disabled={!Number(fund)}>{t('save')}</PrimaryButton>
        </div>
      </Sheet>
    </div>
  )
}
