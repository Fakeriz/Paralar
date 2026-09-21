'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Search, Check, Ban, CreditCard, Wallet, Banknote, Landmark, Smartphone, BarChart3, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, LogoBadge } from './ui'
import CurrencySheet from './CurrencySheet'
import { CARD_THEMES, BANK_LOGOS, ACCOUNT_TYPES, ACCOUNT_ICONS, getTheme } from '@/lib/categories'
import { getCurrency, roundMoney } from '@/lib/currencies'
import { convert, getRate } from '@/lib/rates'
import { cn } from '@/lib/utils'

// Country filter tabs — text only, no flags / no 2-letter codes. Generic removed (covered by ICON section).
const COUNTRY_TABS = [
  { id: 'all', label: 'All' },
  { id: 'my', label: 'Malaysia' },
  { id: 'tr', label: 'Turkey' },
  { id: 'id', label: 'Indonesia' },
]

const ICON_MAP = { CreditCard, Wallet, Banknote, Landmark, Smartphone, BarChart3, Briefcase }

// Adaptive input styling: light grey on light mode, obsidian on dark mode.
const INPUT_CLS = 'w-full bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-white/25'

// Deterministic fake last-4 digits for the card face.
function digits4(s) {
  let h = 0
  const str = String(s || 'paralar')
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return String(h % 10000).padStart(4, '0')
}

// Exported: also used by AccountsSheet. Adaptive, never a plain borderless white card.
export function PreviewCard({ name, balance, currency, theme, logo, type, id, fmt, className }) {
  const th = getTheme(theme)
  const cur = getCurrency(currency)
  const typeLabel = ACCOUNT_TYPES.find((x) => x.id === type)?.label || 'Account'
  const last4 = digits4(id || name)
  const isGlacier = th.id === 'glacier'
  const isObsidian = th.id === 'obsidian'
  const titleCls = isGlacier ? 'text-zinc-950' : isObsidian ? 'text-white' : 'text-zinc-950 dark:text-white'
  const subCls = isGlacier ? 'text-zinc-600' : isObsidian ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-400'

  return (
    <div className={cn('relative rounded-2xl p-5 min-h-[180px] aspect-[1.58/1] overflow-hidden shadow-lg flex flex-col justify-between', th.className, className)}>
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-zinc-200/40 dark:bg-white/[0.08] pointer-events-none" />
      <div className="flex items-start justify-between gap-2 relative">
        <div className="min-w-0">
          <p className={cn('font-bold text-lg truncate', titleCls)}>{name || '—'}</p>
          <p className={cn('text-[11px] font-semibold mt-0.5 uppercase tracking-[0.12em]', subCls)}>{typeLabel}</p>
        </div>
        <LogoBadge logoId={logo} />
      </div>
      <div className="relative">
        <p className={cn('text-2xl font-extrabold tabular-nums tracking-tight', titleCls)}>{fmt ? fmt(balance || 0, currency) : balance}</p>
        <div className={cn('flex items-center gap-3 mt-2 text-xs font-medium', subCls)}>
          <span className="font-mono tracking-[0.2em]">•••• {last4}</span>
          <span className="font-semibold">{cur.symbol} {currency}</span>
        </div>
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
    return (BANK_LOGOS || []).filter((l) => l.country !== 'generic' && (tab === 'all' || l.country === tab) && (!q || l.name.toLowerCase().includes(q)))
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">{children}</p>
      {right ? <span className="text-[12px] font-bold text-zinc-950 dark:text-white">{right}</span> : null}
    </div>
  )

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        full
        noPadding
        className="bg-white dark:bg-[#121214] text-zinc-950 dark:text-white"
        title="New Account"
        left={<button type="button" onClick={onClose} className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors">{t('cancel')}</button>}
        right={<button type="button" onClick={create} disabled={!canSave || saving} className={cn('text-[15px] font-bold py-1 px-1 text-zinc-950 dark:text-white', (!canSave || saving) && 'opacity-40')} data-testid="account-save">{saving ? '...' : 'Create'}</button>}
      >
        <div className="p-4 space-y-6">
          <PreviewCard name={name || 'New Account'} balance={num} currency={currency} theme={theme} logo={logo} type={type} fmt={fmt} />

          {/* Section 1 — CARD DESIGN */}
          <section>
            <Label right={activeTheme?.name}>Card Design</Label>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
              {CARD_THEMES.map((th) => {
                const active = theme === th.id
                return (
                  <button key={th.id} type="button" onClick={() => setTheme(th.id)} className="shrink-0 relative" data-testid={`theme-${th.id}`}>
                    <div className={cn('h-12 w-[72px] rounded-xl shadow-sm', th.className, active && 'ring-2 ring-zinc-950 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#121214]')} />
                    {active ? (
                      <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shadow ring-2 ring-white dark:ring-zinc-900">
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('account_name_ph')} className={cn(INPUT_CLS, 'px-4 py-3 rounded-xl text-[15px]')} data-testid="account-name" />
          </section>

          {/* Section 3 — TYPE */}
          <section>
            <Label>Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((ty) => {
                const active = type === ty.id
                return (
                  <button key={ty.id} type="button" onClick={() => setType(ty.id)}
                    className={cn('rounded-xl py-2.5 text-sm transition-colors', active ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold' : 'bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 font-medium')}
                    data-testid={`type-${ty.id}`}>
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
                  <button key={ic.id} type="button" onClick={() => setIcon(ic.id)}
                    className={cn('h-12 w-12 rounded-xl flex items-center justify-center border transition-colors', active ? 'border-zinc-950 bg-zinc-950/10 text-zinc-950 dark:border-white dark:bg-white/10 dark:text-white' : 'border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-[#1c1c1e] text-zinc-600 dark:text-zinc-400')}
                    data-testid={`icon-${ic.id}`}>
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
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bank or e-wallet..." className={cn(INPUT_CLS, 'pl-10 pr-4 py-3 rounded-xl text-[15px]')} data-testid="logo-search" />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 mt-3">
              {COUNTRY_TABS.map((c) => (
                <button key={c.id} type="button" onClick={() => setTab(c.id)}
                  className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors', tab === c.id ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold' : 'bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 font-medium')}
                  data-testid={`country-${c.id}`}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex items-start gap-1.5 overflow-x-auto py-1 no-scrollbar snap-x touch-pan-x mt-2">
              {/* None — reset to default icon, no bank logo */}
              <button type="button" onClick={() => setLogo(null)} className="shrink-0 snap-start flex flex-col items-center" data-testid="logo-none">
                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center border-2 border-dashed', logo === null ? 'border-zinc-950 text-zinc-950 dark:border-white dark:text-white' : 'border-zinc-300 dark:border-white/25 text-zinc-400 dark:text-zinc-500')}>
                  <Ban size={18} strokeWidth={1.75} />
                </div>
                <span className="text-[9px] line-clamp-1 max-w-[46px] text-center mt-1 text-zinc-600 dark:text-zinc-400 font-medium">None</span>
              </button>
              {logos.map((l) => {
                const active = logo === l.id
                return (
                  <button key={l.id} type="button" onClick={() => setLogo(active ? null : l.id)} className="shrink-0 snap-start flex flex-col items-center" data-testid={`logo-${l.id}`}>
                    <div className={cn('rounded-xl p-0.5 border-2', active ? 'border-zinc-950 dark:border-white' : 'border-transparent')}>
                      <LogoBadge logoId={l.id} size="bank" />
                    </div>
                    <span className="text-[9px] line-clamp-1 max-w-[46px] text-center mt-1 text-zinc-600 dark:text-zinc-400 font-medium">{l.name}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Section 6 — OPENING BALANCE */}
          <section>
            <Label>Opening Balance</Label>
            <div className="flex bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 rounded-xl p-1 gap-1">
              {[{ id: 'split', label: t('split_from') }, { id: 'new', label: t('new_money') }].map((o) => (
                <button key={o.id} type="button" onClick={() => setSource(o.id)}
                  className={cn('flex-1 rounded-lg py-2 text-sm transition-colors', source === o.id ? 'bg-white text-zinc-950 font-bold dark:bg-zinc-800 dark:text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white font-medium')}
                  data-testid={`source-${o.id}`}>
                  {o.label}
                </button>
              ))}
            </div>
            {source === 'split' ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pt-2.5">
                {accounts.map((a) => (
                  <button key={a.id} type="button" onClick={() => setFromId(a.id)}
                    className={cn('shrink-0 rounded-xl px-3 py-2 text-sm whitespace-nowrap', fromId === a.id ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold' : 'bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 font-medium')}>
                    {a.name} · {fmt(a.balance, a.currency)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2 mt-2.5">
              <button type="button" onClick={() => setPickCur(true)} className="shrink-0 rounded-xl bg-zinc-100 dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-3 py-3 flex items-center gap-1.5 text-zinc-950 dark:text-white" data-testid="account-currency">
                <span className="font-bold text-sm">{getCurrency(currency).symbol} {currency}</span>
                <ChevronRight size={15} className="text-zinc-500 dark:text-zinc-400" />
              </button>
              <input type="number" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" className={cn(INPUT_CLS, 'flex-1 px-4 py-3 rounded-xl text-lg font-bold tabular-nums')} data-testid="account-balance" />
            </div>
          </section>

          <button type="button" onClick={create} disabled={!canSave || saving}
            className={cn('w-full rounded-xl bg-zinc-950 text-white hover:bg-zinc-900 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold py-3.5 text-[15px] transition-all active:scale-[0.98]', (!canSave || saving) && 'opacity-40 active:scale-100')}
            data-testid="account-create-btn">
            {saving ? '...' : 'Create'}
          </button>
          <div className="h-2" />
        </div>
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={70} />
    </>
  )
}
