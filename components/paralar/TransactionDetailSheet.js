'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Pencil, Trash2, Eye, X, Plus, Check, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Segmented, CategoryBadge, Card } from './ui'
import { roundMoney } from '@/lib/currencies'
import { applyTxToBalances } from '@/lib/ledger'
import { cn } from '@/lib/utils'

export default function TransactionDetailSheet({ open, onClose, tx, onEdit }) {
  const { t, fmt, home, accounts = [], store, refresh, rates, profile, lang, convertToHome } = useApp()
  const [subTab, setSubTab] = useState('items')
  const [viewImg, setViewImg] = useState(false)
  const [items, setItems] = useState([])
  const [editingItems, setEditingItems] = useState(false)
  // split state: participants + assignment map { itemIndex: [participantId,...] }
  const [people, setPeople] = useState([])
  const [assign, setAssign] = useState({})
  const [activePerson, setActivePerson] = useState(null)
  const [newPerson, setNewPerson] = useState('')

  useEffect(() => {
    if (!open || !tx) return
    setSubTab('items')
    setEditingItems(false)
    setItems(Array.isArray(tx.items) ? tx.items.map((it) => ({ ...it })) : [])
    const saved = tx.split
    if (saved?.people?.length) {
      setPeople(saved.people); setAssign(saved.assign || {}); setActivePerson(saved.people[0]?.id || null)
    } else {
      const me = { id: 'me', name: profile?.full_name?.split(' ')[0] || t('you') }
      setPeople([me]); setAssign({}); setActivePerson('me')
    }
    setNewPerson('')
  }, [open, tx]) // eslint-disable-line

  const cur = tx?.currency || home
  if (!tx) return null
  const acc = accounts.find((a) => a.id === tx.account_id)
  const d = tx.date ? new Date(tx.date) : new Date()
  const isForeign = cur !== home
  const total = Number(tx.amount) || items.reduce((s, i) => s + (Number(i.price) || 0), 0)

  // per-person totals for split-by-items
  const perPerson = useMemo(() => {
    const totals = Object.fromEntries(people.map((p) => [p.id, 0]))
    let unassigned = 0
    items.forEach((it, idx) => {
      const assignees = assign[idx] || []
      const price = Number(it.price) || 0
      if (!assignees.length) { unassigned += price; return }
      const share = price / assignees.length
      assignees.forEach((pid) => { if (totals[pid] != null) totals[pid] += share })
    })
    return { totals, unassigned }
  }, [items, assign, people])

  const remove = async () => {
    try {
      await applyTxToBalances(store, accounts, tx, -1, rates)
      await store.deleteTransaction(tx.id)
      await refresh(); toast.success(t('deleted')); onClose?.()
    } catch (e) { toast.error(e?.message || t('error')) }
  }

  const persistItems = async (next) => {
    setItems(next)
    try { await store.updateTransaction(tx.id, { items: next }); await refresh() } catch (e) { toast.error(e?.message || t('error')) }
  }
  const setItem = (idx, patch) => { const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it)); setItems(next) }
  const addItem = () => setItems((x) => [...x, { name: '', qty: 1, price: 0 }])
  const delItem = (idx) => { const next = items.filter((_, i) => i !== idx); persistItems(next); setAssign((a) => { const c = { ...a }; delete c[idx]; return c }) }

  const addPerson = () => {
    const name = newPerson.trim()
    if (!name) return
    const id = `p_${Date.now()}`
    setPeople((ps) => [...ps, { id, name }]); setActivePerson(id); setNewPerson('')
  }
  const removePerson = (id) => {
    if (id === 'me') return
    setPeople((ps) => ps.filter((p) => p.id !== id))
    setAssign((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.filter((x) => x !== id)])))
    if (activePerson === id) setActivePerson('me')
  }
  const toggleAssign = (idx) => {
    if (!activePerson) return
    setAssign((a) => {
      const cur = a[idx] || []
      return { ...a, [idx]: cur.includes(activePerson) ? cur.filter((x) => x !== activePerson) : [...cur, activePerson] }
    })
  }
  const saveSplit = async () => {
    try { await store.updateTransaction(tx.id, { split: { people, assign, savedAt: new Date().toISOString() } }); await refresh(); toast.success(t('saved_msg')) } catch (e) { toast.error(e?.message || t('error')) }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      left={<button type="button" onClick={onClose} className="p-1"><ChevronLeft size={22} /></button>}
      right={<div className="flex items-center gap-1"><button type="button" onClick={() => onEdit?.(tx)} className="p-2" data-testid="tx-edit"><Pencil size={18} /></button><button type="button" onClick={remove} className="p-2 text-destructive" data-testid="tx-delete"><Trash2 size={18} /></button></div>}
    >
      <p className="text-center text-xs text-muted-foreground">
        {t('paid_by')} {profile?.full_name?.split(' ')[0] || t('user')} {t('on')} {d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        {tx.receipt_number ? ` · ${t('receipt_no')} ${tx.receipt_number}` : ''}
      </p>

      <div className="flex items-center gap-3 mt-4">
        <CategoryBadge id={tx.category} size="lg" />
        <div className="flex-1">
          <p className="text-xl font-extrabold">{tx.merchant || tx.note || t(`cat_${tx.category || 'other'}`)}</p>
          <span className="inline-block mt-1 text-[10px] font-semibold uppercase rounded-md bg-muted px-2 py-0.5 text-muted-foreground">{t(`cat_${tx.category || 'other'}`)}</span>
        </div>
      </div>

      {tx.receipt_url ? (
        <button type="button" onClick={() => setViewImg(true)} className="relative mt-4 w-full rounded-2xl overflow-hidden bg-muted">
          <img src={tx.receipt_url} alt="receipt" className="w-full max-h-52 object-contain" />
          <span className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center"><Eye size={16} /></span>
        </button>
      ) : null}

      <div className="text-center mt-6">
        <p className={cn('text-4xl font-bold tabular-nums', tx.type === 'income' && 'text-emerald-600 dark:text-emerald-400')}>{tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}{fmt(total, cur)}</p>
        {isForeign ? <p className="text-sm text-muted-foreground mt-1">≈ {fmt(convertToHome(total, cur), home)} {home} · {t('rate')} {tx.rate ? Number(tx.rate).toPrecision(4) : ''}</p> : null}
        <p className="text-xs text-muted-foreground mt-2">{t(tx.payment_method || 'cash')}{acc ? ` · ${acc.name}` : ''}{tx.tax_deductible ? ` · ${t('tax_deductible')}` : ''}</p>
      </div>

      <div className="mt-6">
        <Segmented value={subTab} onChange={setSubTab} options={[{ id: 'items', label: t('items') }, { id: 'split', label: t('split') }]} />

        {subTab === 'items' ? (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="label-upper">{items.length} {t('items')}</p>
              <button type="button" onClick={() => { if (editingItems) persistItems(items); setEditingItems(!editingItems) }} className="text-xs font-semibold flex items-center gap-1">{editingItems ? <><Check size={13} /> {t('done')}</> : <><Pencil size={12} /> {t('edit')}</>}</button>
            </div>
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] px-4 py-2 label-upper border-b border-border/40"><span>{t('item')}</span><span>{t('price')}</span></div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-sm border-b border-border/30 last:border-0">
                  {editingItems ? (
                    <>
                      <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={t('item_name')} className="flex-1 bg-transparent outline-none min-w-0" />
                      <input type="number" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) || 0 })} className="w-20 bg-muted rounded-lg px-2 py-1 text-right outline-none tabular-nums" />
                      <button type="button" onClick={() => delItem(i)} className="p-1 text-muted-foreground"><X size={15} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{it.qty > 1 ? `${it.qty}× ` : ''}{it.name || t('item')}</span>
                      <span className="tabular-nums font-semibold">{fmt(it.price, cur)}</span>
                    </>
                  )}
                </div>
              ))}
              {!items.length ? <p className="px-4 py-3 text-sm text-muted-foreground">—</p> : null}
              {editingItems ? <button type="button" onClick={addItem} className="w-full px-4 py-3 text-sm font-semibold flex items-center gap-1.5 text-muted-foreground"><Plus size={15} /> {t('add_item')}</button> : null}
              <div className="grid grid-cols-[1fr_auto] px-4 py-3 font-bold border-t border-border/40"><span>{t('total')}</span><span className="tabular-nums">{fmt(total, cur)}</span></div>
            </Card>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {/* Participants */}
            <div>
              <p className="label-upper mb-2">{t('participants')}</p>
              <div className="flex flex-wrap gap-2">
                {people.map((p) => (
                  <button key={p.id} type="button" onClick={() => setActivePerson(p.id)} className={cn('inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium', activePerson === p.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border/60')}>
                    <span className="h-5 w-5 rounded-full bg-muted-foreground/20 flex items-center justify-center text-[10px] font-bold">{(p.name[0] || '?').toUpperCase()}</span>
                    {p.name}
                    <span className="tabular-nums opacity-80">{fmt(perPerson.totals[p.id] || 0, cur)}</span>
                    {p.id !== 'me' ? <X size={13} onClick={(e) => { e.stopPropagation(); removePerson(p.id) }} /> : null}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} placeholder={t('add_participant')} className="flex-1 rounded-xl bg-card border border-border/60 px-3 py-2 text-sm outline-none" data-testid="split-add-person" />
                <button type="button" onClick={addPerson} className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center"><UserPlus size={16} /></button>
              </div>
            </div>

            {/* Assign items */}
            {items.length ? (
              <div>
                <p className="label-upper mb-1">{t('assign_items')}</p>
                <p className="text-xs text-muted-foreground mb-2">{t('tap_to_assign')}: <span className="font-semibold text-foreground">{people.find((p) => p.id === activePerson)?.name || '—'}</span></p>
                <Card className="overflow-hidden">
                  {items.map((it, i) => {
                    const assignees = assign[i] || []
                    const mine = activePerson && assignees.includes(activePerson)
                    return (
                      <button key={i} type="button" onClick={() => toggleAssign(i)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm border-b border-border/30 last:border-0 text-left">
                        <span className={cn('h-5 w-5 rounded-md border flex items-center justify-center shrink-0', mine ? 'bg-foreground border-foreground text-background' : 'border-border')}>{mine ? <Check size={13} strokeWidth={3} /> : null}</span>
                        <span className="flex-1 truncate">{it.name || t('item')}</span>
                        <span className="tabular-nums font-semibold">{fmt(it.price, cur)}</span>
                        {assignees.length ? <span className="text-[10px] text-muted-foreground">/{assignees.length}</span> : null}
                      </button>
                    )
                  })}
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-muted/50">
                    <span className="text-muted-foreground">{t('unassigned_items')}</span>
                    <span className="tabular-nums font-semibold">{fmt(perPerson.unassigned, cur)}</span>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                {t('no_transactions_sub')}
              </div>
            )}

            {/* Summary */}
            <Card className="p-4 space-y-2">
              {people.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="tabular-nums font-bold">{fmt(perPerson.totals[p.id] || 0, cur)}</span>
                </div>
              ))}
            </Card>

            <button type="button" onClick={saveSplit} className="w-full rounded-xl bg-foreground text-background font-semibold py-3.5" data-testid="split-save">{t('save_split')}</button>
          </div>
        )}
      </div>
      <div className="h-8" />

      {viewImg && tx.receipt_url ? (
        <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewImg(false)}>
          <button type="button" className="absolute top-6 right-6 text-white" onClick={() => setViewImg(false)}><X size={26} /></button>
          <img src={tx.receipt_url} alt="receipt" className="max-h-[85vh] max-w-full object-contain rounded-xl" />
        </div>
      ) : null}
    </Sheet>
  )
}
