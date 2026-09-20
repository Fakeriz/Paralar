'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Receipt, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, TextInput, Field, PrimaryButton } from './ui'
import { CATEGORIES } from '@/lib/categories'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { cn } from '@/lib/utils'

const LOCALE = { en: 'en-GB', tr: 'tr-TR', ms: 'ms-MY', id: 'id-ID' }
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const EXPENSE_CATS = CATEGORIES.filter((c) => c.types?.includes('expense'))

export default function BillsTrackerSheet({ open, onClose }) {
  const { t, fmt, home, accounts = [], store, lang, convertToHome } = useApp()
  const [bills, setBills] = useState([])
  const [month, setMonth] = useState(new Date())
  const [adding, setAdding] = useState(false)

  // add form
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('1')
  const [category, setCategory] = useState('bills')
  const [accountId, setAccountId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try { const list = await store.listBills(); setBills(Array.isArray(list) ? list : []) } catch { setBills([]) }
  }

  useEffect(() => {
    if (!open) return
    setMonth(new Date()); setAdding(false)
    load()
  }, [open]) // eslint-disable-line

  const mKey = monthKeyOf(month)
  const monthLabel = useMemo(() => {
    try { return month.toLocaleDateString(LOCALE[lang] || 'en-GB', { month: 'long', year: 'numeric' }) } catch { return '' }
  }, [month, lang])

  const rows = useMemo(() => {
    return (bills || []).map((b) => ({ ...b, paid: !!(b?.paid_months || {})[mKey] }))
      .sort((a, b) => (Number(a?.due_day) || 0) - (Number(b?.due_day) || 0))
  }, [bills, mKey])

  const toHome = (b) => {
    const raw = Number(b?.amount) || 0
    try { const v = convertToHome ? convertToHome(raw, b?.currency || home) : raw; return typeof v === 'number' && !isNaN(v) ? v : raw } catch { return raw }
  }
  const summary = useMemo(() => {
    let total = 0, paid = 0
    ;(rows || []).forEach((b) => { const v = toHome(b); total += v; if (b.paid) paid += v })
    return { total, paid, remaining: Math.max(0, total - paid) }
  }, [rows]) // eslint-disable-line

  const shiftMonth = (delta) => setMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1))

  const toggle = async (b) => {
    const pm = { ...(b?.paid_months || {}) }
    if (pm[mKey]) delete pm[mKey]; else pm[mKey] = true
    // optimistic
    setBills((list) => (list || []).map((x) => (x.id === b.id ? { ...x, paid_months: pm } : x)))
    try { await store.updateBill(b.id, { paid_months: pm }); await load() } catch (e) { toast.error(e?.message || t('error')); load() }
  }

  const removeBill = async (b) => {
    setBills((list) => (list || []).filter((x) => x.id !== b.id))
    try { await store.deleteBill(b.id) } catch (e) { toast.error(e?.message || t('error')); load() }
  }

  const openAdd = () => {
    setTitle(''); setAmount(''); setDueDay('1'); setCategory('bills'); setAccountId(accounts[0]?.id || null); setAdding(true)
  }

  const saveBill = async () => {
    if (!title.trim() || !Number(amount) || saving) return
    setSaving(true)
    try {
      await store.createBill({
        title: title.trim(),
        amount: roundMoney(Number(amount), home),
        currency: home,
        due_day: Math.min(31, Math.max(1, Number(dueDay) || 1)),
        category,
        account_id: accountId,
      })
      await load()
      setAdding(false)
      toast.success(t('saved_msg'))
    } catch (e) { toast.error(e?.message || t('error')) } finally { setSaving(false) }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        full
        title={(
          <div className="leading-tight">
            <div className="text-base font-bold">Bills</div>
            <div className="text-[11px] font-normal text-muted-foreground">Monthly paid / unpaid checklist</div>
          </div>
        )}
        left={<button type="button" onClick={onClose} className="text-[15px] font-medium py-1 px-1" data-testid="bills-done">Done</button>}
        right={<button type="button" onClick={openAdd} className="text-[15px] font-bold py-1 px-1" data-testid="bills-add">Add</button>}
      >
        {/* Month navigation */}
        <div className="flex items-center justify-between mt-2">
          <button type="button" onClick={() => shiftMonth(-1)} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center" aria-label="prev month" data-testid="bills-prev"><ChevronLeft size={18} /></button>
          <p className="font-bold text-[15px] tabular-nums" data-testid="bills-month">{monthLabel}</p>
          <button type="button" onClick={() => shiftMonth(1)} className="h-10 w-10 rounded-full bg-muted flex items-center justify-center" aria-label="next month" data-testid="bills-next"><ChevronRight size={18} /></button>
        </div>

        {/* Summary card */}
        <div className="mt-4 rounded-2xl bg-foreground text-background p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-60">Remaining this month</p>
          <p className="text-3xl font-extrabold tabular-nums mt-1" data-testid="bills-remaining">{fmt(summary.remaining, home)}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl bg-background/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide opacity-60">Paid</p>
              <p className="font-bold tabular-nums mt-0.5" data-testid="bills-paid">{fmt(summary.paid, home)}</p>
            </div>
            <div className="rounded-xl bg-background/10 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide opacity-60">Total</p>
              <p className="font-bold tabular-nums mt-0.5" data-testid="bills-total">{fmt(summary.total, home)}</p>
            </div>
          </div>
        </div>

        {/* List / empty state */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><Receipt size={26} className="text-muted-foreground" /></div>
            <p className="font-semibold">No bills to track</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">Add your recurring monthly bills and tick them off as you pay.</p>
            <button type="button" onClick={openAdd} className="mt-5 rounded-xl bg-foreground text-background font-semibold px-5 py-3 text-[15px] active:scale-[0.98] transition" data-testid="bills-add-first">Add first bill</button>
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            {rows.map((b) => {
              const cur = getCurrency(b?.currency || home)
              return (
                <div key={b.id} className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors', b.paid ? 'bg-muted/50 border-border/40' : 'bg-card border-border/50')} data-testid="bill-row">
                  <button
                    type="button"
                    onClick={() => toggle(b)}
                    className={cn('h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors', b.paid ? 'bg-foreground border-foreground text-background' : 'border-muted-foreground/40 text-transparent')}
                    aria-label="toggle paid"
                    data-testid="bill-toggle"
                  >
                    {b.paid ? <Check size={15} strokeWidth={3} /> : null}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-semibold text-[15px] truncate', b.paid && 'line-through text-muted-foreground')}>{b?.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{t(`cat_${b?.category || 'bills'}`)} · Due day {b?.due_day || 1}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('font-bold text-[15px] tabular-nums', b.paid && 'text-muted-foreground')}>{cur.flag} {fmt(b?.amount, b?.currency || home)}</p>
                    <button type="button" onClick={() => removeBill(b)} className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5" aria-label="delete bill"><Trash2 size={11} /> {t('delete')}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="h-6" />
      </Sheet>

      {/* Add bill form */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add Bill" zIndex={70}
        left={<button type="button" onClick={() => setAdding(false)} className="text-[15px] text-muted-foreground py-1 px-1">{t('cancel')}</button>}
        right={<button type="button" onClick={saveBill} disabled={!title.trim() || !Number(amount) || saving} className={cn('text-[15px] font-bold py-1 px-1', (!title.trim() || !Number(amount) || saving) && 'opacity-40')} data-testid="bill-save">{saving ? '...' : t('save')}</button>}
      >
        <div className="space-y-5 pt-2">
          <Field label="Bill title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Netflix, Rent, Internet" data-testid="bill-title" /></Field>
          <Field label={`Amount (${home})`}><TextInput type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-lg font-bold" data-testid="bill-amount" /></Field>
          <Field label="Due date (day of month)"><TextInput type="number" inputMode="numeric" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="1" data-testid="bill-due" /></Field>

          <Field label={t('category')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {EXPENSE_CATS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn('shrink-0 rounded-xl border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors', category === c.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border/60 text-foreground')}
                  data-testid={`bill-cat-${c.id}`}
                >
                  {t(`cat_${c.id}`)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('source_account')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              <button type="button" onClick={() => setAccountId(null)} className={cn('shrink-0 rounded-xl border px-3.5 py-2 text-sm font-medium whitespace-nowrap', accountId === null ? 'bg-foreground text-background border-foreground' : 'bg-card border-border/60')}>{t('no_account_opt')}</button>
              {(accounts || []).map((a) => (
                <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={cn('shrink-0 rounded-xl border px-3.5 py-2 text-sm font-medium whitespace-nowrap', accountId === a.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border/60')}>{a.name}</button>
              ))}
            </div>
          </Field>

          <PrimaryButton onClick={saveBill} disabled={!title.trim() || !Number(amount) || saving}>{saving ? '...' : t('save')}</PrimaryButton>
        </div>
      </Sheet>
    </>
  )
}
