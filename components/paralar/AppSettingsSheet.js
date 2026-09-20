'use client'
import { User, Globe, Coins, Moon, CalendarDays, ShieldCheck, Bell, PlayCircle, ShieldAlert, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { useApp } from './context'
import { Sheet, Segmented } from './ui'
import { LANGUAGES } from '@/lib/i18n'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'

function Row({ icon: Icon, label, sub, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left" data-testid={testId}>
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0">
          <p className="font-medium text-[15px]">{label}</p>
          {sub ? <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p> : null}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
    </button>
  )
}

export default function AppSettingsSheet({ open, onClose }) {
  const { t, open: openSheet, lang, home } = useApp()
  const { theme, setTheme } = useTheme()

  const nav = (fn) => { onClose?.(); setTimeout(() => fn(), 140) }
  const soon = () => toast(t('coming_soon'))
  const langName = LANGUAGES.find((l) => l.code === lang)?.name || 'English'
  const box = 'rounded-2xl divide-y divide-border/40 border border-border/40 bg-card overflow-hidden'

  return (
    <Sheet open={open} onClose={onClose} full title={t('app_settings')}>
      <div className="pt-1 space-y-5">
        <div className={box}>
          <Row icon={User} label={t('profile')} onClick={() => nav(() => openSheet('profile'))} testId="set-profile" />
          <Row icon={Globe} label={t('language')} sub={langName} onClick={() => nav(() => openSheet('language'))} testId="set-language" />
          <Row icon={Coins} label={t('home_currency')} sub={`${home} · ${getCurrency(home).name}`} onClick={() => nav(() => openSheet('currency', { target: 'home' }))} testId="set-currency" />
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 min-w-0">
              <Moon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <p className="font-medium text-[15px]">{t('appearance')}</p>
            </div>
            <Segmented size="sm" className={cn('w-40')} value={theme || 'system'} onChange={setTheme} options={[{ id: 'light', label: t('light') }, { id: 'dark', label: t('dark') }, { id: 'system', label: t('system') }]} />
          </div>
        </div>

        <div className={box}>
          <Row icon={CalendarDays} label={t('month_start_date')} sub={t('month_start_sub')} onClick={soon} testId="set-monthstart" />
          <Row icon={ShieldCheck} label={t('account_backup')} sub={t('account_backup_sub')} onClick={soon} testId="set-backup" />
          <Row icon={Bell} label={t('notifications')} sub={t('notifications_sub')} onClick={soon} testId="set-notifications" />
        </div>

        <div className={box}>
          <Row icon={PlayCircle} label={t('tutorial')} sub={t('tutorial_sub')} onClick={soon} testId="set-tutorial" />
          <Row icon={ShieldAlert} label={t('help_legal')} sub={t('help_legal_sub')} onClick={soon} testId="set-help" />
        </div>
        <div className="h-2" />
      </div>
    </Sheet>
  )
}
