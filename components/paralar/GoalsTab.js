'use client'
import { useEffect, useState } from 'react'
import {
  Target, Plane, Home, Car, Gem, GraduationCap, ShieldCheck, TrendingUp,
  Heart, Gift, Plus, Trash2, Repeat, Calendar, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, EmptyState, Sheet, SheetTextButton, Field, TextInput, PrimaryButton, Segmented } from './ui'
import { getCurrency } from '@/lib/currencies'
import { CATEGORIES } from '@/lib/categories'
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

const EXPENSE_CATS = CATEGORIES.filter((c) => c.types?.includes('expense'))

export default function GoalsTab() {
  const { t, goals = [], fmt, home, store, refresh, accounts = [] } = useApp()
  const [activeTab, setActiveTab] = useState('goals') // 'goals' | 'subscriptions'

  // Goals State
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [funding, setFunding] = useState(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [icon, setIcon] = useState('target')
  const [fund, setFund] = useState('')

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState([])
  const [creatingSub, setCreatingSub] = useState(false)
  const [subName, setSubName] = useState('')
  const [subAmount, setSubAmount] = useState('')
  const [subDueDay, setSubDueDay] = useState('1')
  const [subCycle, setSubCycle] = useState('monthly')
  const [subCategory, setSubCategory] = useState('cat_entertainment')
  const [subShowAsBill, setSubShowAsBill] = useState(true)
  const [subAutoLog, setSubAutoLog] = useState(false)
  const [subAccountId, setSubAccountId] = useState(null)
  const [savingSub, setSavingSub] = useState(false)

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

  // Subscription actions
  const openNewSub = () => {
    setSubName('')
    setSubAmount('')
    setSubDueDay('1')
    setSubCycle('monthly')
    setSubCategory('cat_entertainment')
    setSubShowAsBill(true)
    setSubAutoLog(false)
    setSubAccountId(accounts[0]?.id || null)
    setCreatingSub(true)
  }

  const saveSubscription = async () => {
    if (!subName.trim() || !Number(subAmount) || savingSub) return
    setSavingSub(true)
    try {
      if (store?.createSubscription) {
        await store.createSubscription({
          name: subName.trim(),
          amount: Number(subAmount),
          currency: home,
          due_day: Math.min(31, Math.max(1, Number(subDueDay) || 1)),
          cycle: subCycle,
          category: subCategory,
          show_as_bill: subShowAsBill,
          auto_log_expense: subAutoLog,
          account_id: subAccountId,
        })
        await loadSubscriptions()
        setCreatingSub(false)
        toast.success(t('saved_msg'))
      }
    } catch (e) {
      toast.error(e?.message || t('error'))
    } finally {
      setSavingSub(false)
    }
  }

  const toggleSubShowAsBill = async (s) => {
    const nextVal = !s.show_as_bill
    try {
      if (store?.updateSubscription) {
        await store.updateSubscription(s.id, { show_as_bill: nextVal })
        await loadSubscriptions()
        toast.success(t('saved_msg'))
      }
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const removeSubscription = async (s) => {
    try {
      if (store?.deleteSubscription) {
        await store.deleteSubscription(s.id)
        await loadSubscriptions()
        toast.success(t('deleted'))
      }
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const FundingIcon = funding ? goalIcon(funding.icon) : Target

  return (
    <div className="px-5 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            {activeTab === 'goals' ? t('savings_goals') : t('subscriptions')}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => (activeTab === 'goals' ? setCreatingGoal(true) : openNewSub())}
          className="h-10 w-10 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center transition-colors active:scale-95 shadow-sm"
          data-testid={activeTab === 'goals' ? 'new-goal' : 'new-subscription'}
          aria-label={activeTab === 'goals' ? t('new_goal') : t('new_subscription')}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Segmented Switcher */}
      <div className="mt-4">
        <Segmented
          options={[
            { value: 'goals', label: t('savings_goals') },
            { value: 'subscriptions', label: t('subscriptions') },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* VIEW: SAVINGS GOALS */}
      {activeTab === 'goals' && (
        <>
          {goals.length === 0 ? (
            <Card className="mt-5">
              <EmptyState icon={Target} title={t('no_goals')} subtitle={t('no_goals_sub')} />
            </Card>
          ) : (
            <div className="mt-5 space-y-3">
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
                        className="flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-sm font-bold py-2.5 transition-colors"
                      >
                        {t('add_funds')}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGoal(g)}
                        className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition-colors"
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
        </>
      )}

      {/* VIEW: SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <>
          {subscriptions.length === 0 ? (
            <Card className="mt-5">
              <EmptyState
                icon={Repeat}
                title={t('no_subscriptions')}
                subtitle={t('no_subscriptions_sub')}
              />
              <div className="px-5 pb-6 pt-1 text-center">
                <button
                  type="button"
                  onClick={openNewSub}
                  className="rounded-xl bg-emerald-600 text-white font-bold px-5 py-2.5 text-sm active:scale-95 transition-all shadow-sm inline-flex items-center gap-2 hover:bg-emerald-700"
                >
                  <Plus size={16} />
                  {t('new_subscription')}
                </button>
              </div>
            </Card>
          ) : (
            <div className="mt-5 space-y-3">
              {subscriptions.map((s) => (
                <Card key={s.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Repeat size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[15px] truncate text-zinc-950 dark:text-white">{s.name}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {s.cycle === 'yearly' ? t('yearly') : t('monthly')}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {t('due_on_day', { day: s.due_day || 1 })} · {t(s.category?.startsWith('cat_') ? s.category : `cat_${s.category || 'bills'}`)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-[15px] tabular-nums text-zinc-950 dark:text-white">
                        {fmt(s.amount, s.currency || home)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeSubscription(s)}
                        className="text-[11px] text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 inline-flex items-center gap-1 mt-1 transition-colors"
                        aria-label="delete subscription"
                      >
                        <Trash2 size={12} /> {t('delete')}
                      </button>
                    </div>
                  </div>

                  {/* Toggle: Show as bill */}
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-950 dark:text-white block">{t('show_as_bill')}</span>
                      <span className="text-[11px] text-zinc-400">{t('show_as_bill_sub')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSubShowAsBill(s)}
                      className={cn(
                        'w-10 h-5 rounded-full transition-colors relative shrink-0 ml-3',
                        s.show_as_bill ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                      )}
                      role="switch"
                      aria-checked={s.show_as_bill}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5',
                          s.show_as_bill ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

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

      {/* Sheet: Create Subscription */}
      <Sheet
        open={creatingSub}
        onClose={() => setCreatingSub(false)}
        title={t('new_subscription')}
        left={
          <button
            type="button"
            onClick={() => setCreatingSub(false)}
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            {t('cancel')}
          </button>
        }
        right={
          <button
            type="button"
            onClick={saveSubscription}
            disabled={!subName.trim() || !Number(subAmount) || savingSub}
            className={cn(
              'text-[15px] font-bold py-1 px-1 text-emerald-600 dark:text-emerald-400',
              (!subName.trim() || !Number(subAmount) || savingSub) && 'opacity-40'
            )}
            data-testid="sub-save"
          >
            {savingSub ? '...' : t('save')}
          </button>
        }
      >
        <div className="space-y-5 pt-2">
          <Field label={t('bill_title')}>
            <TextInput
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              placeholder="Netflix, Spotify, iCloud, Gym"
              data-testid="sub-name"
            />
          </Field>

          <Field label={`${t('amount')} (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={subAmount}
              onChange={(e) => setSubAmount(e.target.value)}
              placeholder="0"
              className="text-lg font-bold"
              data-testid="sub-amount"
            />
          </Field>

          <Field label={t('billing_cycle')}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSubCycle('monthly')}
                className={cn(
                  'rounded-xl border py-2.5 text-sm font-bold transition-all',
                  subCycle === 'monthly'
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                )}
              >
                {t('monthly')}
              </button>
              <button
                type="button"
                onClick={() => setSubCycle('yearly')}
                className={cn(
                  'rounded-xl border py-2.5 text-sm font-bold transition-all',
                  subCycle === 'yearly'
                    ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                    : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300'
                )}
              >
                {t('yearly')}
              </button>
            </div>
          </Field>

          <Field label={t('due_day_of_month')}>
            <TextInput
              type="number"
              inputMode="numeric"
              min="1"
              max="31"
              value={subDueDay}
              onChange={(e) => setSubDueDay(e.target.value)}
              placeholder="1"
              data-testid="sub-due"
            />
          </Field>

          <Field label={t('category')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {EXPENSE_CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSubCategory(c.id)}
                  className={cn(
                    'shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
                    subCategory === c.id
                      ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white'
                      : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white'
                  )}
                >
                  {t(`cat_${c.id}`)}
                </button>
              ))}
            </div>
          </Field>

          {/* Toggle: Show as bill */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-zinc-950 dark:text-white">
                  {t('show_as_bill')}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('show_as_bill_sub')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubShowAsBill(!subShowAsBill)}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative shrink-0',
                  subShowAsBill ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
                )}
                role="switch"
                aria-checked={subShowAsBill}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5',
                    subShowAsBill ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>

          <PrimaryButton
            onClick={saveSubscription}
            disabled={!subName.trim() || !Number(subAmount) || savingSub}
          >
            {savingSub ? '...' : t('save')}
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  )
}
