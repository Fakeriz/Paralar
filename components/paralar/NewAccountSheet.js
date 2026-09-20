'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Field, TextInput, Segmented, Pill, LogoBadge, PrimaryButton } from './ui'
import CurrencySheet from './CurrencySheet'
import { CARD_THEMES, BANK_LOGOS, getTheme } from '@/lib/categories'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { convert, getRate } from '@/lib/rates'
import { cn } from '@/lib/utils'

const COUNTRY_TABS = [
  { id: 'all', label: 'all' },
  { id: 'id', label: 'indonesia', flag: '🇮🇩' },
  { id: 'my', label: 'malaysia', flag: '🇲🇾' },
  { id: 'tr', label: 'turkey', flag: '🇹🇷' },
  { id: 'generic', label: 'generic' },
]

export function PreviewCard({ name, balance, currency, theme, logo, fmt, className }) {
  const th = getTheme(theme)
  const cur = getCurrency(currency)
  return (
    <div className={cn('relative rounded-2xl p-5 min-h-[180px] overflow-hidden border border-white/10 shadow-xl', th.className, className)}>
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/[0.06]" />
      <div className="flex items-center justify-between">
        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.12em] truncate max-w-[70%]', th.dark ? 'text-slate-600' : 'text-white/60')}>{name || '—'}</p>
        <LogoBadge logoId={logo} />
      </div>
      <p className="text-3xl font-bold mt-4 tabular-nums tracking-tight">{fmt ? fmt(balance || 0, currency) : balance}</p>
      <div className={cn('absolute bottom-5 left-5 right-5 flex items-center justify-between text-xs', th.dark ? 'text-slate-600' : 'text-white/60')}>
        <span>{cur.flag} {currency}</span>
        <span className="font-mono tracking-widest">•••• {th.name.slice(0, 4).toUpperCase()}</span>
      </div>
    </div>
  )
}

export default function NewAccountSheet({ open, onClose }) {
  const { t, home, accounts = [], store, refresh, fmt, rates } = useApp()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(home)
  const [theme, setTheme] = useState('obsidian')
  const [logo, setLogo] = useState(null)
  const [tab, setTab] = useState('all')
  const [source, setSource] = useState('new')
  const [fromId, setFromId] = useState(null)
  const [balance, setBalance] = useState('')
  const [pickCur, setPickCur] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setCurrency(home); setTheme('obsidian'); setLogo(null); setTab('all'); setSource('new'); setFromId(accounts[0]?.id || null); setBalance('')
  }, [open]) // eslint-disable-line

  const logos = useMemo(() => BANK_LOGOS.filter((l) => tab === 'all' || l.country === tab), [tab])
  const num = Number(balance) || 0
  const canSave = name.trim().length > 0 && (source === 'new' || fromId)

  const create = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const acc = await store.createAccount({ name: name.trim(), type: logo ? 'bank' : 'wallet', currency, balance: roundMoney(num, currency), theme, logo, country: tab === 'all' ? null : tab })
      if (source === 'split' && fromId && num > 0) {
        const from = accounts.find((a) => a.id === fromId)
        if (from) {
          const delta = convert(num, currency, from.currency, rates)
          await store.updateAccount(from.id, { balance: roundMoney((Number(from.balance) || 0) - delta, from.currency) })
          await store.createTransaction({
            type: 'transfer', amount: roundMoney(num, currency), currency, home_currency: home,
            home_currency_amount: roundMoney(convert(num, currency, home, rates), home), rate: getRate(currency, home, rates),
            category: 'transfer', payment_method: 'bank', account_id: from.id, to_account_id: acc?.id, fee: 0,
            note: `${t('opening_balance')}: ${name.trim()}`, items: [], tax_deductible: false, date: new Date().toISOString(),
          })
        }
      }
      await refresh()
      toast.success(t('saved_msg'))
      onClose?.()
    } catch (e) { toast.error(e?.missingTable ? t('db_missing') : e?.message || t('error')) } finally { setSaving(false) }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} full title={t('new_account')} left={<SheetTextButton muted onClick={onClose}>{t('cancel')}</SheetTextButton>} right={<SheetTextButton bold onClick={create} className={cn(!canSave && 'opacity-40')} data-testid="account-save">{saving ? '...' : t('create')}</SheetTextButton>}>
        <PreviewCard name={name || t('account_name')} balance={num} currency={currency} theme={theme} logo={logo} fmt={fmt} className="mt-2" />

        <div className="space-y-6 mt-6">
          <Field label={t('account_name')}><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('account_name_ph')} data-testid="account-name" /></Field>

          <Field label={t('theme')}>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 py-1">
              {CARD_THEMES.map((th) => (
                <button key={th.id} type="button" onClick={() => setTheme(th.id)} className="flex flex-col items-center gap-1.5 shrink-0" data-testid={`theme-${th.id}`}>
                  <div className={cn('h-12 w-16 rounded-xl border-2', th.className, theme === th.id ? 'border-foreground ring-2 ring-foreground/20' : 'border-transparent')} />
                  <span className={cn('text-[11px] font-medium', theme === th.id ? 'text-foreground' : 'text-muted-foreground')}>{th.name}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('logo')}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {COUNTRY_TABS.map((c) => <Pill key={c.id} active={tab === c.id} onClick={() => setTab(c.id)}>{c.flag ? `${t(c.label)} ${c.flag}` : t(c.label)}</Pill>)}
            </div>
            <div className="grid grid-cols-4 gap-3 pt-2">
              {logos.map((l) => (
                <button key={l.id} type="button" onClick={() => setLogo(logo === l.id ? null : l.id)} className="flex flex-col items-center gap-1.5" data-testid={`logo-${l.id}`}>
                  <div className={cn('rounded-2xl p-1 border-2', logo === l.id ? 'border-foreground' : 'border-transparent')}><LogoBadge logoId={l.id} size="lg" /></div>
                  <span className="text-[10px] font-medium text-center leading-tight text-muted-foreground line-clamp-2">{l.name}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('currency')}>
            <button type="button" onClick={() => setPickCur(true)} className="w-full rounded-xl bg-card border border-border/60 px-4 py-3 flex items-center gap-3" data-testid="account-currency">
              <span className="text-xl">{getCurrency(currency).flag}</span><span className="font-bold">{currency}</span><span className="text-sm text-muted-foreground flex-1 text-left">{getCurrency(currency).name}</span><ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </Field>

          <Field label={t('opening_balance')}>
            <Segmented value={source} onChange={setSource} options={[{ id: 'new', label: t('new_money') }, { id: 'split', label: t('split_from') }]} size="sm" />
            {source === 'split' ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 pt-2">
                {accounts.map((a) => <Pill key={a.id} active={fromId === a.id} onClick={() => setFromId(a.id)}>{a.name} · {fmt(a.balance, a.currency)}</Pill>)}
              </div>
            ) : null}
            <TextInput type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" className="mt-2 text-lg font-bold" data-testid="account-balance" />
          </Field>

          <PrimaryButton onClick={create} disabled={!canSave || saving}>{t('create')}</PrimaryButton>
        </div>
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={70} />
    </>
  )
}
