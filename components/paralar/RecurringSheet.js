'use client'
import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Trash2, Repeat } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, TextInput, Field, Segmented } from './ui'
import CurrencySheet from './CurrencySheet'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'

const LS_KEY = 'paralar_recurring'
const lsGet = () => { try { const v = localStorage.getItem(LS_KEY); return v ? JSON.parse(v) : [] } catch { return [] } }
const lsSet = (v) => { try { localStorage.setItem(LS_KEY, JSON.stringify(v)) } catch {} }
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}_${Math.random().toString(36).slice(2)}`)

const FREQ_SUFFIX = { weekly: '/ week', monthly: '/ month', yearly: '/ year' }

const daysUntil = (s) => {
  if (!s) return null
  try { const d = new Date(s); if (isNaN(d.getTime())) return null; const ms = new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0); return Math.round(ms / 86400000) } catch { return null }
}
const countdown = (s) => {
  const d = daysUntil(s)
  if (d == null) return ''
  if (d < 0) return `overdue ${Math.abs(d)}d`
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  return `in ${d} days`
}

export default function RecurringSheet({ open, onClose }) {
  const { t, home, fmt, accounts = [] } = useApp()
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [pickCur, setPickCur] = useState(false)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)
  const [freq, setFreq] = useState('monthly')
  const [due, setDue] = useState('')
  const [accountId, setAccountId] = useState(null)

  useEffect(() => {
    if (!open) return
    setItems(lsGet()); setAdding(false)
  }, [open])

  const openAdd = () => { setTitle(''); setAmount(''); setCurrency(home); setFreq('monthly'); setDue(''); setAccountId(accounts[0]?.id || null); setAdding(true) }
  const save = () => {
    if (!title.trim() || !(Number(amount) || 0)) return
    const row = { id: uid(), title: title.trim(), amount: Number(amount) || 0, currency, frequency: freq, next_due: due || null, account_id: accountId, created_at: new Date().toISOString() }
    const next = [...(items || []), row]
    setItems(next); lsSet(next); setAdding(false); toast.success(t('saved_msg'))
  }
  const remove = (id) => { const next = (items || []).filter((x) => x?.id !== id); setItems(next); lsSet(next) }

  return (
    <>
      <Sheet open={open} onClose={onClose} full title="Recurring Schedules"
        right={<button type="button" onClick={openAdd} className="text-[15px] font-bold py-1 px-1 flex items-center gap-1" data-testid="recurring-add"><Plus size={16} /> Add</button>}>

        <div className="mt-2 space-y-2.5">
          {(items || []).length === 0 && !adding ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center mb-3"><Repeat size={24} className="text-muted-foreground" strokeWidth={1.5} /></div>
              <p className="font-semibold">No recurring schedules</p>
              <p className="text-sm text-muted-foreground mt-1">Add subscriptions, rent or salary.</p>
            </div>
          ) : null}

          {(items || []).map((r) => {
            const acc = (accounts || []).find((a) => a?.id === r?.account_id)
            return (
              <div key={r?.id} className="flex items-center gap-3 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-white/[0.04] dark:border-white/10 px-4 py-3.5" data-testid="recurring-row">
                <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0"><Repeat size={18} strokeWidth={1.5} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate">{r?.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{countdown(r?.next_due)}{acc?.name ? ` · ${acc.name}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums text-[15px]">{fmt(r?.amount, r?.currency || home)}</p>
                  <p className="text-[11px] text-muted-foreground">{FREQ_SUFFIX[r?.frequency] || ''}</p>
                </div>
                <button type="button" onClick={() => remove(r?.id)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground shrink-0" aria-label="delete"><Trash2 size={15} /></button>
              </div>
            )
          })}
        </div>

        {adding ? (
          <div className="mt-4 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-white/[0.04] dark:border-white/10 p-4 space-y-4">
            <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Netflix, Rent, Salary" data-testid="recurring-title" /></Field>
            <Field label="Amount">
              <div className="flex gap-2">
                <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-background border border-border/60 px-3 py-3 flex items-center gap-1.5" data-testid="recurring-currency">
                  <span className="font-bold text-sm">{getCurrency(currency).symbol} {currency}</span>
                  <ChevronRight size={15} className="text-muted-foreground" />
                </button>
                <TextInput type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="flex-1 text-lg font-bold" data-testid="recurring-amount" />
              </div>
            </Field>
            <Field label="Frequency">
              <Segmented value={freq} onChange={setFreq} options={[{ id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }]} />
            </Field>
            <Field label="Next due date"><TextInput type="date" value={due} onChange={(e) => setDue(e.target.value)} data-testid="recurring-due" /></Field>
            <Field label={t('source_account')}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <button type="button" onClick={() => setAccountId(null)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium', accountId === null ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{t('no_account_opt')}</button>
                {(accounts || []).map((a) => (
                  <button key={a.id} type="button" onClick={() => setAccountId(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap', accountId === a.id ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{a.name}</button>
                ))}
              </div>
            </Field>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdding(false)} className="flex-1 rounded-xl bg-background border border-border/60 py-2.5 font-medium text-sm">{t('cancel')}</button>
              <button type="button" onClick={save} disabled={!title.trim() || !(Number(amount) || 0)} className={cn('flex-1 rounded-xl bg-foreground text-background py-2.5 font-semibold text-sm', (!title.trim() || !(Number(amount) || 0)) && 'opacity-40')} data-testid="recurring-save">{t('save')}</button>
            </div>
          </div>
        ) : null}
        <div className="h-6" />
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={80} />
    </>
  )
}
