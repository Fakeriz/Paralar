'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronRight, LogOut, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Field, TextInput, Segmented, PrimaryButton, Card } from './ui'
import CurrencySheet from './CurrencySheet'
import { LANGUAGES } from '@/lib/i18n'
import { getCurrency } from '@/lib/currencies'
import { fileToDataUrl } from '@/lib/ledger'
import { cn } from '@/lib/utils'

export default function ProfileSheet({ open, onClose }) {
  const { t, profile, updateProfile, signOut, session, isGuest, setLang } = useApp()
  const [name, setName] = useState('')
  const [mode, setMode] = useState('personal')
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('USD')
  const [avatar, setAvatar] = useState('')
  const [pickCur, setPickCur] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setName(profile?.full_name || '')
    setMode(profile?.usage_mode || 'personal')
    setLanguage(profile?.language || 'en')
    setCurrency(profile?.home_currency || 'USD')
    setAvatar(profile?.avatar_url || '')
  }, [open, profile])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try { setAvatar(await fileToDataUrl(f, 256)) } catch { toast.error(t('error')) }
  }
  const googlePhoto = session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || ''

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile({ full_name: name, usage_mode: mode, language, home_currency: currency, avatar_url: avatar })
      setLang(language)
      toast.success(t('saved_msg'))
      onClose?.()
    } catch (e) { toast.error(e?.missingTable ? t('db_missing') : e?.message || t('error')) } finally { setSaving(false) }
  }

  const initial = (name.trim()[0] || 'U').toUpperCase()

  return (
    <>
      <Sheet open={open} onClose={onClose} full title={t('profile')} left={<SheetTextButton muted onClick={onClose}>{t('close')}</SheetTextButton>} right={<SheetTextButton bold onClick={save} data-testid="profile-save">{saving ? '...' : t('save')}</SheetTextButton>}>
        <div className="flex flex-col items-center pt-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current?.click()} className="relative">
            <div className="h-24 w-24 rounded-full bg-foreground text-background text-3xl font-bold flex items-center justify-center overflow-hidden">
              {avatar ? <img src={avatar} alt="avatar" className="h-full w-full object-cover" /> : initial}
            </div>
            <span className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-background border border-border flex items-center justify-center shadow"><Camera size={16} /></span>
          </button>
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-semibold">{avatar ? t('change_photo') : t('add_photo')}</button>
            {googlePhoto && googlePhoto !== avatar ? <button type="button" onClick={() => setAvatar(googlePhoto)} className="text-sm text-muted-foreground">Google photo</button> : null}
          </div>
          {!isGuest && session?.user?.email ? <p className="text-xs text-muted-foreground mt-1">{session.user.email}</p> : null}
        </div>

        <div className="space-y-6 mt-8">
          <Field label={t('full_name')}><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('full_name')} data-testid="profile-name" /></Field>
          <Field label={t('usage_mode')}>
            <Segmented value={mode} onChange={setMode} options={[{ id: 'personal', label: t('personal') }, { id: 'business', label: t('business') }, { id: 'both', label: t('both') }]} />
          </Field>
          <Field label={t('language')}>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((l) => (
                <button key={l.code} type="button" onClick={() => setLanguage(l.code)} className={cn('flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium', language === l.code ? 'bg-foreground text-background border-foreground' : 'bg-card border-border/60')} data-testid={`profile-lang-${l.code}`}>
                  <span className="text-lg">{l.flag}</span><span className="flex-1 text-left">{l.name}</span>{language === l.code ? <Check size={16} /> : null}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('home_currency')}>
            <Card onClick={() => setPickCur(true)} className="flex items-center gap-3 p-3" data-testid="profile-currency">
              <span className="text-2xl w-8 text-center">{getCurrency(currency).flag}</span>
              <div className="flex-1"><p className="font-bold">{currency}</p><p className="text-xs text-muted-foreground">{getCurrency(currency).name}</p></div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Card>
          </Field>
          <PrimaryButton onClick={save} disabled={saving}>{t('save_changes')}</PrimaryButton>
          <button type="button" onClick={() => { onClose?.(); signOut() }} className="w-full rounded-xl border border-border/60 py-3.5 font-semibold text-destructive flex items-center justify-center gap-2" data-testid="profile-logout">
            <LogOut size={16} /> {t('logout')}
          </button>
        </div>
      </Sheet>
      <CurrencySheet open={pickCur} onClose={() => setPickCur(false)} value={currency} onSelect={setCurrency} zIndex={70} title={t('home_currency')} />
    </>
  )
}
