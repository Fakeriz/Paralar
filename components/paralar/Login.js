'use client'
import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { PrimaryButton, TextInput } from './ui'
import { supabase } from '@/lib/supabase'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.2 35.4 44 30.1 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.8-1.7 0-3.2 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.3.8 1.4 0 2.3-1.2 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-4.1zM14 5.2c.7-.8 1.2-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.3z"/></svg>
  )
}

export default function Login({ onGuest }) {
  const { t } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [mode, setMode] = useState('signin')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!email || !password) return
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success(t('welcome_back'))
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data?.session) toast.success(t('check_email'))
      }
    } catch (err) {
      toast.error(err?.message || t('error'))
    } finally {
      setBusy(false)
    }
  }

  const oauth = async (provider) => {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${base}/` } })
      if (error) throw error
    } catch (err) {
      const msg = err?.message || ''
      toast.error(/not enabled|Unsupported provider/i.test(msg) ? t('provider_disabled') : msg || t('error'))
    }
  }

  return (
    <div className="min-h-dvh bg-background max-w-md mx-auto flex flex-col px-6 safe-top">
      <div className="flex-1 flex flex-col justify-center py-10">
        <div className="mb-10">
          <div className="h-14 w-14 rounded-2xl bg-foreground text-background flex items-center justify-center text-2xl font-extrabold mb-6">P</div>
          <h1 className="text-4xl font-extrabold tracking-tight">Paralar</h1>
          <p className="text-muted-foreground mt-2">{t('ob1_title')}.</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <TextInput type="email" autoComplete="email" placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
          <div className="relative">
            <TextInput type={show ? 'text' : 'password'} autoComplete="current-password" placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" data-testid="login-password" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1" aria-label="toggle password">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <PrimaryButton type="submit" disabled={busy || !email || !password} data-testid="login-submit">
            {busy ? <Loader2 className="animate-spin inline" size={18} /> : mode === 'signin' ? t('sign_in') : t('sign_up')}
          </PrimaryButton>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-4">
          {mode === 'signin' ? t('no_account') : t('have_account')}{' '}
          <button type="button" className="font-semibold text-foreground" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? t('sign_up') : t('sign_in')}
          </button>
        </p>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-border flex-1" /><span className="text-xs text-muted-foreground uppercase">{t('or')}</span><div className="h-px bg-border flex-1" />
        </div>

        <div className="space-y-3">
          <button type="button" onClick={() => oauth('apple')} className="w-full rounded-xl border border-border/60 bg-card py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition">
            <AppleIcon /> {t('continue_apple')}
          </button>
          <button type="button" onClick={() => oauth('google')} className="w-full rounded-xl border border-border/60 bg-card py-3.5 font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition" data-testid="login-google">
            <GoogleIcon /> {t('continue_google')}
          </button>
        </div>
      </div>

      <div className="pb-10 text-center">
        <button type="button" onClick={onGuest} className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline" data-testid="guest-link">
          {t('guest_link')}
        </button>
      </div>
    </div>
  )
}
