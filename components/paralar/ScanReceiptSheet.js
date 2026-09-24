'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Upload, Loader2, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton, Card } from './ui'
import { QuotaBadge } from './QuotaBadge'
import { fileToDataUrl } from '@/lib/ledger'

export default function ScanReceiptSheet({ open, onClose, onUse }) {
  const { t, home, fmt, session, isAiAllowed, open: openSheet } = useApp()
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [quota, setQuota] = useState(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const fileRef = useRef(null)
  const camRef = useRef(null)

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

  useEffect(() => {
    if (open) {
      if (!isAiAllowed) {
        onClose?.()
        openSheet?.('aiPremium')
        return
      }
      setPreview(null)
      setResult(null)
      setBusy(false)
      fetchQuota()
    }
  }, [open, isAiAllowed, onClose, openSheet, fetchQuota])

  const onFile = async (e) => {
    if (!isAiAllowed) {
      onClose?.()
      openSheet?.('aiPremium')
      return
    }
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setBusy(true)
    setResult(null)
    try {
      const dataUrl = await fileToDataUrl(f, 1600)
      setPreview(dataUrl)
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: dataUrl }),
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

      const receiptData = data?.receipt || data || null
      setResult(receiptData)
    } catch (err) {
      toast.error(err?.message || t('error'))
    } finally { setBusy(false) }
  }

  const useIt = () => {
    if (!result) return
    const now = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    const fallbackTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const finalTime = result.time || fallbackTime
    const finalDate = result.transaction_date || (result.date ? `${result.date}T${finalTime}:00` : now.toISOString())

    onUse?.({
      type: 'expense',
      amount: result.total,
      currency: result.currency || home,
      category: result.category || 'other',
      payment_method: result.payment_method || 'cash',
      merchant: result.merchant,
      receipt_number: result.receipt_number,
      items: result.items || [],
      receipt_url: preview,
      note: result.merchant,
      time: finalTime,
      transaction_date: finalDate,
      date: finalDate,
    })
    onClose?.()
  }

  const cur = result?.currency || home

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('scan_receipt')}
      right={<QuotaBadge quota={quota} loading={quotaLoading} />}
      full={!!result}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="scan-file" />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {!preview ? (
        <div className="pt-4 pb-4">
          <div className="rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 h-48 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 gap-2">
            <ScanLine size={36} />
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">{t('upload_receipt')}</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Gemini Vision OCR</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <PrimaryButton
              onClick={() => {
                if (!isAiAllowed) {
                  onClose?.()
                  openSheet?.('aiPremium')
                  return
                }
                camRef.current?.click()
              }}
            >
              <Camera size={18} className="inline mr-2" />
              {t('take_photo')}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                if (!isAiAllowed) {
                  onClose?.()
                  openSheet?.('aiPremium')
                  return
                }
                fileRef.current?.click()
              }}
              data-testid="scan-upload"
            >
              <Upload size={18} className="inline mr-2" />
              Upload
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="pt-2 pb-6">
          <div className="relative rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            <img src={preview} alt="receipt" className="w-full max-h-64 object-contain" />
            {busy ? (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-zinc-950 dark:text-white" size={28} />
                <p className="text-sm font-bold text-zinc-950 dark:text-white">{t('scanning')}</p>
              </div>
            ) : null}
          </div>

          {result ? (
            <div className="mt-5" data-testid="scan-result">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-extrabold text-zinc-950 dark:text-white">{result.merchant || t('merchant')}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium mt-0.5">
                    {result.receipt_number ? `${t('receipt_no')} ${result.receipt_number}` : ''}
                    {result.date ? ` · ${result.date}` : ''}
                    {result.time ? ` · ${result.time}` : ''}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase rounded-md bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-2 py-1">{t(`cat_${result.category || 'other'}`)}</span>
              </div>
              <p className="text-4xl font-extrabold mt-4 tabular-nums text-zinc-950 dark:text-white">{fmt(result.total, cur)}</p>
              <Card className="mt-4 overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-white/5"><span>{t('item')}</span><span>{t('price')}</span></div>
                {(result.items || []).map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm border-b border-zinc-200/40 dark:border-white/5 last:border-0 text-zinc-950 dark:text-white">
                    <span className="truncate font-medium">{it.qty > 1 ? `${it.qty}× ` : ''}{it.name}</span>
                    <span className="tabular-nums font-bold">{fmt(it.price, cur)}</span>
                  </div>
                ))}
                {!(result.items || []).length ? <p className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">—</p> : null}
              </Card>
              <div className="mt-5 space-y-2">
                <PrimaryButton onClick={useIt} data-testid="scan-use">{t('use_this')}</PrimaryButton>
                <SecondaryButton onClick={() => fileRef.current?.click()}>{t('upload_receipt')}</SecondaryButton>
              </div>
            </div>
          ) : !busy ? (
            <div className="mt-4"><SecondaryButton onClick={() => fileRef.current?.click()}>{t('upload_receipt')}</SecondaryButton></div>
          ) : null}
        </div>
      )}
    </Sheet>
  )
}
