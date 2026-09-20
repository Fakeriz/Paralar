'use client'
import { useState } from 'react'
import { Crown, ChevronRight, CreditCard, Bot, Calculator, Tags, Users, HandCoins, Zap, Repeat, TrendingUp, HeartPulse, Briefcase, Check, ReceiptText, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Card, SectionLabel, Sheet, PrimaryButton, SecondaryButton } from './ui'
import { getCurrency } from '@/lib/currencies'
import { LANGUAGES } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import RecurringSheet from './RecurringSheet'
import NetWorthSheet from './NetWorthSheet'
import HealthScoreSheet from './HealthScoreSheet'
import BusinessInvoiceSheet from './BusinessInvoiceSheet'
import AccountSupportSection from './AccountSupportSection'
import AppSettingsSheet from './AppSettingsSheet'

function Row({ icon: Icon, label, onClick, right, testId }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/60 transition" data-testid={testId}>
      <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center"><Icon size={17} /></div>
      <span className="flex-1 font-medium text-[15px]">{label}</span>
      {right ? <span className="text-sm text-muted-foreground">{right}</span> : null}
      <ChevronRight size={16} className="text-muted-foreground" />
    </button>
  )
}

export default function MoreTab() {
  const { t, profile, open, home, sheets, close } = useApp()
  const isPremium = profile?.plan_tier === 'premium'
  const mode = profile?.usage_mode || 'personal'
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [netWorthOpen, setNetWorthOpen] = useState(false)
  const [healthOpen, setHealthOpen] = useState(false)
  const [businessOpen, setBusinessOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [bizCtx, setBizCtxState] = useState(() => { try { return JSON.parse(localStorage.getItem('paralar_bizctx')) || 'personal' } catch { return 'personal' } })
  const setBizCtx = (c) => { setBizCtxState(c); try { localStorage.setItem('paralar_bizctx', JSON.stringify(c)) } catch {} }

  return (
    <div className="px-5 pb-28">
      <div className="flex items-center justify-between pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('more')}</h1>
        <div className="flex items-center gap-2">
          {mode === 'both' ? (
            <div className="flex rounded-full bg-muted p-0.5" data-testid="more-ctx-switch">
              {['personal', 'business'].map((c) => (
                <button key={c} type="button" onClick={() => setBizCtx(c)} className={cn('px-3 py-1 rounded-full text-xs font-semibold transition', bizCtx === c ? 'bg-foreground text-background' : 'text-muted-foreground')}>{t(c)}</button>
              ))}
            </div>
          ) : null}
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="settings" className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted/60 active:bg-muted transition" data-testid="more-settings"><Settings size={22} strokeWidth={1.75} /></button>
        </div>
      </div>

      <button type="button" onClick={() => open('paywall')} className="w-full mt-5 rounded-2xl bg-[#0A0A0B] text-white p-5 text-left relative overflow-hidden border border-white/10" data-testid="premium-card">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.05]" />
        <div className="flex items-center gap-2"><Crown size={18} /><p className="font-bold">{t('premium_title')}</p></div>
        <p className="text-sm text-white/60 mt-1">{t('current_plan')}: {isPremium ? t('premium') : t('free')}</p>
        <span className="inline-block mt-3 rounded-xl bg-white text-black text-sm font-semibold px-4 py-2">{t('upgrade')}</span>
      </button>

      <SectionLabel className="mt-7 mb-2 px-1">{t('everyday')}</SectionLabel>
      <Card className="divide-y divide-border/40 overflow-hidden">
        <Row icon={CreditCard} label={t('accounts_cards')} onClick={() => open('accounts')} testId="more-accounts" />
        <Row icon={ReceiptText} label={t('bills_tracker')} onClick={() => open('bills')} testId="more-bills" />
        <Row icon={Bot} label={t('ai_coach')} onClick={() => open('coach')} testId="more-coach" />
        <Row icon={Calculator} label={t('loan_calculator')} onClick={() => open('loan')} testId="more-loan" />
        <Row icon={Tags} label={t('categories_templates')} onClick={() => open('catman')} testId="more-catman" />
        <Row icon={Users} label={t('split_bill')} onClick={() => open('split')} />
        <Row icon={HandCoins} label={t('debt_tracker')} onClick={() => open('debts')} testId="more-debts" />
      </Card>

      <SectionLabel className="mt-7 mb-2 px-1">{t('advanced')}</SectionLabel>
      <Card className="divide-y divide-border/40 overflow-hidden">
        <Row icon={Zap} label={t('smart_automation')} onClick={() => open('automation')} testId="more-automation" />
        <Row icon={Repeat} label={t('recurring')} onClick={() => setRecurringOpen(true)} testId="more-recurring" />
        <Row icon={TrendingUp} label={t('net_worth')} onClick={() => setNetWorthOpen(true)} testId="more-networth" />
        <Row icon={HeartPulse} label={t('health_score')} onClick={() => setHealthOpen(true)} testId="more-health" />
        <Row icon={Briefcase} label={t('business_invoicing')} onClick={() => setBusinessOpen(true)} testId="more-business" />
      </Card>

      <AccountSupportSection />

      {/* Language sheet */}
      <Sheet open={!!sheets?.language} onClose={() => close('language')} title={t('language')}>
        <div className="space-y-2 pt-2">
          {LANGUAGES.map((l) => (
            <LangRow key={l.code} l={l} />
          ))}
        </div>
      </Sheet>

      {/* Paywall */}
      <Sheet open={!!sheets?.paywall} onClose={() => close('paywall')}>
        <div className="pt-2 pb-2">
          <div className="h-14 w-14 rounded-2xl bg-foreground text-background flex items-center justify-center mx-auto"><Crown size={26} /></div>
          <h2 className="text-2xl font-extrabold text-center mt-4">{t('unlock_premium')}</h2>
          <p className="text-center text-muted-foreground text-sm mt-1">{t('current_plan')}: {isPremium ? t('premium') : t('free')}</p>
          <div className="mt-6 space-y-3">
            {[t('perk_wallets'), t('perk_ocr'), t('perk_invoicing'), t('perk_tax')].map((p) => (
              <div key={p} className="flex items-center gap-3 rounded-xl bg-card border border-border/40 px-4 py-3">
                <div className="h-6 w-6 rounded-full bg-foreground text-background flex items-center justify-center"><Check size={14} strokeWidth={3} /></div>
                <span className="font-medium">{p}</span>
              </div>
            ))}
          </div>
          <p className="text-center mt-6"><span className="text-3xl font-extrabold">{getCurrency(home).symbol} {home === 'IDR' ? '49.000' : home === 'MYR' ? '14.90' : home === 'TRY' ? '99' : '4.99'}</span><span className="text-muted-foreground text-sm"> {t('per_month')}</span></p>
          <div className="mt-5 space-y-2">
            <PrimaryButton onClick={() => { toast(t('coming_soon')); close('paywall') }}>{t('upgrade_now')}</PrimaryButton>
            <SecondaryButton onClick={() => close('paywall')}>{t('maybe_later')}</SecondaryButton>
          </div>
        </div>
      </Sheet>

      <RecurringSheet open={recurringOpen} onClose={() => setRecurringOpen(false)} />
      <NetWorthSheet open={netWorthOpen} onClose={() => setNetWorthOpen(false)} />
      <HealthScoreSheet open={healthOpen} onClose={() => setHealthOpen(false)} />
      <BusinessInvoiceSheet open={businessOpen} onClose={() => setBusinessOpen(false)} />
      <AppSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function LangRow({ l }) {
  const { lang, setLang, close } = useApp()
  const active = lang === l.code
  return (
    <button type="button" onClick={() => { setLang(l.code); close('language') }} className="w-full flex items-center gap-3 rounded-xl bg-card border border-border/40 px-4 py-3.5" data-testid={`lang-${l.code}`}>
      <span className="text-2xl">{l.flag}</span>
      <span className="flex-1 text-left font-medium">{l.name}</span>
      {active ? <Check size={18} strokeWidth={2.5} /> : null}
    </button>
  )
}
