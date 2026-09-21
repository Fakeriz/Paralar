'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  Target,
  Plane,
  Home,
  Car,
  Gem,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Heart,
  Gift,
  Utensils,
  ShoppingBag,
  Receipt,
  Clapperboard,
  HeartPulse,
  Briefcase,
  Layers,
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  ChevronRight,
  Check,
  DollarSign
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Field, TextInput, PrimaryButton, Card } from './ui'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'

// ==========================================
// STORAGE KEYS & HELPERS
// ==========================================
const LS_SUBS = 'paralar_goals_subscriptions'
const LS_BUDGETS = 'paralar_goals_budgets'
const LS_LOANS = 'paralar_goals_loans'

const lsGet = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const lsSet = (key, value) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// ==========================================
// PRESET DEFINITIONS
// ==========================================
const SUBSCRIPTION_PRESETS = [
  { name: 'Spotify', color: '#1DB954', iconLetter: 'S', cycle: 'Monthly' },
  { name: 'Netflix', color: '#E50914', iconLetter: 'N', cycle: 'Monthly' },
  { name: 'YouTube Premium', color: '#FF0000', iconLetter: 'Y', cycle: 'Monthly' },
  { name: 'ChatGPT Plus', color: '#10A37F', iconLetter: 'C', cycle: 'Monthly' },
  { name: 'iCloud+', color: '#007AFF', iconLetter: 'i', cycle: 'Monthly' },
  { name: 'Prime Video', color: '#00A8E1', iconLetter: 'P', cycle: 'Monthly' },
  { name: 'Disney+', color: '#113CCF', iconLetter: 'D', cycle: 'Monthly' },
  { name: 'Adobe CC', color: '#FA0F00', iconLetter: 'A', cycle: 'Monthly' },
]

const BUDGET_CATEGORIES = [
  { id: 'food', name: 'Food & Dining', Icon: Utensils },
  { id: 'groceries', name: 'Groceries', Icon: ShoppingBag },
  { id: 'transport', name: 'Transport', Icon: Car },
  { id: 'shopping', name: 'Shopping', Icon: ShoppingBag },
  { id: 'bills', name: 'Bills & Utilities', Icon: Receipt },
  { id: 'entertainment', name: 'Entertainment', Icon: Clapperboard },
  { id: 'health', name: 'Health & Medical', Icon: HeartPulse },
  { id: 'housing', name: 'Housing & Rent', Icon: Home },
  { id: 'education', name: 'Education', Icon: GraduationCap },
  { id: 'business', name: 'Business', Icon: Briefcase },
  { id: 'other', name: 'General', Icon: Layers },
]

const GOAL_ICONS = [
  { id: 'target', Icon: Target },
  { id: 'gadget', Icon: ShieldCheck },
  { id: 'travel', Icon: Plane },
  { id: 'home', Icon: Home },
  { id: 'car', Icon: Car },
  { id: 'wedding', Icon: Gem },
  { id: 'education', Icon: GraduationCap },
  { id: 'invest', Icon: TrendingUp },
  { id: 'gift', Icon: Gift },
  { id: 'love', Icon: Heart },
]

const getGoalIcon = (id) => GOAL_ICONS.find((g) => g.id === id)?.Icon || Target
const getCategoryMeta = (id) => BUDGET_CATEGORIES.find((b) => b.id === id) || BUDGET_CATEGORIES[0]

// ==========================================
// MAIN GOALS TAB COMPONENT
// ==========================================
export default function GoalsTab() {
  const { t, goals: contextGoals = [], fmt, home = 'IDR', store, refresh, transactions = [] } = useApp()

  // Local state for 4 modular sections
  const [subscriptions, setSubscriptions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [loans, setLoans] = useState([])
  const [localGoals, setLocalGoals] = useState([])

  // Modal Sheet triggers
  const [sheetSub, setSheetSub] = useState(false)
  const [sheetBudget, setSheetBudget] = useState(false)
  const [sheetGoal, setSheetGoal] = useState(false)
  const [sheetLoan, setSheetLoan] = useState(false)
  const [fundingGoal, setFundingGoal] = useState(null)
  const [activeDetailItem, setActiveDetailItem] = useState(null)

  // Subscriptions Form State
  const [subName, setSubName] = useState('')
  const [subAmount, setSubAmount] = useState('')
  const [subCycle, setSubCycle] = useState('Monthly')
  const [subDueDate, setSubDueDate] = useState('')
  const [subColor, setSubColor] = useState('#1DB954')
  const [subImageUrl, setSubImageUrl] = useState('')

  // Budgets Form State
  const [budgetCatId, setBudgetCatId] = useState('food')
  const [budgetLimit, setBudgetLimit] = useState('')
  const [budgetPeriod, setBudgetPeriod] = useState('Monthly')

  // Savings Goal Form State
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalSaved, setGoalSaved] = useState('')
  const [goalIconId, setGoalIconId] = useState('target')
  const [goalImageUrl, setGoalImageUrl] = useState('')
  const [goalDeadline, setGoalDeadline] = useState('')
  const [fundAmount, setFundAmount] = useState('')

  // Loans & BNPL Form State
  const [loanProvider, setLoanProvider] = useState('')
  const [loanTotalLimit, setLoanTotalLimit] = useState('')
  const [loanRemaining, setLoanRemaining] = useState('')
  const [loanMonthlyInstallment, setLoanMonthlyInstallment] = useState('')
  const [loanDueDate, setLoanDueDate] = useState('')
  const [loanRemainingTenor, setLoanRemainingTenor] = useState('')

  // Load stored state on mount
  useEffect(() => {
    setSubscriptions(lsGet(LS_SUBS, []))
    setBudgets(lsGet(LS_BUDGETS, []))
    setLoans(lsGet(LS_LOANS, []))
  }, [])

  // Sync goals (prefer context goals, fallback to local)
  const allGoals = useMemo(() => {
    if (contextGoals && contextGoals.length > 0) return contextGoals
    return localGoals
  }, [contextGoals, localGoals])

  // ==========================================
  // CALCULATIONS FOR HEADERS
  // ==========================================

  // Subscriptions monthly total
  const subscriptionsMonthlyTotal = useMemo(() => {
    return subscriptions.reduce((acc, s) => {
      const val = Number(s.amount) || 0
      if (s.cycle === 'Yearly') return acc + val / 12
      if (s.cycle === 'Weekly') return acc + val * 4.33
      return acc + val
    }, 0)
  }, [subscriptions])

  // Monthly budgets total limit
  const budgetsMonthlyTotal = useMemo(() => {
    return budgets.reduce((acc, b) => acc + (Number(b.limit) || 0), 0)
  }, [budgets])

  // Total savings gathered across goals
  const savingsGoalsTotal = useMemo(() => {
    return allGoals.reduce((acc, g) => acc + (Number(g.saved_amount) || 0), 0)
  }, [allGoals])

  // Remaining debt total for Loans & BNPL
  const loansRemainingTotal = useMemo(() => {
    return loans.reduce((acc, l) => acc + (Number(l.remaining_amount) || 0), 0)
  }, [loans])

  // ==========================================
  // CURRENCY-BASED LOAN PRESETS & COPY
  // ==========================================
  const loanConfig = useMemo(() => {
    const cur = String(home).toUpperCase()
    if (cur === 'IDR') {
      return {
        emptySubtitle: 'Lacak SPayLater, GoPay Later, Kredivo, Akulaku, pinjaman bank & cicilan.',
        presets: ['SPayLater', 'GoPay Later', 'Kredivo', 'Akulaku', 'Indodana', 'Pinjaman Bank (KTA / Cicilan)'],
      }
    }
    if (cur === 'MYR') {
      return {
        emptySubtitle: 'Track Atome, SPayLater, Grab, bank financing & more.',
        presets: ['Atome', 'SPayLater MY', 'GrabPayLater', 'Boost PayFlex', 'Pembiayaan Peribadi Bank'],
      }
    }
    if (cur === 'TRY') {
      return {
        emptySubtitle: 'Kredi, taksitli nakit avans, BNPL ve esnek hesaplarını takip et.',
        presets: [
          'Garanti BBVA Taksit',
          'Yapı Kredi Esnek Hesap',
          'İş Bankası Ek Hesap',
          'Papara Bölüştür / BNPL',
          'Tüketici Kredisi',
        ],
      }
    }
    return {
      emptySubtitle: 'Track credit cards, BNPL, personal loans & installments.',
      presets: ['Klarna', 'Afterpay / Affirm', 'Credit Card EMI', 'Personal Loan', 'Bank Installment'],
    }
  }, [home])

  // Calculate actual category spending this month from transactions
  const categorySpendingMap = useMemo(() => {
    const map = {}
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    ;(transactions || []).forEach((t) => {
      if (t.type !== 'expense') return
      try {
        const d = new Date(t.date)
        if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
          const cat = t.category || 'other'
          map[cat] = (map[cat] || 0) + (Number(t.amount) || 0)
        }
      } catch {}
    })
    return map
  }, [transactions])

  // Remaining days in the current calendar month
  const daysRemainingInMonth = useMemo(() => {
    const now = new Date()
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return Math.max(1, totalDays - now.getDate() + 1)
  }, [])

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // Save Subscription
  const saveSubscription = () => {
    if (!subName.trim() || !Number(subAmount)) {
      toast.error('Please enter name and amount')
      return
    }
    const newSub = {
      id: uid(),
      name: subName.trim(),
      amount: Number(subAmount),
      currency: home,
      cycle: subCycle || 'Monthly',
      due_date: subDueDate || new Date().toISOString().slice(0, 10),
      color: subColor || '#1DB954',
      image_url: subImageUrl.trim() || null,
      created_at: new Date().toISOString(),
    }
    const next = [newSub, ...subscriptions]
    setSubscriptions(next)
    lsSet(LS_SUBS, next)
    setSheetSub(false)
    resetSubForm()
    toast.success(t('saved_msg') || 'Subscription saved')
  }

  const deleteSubscription = (id) => {
    const next = subscriptions.filter((s) => s.id !== id)
    setSubscriptions(next)
    lsSet(LS_SUBS, next)
    setActiveDetailItem(null)
    toast.success(t('deleted') || 'Deleted')
  }

  const resetSubForm = () => {
    setSubName('')
    setSubAmount('')
    setSubCycle('Monthly')
    setSubDueDate('')
    setSubColor('#1DB954')
    setSubImageUrl('')
  }

  // Save Budget
  const saveBudget = () => {
    if (!Number(budgetLimit)) {
      toast.error('Please enter budget limit')
      return
    }
    const catMeta = getCategoryMeta(budgetCatId)
    // Replace if already exists for same category or add new
    const filtered = budgets.filter((b) => b.category_id !== budgetCatId)
    const newBudget = {
      id: uid(),
      category_id: budgetCatId,
      category_name: catMeta.name,
      limit: Number(budgetLimit),
      period: budgetPeriod || 'Monthly',
      currency: home,
      created_at: new Date().toISOString(),
    }
    const next = [newBudget, ...filtered]
    setBudgets(next)
    lsSet(LS_BUDGETS, next)
    setSheetBudget(false)
    setBudgetLimit('')
    toast.success(t('saved_msg') || 'Budget saved')
  }

  const deleteBudget = (id) => {
    const next = budgets.filter((b) => b.id !== id)
    setBudgets(next)
    lsSet(LS_BUDGETS, next)
    setActiveDetailItem(null)
    toast.success(t('deleted') || 'Deleted')
  }

  // Save Goal
  const saveGoal = async () => {
    if (!goalName.trim() || !Number(goalTarget)) {
      toast.error('Please enter goal name and target amount')
      return
    }
    try {
      const payload = {
        name: goalName.trim(),
        target_amount: Number(goalTarget),
        saved_amount: Number(goalSaved) || 0,
        currency: home,
        icon: goalIconId || 'target',
        image_url: goalImageUrl.trim() || null,
        deadline: goalDeadline || null,
      }
      if (store?.createGoal) {
        await store.createGoal(payload)
        await refresh?.()
      } else {
        const next = [{ id: uid(), ...payload, created_at: new Date().toISOString() }, ...localGoals]
        setLocalGoals(next)
      }
      setSheetGoal(false)
      resetGoalForm()
      toast.success(t('saved_msg') || 'Goal created')
    } catch (e) {
      toast.error(e?.message || 'Error saving goal')
    }
  }

  const resetGoalForm = () => {
    setGoalName('')
    setGoalTarget('')
    setGoalSaved('')
    setGoalIconId('target')
    setGoalImageUrl('')
    setGoalDeadline('')
  }

  const handleAddFunds = async () => {
    if (!fundingGoal || !Number(fundAmount)) return
    const addVal = Number(fundAmount)
    try {
      if (store?.updateGoal) {
        await store.updateGoal(fundingGoal.id, {
          saved_amount: (Number(fundingGoal.saved_amount) || 0) + addVal,
        })
        await refresh?.()
      } else {
        const next = allGoals.map((g) =>
          g.id === fundingGoal.id ? { ...g, saved_amount: (Number(g.saved_amount) || 0) + addVal } : g
        )
        setLocalGoals(next)
      }
      setFundingGoal(null)
      setFundAmount('')
      toast.success(t('saved_msg') || 'Funds added')
    } catch (e) {
      toast.error(e?.message || 'Error adding funds')
    }
  }

  const deleteGoalItem = async (id) => {
    try {
      if (store?.deleteGoal) {
        await store.deleteGoal(id)
        await refresh?.()
      } else {
        setLocalGoals((prev) => prev.filter((g) => g.id !== id))
      }
      setActiveDetailItem(null)
      toast.success(t('deleted') || 'Deleted')
    } catch (e) {
      toast.error(e?.message || 'Error deleting goal')
    }
  }

  // Save Loan / BNPL
  const saveLoan = () => {
    if (!loanProvider.trim() || !Number(loanRemaining)) {
      toast.error('Please enter provider and remaining debt')
      return
    }
    const newLoan = {
      id: uid(),
      provider: loanProvider.trim(),
      total_limit: Number(loanTotalLimit) || Number(loanRemaining),
      remaining_amount: Number(loanRemaining),
      monthly_installment: Number(loanMonthlyInstallment) || 0,
      due_date: loanDueDate || '25',
      tenor: loanRemainingTenor.trim() || null,
      currency: home,
      created_at: new Date().toISOString(),
    }
    const next = [newLoan, ...loans]
    setLoans(next)
    lsSet(LS_LOANS, next)
    setSheetLoan(false)
    resetLoanForm()
    toast.success(t('saved_msg') || 'Loan / BNPL saved')
  }

  const deleteLoan = (id) => {
    const next = loans.filter((l) => l.id !== id)
    setLoans(next)
    lsSet(LS_LOANS, next)
    setActiveDetailItem(null)
    toast.success(t('deleted') || 'Deleted')
  }

  const resetLoanForm = () => {
    setLoanProvider('')
    setLoanTotalLimit('')
    setLoanRemaining('')
    setLoanMonthlyInstallment('')
    setLoanDueDate('')
    setLoanRemainingTenor('')
  }

  return (
    <div className="px-5 pb-28 pt-[env(safe-area-inset-top,1rem)] min-h-screen bg-background text-foreground">
      {/* 1. STICKY TOP HEADER */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md -mx-5 px-5 pt-3 pb-3 border-b border-border/40">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('goals') || 'Goals'}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t('goals_subtitle') || 'Plan, save, and clear debt'}</p>
      </div>

      <div className="space-y-6 pt-4">
        {/* ======================================================== */}
        {/* 2A. SECTION: SUBSCRIPTIONS                               */}
        {/* ======================================================== */}
        <section>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t('subscriptions') || 'Subscriptions'}
            </span>
            <div className="flex items-center">
              {subscriptions.length > 0 && (
                <span className="text-xs text-muted-foreground mr-3 font-medium">
                  {fmt(subscriptionsMonthlyTotal, home)}/mo
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  resetSubForm()
                  setSheetSub(true)
                }}
                className="h-7 w-7 rounded-full bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center transition-all active:scale-95"
                aria-label={t('add_subscription') || 'Add Subscription'}
              >
                <Plus size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Conditional State: Empty vs Filled */}
          {subscriptions.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card p-6 text-center shadow-xs">
              <p className="text-sm font-semibold text-foreground">
                {t('no_subscriptions') || 'No subscriptions'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('no_subscriptions_sub') || 'Track recurring payments and see your monthly burn.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {subscriptions.map((s) => {
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveDetailItem({ type: 'sub', data: s })}
                    className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between shadow-xs cursor-pointer hover:border-border transition-all active:scale-[0.99]"
                  >
                    {/* Left: Thumbnail squircle */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl overflow-hidden object-cover bg-muted flex items-center justify-center shrink-0 font-bold text-base shadow-xs"
                        style={{
                          backgroundColor: s.image_url ? undefined : s.color || '#1DB954',
                          color: '#FFFFFF',
                        }}
                      >
                        {s.image_url ? (
                          <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(s.name || 'S').trim()[0].toUpperCase()}</span>
                        )}
                      </div>

                      {/* Middle: Name & cycle/due date */}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground capitalize truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {s.cycle || 'Monthly'} · {s.due_date || 'Recurring'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Nominal Biaya Tebal */}
                    <p className="text-sm font-bold text-foreground tabular-nums ml-3 shrink-0">
                      {fmt(s.amount, s.currency || home)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* 2B. SECTION: MONTHLY BUDGETS                             */}
        {/* ======================================================== */}
        <section>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-2 mt-4">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t('budgets') || 'Monthly Budgets'}
            </span>
            <div className="flex items-center">
              {budgets.length > 0 && (
                <span className="text-xs text-muted-foreground mr-3 font-medium">
                  {fmt(budgetsMonthlyTotal, home)}/mo
                </span>
              )}
              <button
                type="button"
                onClick={() => setSheetBudget(true)}
                className="h-7 w-7 rounded-full bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center transition-all active:scale-95"
                aria-label={t('add_budget') || 'Add Budget'}
              >
                <Plus size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Conditional State: Empty vs Filled */}
          {budgets.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card p-6 text-center shadow-xs">
              <p className="text-sm font-semibold text-foreground">
                {t('no_budgets') || 'Plan this month'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('no_budgets_sub') || 'Set a category limit to see how your spending compares with the plan.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {budgets.map((b) => {
                const meta = getCategoryMeta(b.category_id)
                const IconComponent = meta.Icon || Layers
                const spent = categorySpendingMap[b.category_id] || 0
                const limit = Number(b.limit) || 1
                const pct = Math.min(100, Math.round((spent / limit) * 100))
                const left = Math.max(0, limit - spent)
                const dailyBurn = Math.max(0, Math.round(left / daysRemainingInMonth))

                return (
                  <div
                    key={b.id}
                    onClick={() => setActiveDetailItem({ type: 'budget', data: b })}
                    className="rounded-2xl border border-border/40 bg-card p-4 space-y-3 shadow-xs cursor-pointer hover:border-border transition-all active:scale-[0.99]"
                  >
                    {/* Baris Atas: Ikon squircle + Nama + Persentase */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 text-foreground">
                          <IconComponent size={18} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {b.category_name || meta.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{b.period || 'Monthly'}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground tabular-nums ml-2">{pct}%</span>
                    </div>

                    {/* Baris Tengah: Horizontal progress bar */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          pct >= 100 ? 'bg-rose-500' : 'bg-foreground'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Baris Bawah: Keterangan limit */}
                    <p className="text-xs text-muted-foreground">
                      {fmt(left, b.currency || home)} left of {fmt(limit, b.currency || home)} · ≈{' '}
                      {fmt(dailyBurn, b.currency || home)}/day
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* 2C. SECTION: SAVINGS GOALS                               */}
        {/* ======================================================== */}
        <section>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-2 mt-4">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t('savings_goals') || 'Savings Goals'}
            </span>
            <div className="flex items-center">
              {allGoals.length > 0 && (
                <span className="text-xs text-muted-foreground mr-3 font-medium">
                  {fmt(savingsGoalsTotal, home)}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  resetGoalForm()
                  setSheetGoal(true)
                }}
                className="h-7 w-7 rounded-full bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center transition-all active:scale-95"
                aria-label={t('add_savings_goal') || 'Add Goal'}
              >
                <Plus size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Conditional State: Empty vs Filled */}
          {allGoals.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card p-6 text-center shadow-xs">
              <p className="text-sm font-semibold text-foreground">
                {t('no_goals') || 'Choose something to save for'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('no_goals_sub') || 'Set a target amount and deadline, then record progress whenever you add money.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allGoals.map((g) => {
                const IconComponent = getGoalIcon(g.icon)
                const saved = Number(g.saved_amount) || 0
                const target = Math.max(1, Number(g.target_amount) || 1)
                const pct = Math.min(100, Math.round((saved / target) * 100))

                return (
                  <div
                    key={g.id}
                    onClick={() => setActiveDetailItem({ type: 'goal', data: g })}
                    className="rounded-2xl border border-border/40 bg-card p-4 flex items-center gap-3.5 shadow-xs cursor-pointer hover:border-border transition-all active:scale-[0.99]"
                  >
                    {/* Kiri: Foto target barang / Squircle Icon */}
                    <div className="w-11 h-11 rounded-xl overflow-hidden object-cover bg-muted flex items-center justify-center shrink-0 text-foreground">
                      {g.image_url ? (
                        <img src={g.image_url} alt={g.name} className="w-full h-full object-cover" />
                      ) : (
                        <IconComponent size={20} strokeWidth={1.8} />
                      )}
                    </div>

                    {/* Kanan: Judul target + persentase, bar progres, rincian saldo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                        <span className="text-xs font-bold text-foreground tabular-nums ml-2">{pct}%</span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden my-1.5">
                        <div
                          className="h-full bg-foreground rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground truncate">
                        {fmt(saved, g.currency || home)} {t('of') || 'of'} {fmt(target, g.currency || home)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ======================================================== */}
        {/* 2D. SECTION: LOANS & BNPL                                */}
        {/* ======================================================== */}
        <section>
          {/* Section Header */}
          <div className="flex items-center justify-between mb-2 mt-4">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t('loans_and_bnpl') || 'Loans & BNPL'}
            </span>
            <div className="flex items-center">
              {loans.length > 0 && (
                <span className="text-xs text-muted-foreground mr-3 font-medium">
                  {fmt(loansRemainingTotal, home)} left
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  resetLoanForm()
                  setSheetLoan(true)
                }}
                className="h-7 w-7 rounded-full bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center transition-all active:scale-95"
                aria-label={t('add_loan') || 'Add Loan or BNPL'}
              >
                <Plus size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Conditional State: Empty vs Filled */}
          {loans.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card p-6 text-center shadow-xs">
              <p className="text-sm font-semibold text-foreground">
                {t('no_loans') || 'No loans or BNPL'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('no_loans_sub') || loanConfig.emptySubtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {loans.map((l) => {
                const total = Math.max(1, Number(l.total_limit) || Number(l.remaining_amount) || 1)
                const remaining = Number(l.remaining_amount) || 0
                const repaid = Math.max(0, total - remaining)
                const pctRepaid = Math.min(100, Math.round((repaid / total) * 100))

                return (
                  <div
                    key={l.id}
                    onClick={() => setActiveDetailItem({ type: 'loan', data: l })}
                    className="rounded-2xl border border-border/40 bg-card p-4 space-y-2.5 shadow-xs cursor-pointer hover:border-border transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{l.provider}</p>
                          {l.tenor && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium text-muted-foreground">
                              {l.tenor}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Due on the {l.due_date ? `${l.due_date}th` : 'month end'}
                        </p>
                      </div>

                      {Number(l.monthly_installment) > 0 && (
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {fmt(l.monthly_installment, l.currency || home)}
                            <span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar of Cleared Debt */}
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full transition-all duration-300"
                        style={{ width: `${pctRepaid}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{fmt(remaining, l.currency || home)} remaining</span>
                      <span>{pctRepaid}% cleared</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* ======================================================== */}
      {/* 4. BOTTOM SHEET MODALS                                   */}
      {/* ======================================================== */}

      {/* A. ADD SUBSCRIPTION SHEET */}
      <Sheet
        open={sheetSub}
        onClose={() => setSheetSub(false)}
        title={t('add_subscription') || 'Add Subscription'}
        left={
          <button
            type="button"
            onClick={() => setSheetSub(false)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('cancel') || 'Cancel'}
          </button>
        }
        right={
          <button
            type="button"
            onClick={saveSubscription}
            className="text-sm font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            {t('save') || 'Save'}
          </button>
        }
      >
        <div className="space-y-4 pt-1">
          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Quick Presets</label>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {SUBSCRIPTION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setSubName(p.name)
                    setSubColor(p.color)
                    setSubCycle(p.cycle)
                  }}
                  className="px-3 py-1.5 rounded-xl border border-border/50 bg-muted/40 hover:bg-muted text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <Field label="Service Name">
            <TextInput
              placeholder="e.g. Spotify, Netflix, iCloud"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
            />
          </Field>

          <Field label={`Amount (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              placeholder="50000"
              value={subAmount}
              onChange={(e) => setSubAmount(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing Cycle">
              <select
                value={subCycle}
                onChange={(e) => setSubCycle(e.target.value)}
                className="w-full rounded-xl bg-muted/40 border border-border/60 text-foreground px-3.5 py-3 text-sm outline-none focus:border-foreground transition-colors"
              >
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
                <option value="Weekly">Weekly</option>
              </select>
            </Field>

            <Field label="Due Date / Renewal">
              <TextInput
                type="date"
                value={subDueDate}
                onChange={(e) => setSubDueDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Image URL (Optional)">
            <TextInput
              placeholder="https://..."
              value={subImageUrl}
              onChange={(e) => setSubImageUrl(e.target.value)}
            />
          </Field>

          <PrimaryButton onClick={saveSubscription} disabled={!subName || !Number(subAmount)}>
            {t('save') || 'Save Subscription'}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* B. ADD MONTHLY BUDGET SHEET */}
      <Sheet
        open={sheetBudget}
        onClose={() => setSheetBudget(false)}
        title={t('add_budget') || 'Add Monthly Budget'}
        left={
          <button
            type="button"
            onClick={() => setSheetBudget(false)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('cancel') || 'Cancel'}
          </button>
        }
        right={
          <button
            type="button"
            onClick={saveBudget}
            className="text-sm font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            {t('save') || 'Save'}
          </button>
        }
      >
        <div className="space-y-4 pt-1">
          <Field label="Category">
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {BUDGET_CATEGORIES.map((cat) => {
                const active = budgetCatId === cat.id
                const CatIcon = cat.Icon
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBudgetCatId(cat.id)}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left',
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border/60 bg-muted/40 text-foreground hover:bg-muted'
                    )}
                  >
                    <CatIcon size={16} />
                    <span className="truncate">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label={`Monthly Limit (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              placeholder="2000000"
              value={budgetLimit}
              onChange={(e) => setBudgetLimit(e.target.value)}
            />
          </Field>

          <Field label="Period">
            <select
              value={budgetPeriod}
              onChange={(e) => setBudgetPeriod(e.target.value)}
              className="w-full rounded-xl bg-muted/40 border border-border/60 text-foreground px-3.5 py-3 text-sm outline-none focus:border-foreground transition-colors"
            >
              <option value="Monthly">Monthly</option>
              <option value="Weekly">Weekly</option>
            </select>
          </Field>

          <PrimaryButton onClick={saveBudget} disabled={!Number(budgetLimit)}>
            {t('save') || 'Save Budget'}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* C. ADD SAVINGS GOAL SHEET */}
      <Sheet
        open={sheetGoal}
        onClose={() => setSheetGoal(false)}
        title={t('add_savings_goal') || 'Add Savings Goal'}
        left={
          <button
            type="button"
            onClick={() => setSheetGoal(false)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('cancel') || 'Cancel'}
          </button>
        }
        right={
          <button
            type="button"
            onClick={saveGoal}
            className="text-sm font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            {t('save') || 'Save'}
          </button>
        }
      >
        <div className="space-y-4 pt-1">
          {/* Icon Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Goal Icon</label>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {GOAL_ICONS.map(({ id, Icon }) => {
                const active = goalIconId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setGoalIconId(id)}
                    className={cn(
                      'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border transition-all',
                      active
                        ? 'bg-foreground text-background border-foreground ring-2 ring-foreground/20'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted'
                    )}
                  >
                    <Icon size={18} />
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Goal Target Name">
            <TextInput
              placeholder="e.g. MBP, New Phone, Emergency Fund"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
            />
          </Field>

          <Field label={`Target Amount (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              placeholder="1150000"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
            />
          </Field>

          <Field label={`Current Saved Amount (${home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={goalSaved}
              onChange={(e) => setGoalSaved(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deadline (Optional)">
              <TextInput
                type="date"
                value={goalDeadline}
                onChange={(e) => setGoalDeadline(e.target.value)}
              />
            </Field>

            <Field label="Photo URL (Optional)">
              <TextInput
                placeholder="https://..."
                value={goalImageUrl}
                onChange={(e) => setGoalImageUrl(e.target.value)}
              />
            </Field>
          </div>

          <PrimaryButton onClick={saveGoal} disabled={!goalName || !Number(goalTarget)}>
            {t('create') || 'Create Goal'}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* D. ADD LOAN / BNPL SHEET */}
      <Sheet
        open={sheetLoan}
        onClose={() => setSheetLoan(false)}
        title={t('add_loan') || 'Add Loan / BNPL'}
        left={
          <button
            type="button"
            onClick={() => setSheetLoan(false)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('cancel') || 'Cancel'}
          </button>
        }
        right={
          <button
            type="button"
            onClick={saveLoan}
            className="text-sm font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            {t('save') || 'Save'}
          </button>
        }
      >
        <div className="space-y-4 pt-1">
          {/* Quick Dynamic Currency-Based Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Recommended Presets ({home})
            </label>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {loanConfig.presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLoanProvider(p)}
                  className="px-3 py-1.5 rounded-xl border border-border/50 bg-muted/40 hover:bg-muted text-xs font-medium shrink-0 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <Field label="Provider / Creditor">
            <TextInput
              placeholder="e.g. SPayLater, Kredivo, Atome"
              value={loanProvider}
              onChange={(e) => setLoanProvider(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Total Loan / Plafon (${home})`}>
              <TextInput
                type="number"
                inputMode="decimal"
                placeholder="3000000"
                value={loanTotalLimit}
                onChange={(e) => setLoanTotalLimit(e.target.value)}
              />
            </Field>

            <Field label={`Remaining Debt (${home})`}>
              <TextInput
                type="number"
                inputMode="decimal"
                placeholder="1500000"
                value={loanRemaining}
                onChange={(e) => setLoanRemaining(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Monthly Installment (${home})`}>
              <TextInput
                type="number"
                inputMode="decimal"
                placeholder="250000"
                value={loanMonthlyInstallment}
                onChange={(e) => setLoanMonthlyInstallment(e.target.value)}
              />
            </Field>

            <Field label="Remaining Tenor">
              <TextInput
                placeholder="e.g. 3 of 6 mos left"
                value={loanRemainingTenor}
                onChange={(e) => setLoanRemainingTenor(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Due Date of the Month">
            <TextInput
              type="number"
              placeholder="e.g. 25"
              min="1"
              max="31"
              value={loanDueDate}
              onChange={(e) => setLoanDueDate(e.target.value)}
            />
          </Field>

          <PrimaryButton onClick={saveLoan} disabled={!loanProvider || !Number(loanRemaining)}>
            {t('save') || 'Save Loan / BNPL'}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* E. ADD FUNDS MODAL FOR GOAL */}
      <Sheet
        open={!!fundingGoal}
        onClose={() => setFundingGoal(null)}
        title={t('deposit_add_funds') || 'Deposit / Add Funds'}
        left={
          <button
            type="button"
            onClick={() => setFundingGoal(null)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {t('cancel') || 'Cancel'}
          </button>
        }
        right={
          <button
            type="button"
            onClick={handleAddFunds}
            disabled={!Number(fundAmount)}
            className="text-sm font-bold text-foreground disabled:opacity-40"
          >
            {t('save') || 'Save'}
          </button>
        }
      >
        <div className="space-y-4 pt-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center text-foreground">
            {fundingGoal?.icon ? (
              (() => {
                const IconC = getGoalIcon(fundingGoal.icon)
                return <IconC size={24} />
              })()
            ) : (
              <Target size={24} />
            )}
          </div>
          <div>
            <p className="font-bold text-base text-foreground">{fundingGoal?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current: {fmt(fundingGoal?.saved_amount || 0, fundingGoal?.currency || home)} {t('of') || 'of'}{' '}
              {fmt(fundingGoal?.target_amount || 0, fundingGoal?.currency || home)}
            </p>
          </div>

          <Field label={`Amount to Add (${fundingGoal?.currency || home})`}>
            <TextInput
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              autoFocus
            />
          </Field>

          <PrimaryButton onClick={handleAddFunds} disabled={!Number(fundAmount)}>
            {t('confirm_deposit') || 'Confirm Deposit'}
          </PrimaryButton>
        </div>
      </Sheet>

      {/* F. ITEM DETAIL & DELETE CONFIRMATION SHEET */}
      <Sheet
        open={!!activeDetailItem}
        onClose={() => setActiveDetailItem(null)}
        title={t('item_details') || 'Item Details'}
        left={
          <button
            type="button"
            onClick={() => setActiveDetailItem(null)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            {t('close') || 'Close'}
          </button>
        }
      >
        {activeDetailItem && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Type</span>
                <span className="text-xs font-bold uppercase">{activeDetailItem.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Title</span>
                <span className="text-sm font-semibold">
                  {activeDetailItem.data.name ||
                    activeDetailItem.data.provider ||
                    activeDetailItem.data.category_name}
                </span>
              </div>
              {activeDetailItem.data.amount !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="text-sm font-bold">
                    {fmt(activeDetailItem.data.amount, activeDetailItem.data.currency || home)}
                  </span>
                </div>
              )}
              {activeDetailItem.data.limit !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Limit</span>
                  <span className="text-sm font-bold">
                    {fmt(activeDetailItem.data.limit, activeDetailItem.data.currency || home)}
                  </span>
                </div>
              )}
              {activeDetailItem.data.remaining_amount !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Remaining</span>
                  <span className="text-sm font-bold">
                    {fmt(activeDetailItem.data.remaining_amount, activeDetailItem.data.currency || home)}
                  </span>
                </div>
              )}
            </div>

            {/* Quick action for Goal to Add Funds */}
            {activeDetailItem.type === 'goal' && (
              <button
                type="button"
                onClick={() => {
                  setFundingGoal(activeDetailItem.data)
                  setActiveDetailItem(null)
                }}
                className="w-full py-3 rounded-xl bg-foreground text-background font-bold text-sm transition-all active:scale-[0.98]"
              >
                {t('deposit_add_funds') || 'Deposit / Add Funds'}
              </button>
            )}

            {/* Delete button */}
            <button
              type="button"
              onClick={() => {
                const { type, data } = activeDetailItem
                if (type === 'sub') deleteSubscription(data.id)
                else if (type === 'budget') deleteBudget(data.id)
                else if (type === 'goal') deleteGoalItem(data.id)
                else if (type === 'loan') deleteLoan(data.id)
              }}
              className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold text-sm hover:bg-rose-500/10 flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 size={16} />
              <span>{t('delete') || 'Delete'}</span>
            </button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
