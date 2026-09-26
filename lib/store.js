import { v4 as uuidv4 } from 'uuid'
import { supabase } from './supabase'
import { addToSyncQueue, getOfflineTransactions, saveOfflineTransactions, isOnline, getSyncQueue } from './sync'

const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4()

// Hybrid data layer: guest mode -> localStorage, authenticated -> Supabase (RLS protected)

const LS = {
  profile: 'paralar_guest_profile',
  accounts: 'paralar_guest_accounts',
  transactions: 'paralar_guest_transactions',
  goals: 'paralar_guest_goals',
}

const lsGet = (k, d) => {
  if (typeof window === 'undefined') return d
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
}
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export const DEFAULT_PROFILE = {
  full_name: '',
  avatar_url: '',
  usage_mode: 'personal',
  language: 'en',
  home_currency: 'USD',
  plan_tier: 'free',
  cloud_backup_provider: 'local',
}

function guestStore() {
  return {
    mode: 'guest',
    async getProfile() { return { ...DEFAULT_PROFILE, ...(lsGet(LS.profile, {}) || {}) } },
    async saveProfile(patch) { const p = { ...DEFAULT_PROFILE, ...(lsGet(LS.profile, {}) || {}), ...patch }; lsSet(LS.profile, p); return p },

    async listAccounts() { return lsGet(LS.accounts, []) || [] },
    async createAccount(a) { const list = lsGet(LS.accounts, []) || []; const acc = { id: uuidv4(), created_at: new Date().toISOString(), ...a }; lsSet(LS.accounts, [...list, acc]); return acc },
    async updateAccount(id, patch) { const list = (lsGet(LS.accounts, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(LS.accounts, list); return list.find((x) => x.id === id) },
    async deleteAccount(id) { lsSet(LS.accounts, (lsGet(LS.accounts, []) || []).filter((x) => x.id !== id)) },

    async listTransactions() {
      return (lsGet(LS.transactions, []) || []).map((x) => ({
        description: x.description || x.note || '',
        transaction_date: x.transaction_date || x.date,
        ...x,
      })).sort((a, b) => new Date(b.date || b.transaction_date) - new Date(a.date || a.transaction_date))
    },
    async createTransaction(t) {
      const list = lsGet(LS.transactions, []) || [];
      const tx = {
        id: t.id || generateId(),
        created_at: new Date().toISOString(),
        currency: t.currency || 'USD',
        note: t.note || t.description || null,
        date: t.date || t.transaction_date || new Date().toISOString(),
        ...t,
      };
      lsSet(LS.transactions, [tx, ...list]);
      return tx
    },
    async updateTransaction(id, patch) { const list = (lsGet(LS.transactions, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(LS.transactions, list); return list.find((x) => x.id === id) },
    async deleteTransaction(id) { lsSet(LS.transactions, (lsGet(LS.transactions, []) || []).filter((x) => x.id !== id)) },

    async listGoals() { return lsGet(LS.goals, []) || [] },
    async createGoal(g) { const list = lsGet(LS.goals, []) || []; const goal = { id: uuidv4(), created_at: new Date().toISOString(), saved_amount: 0, ...g }; lsSet(LS.goals, [...list, goal]); return goal },
    async updateGoal(id, patch) { const list = (lsGet(LS.goals, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(LS.goals, list); return list.find((x) => x.id === id) },
    async deleteGoal(id) { lsSet(LS.goals, (lsGet(LS.goals, []) || []).filter((x) => x.id !== id)) },
  }
}

function wrapError(error) {
  if (!error) return null
  const e = new Error(error.message || 'Supabase error')
  e.code = error.code
  e.missingTable = error.code === '42P01' || /relation .* does not exist/i.test(error.message || '') || /Could not find the table/i.test(error.message || '')
  return e
}

function supabaseStore(userId, userMeta = {}) {
  const uid = userId
  const table = (name) => supabase.from(name)
  const throwIf = (error) => { const e = wrapError(error); if (e) throw e }

  return {
    mode: 'supabase',
    async getProfile() {
      const localProvider = lsGet(`paralar_cloud_backup_provider_${uid}`) || lsGet('paralar_cloud_backup_provider') || 'local'
      const { data, error } = await table('profiles').select('*').eq('id', uid).maybeSingle()
      throwIf(error)
      if (data) return { ...DEFAULT_PROFILE, cloud_backup_provider: localProvider, ...data }
      const fresh = {
        id: uid,
        ...DEFAULT_PROFILE,
        cloud_backup_provider: localProvider,
        full_name: userMeta?.full_name || userMeta?.name || '',
        avatar_url: userMeta?.avatar_url || userMeta?.picture || '',
      }
      const { data: created, error: e2 } = await table('profiles').upsert(fresh).select().maybeSingle()
      if (e2) {
        const fallback = { ...fresh }
        delete fallback.cloud_backup_provider
        const { data: retry } = await table('profiles').upsert(fallback).select().maybeSingle()
        return { ...fresh, ...(retry || {}) }
      }
      return { ...fresh, ...(created || {}) }
    },
    async saveProfile(patch) {
      if (patch?.cloud_backup_provider) {
        lsSet(`paralar_cloud_backup_provider_${uid}`, patch.cloud_backup_provider)
        lsSet('paralar_cloud_backup_provider', patch.cloud_backup_provider)
      }
      const payload = { id: uid, ...patch, updated_at: new Date().toISOString() }
      let { data, error } = await table('profiles').upsert(payload).select().maybeSingle()
      if (error && (error.code === 'PGRST204' || error.code === '42703' || /does not exist/i.test(error.message || ''))) {
        const safePayload = { ...payload }
        delete safePayload.cloud_backup_provider
        const retry = await table('profiles').upsert(safePayload).select().maybeSingle()
        if (!retry.error) return { ...safePayload, ...patch, ...(retry.data || {}) }
      }
      throwIf(error)
      return { ...patch, ...(data || {}) }
    },

    async listAccounts() { const { data, error } = await table('accounts').select('*').eq('user_id', uid).order('created_at'); throwIf(error); return data || [] },
    async createAccount(a) { const { data, error } = await table('accounts').insert({ ...a, user_id: uid }).select().maybeSingle(); throwIf(error); return data },
    async updateAccount(id, patch) { const { data, error } = await table('accounts').update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle(); throwIf(error); return data },
    async deleteAccount(id) { const { error } = await table('accounts').delete().eq('id', id).eq('user_id', uid); throwIf(error) },

    async listTransactions() {
      let serverData = []
      let hadNetworkError = false

      if (!isOnline()) {
        const cached = lsGet(`paralar_state_cache_${uid}`, {})?.transactions || []
        serverData = cached
      } else {
        try {
          const { data, error } = await table('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }).limit(150)
          if (error) {
            if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
              hadNetworkError = true
              serverData = lsGet(`paralar_state_cache_${uid}`, {})?.transactions || []
            } else {
              throwIf(error)
            }
          } else {
            serverData = data || []
          }
        } catch (e) {
          hadNetworkError = true
          serverData = lsGet(`paralar_state_cache_${uid}`, {})?.transactions || []
        }
      }

      // Merge with offline queued mutations
      const offlineList = getOfflineTransactions()
      const syncQueue = getSyncQueue()
      const deletedIds = new Set(syncQueue.filter((q) => q.action === 'delete').map((q) => q.id))

      const map = new Map()
      serverData.forEach((row) => {
        if (!deletedIds.has(row.id)) {
          map.set(row.id, { ...row, _synced: true })
        }
      })
      offlineList.forEach((row) => {
        if (!deletedIds.has(row.id)) {
          const existing = map.get(row.id) || {}
          map.set(row.id, { ...existing, ...row, _synced: false })
        }
      })

      const combined = Array.from(map.values()).sort(
        (a, b) => new Date(b.date || b.transaction_date) - new Date(a.date || a.transaction_date)
      )

      return combined.map((row) => {
        let split = null
        try {
          const s = localStorage.getItem(`paralar_tx_split_${row.id}`)
          if (s) split = JSON.parse(s)
        } catch {}
        const localStoreProvider = lsGet(`paralar_tx_storage_${row.id}`)
        const itemMeta = Array.isArray(row.items) && row.items[0] && typeof row.items[0] === 'object' ? row.items[0] : {}
        let cachedReceipt = null
        if (typeof localStorage !== 'undefined' && row.receipt_url) {
          try {
            cachedReceipt =
              localStorage.getItem(`paralar_receipt_cache_${row.receipt_url}`) ||
              localStorage.getItem(`paralar_receipt_cache_${row.id}`)
            if (!cachedReceipt && row.receipt_url.includes('drive.google.com')) {
              const match = row.receipt_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || row.receipt_url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
              if (match?.[1]) {
                cachedReceipt = localStorage.getItem(`paralar_receipt_cache_${match[1]}`)
              }
            }
          } catch {}
        }
        return {
          description: row.description || row.note || '',
          transaction_date: row.transaction_date || row.date,
          bill_id: row.bill_id || itemMeta.bill_id || null,
          billing_month: row.billing_month || itemMeta.billing_month || null,
          storage_provider: row.storage_provider || localStoreProvider || (row.receipt_url?.includes('drive.google.com') ? 'google_drive' : 'local'),
          receipt_preview: cachedReceipt || row.receipt_preview || null,
          split,
          ...row,
        }
      })
    },
    async createTransaction(t) {
      const meta = {
        ...(t.bill_id ? { bill_id: t.bill_id } : {}),
        ...(t.billing_month ? { billing_month: t.billing_month } : {}),
        ...(t.description ? { description: t.description } : {}),
      }
      const rawDate = t.date || t.transaction_date || new Date().toISOString()
      const storageProvider = t.storage_provider || (t.receipt_url?.includes('drive.google.com') ? 'google_drive' : 'local')
      const id = t.id || generateId()

      if (typeof localStorage !== 'undefined' && (t.receipt_preview || t.receipt_url)) {
        try {
          const p = t.receipt_preview || (t.receipt_url?.startsWith('data:') ? t.receipt_url : null)
          if (p) {
            localStorage.setItem(`paralar_receipt_cache_${id}`, p)
            if (t.receipt_url) {
              localStorage.setItem(`paralar_receipt_cache_${t.receipt_url}`, p)
              const match = t.receipt_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || t.receipt_url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
              if (match?.[1]) {
                localStorage.setItem(`paralar_receipt_cache_${match[1]}`, p)
              }
            }
          }
        } catch {}
      }
      const cleanPayload = {
        id,
        user_id: uid,
        type: t.type || 'expense',
        amount: Number(t.amount) || 0,
        currency: t.currency || 'USD',
        home_currency: t.home_currency || null,
        home_currency_amount: t.home_currency_amount != null ? Number(t.home_currency_amount) : null,
        rate: t.rate != null ? Number(t.rate) : null,
        category: t.category || 'other',
        payment_method: t.payment_method || 'bank',
        account_id: t.account_id || null,
        to_account_id: t.to_account_id || null,
        fee: Number(t.fee) || 0,
        note: t.note || t.description || null,
        description: t.description || t.note || null,
        merchant: t.merchant || null,
        receipt_number: t.receipt_number || null,
        receipt_url: t.receipt_url || null,
        items: Array.isArray(t.items) && t.items.length ? t.items : (Object.keys(meta).length ? [meta] : []),
        tax_deductible: !!t.tax_deductible,
        date: rawDate,
        transaction_date: t.transaction_date || rawDate,
        bill_id: t.bill_id || null,
        billing_month: t.billing_month || null,
      }

      lsSet(`paralar_tx_storage_${id}`, storageProvider)

      // Optimistic cache update in local offline store
      const offlineList = getOfflineTransactions()
      saveOfflineTransactions([{ ...cleanPayload, storage_provider: storageProvider, _synced: false }, ...offlineList.filter((x) => x.id !== id)])

      // If offline: queue immediately
      if (!isOnline()) {
        addToSyncQueue('insert', 'transactions', cleanPayload)
        return { ...cleanPayload, storage_provider: storageProvider, id, _synced: false }
      }

      // Online: attempt insert
      try {
        const { data, error } = await table('transactions').insert(cleanPayload).select('id, created_at').maybeSingle()
        if (error) {
          if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
            addToSyncQueue('insert', 'transactions', cleanPayload)
            return { ...cleanPayload, storage_provider: storageProvider, id, _synced: false }
          }
          if (error.code === 'PGRST204' || error.code === '42703' || /does not exist/i.test(error.message || '')) {
            const minimalPayload = {
              id,
              user_id: uid,
              type: cleanPayload.type,
              amount: cleanPayload.amount,
              currency: cleanPayload.currency,
              category: cleanPayload.category,
              payment_method: cleanPayload.payment_method,
              account_id: cleanPayload.account_id,
              to_account_id: cleanPayload.to_account_id,
              note: cleanPayload.note,
              date: cleanPayload.date,
            }
            const { data: minData, error: minErr } = await table('transactions').insert(minimalPayload).select('id, created_at').maybeSingle()
            if (minErr && /network|fetch|offline|Failed to fetch/i.test(minErr.message || '')) {
              addToSyncQueue('insert', 'transactions', minimalPayload)
              return { ...cleanPayload, storage_provider: storageProvider, id, _synced: false }
            }
            throwIf(minErr)
            return { ...cleanPayload, storage_provider: storageProvider, id: minData?.id || id, _synced: true }
          }
          throwIf(error)
        }
        return { ...cleanPayload, storage_provider: storageProvider, id: data?.id || id, _synced: true }
      } catch (err) {
        if (/network|fetch|offline|Failed to fetch/i.test(err?.message || '')) {
          addToSyncQueue('insert', 'transactions', cleanPayload)
          return { ...cleanPayload, storage_provider: storageProvider, id, _synced: false }
        }
        throw err
      }
    },
    async updateTransaction(id, patch) {
      const allowed = [
        'type', 'amount', 'currency', 'home_currency', 'home_currency_amount',
        'rate', 'category', 'payment_method', 'account_id', 'to_account_id',
        'fee', 'note', 'merchant', 'receipt_number', 'receipt_url', 'items',
        'tax_deductible', 'date', 'transaction_date', 'description', 'bill_id', 'billing_month'
      ]
      const cleanPatch = {}
      for (const k of allowed) {
        if (patch[k] !== undefined) cleanPatch[k] = patch[k]
      }
      if (typeof localStorage !== 'undefined' && (patch.receipt_preview || patch.receipt_url)) {
        try {
          const p = patch.receipt_preview || (patch.receipt_url?.startsWith('data:') ? patch.receipt_url : null)
          if (p) {
            localStorage.setItem(`paralar_receipt_cache_${id}`, p)
            if (patch.receipt_url) {
              localStorage.setItem(`paralar_receipt_cache_${patch.receipt_url}`, p)
              const match = patch.receipt_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || patch.receipt_url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
              if (match?.[1]) {
                localStorage.setItem(`paralar_receipt_cache_${match[1]}`, p)
              }
            }
          }
        } catch {}
      }
      if (patch.split !== undefined) {
        try {
          localStorage.setItem(`paralar_tx_split_${id}`, JSON.stringify(patch.split))
        } catch {}
      }

      // Optimistic update in offline list
      const offlineList = getOfflineTransactions()
      const existingOfflineIdx = offlineList.findIndex((x) => x.id === id)
      if (existingOfflineIdx >= 0) {
        offlineList[existingOfflineIdx] = { ...offlineList[existingOfflineIdx], ...patch, _synced: false }
        saveOfflineTransactions(offlineList)
      }

      if (!isOnline()) {
        addToSyncQueue('update', 'transactions', { id, user_id: uid, ...cleanPatch })
        return { id, ...patch, _synced: false }
      }

      try {
        const { error } = await table('transactions').update(cleanPatch).eq('id', id).eq('user_id', uid)
        if (error) {
          if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
            addToSyncQueue('update', 'transactions', { id, user_id: uid, ...cleanPatch })
            return { id, ...patch, _synced: false }
          }
          throwIf(error)
        }
        return { id, ...patch, _synced: true }
      } catch (err) {
        if (/network|fetch|offline|Failed to fetch/i.test(err?.message || '')) {
          addToSyncQueue('update', 'transactions', { id, user_id: uid, ...cleanPatch })
          return { id, ...patch, _synced: false }
        }
        throw err
      }
    },
    async deleteTransaction(id) {
      // Optimistic update in offline list
      const offlineList = getOfflineTransactions()
      saveOfflineTransactions(offlineList.filter((x) => x.id !== id))
      try { localStorage.removeItem(`paralar_tx_split_${id}`) } catch {}

      if (!isOnline()) {
        addToSyncQueue('delete', 'transactions', { id, user_id: uid })
        return true
      }

      try {
        const { error } = await table('transactions').delete().eq('id', id).eq('user_id', uid)
        if (error) {
          if (/network|fetch|offline|Failed to fetch/i.test(error.message || '')) {
            addToSyncQueue('delete', 'transactions', { id, user_id: uid })
            return true
          }
          throwIf(error)
        }
        return true
      } catch (err) {
        if (/network|fetch|offline|Failed to fetch/i.test(err?.message || '')) {
          addToSyncQueue('delete', 'transactions', { id, user_id: uid })
          return true
        }
        throw err
      }
    },

    async listGoals() {
      const { data, error } = await table('goals').select('*').eq('user_id', uid).order('created_at')
      throwIf(error)
      return (data || []).filter((g) => g.type !== 'subscription')
    },
    async createGoal(g) { const { data, error } = await table('goals').insert({ ...g, user_id: uid }).select().maybeSingle(); throwIf(error); return data },
    async updateGoal(id, patch) { const { data, error } = await table('goals').update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle(); throwIf(error); return data },
    async deleteGoal(id) { const { error } = await table('goals').delete().eq('id', id).eq('user_id', uid); throwIf(error) },
  }
}

export function createStore(session) {
  const scope = session?.user?.id || 'guest'
  const base = session?.user?.id ? supabaseStore(session.user.id, session.user.user_metadata || {}) : guestStore()
  const categories = hybridColl(session, 'categories', `paralar_categories_${scope}`)
  const templates = hybridColl(session, 'transaction_templates', `paralar_templates_${scope}`)
  const debts = hybridColl(session, 'debts', `paralar_debts_${scope}`)
  // budgets are stored in local checklist / goals with type='budget'
  const budgets = localColl(`paralar_budgets_${scope}`)
  return {
    ...base,
    ...localBills(scope),
    ...localSubscriptions(session, scope),
    // Categories & Templates & Debts & Budgets (Supabase for authed w/ safe localStorage fallback; localStorage for guest)
    listCategories: () => categories.list(),
    createCategory: (r) => categories.create(r),
    updateCategory: (id, p) => categories.update(id, p),
    deleteCategory: (id) => categories.remove(id),
    listTemplates: () => templates.list(),
    createTemplate: (r) => templates.create(r),
    updateTemplate: (id, p) => templates.update(id, p),
    deleteTemplate: (id) => templates.remove(id),
    listDebts: () => debts.list(),
    createDebt: (r) => debts.create(r),
    updateDebt: (id, p) => debts.update(id, p),
    deleteDebt: (id) => debts.remove(id),
    listBudgets: () => budgets.list(),
    createBudget: (r) => budgets.create(r),
    updateBudget: (id, p) => budgets.update(id, p),
    deleteBudget: (id) => budgets.remove(id),
  }
}

// Pure localStorage collection.
function localColl(key) {
  return {
    async list() { return lsGet(key, []) || [] },
    async create(row) { const list = lsGet(key, []) || []; const r = { id: uuidv4(), created_at: new Date().toISOString(), ...row }; lsSet(key, [...list, r]); return r },
    async update(id, patch) { const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(key, list); return list.find((x) => x.id === id) },
    async remove(id) { lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id)) },
  }
}

// Hybrid collection: authed -> Supabase, but transparently falls back to localStorage on ANY error
// (missing table, offline, etc). Guest -> pure localStorage.
function hybridColl(session, tableName, key) {
  const uid = session?.user?.id
  const local = localColl(key)
  if (!uid) return local
  const tbl = () => supabase.from(tableName)
  return {
    async list() {
      try { const { data, error } = await tbl().select('*').eq('user_id', uid).order('created_at'); if (error) throw error; return data || [] }
      catch { return local.list() }
    },
    async create(row) {
      try { const { data, error } = await tbl().insert({ ...row, user_id: uid }).select().maybeSingle(); if (error) throw error; return data }
      catch { return local.create(row) }
    },
    async update(id, patch) {
      try { const { data, error } = await tbl().update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle(); if (error) throw error; return data }
      catch { return local.update(id, patch) }
    },
    async remove(id) {
      try { const { error } = await tbl().delete().eq('id', id).eq('user_id', uid); if (error) throw error }
      catch { return local.remove(id) }
    },
  }
}

// BILLS TRACKER — device-local (localStorage) monthly checklist. Works in both guest & authed modes.
// A bill is a recurring monthly item; `paid_months` maps 'YYYY-MM' -> true when settled that month.
function localBills(scope) {
  const key = `paralar_bills_${scope}`
  return {
    async listBills() { return lsGet(key, []) || [] },
    async createBill(b) {
      const list = lsGet(key, []) || []
      const bill = { id: uuidv4(), created_at: new Date().toISOString(), paid_months: {}, ...b }
      lsSet(key, [...list, bill])
      return bill
    },
    async updateBill(id, patch) {
      const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x))
      lsSet(key, list)
      return list.find((x) => x.id === id)
    },
    async deleteBill(id) { lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id)) },
  }
}

// SUBSCRIPTIONS (linked to Goals & Bills checklist)
function localSubscriptions(session, scope) {
  const key = `paralar_subscriptions_${scope}`
  const billsKey = `paralar_bills_${scope}`
  const uid = session?.user?.id

  const syncGoal = async (action, sub) => {
    if (!uid) return
    try {
      if (action === 'create' || action === 'update') {
        const payload = {
          id: sub.id,
          user_id: uid,
          name: sub.name || sub.title || 'Subscription',
          target_amount: Number(sub.amount) || 0,
          currency: sub.currency || 'USD',
          type: 'subscription',
          deadline: sub.next_billing_date || null,
        }
        const { error } = await supabase.from('goals').upsert(payload)
        if (error && (error.code === 'PGRST204' || error.code === '42703' || /does not exist/i.test(error.message || ''))) {
          // If 'type' column is absent in custom goals schema, upsert standard columns
          const { type: _, ...safe } = payload
          await supabase.from('goals').upsert(safe)
        }
      } else if (action === 'delete') {
        await supabase.from('goals').delete().eq('id', sub.id).eq('user_id', uid)
      }
    } catch (e) {
      console.warn('Goals subscription sync notice:', e?.message)
    }
  }

  const getDueDay = (sub) => {
    if (sub.next_billing_date) {
      const parts = sub.next_billing_date.split('-')
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10)
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) return parsed
      }
    }
    return Math.min(31, Math.max(1, Number(sub.due_day) || 1))
  }

  return {
    async listSubscriptions() { return lsGet(key, []) || [] },
    async createSubscription(s) {
      const list = lsGet(key, []) || []
      const sub = {
        id: uuidv4(),
        created_at: new Date().toISOString(),
        show_as_bill: true,
        ...s,
      }
      sub.due_day = getDueDay(sub)
      lsSet(key, [...list, sub])

      if (sub.show_as_bill) {
        const bills = lsGet(billsKey, []) || []
        const mirrorBill = {
          id: uuidv4(),
          created_at: new Date().toISOString(),
          title: sub.name || sub.title,
          amount: sub.amount,
          currency: sub.currency,
          due_day: sub.due_day,
          next_billing_date: sub.next_billing_date || null,
          cycle: sub.cycle || 'monthly',
          category: sub.category || 'cat_bills',
          account_id: sub.account_id || null,
          payment_method: sub.payment_method || 'card',
          auto_log_expense: Boolean(sub.auto_log_expense),
          is_subscription_mirror: true,
          subscription_id: sub.id,
          cover_url: sub.cover_url || null,
          paid_months: {},
        }
        lsSet(billsKey, [...bills, mirrorBill])
      }

      await syncGoal('create', sub)
      return sub
    },
    async updateSubscription(id, patch) {
      const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x))
      lsSet(key, list)
      const updated = list.find((x) => x.id === id)
      if (updated) {
        updated.due_day = getDueDay(updated)
        const bills = lsGet(billsKey, []) || []
        const existingIdx = bills.findIndex((b) => b.subscription_id === id)
        if (updated.show_as_bill) {
          const mirrorData = {
            title: updated.name || updated.title,
            amount: updated.amount,
            currency: updated.currency,
            due_day: updated.due_day,
            next_billing_date: updated.next_billing_date || null,
            cycle: updated.cycle || 'monthly',
            category: updated.category || 'cat_bills',
            account_id: updated.account_id || null,
            payment_method: updated.payment_method || 'card',
            auto_log_expense: Boolean(updated.auto_log_expense),
            is_subscription_mirror: true,
            subscription_id: updated.id,
            cover_url: updated.cover_url || null,
          }
          if (existingIdx >= 0) {
            bills[existingIdx] = {
              ...bills[existingIdx],
              ...mirrorData,
            }
          } else {
            bills.push({
              id: uuidv4(),
              created_at: new Date().toISOString(),
              ...mirrorData,
              paid_months: {},
            })
          }
          lsSet(billsKey, bills)
        } else {
          if (existingIdx >= 0) {
            lsSet(billsKey, bills.filter((b) => b.subscription_id !== id))
          }
        }
        await syncGoal('update', updated)
      }
      return updated
    },
    async deleteSubscription(id) {
      lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id))
      const bills = lsGet(billsKey, []) || []
      lsSet(billsKey, bills.filter((b) => b.subscription_id !== id))
      await syncGoal('delete', { id })
    },
  }
}
