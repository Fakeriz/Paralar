'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Loader2, Bot, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet } from './ui'
import { QuotaBadge } from './QuotaBadge'
import { convert } from '@/lib/rates'
import { cn } from '@/lib/utils'

export default function CoachSheet({ open, onClose }) {
  const { t, home, lang, transactions = [], accounts = [], goals = [], rates, fmt, session, isAiAllowed, open: openSheet } = useApp()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [quota, setQuota] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const scrollRef = useRef(null)

  const fetchQuota = useCallback(async () => {
    if (!session?.access_token) return
    setQuotaLoading(true)
    try {
      const res = await fetch('/api/ai/usage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setQuota(data)
      }
    } catch (e) {
      console.warn('Failed to fetch AI quota:', e)
    } finally {
      setQuotaLoading(false)
    }
  }, [session?.access_token])

  const context = useMemo(() => {
    const now = new Date()
    const inMonth = transactions.filter((tx) => { const d = new Date(tx.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() })
    const sum = (type) => inMonth.filter((tx) => tx.type === type).reduce((s, tx) => s + convert(tx.amount, tx.currency, home, rates), 0)
    const byCat = {}
    inMonth.filter((tx) => tx.type === 'expense').forEach((tx) => { byCat[tx.category] = (byCat[tx.category] || 0) + convert(tx.amount, tx.currency, home, rates) })
    const totalBalance = accounts.reduce((s, a) => s + convert(a.balance, a.currency, home, rates), 0)
    return {
      homeCurrency: home,
      totalBalance: Math.round(totalBalance),
      monthIncome: Math.round(sum('income')),
      monthSpending: Math.round(sum('expense')),
      topCategories: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => ({ category: c, amount: Math.round(v) })),
      accounts: accounts.map((a) => ({ name: a.name, balance: Math.round(a.balance), currency: a.currency })),
      goals: goals.map((g) => ({ name: g.name, saved: g.saved_amount, target: g.target_amount })),
    }
  }, [transactions, accounts, goals, home, rates])

  const starters = [
    lang === 'id' ? 'Analisa pengeluaranku bulan ini' : lang === 'ms' ? 'Analisa perbelanjaan saya bulan ini' : lang === 'tr' ? 'Bu ayki harcamalarımı analiz et' : 'Analyze my spending this month',
    lang === 'id' ? 'Bagaimana cara menabung lebih banyak?' : lang === 'ms' ? 'Bagaimana nak menabung lebih?' : lang === 'tr' ? 'Nasıl daha fazla biriktirebilirim?' : 'How can I save more?',
  ]

  useEffect(() => {
    if (open) {
      if (!isAiAllowed) {
        onClose?.()
        openSheet?.('aiPremium')
        return
      }
      setMessages([{ role: 'assistant', content: lang === 'id' ? 'Halo! Saya AI Financial Coach kamu. Tanya apa saja soal keuanganmu. 💰' : lang === 'ms' ? 'Hai! Saya AI Financial Coach anda. Tanya apa sahaja tentang kewangan anda. 💰' : lang === 'tr' ? 'Merhaba! Ben AI Finans Koçunuzum. Finanslarınız hakkında her şeyi sorun. 💰' : "Hi! I'm your AI Financial Coach. Ask me anything about your money. 💰" }])
      fetchQuota()
    }
  }, [open, lang, isAiAllowed, onClose, openSheet, fetchQuota])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  const send = async (text) => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    const content = (text ?? input).trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: next.filter((m) => m.role !== 'system'), language: lang, context }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 || data?.code === 'AI_PREMIUM_REQUIRED') {
          onClose?.()
          openSheet?.('aiPremium')
          return
        }
        if (res.status === 429 || data?.code === 'AI_QUOTA_EXCEEDED') {
          toast.error(data?.error || 'Kuota AI harian Anda telah habis.')
          setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${data?.error || 'Kuota AI harian Anda telah habis.'}` }])
          return
        }
        throw new Error(data?.error || t('error'))
      }

      if (data?.remaining !== undefined) {
        setQuota({
          remaining: data.remaining,
          total: data.total,
          is_unlimited: data.is_unlimited,
        })
      }

      setMessages((m) => [...m, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e?.message || t('error')}` }])
    } finally { setBusy(false) }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      noPadding
      title={<span className="flex items-center gap-2"><Bot size={18} /> {t('ai_coach')}</span>}
      right={<QuotaBadge quota={quota} loading={quotaLoading} />}
    >
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 bg-muted/50 text-[11px] text-muted-foreground text-center">
          {fmt(context.totalBalance, home)} · {t('spending')}: {fmt(context.monthSpending, home)} · Gemini 2.0 Flash
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[82%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed', m.role === 'user' ? 'bg-foreground text-background rounded-br-md' : 'bg-card border border-border/50 rounded-bl-md')}>{m.content}</div>
            </div>
          ))}
          {busy ? <div className="flex justify-start"><div className="bg-card border border-border/50 rounded-2xl rounded-bl-md px-4 py-3"><Loader2 size={16} className="animate-spin" /></div></div> : null}
          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-2 pt-2">
              {starters.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-border/60 bg-card px-3 py-2 text-xs font-medium flex items-center gap-1.5"><Sparkles size={12} /> {s}</button>)}
            </div>
          ) : null}
        </div>
        <div className="border-t border-border/40 p-3 safe-bottom flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="..." className="flex-1 rounded-xl bg-muted px-4 py-3 text-sm outline-none" data-testid="coach-input" />
          <button type="button" onClick={() => send()} disabled={busy || !input.trim()} className="h-11 w-11 rounded-xl bg-foreground text-background flex items-center justify-center disabled:opacity-40" data-testid="coach-send"><Send size={18} /></button>
        </div>
      </div>
    </Sheet>
  )
}
