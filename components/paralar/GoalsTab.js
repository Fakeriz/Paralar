'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Flag, Target, Plane, Home as HomeIcon, Car, Gem, GraduationCap, ShieldCheck, TrendingUp,
  Heart, Gift, Sparkles, Plus, Trash2, Repeat, HelpCircle, Camera, Calendar,
  CreditCard, X, ChevronRight, Info, Landmark, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, EmptyState, Sheet, SheetTextButton, Field, TextInput, PrimaryButton, CategoryIcon } from './ui'
import SubscriptionSheet from './SubscriptionSheet'
import SetBudgetModal from '@/components/goals/SetBudgetModal'
import { CATEGORIES } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { convert } from '@/lib/rates'
import { cn } from '@/lib/utils'

// 12 squircle icons for Savings Goals (Default: Flag)
const GOAL_ICONS = [
  { id: 'flag', Icon: Flag, label: 'Flag' },
  { id: 'target', Icon: Target, label: 'Target' },
  { id: 'travel', Icon: Plane, label: 'Travel' },
  { id: 'home', Icon: HomeIcon, label: 'Home' },
  { id: 'car', Icon: Car, label: 'Car' },
  { id: 'wedding', Icon: Gem, label: 'Special' },
  { id: 'education', Icon: GraduationCap, label: 'Education' },
  { id: 'gadget', Icon: ShieldCheck, label: 'Security' },
  { id: 'invest', Icon: TrendingUp, label: 'Invest' },
  { id: 'love', Icon: Heart, label: 'Love' },
  { id: 'gift', Icon: Gift, label: 'Gift' },
  { id: 'sparkles', Icon: Sparkles, label: 'Dream' },
]

const goalIcon = (id) => GOAL_ICONS.find((g) => g.id === id)?.Icon || Flag

const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.types?.includes('expense'))

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
  const { t, goals = [], transactions = [], fmt, home, rates, store, refresh, open: openSheet } = useApp()

  // 1. Subscriptions State
  const [subscriptions, setSubscriptions] = useState([])
  const [subSheetOpen, setSubSheetOpen] = useState(false)
  const [selectedSub, setSelectedSub] = useState(null)

  // 2. Budgets State
  const [budgets, setBudgets] = useState([])
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState(null)
  const [showBudgetHelp, setShowBudgetHelp] = useState(false)

  // 3. Savings Goals State
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [funding, setFunding] = useState(null)
  const [fund, setFund] = useState('')
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalStarting, setGoalStarting] = useState('')
  const [goalIconId, setGoalIconId] = useState('flag')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [goalMonthlyTarget, setGoalMonthlyTarget] = useState('')
  const [goalCoverUrl, setGoalCoverUrl] = useState('')
  const goalFileInputRef = useRef(null)

  // 4. Loans & BNPL State
  const [loans, setLoans] = useState([])
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState(null)
  const [creditorName, setCreditorName] = useState('')
  const [loanTotalAmount, setLoanTotalAmount] = useState('')
  const [loanInstallment, setLoanInstallment] = useState('')
  const [loanTenorMonths, setLoanTenorMonths] = useState('')
  const [loanDueDay, setLoanDueDay] = useState('25')

  // Load all data
  const loadData = async () => {
    try {
      if (store?.listSubscriptions) {
        const subs = await store.listSubscriptions()
        setSubscriptions(Array.isArray(subs) ? subs : [])
      }
    } catch {
      setSubscriptions([])
    }

    try {
      if (store?.listBudgets) {
        const b = await store.listBudgets()
        setBudgets(Array.isArray(b) ? b : [])
      }
    } catch {
      setBudgets([])
    }

    try {
      if (store?.listDebts) {
        const d = await store.listDebts()
        setLoans(Array.isArray(d) ? d : [])
      }
    } catch {
      setLoans([])
    }
  }

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line

  // 1. Subscriptions Accumulation
  const monthlySubTotal = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return 0
    return subscriptions.reduce((sum, s) => {
      const rawAmt = Number(s?.amount) || 0
      let monthlyAmt = rawAmt
      if (s.cycle === 'weekly') monthlyAmt = rawAmt * (52 / 12)
      else if (s.cycle === '3_months') monthlyAmt = rawAmt / 3
      else if (s.cycle === '6_months') monthlyAmt = rawAmt / 6
      else if (s.cycle === 'yearly') monthlyAmt = rawAmt / 12
      const inHome = convert(monthlyAmt, s?.currency || home, home, rates)
      return sum + (Number(inHome) || 0)
    }, 0)
  }, [subscriptions, home, rates])

  // 2. Budgets Calculation with current month transactions
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1)

  const budgetsWithSpending = useMemo(() => {
    return (budgets || []).map((b) => {
      const catId = b?.category
      const dStart = b?.from_date ? new Date(b.from_date) : null
      const dEnd = b?.to_date ? new Date(b.to_date + 'T23:59:59.999') : null

      const spent = (transactions || [])
        .filter((tx) => {
          if (tx?.type !== 'expense') return false
          if (tx?.category !== catId) return false
          if (dStart && dEnd) {
            const txDate = new Date(tx?.date || tx?.transaction_date || tx?.created_at || 0)
            if (isNaN(txDate.getTime())) return false
            return txDate >= dStart && txDate <= dEnd
          }
          const d = (tx?.date || tx?.transaction_date || '').slice(0, 7)
          return d === currentMonthKey
        })
        .reduce((sum, tx) => sum + convert(tx?.amount || 0, tx?.currency || home, home, rates), 0)

      const limit = Number(b?.limit_amount) || 0
      const remaining = Math.max(0, limit - spent)
      const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
      const dailyRemaining = remaining / daysLeft
      return { ...b, spent, limit, remaining, pct, dailyRemaining }
    })
  }, [budgets, transactions, currentMonthKey, home, rates, daysLeft])

  const totalBudgetsLimit = useMemo(() => {
    return (budgets || []).reduce((sum, b) => sum + (Number(b?.limit_amount) || 0), 0)
  }, [budgets])

  // 3. Savings Goals Total Saved
  const totalSaved = useMemo(() => {
    return (goals || []).reduce((sum, g) => {
      const amt = Number(g?.saved_amount) || 0
      return sum + convert(amt, g?.currency || home, home, rates)
    }, 0)
  }, [goals, home, rates])

  // 4. Loans Total Installments
  const totalLoanInstallment = useMemo(() => {
    return (loans || []).reduce((sum, l) => {
      const amt = Number(l?.installment_amount || l?.monthly_payment || l?.amount) || 0
      return sum + convert(amt, l?.currency || home, home, rates)
    }, 0)
  }, [loans, home, rates])

  // Currency-adaptive BNPL Subtitle
  const bnplSubtitle = useMemo(() => {
    if (home === 'IDR') return 'SPayLater, Kredivo, GoPay Later, Cicilan'
    if (home === 'MYR') return 'Atome, Grab PayLater, SPayLater'
    if (home === 'TRY') return 'Taksit, Papara, Kredi'
    return 'PayLater, Installments, Loans'
  }, [home])

  // Handlers for Subscriptions
  const openNewSub = () => {
    setSelectedSub(null)
    setSubSheetOpen(true)
  }

  const openEditSub = (sub) => {
    setSelectedSub(sub)
    setSubSheetOpen(true)
  }

  // Handlers for Budgets
  const openNewBudget = () => {
    setEditingBudget(null)
    setBudgetModalOpen(true)
  }

  const openEditBudget = (b) => {
    setEditingBudget(b)
    setBudgetModalOpen(true)
  }

  // Handlers for Savings Goals
  const openNewGoalModal = () => {
    setGoalName('')
    setGoalTarget('')
    setGoalStarting('')
    setGoalIconId('flag')
    setGoalDeadline('')
    setGoalMonthlyTarget('')
    setGoalCoverUrl('')
    setCreatingGoal(true)
  }

  const handleGoalImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Maksimal foto 2MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setGoalCoverUrl(ev.target?.result || '')
    }
    reader.readAsDataURL(file)
  }

  // Auto-calculate monthly savings target if deadline changes
  const handleDeadlineToMonthly = (deadlineVal, targetVal, startingVal) => {
    setGoalDeadline(deadlineVal)
    if (!deadlineVal || !targetVal) return
    const targetNum = Number(targetVal) || 0
    const startNum = Number(startingVal) || 0
    const needed = Math.max(0, targetNum - startNum)
    const deadDate = new Date(deadlineVal)
    const curDate = new Date()
    const months = Math.max(1, (deadDate.getFullYear() - curDate.getFullYear()) * 12 + (deadDate.getMonth() - curDate.getMonth()))
    setGoalMonthlyTarget(String(Math.round(needed / months)))
  }

  const handleCreateGoal = async () => {
    if (!goalName.trim() || !Number(goalTarget)) {
      toast.error('Isi nama target dan nominal sasaran')
      return
    }
    try {
      await store.createGoal({
        name: goalName.trim(),
        icon: goalIconId,
        target_amount: Number(goalTarget),
        saved_amount: Number(goalStarting) || 0,
        currency: home,
        deadline: goalDeadline || null,
        monthly_target: Number(goalMonthlyTarget) || null,
        cover_url: goalCoverUrl || null,
      })
      setCreatingGoal(false)
      await refresh()
      toast.success(t('saved_msg') || 'Target tersimpan')
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const addFunds = async () => {
    if (!funding || !Number(fund)) return
    try {
      await store.updateGoal(funding.id, {
        saved_amount: (Number(funding.saved_amount) || 0) + Number(fund),
      })
      setFunding(null)
      setFund('')
      await refresh()
      toast.success(t('saved_msg') || 'Dana ditambahkan')
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const removeGoal = async (g) => {
    try {
      await store.deleteGoal(g.id)
      await refresh()
      toast.success(t('deleted') || 'Target dihapus')
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  // Handlers for Loans & BNPL
  const openNewLoanModal = () => {
    setEditingLoan(null)
    setCreditorName('')
    setLoanTotalAmount('')
    setLoanInstallment('')
    setLoanTenorMonths('')
    setLoanDueDay('25')
    setLoanModalOpen(true)
  }

  const openEditLoanModal = (l) => {
    setEditingLoan(l)
    setCreditorName(l.name || l.title || '')
    setLoanTotalAmount(String(l.total_amount || l.amount || ''))
    setLoanInstallment(String(l.installment_amount || l.monthly_payment || ''))
    setLoanTenorMonths(String(l.remaining_tenor || l.tenor_months || ''))
    setLoanDueDay(String(l.due_day || '25'))
    setLoanModalOpen(true)
  }

  const handleSaveLoan = async () => {
    if (!creditorName.trim() || !Number(loanInstallment)) {
      toast.error('Masukkan nama penyedia cicilan dan nominal angsuran')
      return
    }
    try {
      const payload = {
        name: creditorName.trim(),
        total_amount: Number(loanTotalAmount) || 0,
        installment_amount: Number(loanInstallment),
        remaining_tenor: Number(loanTenorMonths) || 1,
        due_day: Math.min(31, Math.max(1, Number(loanDueDay) || 1)),
        currency: home,
        type: 'bnpl',
      }
      if (editingLoan?.id) {
        await store.updateDebt(editingLoan.id, payload)
      } else {
        await store.createDebt(payload)
      }
      await loadData()
      setLoanModalOpen(false)
      toast.success(t('saved_msg') || 'Cicilan disimpan')
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const handleDeleteLoan = async () => {
    if (!editingLoan?.id) return
    try {
      await store.deleteDebt(editingLoan.id)
      await loadData()
      setLoanModalOpen(false)
      toast.success(t('deleted') || 'Cicilan dihapus')
    } catch (e) {
      toast.error(e?.message || t('error'))
    }
  }

  const FundingIcon = funding ? goalIcon(funding.icon) : Flag

  return (
    <div className="px-5 pb-28">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-30 pt-6 pb-2 bg-background/95 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('goals') || 'Goals'}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5 font-medium">
          Plan, save, and clear debt
        </p>
      </div>

      {/* ============================================================ */}
      {/* 1. SECTION: SUBSCRIPTIONS */}
      {/* ============================================================ */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            SUBSCRIPTIONS
          </span>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(monthlySubTotal, home)}/mo
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl overflow-hidden object-cover bg-muted flex items-center justify-center shrink-0 border border-border/20">
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
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {sub.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {cycleDisplay}{dateDisplay ? ` · ${dateDisplay}` : ''}
                      </p>
                    </div>
                  </div>
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

      {/* ============================================================ */}
      {/* 2. SECTION: MONTHLY BUDGETS */}
      {/* ============================================================ */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              MONTHLY BUDGETS
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowBudgetHelp(true)
              }}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded-full transition-colors"
              aria-label="How budgets work"
            >
              <HelpCircle className="cursor-pointer" size={15} />
            </button>
          </div>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(totalBudgetsLimit, home)}/mo
            </span>
            <button
              type="button"
              onClick={openNewBudget}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              aria-label="Set budget"
              data-testid="new-budget"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {budgetsWithSpending.length === 0 ? (
          <button
            type="button"
            onClick={openNewBudget}
            className="w-full rounded-2xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground hover:border-foreground/30 hover:bg-muted/10 transition-all cursor-pointer block"
          >
            + Set your first budget limit
          </button>
        ) : (
          <div className="space-y-2.5">
            {budgetsWithSpending.map((b) => {
              const catObj = EXPENSE_CATEGORIES.find((c) => c.id === b.category)
              const catName = t(`cat_${b.category}`) || catObj?.name || b.category
              return (
                <div
                  key={b.id}
                  onClick={() => openEditBudget(b)}
                  className="rounded-2xl border border-border/40 bg-card p-4 hover:bg-muted/20 transition-all cursor-pointer shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-border/20">
                        <CategoryIcon id={b.category} size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {catName}
                          {b.subcategory && !b.subcategory.startsWith('All of') ? ` · ${b.subcategory}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {fmt(b.remaining, home)} left of {fmt(b.limit, home)} · ≈ {fmt(b.dailyRemaining, home)}/day
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {b.pct}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        b.pct >= 100 ? 'bg-rose-500' : 'bg-foreground'
                      )}
                      style={{ width: `${Math.min(100, b.pct)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. SECTION: SAVINGS GOALS */}
      {/* ============================================================ */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t('savings_goals') || 'SAVINGS GOALS'}
          </span>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(totalSaved, home)}
            </span>
            <button
              type="button"
              onClick={openNewGoalModal}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              aria-label={t('new_goal')}
              data-testid="new-goal"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {goals.length === 0 ? (
          <button
            type="button"
            onClick={openNewGoalModal}
            className="w-full rounded-2xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground hover:border-foreground/30 hover:bg-muted/10 transition-all cursor-pointer block"
          >
            + Add a savings goal
          </button>
        ) : (
          <div className="space-y-3">
            {(goals || []).map((g) => {
              const targetVal = Number(g?.target_amount) || 1
              const savedVal = Number(g?.saved_amount) || 0
              const pct = Math.min(100, Math.round((savedVal / targetVal) * 100))
              const GIcon = goalIcon(g?.icon)
              return (
                <div key={g.id} className="rounded-2xl border border-border/40 bg-card p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {g?.cover_url ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden object-cover bg-muted shrink-0 border border-border/20">
                          <img src={g.cover_url} alt={g.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-border/20">
                          <GIcon size={20} strokeWidth={1.75} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">{g?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmt(savedVal, g?.currency || home)} of {fmt(targetVal, g?.currency || home)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold tabular-nums text-foreground">{pct}%</span>
                    </div>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setFunding(g)}
                      className="flex-1 rounded-xl bg-foreground text-background text-xs font-bold py-2.5 transition-opacity hover:opacity-90 active:scale-[0.99] cursor-pointer"
                    >
                      {t('add_funds') || '+ Add funds'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeGoal(g)}
                      className="h-9 w-9 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                      aria-label="Delete goal"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. SECTION: LOANS & BNPL */}
      {/* ============================================================ */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            LOANS & BNPL
          </span>
          <div className="flex items-center">
            <span className="text-xs text-muted-foreground mr-3 font-medium">
              {fmt(totalLoanInstallment, home)}/mo
            </span>
            <button
              type="button"
              onClick={openNewLoanModal}
              className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
              aria-label="Add loan or BNPL"
              data-testid="new-loan"
            >
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/80 mb-3 font-normal">
          {bnplSubtitle}
        </p>

        {loans.length === 0 ? (
          <button
            type="button"
            onClick={openNewLoanModal}
            className="w-full rounded-2xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground hover:border-foreground/30 hover:bg-muted/10 transition-all cursor-pointer block"
          >
            + Add loan or BNPL installment
          </button>
        ) : (
          <div className="space-y-2.5">
            {loans.map((loan) => {
              const installmentAmt = Number(loan.installment_amount || loan.monthly_payment || loan.amount) || 0
              const tenor = Number(loan.remaining_tenor || loan.tenor_months) || 1
              return (
                <div
                  key={loan.id}
                  onClick={() => openEditLoanModal(loan)}
                  className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between hover:bg-muted/20 transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-border/20">
                      <CreditCard size={18} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {loan.name || loan.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {tenor} months remaining · Due day {loan.due_day || 25}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-foreground">
                      {fmt(installmentAmt, loan.currency || home)}/mo
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODALS & SHEETS */}
      {/* ============================================================ */}

      {/* 1. Subscription Detail / Edit Bottom Sheet */}
      <SubscriptionSheet
        open={subSheetOpen}
        onClose={() => setSubSheetOpen(false)}
        subscription={selectedSub}
        onSaved={async () => {
          await loadData()
          await refresh()
        }}
        onDeleted={async () => {
          await loadData()
          await refresh()
        }}
      />

      {/* 2. Set / Edit Budget Modal */}
      <SetBudgetModal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        budget={editingBudget}
        onSaved={async () => {
          await loadData()
          await refresh?.()
        }}
        onDeleted={async () => {
          await loadData()
          await refresh?.()
        }}
        onManageCategories={() => {
          if (typeof openSheet === 'function') {
            openSheet('catman')
          }
        }}
        transactions={transactions}
        existingBudgets={budgets}
        home={home}
        fmt={fmt}
        rates={rates}
        store={store}
        t={t}
      />

      {/* How Budgets Work Dialog */}
      {showBudgetHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowBudgetHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card border border-border/40 p-6 shadow-2xl space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-muted text-foreground mx-auto flex items-center justify-center">
              <HelpCircle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                How Budgets Work
              </h3>
              <div className="text-xs text-muted-foreground mt-3 space-y-2.5 leading-relaxed text-left">
                <p>
                  Set a spending limit for any date range. Pick a start and end date to track spending for a specific period — weekly, fortnightly, or monthly.
                </p>
                <p>
                  With Repeat on, the budget rolls into the next period by itself and spending starts back at zero. Turn it off for a one-off budget that simply ends.
                </p>
                <p>
                  Paralar will notify you if you go over budget.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowBudgetHelp(false)}
              className="w-full rounded-xl bg-foreground text-background font-semibold py-3 text-sm transition-all active:scale-95 cursor-pointer hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* 3. New Savings Goal Modal */}
      <Sheet
        open={creatingGoal}
        onClose={() => setCreatingGoal(false)}
        title={t('new_goal') || 'New Savings Goal'}
        left={
          <SheetTextButton muted onClick={() => setCreatingGoal(false)}>
            {t('cancel')}
          </SheetTextButton>
        }
        right={
          <SheetTextButton bold onClick={handleCreateGoal}>
            {t('save')}
          </SheetTextButton>
        }
      >
        <div className="space-y-4 pt-2 pb-6 max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* Cover Photo Upload */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5">
              COVER PHOTO (OPTIONAL)
            </label>
            <input
              ref={goalFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleGoalImageUpload}
            />
            {goalCoverUrl ? (
              <div className="relative aspect-[2.3/1] w-full rounded-2xl overflow-hidden bg-muted border border-border/40">
                <img src={goalCoverUrl} alt="Cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setGoalCoverUrl('')}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onClick={() => goalFileInputRef.current?.click()}
                className="w-full aspect-[2.3/1] rounded-2xl border border-dashed border-border/60 bg-muted/20 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/40 transition-colors text-center p-3"
              >
                <Camera size={20} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Upload goal cover photo</span>
              </div>
            )}
          </div>

          {/* 12 Squircle Icons Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5">
              ICON (FLAG DEFAULT)
            </label>
            <div className="grid grid-cols-6 gap-2">
              {GOAL_ICONS.map(({ id, Icon }) => {
                const active = goalIconId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setGoalIconId(id)}
                    className={cn(
                      'w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer mx-auto',
                      active
                        ? 'bg-foreground text-background shadow-xs ring-2 ring-foreground ring-offset-2 ring-offset-background'
                        : 'bg-muted/40 border border-border/30 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                  </button>
                )
              })}
            </div>
          </div>

          <Field label={t('goal_name') || 'Goal Name'}>
            <TextInput
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. Emergency Fund, New Laptop"
            />
          </Field>

          <Field label={`${t('target_amount')} (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={goalTarget}
              onChange={(e) => {
                setGoalTarget(e.target.value)
                handleDeadlineToMonthly(goalDeadline, e.target.value, goalStarting)
              }}
              placeholder="0"
            />
          </Field>

          <Field label={`Starting Saved Balance (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={goalStarting}
              onChange={(e) => {
                setGoalStarting(e.target.value)
                handleDeadlineToMonthly(goalDeadline, goalTarget, e.target.value)
              }}
              placeholder="0"
            />
          </Field>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase block mb-1.5">
              DEADLINE (OPTIONAL)
            </label>
            <div className="relative">
              <input
                type="date"
                value={goalDeadline}
                onChange={(e) => handleDeadlineToMonthly(e.target.value, goalTarget, goalStarting)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-muted/40 rounded-2xl p-3.5 flex items-center gap-3 border border-border/30">
                <Calendar size={18} className="text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold text-foreground">
                  {goalDeadline || 'Select deadline date'}
                </span>
              </div>
            </div>
          </div>

          <Field label={`Monthly Savings Target (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={goalMonthlyTarget}
              onChange={(e) => setGoalMonthlyTarget(e.target.value)}
              placeholder="Auto-calculated or custom"
            />
          </Field>

          <PrimaryButton onClick={handleCreateGoal} disabled={!goalName.trim() || !Number(goalTarget)}>
            {t('create') || 'Create Goal'}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* Add Funds to Goal Modal */}
      <Sheet open={!!funding} onClose={() => setFunding(null)} title={t('add_funds') || 'Add Funds'}>
        <div className="space-y-5 pt-2 pb-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-muted text-foreground flex items-center justify-center">
              <FundingIcon size={28} strokeWidth={1.75} />
            </div>
          </div>
          <p className="text-center font-bold text-foreground text-lg">{funding?.name}</p>
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

      {/* 4. Loans & BNPL Modal */}
      <Sheet
        open={loanModalOpen}
        onClose={() => setLoanModalOpen(false)}
        title={editingLoan ? 'Edit Loan & BNPL' : 'Add Loan & BNPL'}
        left={
          <SheetTextButton muted onClick={() => setLoanModalOpen(false)}>
            {t('cancel')}
          </SheetTextButton>
        }
        right={
          <SheetTextButton bold onClick={handleSaveLoan}>
            {t('save')}
          </SheetTextButton>
        }
      >
        <div className="space-y-4 pt-2 pb-6">
          <Field label="Creditor / Service Name">
            <TextInput
              value={creditorName}
              onChange={(e) => setCreditorName(e.target.value)}
              placeholder="e.g. SPayLater, Kredivo, Atome, Bank"
            />
          </Field>

          <Field label={`Monthly Installment (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={loanInstallment}
              onChange={(e) => setLoanInstallment(e.target.value)}
              placeholder="e.g. 450000"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Remaining Tenor (Months)">
              <TextInput
                type="number"
                inputMode="numeric"
                value={loanTenorMonths}
                onChange={(e) => setLoanTenorMonths(e.target.value)}
                placeholder="e.g. 6"
              />
            </Field>
            <Field label="Due Day of Month (1-31)">
              <TextInput
                type="number"
                inputMode="numeric"
                value={loanDueDay}
                onChange={(e) => setLoanDueDay(e.target.value)}
                placeholder="25"
              />
            </Field>
          </div>

          <Field label={`Total Loan / Original Balance (${home}) - Optional`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={loanTotalAmount}
              onChange={(e) => setLoanTotalAmount(e.target.value)}
              placeholder="0"
            />
          </Field>

          <PrimaryButton onClick={handleSaveLoan} disabled={!creditorName.trim() || !Number(loanInstallment)}>
            {editingLoan ? 'Save Changes' : 'Add Loan'}
          </PrimaryButton>

          {editingLoan && (
            <button
              type="button"
              onClick={handleDeleteLoan}
              className="w-full text-center text-sm font-semibold text-rose-500 hover:opacity-80 py-2 cursor-pointer transition-opacity"
            >
              Delete Loan
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}
