'use client'
import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2, Sparkles, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useApp } from './context'
import { Sheet, PrimaryButton, TextInput, CategoryBadge, Card } from './ui'
import { CATEGORIES } from '@/lib/categories'
import { cn } from '@/lib/utils'

export default function VoiceLogSheet({ open, onClose, onResult }) {
  const { t, home, lang, accounts = [], fmt, session, isAiAllowed, open: openSheet } = useApp()
  const [state, setState] = useState('idle') // idle | recording | processing | result
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState(null)
  const [typed, setTyped] = useState('')
  const [showTyped, setShowTyped] = useState(false)
  const recRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (open) {
      if (!isAiAllowed) {
        onClose?.()
        openSheet?.('aiPremium')
        return
      }
      setState('idle')
      setTranscript('')
      setParsed(null)
      setTyped('')
      setShowTyped(false)
    }
  }, [open, isAiAllowed, onClose, openSheet])

  const parseText = async (text) => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    setState('processing')
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text,
          homeCurrency: home,
          language: lang,
          accounts: accounts.map((a) => a.name),
          categories: CATEGORIES.filter((c) => c.id !== 'transfer').map((c) => c.id),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('error'))
      setTranscript(text)
      setParsed(data)
      setState('result')
    } catch (e) {
      toast.error(e?.message || t('error'))
      setState('idle')
    }
  }

  const start = async () => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((x) => window.MediaRecorder?.isTypeSupported?.(x)) || ''
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop())
        const type = (rec.mimeType || mime || 'audio/webm').split(';')[0]
        const blob = new Blob(chunksRef.current, { type })
        if (!blob.size) { setState('idle'); return }
        setState('processing')
        try {
          const form = new FormData()
          form.append('file', blob, type.includes('mp4') ? 'recording.mp4' : type.includes('ogg') ? 'recording.ogg' : 'recording.webm')
          form.append('language', lang)
          const headers = {}
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
          const res = await fetch('/api/ai/transcribe', { method: 'POST', headers, body: form })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error || t('error'))
          if (!data?.text) throw new Error(t('error'))
          await parseText(data.text)
        } catch (e) { toast.error(e?.message || t('error')); setState('idle') }
      }
      recRef.current = rec
      rec.start()
      setState('recording')
    } catch (e) {
      toast.error(e?.message || 'Microphone not available')
      setShowTyped(true)
    }
  }
  const stop = () => { try { recRef.current?.stop() } catch {} }

  const useIt = () => {
    if (!parsed) return
    onResult?.({ type: parsed.type, amount: parsed.amount, currency: parsed.currency, category: parsed.category, payment_method: parsed.payment_method, account_name: parsed.account_name, merchant: parsed.merchant, note: parsed.note })
    onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('voice_log')}>
      <div className="flex flex-col items-center pt-6 pb-4">
        {state !== 'result' ? (
          <>
            <div className="relative h-40 w-40 flex items-center justify-center">
              {state === 'recording' ? (
                <>
                  <motion.span className="absolute inset-0 rounded-full bg-foreground/10" animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }} transition={{ repeat: Infinity, duration: 1.6 }} />
                  <motion.span className="absolute inset-4 rounded-full bg-foreground/10" animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }} transition={{ repeat: Infinity, duration: 1.6, delay: 0.3 }} />
                </>
              ) : null}
              <button
                type="button"
                onClick={state === 'recording' ? stop : state === 'idle' ? start : undefined}
                disabled={state === 'processing'}
                className={cn('relative h-24 w-24 rounded-full flex items-center justify-center shadow-2xl transition active:scale-95', state === 'recording' ? 'bg-destructive text-white' : 'bg-foreground text-background')}
                data-testid="voice-mic"
              >
                {state === 'processing' ? <Loader2 size={32} className="animate-spin" /> : state === 'recording' ? <Square size={28} fill="currentColor" /> : <Mic size={34} />}
              </button>
            </div>
            <p className="font-semibold mt-4">{state === 'recording' ? t('listening') : state === 'processing' ? t('processing') : t('tap_to_speak')}</p>
            <p className="text-sm text-muted-foreground mt-1 text-center">{state === 'recording' ? t('tap_to_stop') : t('say_example')}</p>
            <p className="text-[10px] text-muted-foreground mt-3">Google Gemini 2.0 Flash · Voice & NLP</p>

            <button type="button" onClick={() => setShowTyped(!showTyped)} className="mt-6 text-sm font-semibold flex items-center gap-1.5 text-muted-foreground"><Keyboard size={14} /> {showTyped ? t('close') : 'Type instead'}</button>
            {showTyped ? (
              <div className="w-full flex gap-2 mt-3">
                <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('say_example').replace('Try: ', '').replace(/"/g, '')} data-testid="voice-text" onKeyDown={(e) => { if (e.key === 'Enter' && typed.trim()) parseText(typed.trim()) }} />
                <button type="button" disabled={!typed.trim() || state === 'processing'} onClick={() => parseText(typed.trim())} className="rounded-xl bg-foreground text-background px-4 font-semibold disabled:opacity-40" data-testid="voice-parse"><Sparkles size={18} /></button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="w-full">
            <p className="label-upper">{t('transcript')}</p>
            <p className="mt-1 text-lg font-medium">“{transcript}”</p>
            <Card className="mt-5 p-4 flex items-center gap-3" data-testid="voice-result">
              <CategoryBadge id={parsed?.category} />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{parsed?.merchant || parsed?.note}</p>
                <p className="text-xs text-muted-foreground">{t(`cat_${parsed?.category || 'other'}`)} · {t(parsed?.payment_method || 'cash')}{parsed?.account_name ? ` · ${parsed.account_name}` : ''}</p>
              </div>
              <p className="font-bold tabular-nums">{parsed?.type === 'income' ? '+' : '-'}{fmt(parsed?.amount || 0, parsed?.currency || home)}</p>
            </Card>
            <p className="text-[11px] text-muted-foreground mt-2 text-right">{Math.round((parsed?.confidence || 0) * 100)}% · {parsed?.model}</p>
            <div className="mt-5 space-y-2">
              <PrimaryButton onClick={useIt} data-testid="voice-use">{t('review_and_save')}</PrimaryButton>
              <button type="button" onClick={() => { setState('idle'); setParsed(null) }} className="w-full py-3 text-sm font-semibold text-muted-foreground">{t('cancel')}</button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
