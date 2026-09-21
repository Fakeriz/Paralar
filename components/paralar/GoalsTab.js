'use client'
import { useEffect, useState, useMemo } from 'react'
import {
  Target, Plane, Home, Car, Gem, GraduationCap, ShieldCheck, TrendingUp,
  Heart, Gift, Plus, Trash2, Repeat
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, EmptyState, Sheet, SheetTextButton, Field, TextInput, PrimaryButton } from './ui'
import SubscriptionSheet from './SubscriptionSheet'
import { getCurrency } from '@/lib/currencies'
import { convert } from '@/lib/rates'
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

function formatCycle(cycle) {
  if (!cycle) return 'Monthly'
  if (cycle === 'weekly') return 'Weekly'
  if (cycle === 'monthly') return 'Monthly'
  if (cycle === '3_months') return '3 Months'
  if (cycle === '6_months') return '6 Months'
  if (cycle === 'yearly') return 'Yearly'
  return cycle.charAt(0).toUpperCase() + cycle.slice(1)
}

export default function GoalsTab() {
  const { t, goals = [], fmt, home, rates, store, refresh } = useApp()

  // Goals State
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [funding, setFunding] = useState(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [icon, setIcon] = useState('target')
  const [fund, setFund] = useState('')

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState([])
  const [subSheetOpen, setSubSheetOpen] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)

  const loadSubscriptions = async () => {
    try {
      if (store?.listSubscriptions) {
        const list = await store.listSubscriptions()
        setSubscriptions(Array.isArray(list) ? list : [])
      }
    } catch {
      setSubscriptions([])
    }
  }

  useEffect(() => {
    loadSubscriptions()
  }, []) // eslint-disable-line

  // Calculate total monthly accumulation
  const monthlyTotal = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return 0
    return subscriptions.reduce((sum, s) => {
      const rawAmt = Number(s.amount) || 0
      let monthlyAmt = rawAmt
      if (s.cycle === 'weekly') {
        monthlyAmt = rawAmt * (52 / 12)
      } else if (s.cycle === '3_months') {
        monthlyAmt = rawAmt / 3
      } else if (s.cycle === '6_months') {
        monthlyAmt = rawAmt / 6
      } else if (s.cycle === 'yearly') {
        monthlyAmt = rawAmt / 12
      }
      const inHome = convert(monthlyAmt, s.currency || home, home, rates)
      return sum + (Number(inHome) || 0)
    }, 0)
  }, [subscriptions, home, rates])

  // Goal actions
  const createGoal = async () => {
    if (!name || !Number(target)) return
    try {
      await store.createGoal({ name, icon, target_amount: Number(target), saved_amount: 0, currency: home })
      setCreatingGoal(false)
      setName('')
      setTarget('')
      setIcon('target')
      await refresh()
      toast.success(t('saved_msg'))
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const addFunds = async () => {
    if (!funding || !Number(fund)) return
    try {
      await store.updateGoal(funding.id, { saved_amount: (Number(funding.saved_amount) || 0) + Number(fund) })
      setFunding(null)
      setFund('')
      await refresh()
      toast.success(t('saved_msg'))
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const removeGoal = async (g) => {
    try {
      await store.deleteGoal(g.id)
      await refresh()
      toast.success(t('deleted'))
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  // Subscription sheet triggers
  const openNewSub = () => {
    setSelectedSub(null)
    setSubSheetOpen(true)
  }

  const openEditSub = (sub) => {
    setSelectedSub(sub)
    setSubSheetOpen(true)
  }

  const FundingIcon = funding ? goalIcon(funding.icon) : Target

  return (
    <div className="px-5 pb-28">
      {/* Header */}
      <div className="pt-6 pb-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          {t('goals') || 'Goals'}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
          Plan, save, and clear debt
        </p>
      </div>

      {/* 1. SECTION: SUBSCRIPTIONS */}
      <div className="mt-6">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            SUBSCRIPTIONS
          </span>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(monthlyTotal, home)}/mo
            </span>
            <button
              type="button"
              onClick={openNewSub}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              aria-label="Add subscription"
              data-testid="new-subscription"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Active Subscriptions Cards */}
        {subscriptions.length === 0 ? (
          <button
            type="button"
            onClick={openNewSub}
            className="w-full rounded-2xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground hover:border-foreground/30 hover:bg-muted/10 transition-all cursor-pointer block"
          >
            + Add your first subscription
          </button>
        ) : (
          <div className="space-y-2.5">
            {subscriptions.map((sub) => {
              const cycleDisplay = formatCycle(sub.cycle)
              const dateDisplay = sub.next_billing_date || (sub.due_day ? `Day ${sub.due_day}` : '')
              return (
                <div
                  key={sub.id}
                  onClick={() => openEditSub(sub)}
                  className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between hover:bg-muted/20 transition-all cursor-pointer shadow-xs"
                  data-testid={`subscription-card-${sub.id}`}
                >
                  {/* Left: Logo/Cover */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden object-cover bg-muted flex items-center justify-center shrink-0 border border-border/20">
                      {sub.cover_url ? (
                        <img
                          src={sub.cover_url}
                          alt={sub.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold uppercase text-foreground">
                          {sub.name ? sub.name.slice(0, 2) : <Repeat size={18} />}
                        </span>
                      )}
                    </div>
                    {/* Middle: Name + Cycle & Next billing date */}
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {sub.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {cycleDisplay}{dateDisplay ? ` · ${dateDisplay}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Amount */}
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-foreground">
                      {fmt(sub.amount, sub.currency || home)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 2. SECTION: SAVINGS GOALS */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t('savings_goals') || 'SAVINGS GOALS'}
          </span>
          <button
            type="button"
            onClick={() => setCreatingGoal(true)}
            className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
            aria-label={t('new_goal')}
            data-testid="new-goal"
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>

        {goals.length === 0 ? (
          <Card>
            <EmptyState icon={Target} title={t('no_goals')} subtitle={t('no_goals_sub')} />
          </Card>
        ) : (
          <div className="space-y-3">
            {(goals || []).map((g) => {
              const pct = Math.min(
                100,
                Math.round(((Number(g?.saved_amount) || 0) / Math.max(1, Number(g?.target_amount) || 1)) * 100)
              )
              const GIcon = goalIcon(g?.icon)
              return (
                <Card key={g.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-950 dark:text-white">
                      <GIcon size={22} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-zinc-950 dark:text-white">{g?.name}</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                        {fmt(g?.saved_amount, g?.currency || home)} {t('of')} {fmt(g?.target_amount, g?.currency || home)}
                      </p>
                    </div>
                    <p className="text-xl font-bold tabular-nums text-zinc-950 dark:text-white">{pct}%</p>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 mt-3 overflow-hidden">
                    <div
                      className="h-full bg-zinc-950 dark:bg-white rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setFunding(g)}
                      className="flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-sm font-bold py-2.5 transition-colors cursor-pointer"
                    >
                      {t('add_funds')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(g)}
                      className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Subscription Detail / Edit Bottom Sheet */}
      <SubscriptionSheet
        open={subSheetOpen}
        onClose={() => setSubSheetOpen(false)}
        subscription={selectedSub}
        onSaved={async () => {
          await loadSubscriptions()
          await refresh()
        }}
        onDeleted={async () => {
          await loadSubscriptions()
          await refresh()
        }}
      />

      {/* Sheet: Create Goal */}
      <Sheet
        open={creatingGoal}
        onClose={() => setCreatingGoal(false)}
        title={t('new_goal')}
        left={
          <SheetTextButton muted onClick={() => setCreatingGoal(false)}>
            {t('cancel')}
          </SheetTextButton>
        }
        right={
          <SheetTextButton bold onClick={createGoal}>
            {t('save')}
          </SheetTextButton>
        }
      >
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
                    'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all cursor-pointer',
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
          <Field label={t('goal_name')}>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('goal_placeholder')}
              data-testid="goal-name"
            />
          </Field>
          <Field label={`${t('target_amount')} (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="0"
              data-testid="goal-target"
            />
          </Field>
          <PrimaryButton onClick={createGoal} disabled={!name || !Number(target)}>
            {t('create')}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* Sheet: Add Funds */}
      <Sheet open={!!funding} onClose={() => setFunding(null)} title={t('add_funds')}>
        <div className="space-y-5 pt-2">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-950 dark:text-white">
              <FundingIcon size={28} strokeWidth={1.75} />
            </div>
          </div>
          <p className="text-center font-bold text-zinc-950 dark:text-white text-lg">{funding?.name}</p>
          <Field label={`${t('amount')} (${getCurrency(funding?.currency || home).code})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={fund}
              onChange={(e) => setFund(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </Field>
          <PrimaryButton onClick={addFunds} disabled={!Number(fund)}>
            {t('save')}
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  )
}
