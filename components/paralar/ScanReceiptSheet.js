'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, Upload, Loader2, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, PrimaryButton, SecondaryButton, Card } from './ui'
import { fileToDataUrl } from '@/lib/ledger'

export default function ScanReceiptSheet({ open, onClose, onUse }) {
  const { t, home, fmt } = useApp()
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)
  const camRef = useRef(null)

  useEffect(() => { if (open) { setPreview(null); setResult(null); setBusy(false) } }, [open])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    e.target.value = ''
    setBusy(true)
    setResult(null)
    try {
      const dataUrl = await fileToDataUrl(f, 1600)
      setPreview(dataUrl)
      const res = await fetch('/api/ai/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: dataUrl }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t('error'))
      setResult(data?.receipt || null)
    } catch (err) {
      toast.error(err?.message || t('error'))
    } finally { setBusy(false) }
  }

  const useIt = () => {
    if (!result) return
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
      date: result.date ? new Date(result.date) : new Date(),
    })
    onClose?.()
  }

  const cur = result?.currency || home

  return (
    <Sheet open={open} onClose={onClose} title={t('scan_receipt')} full={!!result}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="scan-file" />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {!preview ? (
        <div className="pt-4 pb-4">
          <div className="rounded-2xl border-2 border-dashed border-border h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <ScanLine size={36} />
            <p className="text-sm font-medium">{t('upload_receipt')}</p>
            <p className="text-[10px]">Gemini Vision OCR</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <PrimaryButton onClick={() => camRef.current?.click()}><Camera size={18} className="inline mr-2" />{t('take_photo')}</PrimaryButton>
            <SecondaryButton onClick={() => fileRef.current?.click()} data-testid="scan-upload"><Upload size={18} className="inline mr-2" />Upload</SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="pt-2 pb-6">
          <div className="relative rounded-2xl overflow-hidden bg-muted">
            <img src={preview} alt="receipt" className="w-full max-h-64 object-contain" />
            {busy ? (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={28} />
                <p className="text-sm font-semibold">{t('scanning')}</p>
              </div>
            ) : null}
          </div>

          {result ? (
            <div className="mt-5" data-testid="scan-result">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-extrabold">{result.merchant || t('merchant')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{result.receipt_number ? `${t('receipt_no')} ${result.receipt_number}` : ''} {result.date ? `· ${result.date}` : ''}</p>
                </div>
                <span className="text-[10px] font-semibold uppercase rounded-md bg-foreground text-background px-2 py-1">{t(`cat_${result.category || 'other'}`)}</span>
              </div>
              <p className="text-4xl font-bold mt-4 tabular-nums">{fmt(result.total, cur)}</p>
              <Card className="mt-4 overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] px-4 py-2 label-upper border-b border-border/40"><span>{t('item')}</span><span>{t('price')}</span></div>
                {(result.items || []).map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] px-4 py-2.5 text-sm border-b border-border/30 last:border-0">
                    <span className="truncate">{it.qty > 1 ? `${it.qty}× ` : ''}{it.name}</span>
                    <span className="tabular-nums font-semibold">{fmt(it.price, cur)}</span>
                  </div>
                ))}
                {!(result.items || []).length ? <p className="px-4 py-3 text-sm text-muted-foreground">—</p> : null}
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
