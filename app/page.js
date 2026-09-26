'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { createStore, DEFAULT_PROFILE } from '@/lib/store'
import { translate, LOCALE_MAP } from '@/lib/i18n'
import { formatMoney } from '@/lib/currencies'
import { convert, FALLBACK_RATES } from '@/lib/rates'
import { applyTxToBalances, computeBalanceDelta } from '@/lib/ledger'
import { initSyncListener } from '@/lib/sync'
import { AppContext } from '@/components/paralar/context'

import Onboarding from '@/components/paralar/Onboarding'
import Login from '@/components/paralar/Login'
import NewPasswordSheet from '@/components/paralar/NewPasswordSheet'
import BottomNav from '@/components/paralar/BottomNav'
import HomeTab from '@/components/paralar/HomeTab'
import TransactionsTab from '@/components/paralar/TransactionsTab'
import GoalsTab from '@/components/paralar/GoalsTab'
import MoreTab from '@/components/paralar/MoreTab'
import AddTransactionSheet from '@/components/paralar/AddTransactionSheet'
import QuickActionsSheet from '@/components/paralar/QuickActionsSheet'
import ProfileSheet from '@/components/paralar/ProfileSheet'
import NewAccountSheet from '@/components/paralar/NewAccountSheet'
import VoiceLogSheet from '@/components/paralar/VoiceLogSheet'
import ScanReceiptSheet from '@/components/paralar/ScanReceiptSheet'
import TransactionDetailSheet from '@/components/paralar/TransactionDetailSheet'
import CoachSheet from '@/components/paralar/CoachSheet'
import SplitBillSheet from '@/components/paralar/SplitBillSheet'
import AccountsSheet from '@/components/paralar/AccountsSheet'
import AnalyticsSheet from '@/components/paralar/AnalyticsSheet'
import CurrencySheet from '@/components/paralar/CurrencySheet'
import NotificationsSheet from '@/components/paralar/NotificationsSheet'
import SmartAutomationSheet from '@/components/paralar/SmartAutomationSheet'
import BillsTrackerSheet from '@/components/paralar/BillsTrackerSheet'
import LoanCalculatorSheet from '@/components/paralar/LoanCalculatorSheet'
import CategoriesTemplatesSheet from '@/components/paralar/CategoriesTemplatesSheet'
import DebtTrackerSheet from '@/components/paralar/DebtTrackerSheet'
import ExportTransactionsSheet from '@/components/paralar/ExportTransactionsSheet'
import ImportTransactionsSheet from '@/components/paralar/ImportTransactionsSheet'
import AiPremiumSheet from '@/components/paralar/AiPremiumSheet'
import PaywallSheet from '@/components/paralar/PaywallSheet'
import CloudReceiptBackupSheet from '@/components/paralar/CloudReceiptBackupSheet'
import ReceiptGallerySheet from '@/components/paralar/ReceiptGallerySheet'

const GUEST_KEY = 'paralar_guest_mode'
const ONBOARD_KEY = 'paralar_onboarded'
const LANG_KEY = 'paralar_lang'

export default function App() {
  const [booting, setBooting] = useState(true)
  const [session, setSession] = useState(null)
  const [isGuest, setIsGuest] = useState(false)
  const [onboarded, setOnboarded] = useState(true)
  const [lang, setLangState] = useState('en')
  const [recovery, setRecovery] = useState(false)

  const [profile, setProfile] = useState({ ...DEFAULT_PROFILE })
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [goals, setGoals] = useState([])
  const [bills, setBills] = useState([])
  const [budgets, setBudgets] = useState([])
  const [rates, setRates] = useState(FALLBACK_RATES)

  const [tab, setTab] = useState('home')
  const [sheets, setSheets] = useState({})
  const [hideBalance, setHideBalance] = useState(false)

  const store = useMemo(() => createStore(session), [session])
  const home = profile?.home_currency || 'USD'

  const t = useCallback((key, vars, fallback) => translate(lang, key, vars, fallback), [lang])
  const fmt = useCallback((amount, code) => formatMoney(amount, code, { locale: LOCALE_MAP[lang] || 'en-US' }), [lang])
  const convertToHome = useCallback((amount, code) => convert(amount, code, home, rates), [home, rates])

  // ---- boot: session + prefs ----
  useEffect(() => {
    try {
      setIsGuest(localStorage.getItem(GUEST_KEY) === '1')
      setOnboarded(localStorage.getItem(ONBOARD_KEY) === '1')
      const savedLang = localStorage.getItem(LANG_KEY)
      if (savedLang) setLangState(savedLang)
    } catch {}

    let active = true
    // Safety: never stay stuck on the splash even if auth is slow/unreachable.
    const failsafe = setTimeout(() => { if (active) setBooting(false) }, 2500)
    supabase.auth.getSession()
      .then(({ data }) => { if (active) setSession(data?.session || null) })
      .catch(() => {})
      .finally(() => { if (active) setBooting(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, next) => {
      // Password recovery link opened — show the "Set new password" screen instead of Home.
      if (_e === 'PASSWORD_RECOVERY') { setRecovery(true); setSession(next || null); return }
      setSession(next || null)
      if (next?.user) { setIsGuest(false); try { localStorage.removeItem(GUEST_KEY) } catch {} }
    })
    return () => { active = false; clearTimeout(failsafe); listener?.subscription?.unsubscribe?.() }
  }, [])

  // ---- rates ----
  useEffect(() => {
    fetch('/api/rates').then((r) => r.json()).then((d) => { if (d?.rates) setRates(d.rates) }).catch(() => {})
  }, [])

  const authed = !!session?.user || isGuest

  // ---- instant cache hydration on session load ----
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return
    try {
      const raw = localStorage.getItem(`paralar_state_cache_${uid}`)
      if (raw) {
        const cached = JSON.parse(raw)
        if (cached?.profile) setProfile((p) => ({ ...p, ...cached.profile }))
        if (Array.isArray(cached?.accounts) && cached.accounts.length) setAccounts(cached.accounts)
        if (Array.isArray(cached?.transactions) && cached.transactions.length) setTransactions(cached.transactions)
        if (Array.isArray(cached?.goals) && cached.goals.length) setGoals(cached.goals)
        if (Array.isArray(cached?.bills) && cached.bills.length) setBills(cached.bills)
        if (Array.isArray(cached?.budgets) && cached.budgets.length) setBudgets(cached.budgets)
      }
    } catch {}
  }, [session?.user?.id])

  const refresh = useCallback(async () => {
    if (!authed) return
    try {
      const [p, a, tx, g, b, bg] = await Promise.all([
        store.getProfile(),
        store.listAccounts(),
        store.listTransactions(),
        store.listGoals(),
        store.listBills ? store.listBills() : Promise.resolve([]),
        store.listBudgets ? store.listBudgets() : Promise.resolve([]),
      ])
      const nextProfile = { ...DEFAULT_PROFILE, ...(p || {}) }
      const nextAccounts = Array.isArray(a) ? a : []
      const nextTransactions = Array.isArray(tx) ? tx : []
      const nextGoals = Array.isArray(g) ? g : []
      const nextBills = Array.isArray(b) ? b : []
      const nextBudgets = Array.isArray(bg) ? bg : []

      setProfile(nextProfile)
      setAccounts(nextAccounts)
      setTransactions(nextTransactions)
      setGoals(nextGoals)
      setBills(nextBills)
      setBudgets(nextBudgets)

      const uid = session?.user?.id
      if (uid) {
        try {
          localStorage.setItem(`paralar_state_cache_${uid}`, JSON.stringify({
            profile: nextProfile,
            accounts: nextAccounts,
            transactions: nextTransactions,
            goals: nextGoals,
            bills: nextBills,
            budgets: nextBudgets,
          }))
        } catch {}
      }

      const savedLang = (() => { try { return localStorage.getItem(LANG_KEY) } catch { return null } })()
      if (!savedLang && p?.language) setLangState(p.language)
    } catch (e) {
      console.warn('refresh failed', e?.message)
    }
  }, [authed, store, session?.user?.id])

  useEffect(() => { if (authed) refresh() }, [authed, refresh])

  useEffect(() => {
    if (!authed) return
    const cleanup = initSyncListener(supabase, () => {
      refresh()
    })
    return cleanup
  }, [authed, refresh])

  const setLang = useCallback((l) => {
    setLangState(l)
    try { localStorage.setItem(LANG_KEY, l) } catch {}
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const saved = await store.saveProfile(patch)
    setProfile((p) => ({ ...p, ...patch, ...(saved || {}) }))
    return saved
  }, [store])

  const userTier = (!session || isGuest) ? 'free' : (profile?.plan_tier || 'free')
  const isAiAllowed = userTier === 'premium' || userTier === 'admin'

  const open = useCallback((name, payload = true) => {
    if ((name === 'scan' || name === 'voice' || name === 'coach') && !isAiAllowed) {
      setSheets((s) => ({ ...s, aiPremium: true }))
      return
    }
    setSheets((s) => ({ ...s, [name]: payload }))
  }, [isAiAllowed])
  const close = useCallback((name) => setSheets((s) => ({ ...s, [name]: null })), [])

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut() } catch {}
    try { localStorage.removeItem(GUEST_KEY) } catch {}
    setIsGuest(false); setSession(null)
    setProfile({ ...DEFAULT_PROFILE }); setAccounts([]); setTransactions([]); setGoals([]); setBills([]); setBudgets([])
    setTab('home'); setSheets({})
  }, [])

  const enterGuest = () => { try { localStorage.setItem(GUEST_KEY, '1') } catch {}; setIsGuest(true) }
  const finishOnboarding = () => { try { localStorage.setItem(ONBOARD_KEY, '1') } catch {}; setOnboarded(true) }

  // High-performance optimistic transaction mutations
  const saveTransaction = useCallback(async (txData, editId) => {
    const prevTxList = transactions
    const prevAccList = accounts

    // 1. Instant optimistic state update
    let nextAccounts = accounts
    if (editId) {
      const old = transactions.find((x) => x.id === editId)
      if (old) {
        nextAccounts = computeBalanceDelta(nextAccounts, old, -1, rates)
      }
    }
    nextAccounts = computeBalanceDelta(nextAccounts, txData, 1, rates)
    setAccounts(nextAccounts)

    const tempId = editId || txData.id || `tx_${Date.now()}`
    const optimisticTx = { ...txData, id: tempId, created_at: txData.created_at || new Date().toISOString() }

    if (editId) {
      setTransactions((prev) => prev.map((t) => (t.id === editId ? { ...t, ...optimisticTx } : t)))
    } else {
      setTransactions((prev) => [optimisticTx, ...prev])
    }

    try {
      let saved
      if (editId) {
        const old = prevTxList.find((x) => x.id === editId)
        const ops = [store.updateTransaction(editId, txData)]
        if (old) {
          ops.push(applyTxToBalances(store, prevAccList, old, -1, rates))
        }
        ops.push(applyTxToBalances(store, nextAccounts, txData, 1, rates))
        const [updated] = await Promise.all(ops)
        saved = updated
      } else {
        // Run DB creation and balance sync concurrently for maximum speed
        const [created] = await Promise.all([
          store.createTransaction(txData),
          applyTxToBalances(store, prevAccList, txData, 1, rates),
        ])
        saved = created
        // If created has real ID, swap it in transactions
        if (saved?.id && saved.id !== tempId) {
          setTransactions((prev) => prev.map((t) => (t.id === tempId ? { ...t, id: saved.id } : t)))
        }
      }

      // Silent background sync
      refresh()
      return saved
    } catch (err) {
      console.error('saveTransaction error, reverting:', err)
      setTransactions(prevTxList)
      setAccounts(prevAccList)
      throw err
    }
  }, [transactions, accounts, rates, store, refresh])

  const deleteTransaction = useCallback(async (tx) => {
    if (!tx?.id) return
    const txId = tx.id
    const prevTxList = transactions
    const prevAccList = accounts

    // 1. Instant optimistic state update (0ms latency for user)
    setTransactions((prev) => prev.filter((item) => item.id !== txId))
    const deltaAccounts = computeBalanceDelta(accounts, tx, -1, rates)
    if (deltaAccounts) {
      setAccounts(deltaAccounts)
    }

    try {
      // 2. Concurrently delete transaction and balance update in DB
      await Promise.all([
        store.deleteTransaction(txId),
        applyTxToBalances(store, accounts, tx, -1, rates),
      ])
      // Silent background sync
      refresh()
      return true
    } catch (err) {
      console.error('deleteTransaction error, reverting:', err)
      setTransactions(prevTxList)
      setAccounts(prevAccList)
      throw err
    }
  }, [transactions, accounts, rates, store, refresh])

  // stats
  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((s, a) => s + convert(Number(a.balance) || 0, a.currency, home, rates), 0)
    const now = new Date()
    const inMonth = transactions.filter((tx) => { const d = new Date(tx.date || tx.transaction_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    const income = inMonth.filter((tx) => tx.type === 'income').reduce((s, tx) => s + convert(tx.amount, tx.currency, home, rates), 0)
    const spending = inMonth.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + convert(tx.amount, tx.currency, home, rates), 0)
    return { totalBalance, income, spending }
  }, [accounts, transactions, home, rates])

  const editTx = useCallback((tx) => {
    close('txDetail')
    setTimeout(() => open('addTx', { ...tx, editId: tx.id }), 150)
  }, [close, open])

  const handleQuickAction = useCallback((action) => {
    close('quickActions')
    close('quick')
    setTimeout(() => {
      if (action === 'addTx') {
        open('addTx')
      } else if (action === 'scanReceipt') {
        if (!isAiAllowed) {
          open('aiPremium')
        } else {
          open('scan')
        }
      } else if (action === 'savings') {
        setTab('goals')
      } else if (action === 'voiceLog') {
        if (!isAiAllowed) {
          open('aiPremium')
        } else {
          open('voice')
        }
      }
    }, 120)
  }, [close, open, isAiAllowed, setTab])

  const ctx = {
    t, lang, setLang, fmt, home, rates, convertToHome,
    session, user: session?.user || null, isGuest, profile, updateProfile, signOut,
    userTier, isAiAllowed,
    accounts, transactions, goals, bills, budgets, stats, store, refresh,
    addTransaction: saveTransaction, saveTransaction, deleteTransaction,
    tab, setTab, sheets, open, close,
    hideBalance, setHideBalance,
    editTx, handleQuickAction,
  }

  // ---- render gates ----
  if (booting) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="h-14 w-14 rounded-2xl bg-foreground text-background flex items-center justify-center text-2xl font-extrabold animate-pulse">P</div>
      </div>
    )
  }

  if (recovery) {
    return (
      <AppContext.Provider value={ctx}>
        <NewPasswordSheet onDone={() => setRecovery(false)} />
      </AppContext.Provider>
    )
  }

  if (!authed) {
    return (
      <AppContext.Provider value={ctx}>
        {!onboarded ? <Onboarding onDone={finishOnboarding} /> : <Login onGuest={enterGuest} />}
      </AppContext.Provider>
    )
  }

  return (
    <AppContext.Provider value={ctx}>
      <main className="min-h-dvh bg-background max-w-md mx-auto relative safe-top">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          {tab === 'home' ? <HomeTab /> : null}
          {tab === 'transactions' ? <TransactionsTab /> : null}
          {tab === 'goals' ? <GoalsTab /> : null}
          {tab === 'more' ? <MoreTab /> : null}
        </motion.div>

        <BottomNav tab={tab} onTab={setTab} onPlus={() => open('quickActions')} />

        {/* Sheets */}
        <QuickActionsSheet
          open={Boolean(sheets?.quickActions || sheets?.quick)}
          onClose={() => {
            close('quickActions')
            close('quick')
          }}
          onSelectAction={handleQuickAction}
        />
        <AddTransactionSheet open={!!sheets.addTx} onClose={() => close('addTx')} initial={sheets.addTx && typeof sheets.addTx === 'object' ? sheets.addTx : {}} />
        <ProfileSheet open={!!sheets.profile} onClose={() => close('profile')} />
        <NewAccountSheet open={!!sheets.newAccount} onClose={() => close('newAccount')} />
        <VoiceLogSheet open={!!sheets.voice} onClose={() => close('voice')} onResult={(data) => { close('voice'); setTimeout(() => open('addTx', data), 150) }} />
        <ScanReceiptSheet open={Boolean(sheets?.scan || sheets?.scanReceipt)} onClose={() => { close('scan'); close('scanReceipt') }} onUse={(data) => { close('scan'); close('scanReceipt'); setTimeout(() => open('addTx', data), 150) }} />
        <TransactionDetailSheet open={!!sheets.txDetail} onClose={() => close('txDetail')} tx={sheets.txDetail && typeof sheets.txDetail === 'object' ? sheets.txDetail : null} onEdit={editTx} />
        <CoachSheet open={!!sheets.coach} onClose={() => close('coach')} />
        <SplitBillSheet open={!!sheets.split} onClose={() => close('split')} />
        <AccountsSheet open={!!sheets.accounts} onClose={() => close('accounts')} />
        <AnalyticsSheet open={!!sheets.analytics} onClose={() => close('analytics')} />
        <NotificationsSheet open={!!sheets.notifications} onClose={() => close('notifications')} />
        <SmartAutomationSheet open={!!sheets.automation} onClose={() => close('automation')} />
        <BillsTrackerSheet open={!!sheets.bills} onClose={() => close('bills')} />
        <LoanCalculatorSheet open={!!sheets.loan} onClose={() => close('loan')} />
        <CategoriesTemplatesSheet open={!!sheets.catman} onClose={() => close('catman')} />
        <DebtTrackerSheet open={!!sheets.debts} onClose={() => close('debts')} />
        <ExportTransactionsSheet open={!!sheets.exportTx} onClose={() => close('exportTx')} />
        <ImportTransactionsSheet open={!!sheets.importTx} onClose={() => close('importTx')} />
        <ReceiptGallerySheet
          open={Boolean(sheets?.receiptGallery)}
          onClose={() => close('receiptGallery')}
          onOpenScanner={() => {
            close('receiptGallery')
            setTimeout(() => {
              if (!isAiAllowed) {
                open('aiPremium')
              } else {
                open('scan')
              }
            }, 120)
          }}
        />
        <CurrencySheet
          open={!!sheets.currency}
          onClose={() => close('currency')}
          value={home}
          title={t('home_currency')}
          onSelect={(code) => updateProfile({ home_currency: code })}
        />
        <AiPremiumSheet
          open={!!sheets.aiPremium}
          onClose={() => close('aiPremium')}
          onUpgrade={() => {
            close('aiPremium')
            open('paywall')
          }}
        />
        <PaywallSheet open={!!sheets.paywall} onClose={() => close('paywall')} />
        <CloudReceiptBackupSheet open={!!sheets.cloudBackup} onClose={() => close('cloudBackup')} />
      </main>
    </AppContext.Provider>
  )
}
