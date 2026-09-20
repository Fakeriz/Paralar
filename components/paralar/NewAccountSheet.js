'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Search, Check, CreditCard, Wallet, Banknote, Landmark, Smartphone, BarChart3, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, LogoBadge } from './ui'
import CurrencySheet from './CurrencySheet'
import { CARD_THEMES, BANK_LOGOS, ACCOUNT_TYPES, ACCOUNT_ICONS, getTheme } from '@/lib/categories'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { convert, getRate } from '@/lib/rates'
import { cn } from '@/lib/utils'

const COUNTRY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'my', label: 'Malaysia', flag: '🇲🇾' },
  { id: 'tr', label: 'Turkey', flag: '🇹🇷' },
  { id: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { id: 'generic', label: 'Generic' },
]

const ICON_MAP = { CreditCard, Wallet, Banknote, Landmark, Smartphone, BarChart3, Briefcase }

// Exported: rendered in AccountsSheet too. Light-mode readable (never a plain white borderless card).
export function PreviewCard({ name, balance, currency, theme, logo, fmt, className }) {
  const th = getTheme(theme)
  const cur = getCurrency(currency)
  return (
    <div
      className={cn(
        'relative rounded-2xl p-5 min-h-[172px] overflow-hidden shadow-xl border',
        th.className,
        th.dark ? 'border-zinc-300' : 'border-white/10',
        className
      )}
    >
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/[0.06]" />
      <div className="flex items-center justify-between">
        <p className={cn('text-[11px] font-semibold uppercase tracking-[0.12em] truncate max-w-[70%]', th.dark ? 'text-zinc-600' : 'text-white/60')}>{name || '—'}</p>
        <LogoBadge logoId={logo} className={th.dark ? 'text-zinc-800' : ''} />
      </div>
      <p className="text-3xl font-bold mt-4 tabular-nums tracking-tight">{fmt ? fmt(balance || 0, currency) : balance}</p>
      <div className={cn('absolute bottom-5 left-5 right-5 flex items-center justify-between text-xs', th.dark ? 'text-zinc-600' : 'text-white/60')}>
        <span>{cur.flag} {currency}</span>
        <span className="font-mono tracking-widest">•••• {th.name.slice(0, 4).toUpperCase()}</span>
      </div>
    </div>
  )
}

export default function NewAccountSheet({ open, onClose }) {
  const { t, home, accounts = [], store, refresh, fmt, rates } = useApp()
  const [name, setName] = useState('')
  const [type, setType] = useState('bank')
  const [icon, setIcon] = useState('card')
  const [currency, setCurrency] = useState(home)
  const [theme, setTheme] = useState('obsidian')
  const [logo, setLogo] = useState(null)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('new')
  const [fromId, setFromId] = useState(null)
  const [balance, setBalance] = useState('')
  const [pickCur, setPickCur] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setType('bank'); setIcon('card'); setCurrency(home); setTheme('obsidian'); setLogo(null)
    setTab('all'); setQuery(''); setSource('new'); setFromId(accounts[0]?.id || null); setBalance('')
  }, [open]) // eslint-disable-line

  const logos = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (BANK_LOGOS || []).filter((l) => (tab === 'all' || l.country === tab) && (!q || l.name.toLowerCase().includes(q)))
  }, [tab, query])

  const activeTheme = getTheme(theme)
  const num = Number(balance) || 0
  const canSave = name.trim().length > 0 && (source === 'new' || fromId)

  const create = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const acc = await store.createAccount({
        name: name.trim(), type, icon, currency, balance: roundMoney(num, currency),
        theme, logo, country: tab === 'all' ? null : tab,
      })
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

  const Label = ({ children, right }) => (
    <div className="flex items-center justify-between mb-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{children}</p>
      {right ? <span className="text-[12px] font-semibold text-white/85">{right}</span> : null}
    </div>
  )

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        full
        noPadding
        className="bg-[#121214] text-white"
        title="New Account"
        left={<button type="button" onClick={onClose} className="text-[15px] text-white/60 py-1 px-1">{t('cancel')}</button>}
        right={<button type="button" onClick={create} disabled={!canSave || saving} className={cn('text-[15px] font-bold py-1 px-1 text-white', (!canSave || saving) && 'opacity-40')} data-testid="account-save">{saving ? '...' : 'Create'}</button>}
      >
        <div className="p-4 space-y-6">
          <PreviewCard name={name || 'New Account'} balance={num} currency={currency} theme={theme} logo={logo} fmt={fmt} />

          {/* Section 1 — CARD DESIGN */}
          <section>
            <Label right={activeTheme?.name}>Card Design</Label>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
              {CARD_THEMES.map((th) => {
                const active = theme === th.id
                return (
                  <button key={th.id} type="button" onClick={() => setTheme(th.id)} className="shrink-0 relative" data-testid={`theme-${th.id}`}>
                    <div className={cn('h-12 w-[72px] rounded-xl shadow-md', th.className, active ? 'ring-2 ring-white' : 'ring-1 ring-white/15', th.dark && !active && 'ring-zinc-300')} />
                    {active ? (
                      <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#d4af37] text-black flex items-center justify-center shadow ring-2 ring-[#121214]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 2 — ACCOUNT DETAILS */}
          <section>
            <Label>Account Details</Label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('account_name_ph')}
              className="w-full bg-[#1c1c1e] border border-white/10 px-4 py-3 rounded-xl text-[15px] text-white placeholder-white/35 outline-none focus:border-white/25"
              data-testid="account-name"
            />
          </section>

          {/* Section 3 — TYPE */}
          <section>
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((ty) => {
                const active = type === ty.id
                return (
                  <button
                    key={ty.id}
                    type="button"
                    onClick={() => setType(ty.id)}
                    className={cn('rounded-xl py-2.5 text-sm transition-colors', active ? 'bg-white text-black font-medium' : 'bg-[#1c1c1e] border border-white/10 text-white/80')}
                    data-testid={`type-${ty.id}`}
                  >
                    {ty.label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 4 — ICON */}
          <section>
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2.5">
              {ACCOUNT_ICONS.map((ic) => {
                const Icon = ICON_MAP[ic.icon] || CreditCard
                const active = icon === ic.id
                return (
                  <button
                    key={ic.id}
                    type="button"
                    onClick={() => setIcon(ic.id)}
                    className={cn('h-12 w-12 rounded-xl flex items-center justify-center border transition-colors', active ? 'border-white bg-white/10 text-white' : 'border-white/10 bg-[#1c1c1e] text-white/50')}
                    data-testid={`icon-${ic.id}`}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 5 — BANK / E-WALLET (OPTIONAL) */}
          <section>
            <Label>Bank / E-Wallet (Optional)</Label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bank or e-wallet..."
                className="w-full bg-[#1c1c1e] border border-white/10 pl-10 pr-4 py-3 rounded-xl text-[15px] text-white placeholder-white/35 outline-none focus:border-white/25"
                data-testid="logo-search"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mt-3">
              {COUNTRY_TABS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTab(c.id)}
                  className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors', tab === c.id ? 'bg-white text-black font-medium' : 'bg-[#1c1c1e] border border-white/10 text-white/70')}
                  data-testid={`country-${c.id}`}
                >
                  {c.flag ? `${c.label} ${c.flag}` : c.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3 pt-3">
              {logos.map((l) => {
                const active = logo === l.id
                return (
                  <button key={l.id} type="button" onClick={() => setLogo(active ? null : l.id)} className="flex flex-col items-center gap-1.5" data-testid={`logo-${l.id}`}>
                    <div className={cn('rounded-2xl p-1 border-2', active ? 'border-white' : 'border-transparent')}>
                      <LogoBadge logoId={l.id} size="lg" />
                    </div>
                    <span className="text-[10px] font-medium text-center leading-tight text-white/55 line-clamp-2">{l.name}</span>
                  </button>
                )
              })}
              {logos.length === 0 ? <p className="col-span-4 text-center text-sm text-white/40 py-4">—</p> : null}
            </div>
          </section>

          {/* Section 6 — OPENING BALANCE */}
          <section>
            <Label>Opening Balance</Label>
            <div className="flex bg-[#1c1c1e] border border-white/10 rounded-xl p-1 gap-1">
              {[{ id: 'split', label: t('split_from') }, { id: 'new', label: t('new_money') }].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSource(o.id)}
                  className={cn('flex-1 rounded-lg py-2 text-sm font-medium transition-colors', source === o.id ? 'bg-white text-black' : 'text-white/60')}
                  data-testid={`source-${o.id}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {source === 'split' ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pt-2.5">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setFromId(a.id)}
                    className={cn('shrink-0 rounded-xl px-3 py-2 text-sm whitespace-nowrap', fromId === a.id ? 'bg-white text-black font-medium' : 'bg-[#1c1c1e] border border-white/10 text-white/70')}
                  >
                    {a.name} · {fmt(a.balance, a.currency)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2 mt-2.5">
              <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-[#1c1c1e] border border-white/10 px-3 py-3 flex items-center gap-1.5" data-testid="account-currency">
                <span className="text-lg">{getCurrency(currency).flag}</span>
                <span className="font-bold text-sm">{currency}</span>
                <ChevronRight size={15} className="text-white/40" />
              </button>
              <input
                type="number"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0"
                className="flex-1 bg-[#1c1c1e] border border-white/10 px-4 py-3 rounded-xl text-lg font-bold text-white placeholder-white/35 outline-none focus:border-white/25 tabular-nums"
                data-testid="account-balance"
              />
            </div>
          </section>

          <button
            type="button"
            onClick={create}
            disabled={!canSave || saving}
            className={cn('w-full rounded-xl bg-white text-black font-semibold py-3.5 text-[15px] transition-all active:scale-[0.98]', (!canSave || saving) && 'opacity-40 active:scale-100')}
            data-testid="account-create-btn"
          >
            {saving ? '...' : 'Create'}
          </button>
          <div className="h-2" />
        </div>
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={70} />
    </>
  )
}
