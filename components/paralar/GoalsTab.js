'use client'
import { useState } from 'react'
import { Target, Plane, Home, Car, Gem, GraduationCap, ShieldCheck, TrendingUp, Heart, Gift, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, EmptyState, Sheet, SheetTextButton, Field, TextInput, PrimaryButton } from './ui'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'

// Pure monochrome outline goal icons (Lucide). No system emoji.
const GOAL_ICONS = [
  { id: 'target', Icon: Target },
  { id: 'travel', Icon: Plane },
  { id: 'home', Icon: Home },
  { id: 'car', Icon: Car },
  { id: 'wedding', Icon: Gem },
  { id: 'education', Icon: GraduationCap },
  { id: 'gadget', Icon: ShieldCheck },
  { id: 'invest', Icon: TrendingUp },
  { id: 'love', Icon: Heart },
  { id: 'gift', Icon: Gift },
]
const goalIcon = (id) => GOAL_ICONS.find((g) => g.id === id)?.Icon || Target

export default function GoalsTab() {
  const { t, goals = [], fmt, home, store, refresh } = useApp()
  const [creating, setCreating] = useState(false)
  const [funding, setFunding] = useState(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [icon, setIcon] = useState('target')
  const [fund, setFund] = useState('')

  const create = async () => {
    if (!name || !Number(target)) return
    try {
      await store.createGoal({ name, icon, target_amount: Number(target), saved_amount: 0, currency: home })
      setCreating(false); setName(''); setTarget(''); setIcon('target')
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

  const FundingIcon = funding ? goalIcon(funding.icon) : Target

  return (
    <div className="px-5 pb-28">
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">{t('savings_goals')}</h1>
        <button type="button" onClick={() => setCreating(true)} className="h-10 w-10 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center transition-colors" data-testid="new-goal"><Plus size={20} /></button>
      </div>

      {goals.length === 0 ? (
        <Card className="mt-5"><EmptyState icon={Target} title={t('no_goals')} subtitle={t('no_goals_sub')} /></Card>
      ) : (
        <div className="mt-5 space-y-3">
          {(goals || []).map((g) => {
            const pct = Math.min(100, Math.round(((Number(g?.saved_amount) || 0) / Math.max(1, Number(g?.target_amount) || 1)) * 100))
            const GIcon = goalIcon(g?.icon)
            return (
              <Card key={g.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                    <GIcon size={22} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-zinc-950 dark:text-white">{g?.name}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">{fmt(g?.saved_amount, g?.currency || home)} {t('of')} {fmt(g?.target_amount, g?.currency || home)}</p>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-zinc-950 dark:text-white">{pct}%</p>
                </div>
                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 mt-3 overflow-hidden"><div className="h-full bg-zinc-950 dark:bg-white rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setFunding(g)} className="flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-sm font-bold py-2.5 transition-colors">{t('add_funds')}</button>
                  <button type="button" onClick={() => remove(g)} className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors" aria-label="delete"><Trash2 size={16} /></button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('new_goal')} left={<SheetTextButton muted onClick={() => setCreating(false)}>{t('cancel')}</SheetTextButton>} right={<SheetTextButton bold onClick={create}>{t('save')}</SheetTextButton>}>
        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
            {GOAL_ICONS.map(({ id, Icon }) => {
              const active = icon === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIcon(id)}
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all',
                    active
                      ? 'bg-zinc-950 text-white shadow-md ring-2 ring-zinc-950 ring-offset-2 ring-offset-white dark:bg-white dark:text-zinc-950 dark:ring-white dark:ring-offset-zinc-900'
                      : 'bg-zinc-100 text-zinc-600 border border-zinc-200/60 dark:bg-zinc-900 dark:text-zinc-400 dark:border-white/10'
                  )}
                  data-testid={`goal-icon-${id}`}
                >
                  <Icon size={20} strokeWidth={active ? 2 : 1.5} />
                </button>
              )
            })}
          </div>
          <Field label={t('goal_name')}><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('goal_placeholder')} data-testid="goal-name" /></Field>
          <Field label={`${t('target_amount')} (${home})`}><TextInput type="number" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" data-testid="goal-target" /></Field>
          <PrimaryButton onClick={create} disabled={!name || !Number(target)}>{t('create')}</PrimaryButton>
        </div>
      </Sheet>

      <Sheet open={!!funding} onClose={() => setFunding(null)} title={t('add_funds')}>
        <div className="space-y-5 pt-2">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-950 dark:text-white"><FundingIcon size={28} strokeWidth={1.75} /></div>
          </div>
          <p className="text-center font-bold text-zinc-950 dark:text-white text-lg">{funding?.name}</p>
          <Field label={`${t('amount')} (${getCurrency(funding?.currency || home).code})`}><TextInput type="number" inputMode="decimal" value={fund} onChange={(e) => setFund(e.target.value)} placeholder="0" autoFocus /></Field>
          <PrimaryButton onClick={addFunds} disabled={!Number(fund)}>{t('save')}</PrimaryButton>
        </div>
      </Sheet>
    </div>
  )
}
