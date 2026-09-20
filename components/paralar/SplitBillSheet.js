'use client'
import { useEffect, useMemo, useState } from 'react'
import { Plus, X, UserPlus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Field, TextInput, Segmented, PrimaryButton, Card } from './ui'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { cn } from '@/lib/utils'

export default function SplitBillSheet({ open, onClose }) {
  const { t, home, fmt, profile } = useApp()
  const [title, setTitle] = useState('')
  const [total, setTotal] = useState('')
  const [mode, setMode] = useState('equally')
  const [people, setPeople] = useState([])
  const [newPerson, setNewPerson] = useState('')
  const [items, setItems] = useState([])
  const [assign, setAssign] = useState({})
  const [activePerson, setActivePerson] = useState('me')

  useEffect(() => {
    if (!open) return
    setTitle(''); setTotal(''); setMode('equally'); setItems([]); setAssign({}); setNewPerson('')
    const me = { id: 'me', name: profile?.full_name?.split(' ')[0] || t('you') }
    setPeople([me, { id: 'p1', name: '' }]); setActivePerson('me')
  }, [open]) // eslint-disable-line

  const named = people.filter((p) => p.name.trim())
  const totalNum = mode === 'items' ? items.reduce((s, i) => s + (Number(i.price) || 0), 0) : Number(total) || 0
  const equalShare = named.length ? roundMoney(totalNum / named.length, home) : 0

  const perPerson = useMemo(() => {
    const totals = Object.fromEntries(people.map((p) => [p.id, 0]))
    if (mode === 'equally') { named.forEach((p) => { totals[p.id] = equalShare }); return { totals, unassigned: 0 } }
    if (mode === 'uneven') { people.forEach((p) => { totals[p.id] = Number(p.amount) || 0 }); return { totals, unassigned: 0 } }
    let unassigned = 0
    items.forEach((it, idx) => {
      const a = assign[idx] || []; const price = Number(it.price) || 0
      if (!a.length) { unassigned += price; return }
      const share = price / a.length; a.forEach((pid) => { if (totals[pid] != null) totals[pid] += share })
    })
    return { totals, unassigned }
  }, [mode, people, named, equalShare, items, assign])

  const setPerson = (id, patch) => setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const addPerson = () => { const name = newPerson.trim(); const id = `p_${Date.now()}`; setPeople((ps) => [...ps, { id, name: name || `Person ${ps.length + 1}` }]); setActivePerson(id); setNewPerson('') }
  const removePerson = (id) => { if (id === 'me') return; setPeople((ps) => ps.filter((p) => p.id !== id)); setAssign((a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.filter((x) => x !== id)]))); if (activePerson === id) setActivePerson('me') }
  const addItem = () => setItems((x) => [...x, { name: '', price: 0 }])
  const setItem = (i, patch) => setItems((x) => x.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const delItem = (i) => { setItems((x) => x.filter((_, idx) => idx !== i)); setAssign((a) => { const c = { ...a }; delete c[i]; return c }) }
  const toggleAssign = (i) => setAssign((a) => { const cur = a[i] || []; return { ...a, [i]: cur.includes(activePerson) ? cur.filter((x) => x !== activePerson) : [...cur, activePerson] } })

  const save = () => {
    if (!title.trim() || totalNum <= 0 || named.length < 2) { toast.error(t('error')); return }
    toast.success(t('saved_msg')); onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} full title={t('split_bill')} left={<SheetTextButton muted onClick={onClose}>{t('cancel')}</SheetTextButton>} right={<SheetTextButton bold onClick={save}>{t('save')}</SheetTextButton>}>
      <div className="space-y-5 pt-2">
        <Field label={t('goal_name')}><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Dinner at Murni" data-testid="split-title" /></Field>
        <Segmented value={mode} onChange={setMode} options={[{ id: 'equally', label: t('equally') }, { id: 'uneven', label: t('uneven') }, { id: 'items', label: t('by_items') }]} />

        {mode !== 'items' ? (
          <Field label={`${t('total')} (${getCurrency(home).code})`}><TextInput type="number" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" className="text-lg font-bold" data-testid="split-total" /></Field>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1"><p className="label-upper">{t('items')}</p><span className="text-sm font-bold tabular-nums">{fmt(totalNum, home)}</span></div>
            <Card className="overflow-hidden">
              {items.map((it, i) => {
                const a = assign[i] || []; const mine = a.includes(activePerson)
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-border/30 last:border-0">
                    <button type="button" onClick={() => toggleAssign(i)} className={cn('h-5 w-5 rounded-md border flex items-center justify-center shrink-0', mine ? 'bg-foreground border-foreground text-background' : 'border-border')}>{mine ? <Check size={12} strokeWidth={3} /> : null}</button>
                    <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={t('item_name')} className="flex-1 bg-transparent outline-none text-sm min-w-0" />
                    <input type="number" inputMode="decimal" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) || 0 })} className="w-20 bg-muted rounded-lg px-2 py-1 text-right text-sm outline-none tabular-nums" placeholder="0" />
                    <button type="button" onClick={() => delItem(i)} className="p-1 text-muted-foreground"><X size={14} /></button>
                  </div>
                )
              })}
              <button type="button" onClick={addItem} className="w-full px-3 py-2.5 text-sm font-semibold flex items-center gap-1.5 text-muted-foreground"><Plus size={14} /> {t('add_item')}</button>
            </Card>
            {perPerson.unassigned > 0 ? <p className="text-xs text-muted-foreground mt-1">{t('unassigned_items')}: {fmt(perPerson.unassigned, home)}</p> : null}
          </div>
        )}

        {mode === 'equally' && named.length ? <p className="text-center text-sm text-muted-foreground">{fmt(equalShare, home)} / {t('person')} × {named.length}</p> : null}

        <div>
          <p className="label-upper mb-2">{t('participants')}</p>
          <div className="space-y-2">
            {people.map((p) => (
              <Card key={p.id} className={cn('flex items-center gap-2 p-2.5', mode === 'items' && activePerson === p.id && 'ring-2 ring-foreground/30')} onClick={mode === 'items' ? () => setActivePerson(p.id) : undefined}>
                <div className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">{(p.name.trim()[0] || '?').toUpperCase()}</div>
                <input value={p.name} onChange={(e) => setPerson(p.id, { name: e.target.value })} placeholder="Name" className="flex-1 bg-transparent outline-none text-sm font-medium min-w-0" onClick={(e) => e.stopPropagation()} />
                {mode === 'uneven' ? (
                  <input type="number" inputMode="decimal" value={p.amount || ''} onChange={(e) => setPerson(p.id, { amount: e.target.value })} placeholder="0" className="w-20 bg-muted rounded-lg px-2 py-1.5 text-sm text-right outline-none" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground pr-1">{fmt(perPerson.totals[p.id] || 0, home)}</span>
                )}
                {p.id !== 'me' ? <button type="button" onClick={(e) => { e.stopPropagation(); removePerson(p.id) }} className="p-1.5 text-muted-foreground"><X size={15} /></button> : null}
              </Card>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <TextInput value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPerson()} placeholder={t('add_participant')} className="py-2" data-testid="split-add" />
            <button type="button" onClick={addPerson} className="h-[42px] w-[42px] rounded-xl bg-foreground text-background flex items-center justify-center shrink-0"><UserPlus size={16} /></button>
          </div>
        </div>

        <PrimaryButton onClick={save}>{t('save')}</PrimaryButton>
      </div>
    </Sheet>
  )
}
