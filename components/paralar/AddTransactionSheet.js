'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Calculator, Camera, Delete, Check, X, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Segmented, Pill, Field, TextInput, CategoryBadge, CategoryIcon, Card } from './ui'
import CurrencySheet from './CurrencySheet'
import { CATEGORIES, PAYMENT_METHODS } from '@/lib/categories'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { convert, getRate, formatRate } from '@/lib/rates'
import { applyTxToBalances, evaluateExpression, toLocalDatetimeValue, fileToDataUrl } from '@/lib/ledger'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '.', '0', '⌫', '+']

export default function AddTransactionSheet({ open, onClose, initial }) {
  const { t, home, rates, accounts = [], store, refresh, fmt, transactions = [] } = useApp()
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(home)
  const [category, setCategory] = useState('food')
  const [payment, setPayment] = useState('cash')
  const [accountId, setAccountId] = useState(null)
  const [toAccountId, setToAccountId] = useState(null)
  const [date, setDate] = useState(toLocalDatetimeValue(new Date()))
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [items, setItems] = useState([])
  const [merchant, setMerchant] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [tax, setTax] = useState(false)
  const [showFee, setShowFee] = useState(false)
  const [fee, setFee] = useState('')
  const [showCalc, setShowCalc] = useState(false)
  const [pickCurrency, setPickCurrency] = useState(false)
  const [pickCategory, setPickCategory] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const editId = initial?.editId || null

  useEffect(() => {
    if (!open) return
    const ini = initial || {}
    setType(ini.type || 'expense')
    setAmount(ini.amount ? String(ini.amount) : '')
    setCurrency(ini.currency || home)
    setCategory(ini.category || (ini.type === 'income' ? 'salary' : 'food'))
    setPayment(ini.payment_method || 'cash')
    let accId = ini.account_id || null
    if (!accId && ini.account_name) {
      const m = accounts.find((a) => a.name?.toLowerCase().includes(String(ini.account_name).toLowerCase()) || String(ini.account_name).toLowerCase().includes(a.name?.toLowerCase()))
      accId = m?.id || null
    }
    if (!accId && !ini.editId && ini.account_id !== null) accId = accounts[0]?.id || null
    setAccountId(accId)
    setToAccountId(ini.to_account_id || accounts.find((a) => a.id !== accId)?.id || null)
    setDate(toLocalDatetimeValue(ini.date || new Date()))
    setNote(ini.note || '')
    setReceipt(ini.receipt_url ? { dataUrl: ini.receipt_url, name: 'receipt' } : null)
    setItems(Array.isArray(ini.items) ? ini.items : [])
    setMerchant(ini.merchant || '')
    setReceiptNumber(ini.receipt_number || '')
    setTax(!!ini.tax_deductible)
    setFee(ini.fee ? String(ini.fee) : '')
    setShowFee(!!ini.fee)
    setShowCalc(false)
  }, [open]) // eslint-disable-line

  const num = useMemo(() => evaluateExpression(amount), [amount])
  const isForeign = currency !== home
  const converted = convert(num, currency, home, rates)
  const rate = getRate(currency, home, rates)
  const cur = getCurrency(currency)
  const title = type === 'expense' ? t('add_expense') : type === 'income' ? t('add_income') : t('add_transfer')
  const canSave = num > 0 && (type !== 'transfer' || (accountId && toAccountId && accountId !== toAccountId))

  const pressKey = (k) => {
    if (k === '⌫') return setAmount((a) => a.slice(0, -1))
    if (k === '=') return setAmount(String(roundMoney(evaluateExpression(amount), currency)))
    setAmount((a) => a + k)
  }

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const dataUrl = await fileToDataUrl(f, 1000)
      setReceipt({ dataUrl: f.type?.startsWith('image/') ? dataUrl : null, name: f.name, isPdf: !f.type?.startsWith('image/') })
    } catch { toast.error(t('error')) }
  }

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const finalAmount = roundMoney(num, currency)
      const tx = {
        type,
        amount: finalAmount,
        currency,
        home_currency: home,
        home_currency_amount: roundMoney(convert(finalAmount, currency, home, rates), home),
        rate,
        category: type === 'transfer' ? 'transfer' : category,
        payment_method: type === 'transfer' ? 'bank' : payment,
        account_id: accountId || null,
        to_account_id: type === 'transfer' ? toAccountId : null,
        fee: type === 'transfer' && showFee ? Number(fee) || 0 : 0,
        note: note || null,
        merchant: merchant || null,
        receipt_number: receiptNumber || null,
        receipt_url: receipt?.dataUrl && receipt.dataUrl.length < 900000 ? receipt.dataUrl : null,
        items: items?.length ? items : [],
        tax_deductible: type === 'expense' ? tax : false,
        date: new Date(date).toISOString(),
      }
      if (editId) {
        const old = transactions.find((x) => x.id === editId)
        if (old) await applyTxToBalances(store, accounts, old, -1, rates)
        await store.updateTransaction(editId, tx)
      } else {
        await store.createTransaction(tx)
      }
      await applyTxToBalances(store, accounts, tx, 1, rates)
      await refresh()
      toast.success(t('saved_msg'))
      onClose?.()
    } catch (e) {
      toast.error(e?.missingTable ? t('db_missing') : e?.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  const accountPills = (value, onChange, allowNone = true) => (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
      {accounts.map((a) => <Pill key={a.id} active={value === a.id} onClick={() => onChange(a.id)}>{a.name}</Pill>)}
      {allowNone ? <Pill active={!value} onClick={() => onChange(null)}>{t('no_account_opt')}</Pill> : null}
    </div>
  )

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        full
        title={title}
        left={<SheetTextButton muted onClick={onClose} data-testid="tx-cancel">{t('cancel')}</SheetTextButton>}
        right={<SheetTextButton bold onClick={save} className={cn(!canSave && 'opacity-40')} data-testid="tx-save">{saving ? '...' : t('save')}</SheetTextButton>}
      >
        <Segmented value={type} onChange={(v) => { setType(v); if (v === 'income' && ['food', 'groceries', 'transport'].includes(category)) setCategory('salary'); if (v === 'expense' && ['salary', 'freelance'].includes(category)) setCategory('food') }} options={[{ id: 'expense', label: t('expense') }, { id: 'income', label: t('income_tab') }, { id: 'transfer', label: t('transfer') }]} className="mt-1" />

        {/* Amount */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => setPickCurrency(true)} className="rounded-xl bg-card border border-border/60 px-3 py-1.5 text-sm font-bold flex items-center gap-1.5" data-testid="currency-pill">
              <span>{cur.flag}</span> {currency} <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            <button type="button" onClick={() => setShowCalc(!showCalc)} className={cn('h-9 w-9 rounded-xl border border-border/60 flex items-center justify-center', showCalc ? 'bg-foreground text-background' : 'bg-card')} aria-label="calculator" data-testid="calc-toggle">
              <Calculator size={16} />
            </button>
          </div>
          <div className="mt-3 flex items-baseline justify-center gap-2">
            <span className="text-2xl font-semibold text-muted-foreground">{cur.symbol}</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,+\-*/×÷−]/g, ''))}
              inputMode="decimal"
              placeholder="0"
              className="bg-transparent text-5xl font-bold tabular-nums tracking-tight text-center outline-none w-full max-w-[260px] placeholder:text-muted-foreground/40"
              data-testid="amount-input"
            />
          </div>
          {/[+\-*/×÷−]/.test(amount.slice(1)) ? <p className="text-sm text-muted-foreground mt-1">= {fmt(num, currency)}</p> : null}
          {isForeign && num > 0 ? (
            <div className="inline-flex mt-3 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground" data-testid="conversion-badge">
              ≈ {fmt(converted, home)} {home} <span className="mx-1.5 opacity-40">|</span> {t('rate')}: 1 {currency} = {formatRate(rate)} {home}
            </div>
          ) : null}
        </div>

        {showCalc ? (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={() => pressKey(k)} className={cn('h-12 rounded-xl font-bold text-lg active:scale-95 transition', /[÷×−+]/.test(k) ? 'bg-foreground text-background' : 'bg-card border border-border/60')}>
                {k === '⌫' ? <Delete size={18} className="mx-auto" /> : k}
              </button>
            ))}
            <button type="button" onClick={() => pressKey('=')} className="col-span-4 h-11 rounded-xl bg-muted font-bold">=</button>
          </div>
        ) : null}

        {type !== 'transfer' ? (
          <div className="mt-6 space-y-6">
            {/* Category */}
            <Card onClick={() => setPickCategory(true)} className="flex items-center gap-3 p-3" data-testid="category-card">
              <CategoryBadge id={category} />
              <div className="flex-1">
                <p className="label-upper">{t('category')}</p>
                <p className="font-semibold">{t(`cat_${category}`)}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Card>

            <Field label={t('payment_method')}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                {PAYMENT_METHODS.map((m) => <Pill key={m} active={payment === m} onClick={() => setPayment(m)}>{t(m)}</Pill>)}
              </div>
            </Field>

            <Field label={t('source_account')}>{accountPills(accountId, setAccountId)}</Field>

            <Field label={t('date_time')}>
              <TextInput type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} data-testid="date-input" />
            </Field>

            <Field label={t('merchant')}>
              <TextInput value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Era Superstore" />
            </Field>

            <Field label={t('note')}>
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('note_placeholder')} data-testid="note-input" />
            </Field>

            <Field label={t('receipt')}>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
              <Card onClick={() => fileRef.current?.click()} className="flex items-center gap-3 p-3">
                {receipt?.dataUrl ? (
                  <img src={receipt.dataUrl} alt="receipt" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">{receipt?.isPdf ? <FileText size={20} /> : <Camera size={20} />}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{receipt ? receipt.name : t('add_receipt')}</p>
                  <p className="text-xs text-muted-foreground">{t('photo_or_pdf')}</p>
                </div>
                {receipt ? <button type="button" onClick={(e) => { e.stopPropagation(); setReceipt(null) }} className="p-2"><X size={16} /></button> : <ChevronRight size={18} className="text-muted-foreground" />}
              </Card>
              {items?.length ? <p className="text-xs text-muted-foreground px-1">{items.length} {t('items').toLowerCase()} · {receiptNumber ? `${t('receipt_no')} ${receiptNumber}` : ''}</p> : null}
            </Field>

            {type === 'expense' ? (
              <Card className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="font-semibold">{t('tax_deductible')}</p>
                  <p className="text-xs text-muted-foreground">{t('tax_deductible_sub')}</p>
                </div>
                <Switch checked={tax} onCheckedChange={setTax} data-testid="tax-switch" />
              </Card>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <Field label={t('from')}>{accountPills(accountId, setAccountId, false)}</Field>
            <Field label={t('to')}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                {accounts.filter((a) => a.id !== accountId).map((a) => <Pill key={a.id} active={toAccountId === a.id} onClick={() => setToAccountId(a.id)}>{a.name}</Pill>)}
              </div>
            </Field>
            {!showFee ? (
              <button type="button" onClick={() => setShowFee(true)} className="text-sm font-semibold">{t('add_charges')}</button>
            ) : (
              <Field label={`${t('charges')} (${currency})`}>
                <TextInput type="number" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
              </Field>
            )}
            <Field label={t('date_time')}>
              <TextInput type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t('notes')}>
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('note_placeholder')} />
            </Field>
            {accounts.length < 2 ? <p className="text-xs text-muted-foreground">{t('select_accounts')}</p> : null}
          </div>
        )}
        <div className="h-6" />
      </Sheet>

      <CurrencySheet open={pickCurrency} onClose={() => setPickCurrency(false)} value={currency} onSelect={setCurrency} zIndex={70} />

      <Sheet open={pickCategory} onClose={() => setPickCategory(false)} title={t('select_category')} zIndex={70}>
        <div className="grid grid-cols-4 gap-3 pt-2 pb-4">
          {CATEGORIES.filter((c) => c.types.includes(type)).map((c) => (
            <button key={c.id} type="button" onClick={() => { setCategory(c.id); setPickCategory(false) }} className="flex flex-col items-center gap-2" data-testid={`cat-${c.id}`}>
              <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center border', category === c.id ? 'bg-foreground text-background border-foreground' : 'bg-card border-border/50')}>
                <CategoryIcon id={c.id} size={22} />
              </div>
              <span className="text-[11px] font-medium text-center leading-tight">{t(`cat_${c.id}`)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}
