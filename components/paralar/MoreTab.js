'use client'
import { useState } from 'react'
import { Crown, ChevronRight, CreditCard, Bot, Calculator, Tags, Users, HandCoins, Zap, Repeat, TrendingUp, HeartPulse, Briefcase, Globe2, Coins, SunMoon, Check, LogOut, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useApp } from './context'
import { Card, SectionLabel, Sheet, PrimaryButton, SecondaryButton, Segmented } from './ui'
import { getCurrency } from '@/lib/currencies'
import { LANGUAGES } from '@/lib/i18n'
import RecurringSheet from './RecurringSheet'
import NetWorthSheet from './NetWorthSheet'

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
  const { t, profile, open, lang, home, sheets, close, signOut } = useApp()
  const { theme, setTheme } = useTheme()
  const soon = () => toast(t('coming_soon'))
  const isPremium = profile?.plan_tier === 'premium'
  const [recurringOpen, setRecurringOpen] = useState(false)
  const [netWorthOpen, setNetWorthOpen] = useState(false)

  return (
    <div className="px-5 pb-28">
      <h1 className="text-2xl font-extrabold tracking-tight pt-6">{t('more')}</h1>

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
        <Row icon={HeartPulse} label={t('health_score')} onClick={soon} />
        <Row icon={Briefcase} label={t('business_invoicing')} onClick={soon} />
      </Card>

      <SectionLabel className="mt-7 mb-2 px-1">{t('profile')}</SectionLabel>
      <Card className="divide-y divide-border/40 overflow-hidden">
        <Row icon={Globe2} label={t('language')} right={LANGUAGES.find((l) => l.code === lang)?.name} onClick={() => open('language')} testId="more-language" />
        <Row icon={Coins} label={t('home_currency')} right={`${getCurrency(home).flag} ${home}`} onClick={() => open('currency', { target: 'home' })} testId="more-currency" />
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center"><SunMoon size={17} /></div>
          <span className="flex-1 font-medium text-[15px]">{t('appearance')}</span>
          <Segmented size="sm" className="w-44" value={theme || 'system'} onChange={setTheme} options={[{ id: 'light', label: t('light') }, { id: 'dark', label: t('dark') }, { id: 'system', label: t('system') }]} />
        </div>
        <Row icon={LogOut} label={t('logout')} onClick={signOut} testId="more-logout" />
      </Card>
      <p className="text-center text-[11px] text-muted-foreground mt-8">Paralar v0.1 · PWA</p>

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
