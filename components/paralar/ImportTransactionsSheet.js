'use client'
import { useMemo, useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Field } from './ui'
import { CATEGORIES } from '@/lib/categories'
import { convert } from '@/lib/rates'
import { roundMoney } from '@/lib/currencies'
import { cn } from '@/lib/utils'

const CAT_IDS = CATEGORIES.map((c) => c.id)
const norm = (s) => String(s ?? '').trim().toLowerCase()

const findIdx = (headers, patterns) => {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i])
    if (patterns.some((p) => h.includes(p))) return i
  }
  return -1
}

function normalizeDate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date && !isNaN(v.getTime())) return v
  const s = String(v).trim()
  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) { const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])); return isNaN(d.getTime()) ? null : d }
  // DD/MM/YYYY or DD-MM-YYYY (day-first). If first > 12 it's certainly the day.
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/)
  if (m) {
    let a = Number(m[1]), b = Number(m[2]); const y = Number(m[3].length === 2 ? '20' + m[3] : m[3])
    let day = a, mon = b
    if (a > 12 && b <= 12) { day = a; mon = b } else if (b > 12 && a <= 12) { day = b; mon = a }
    const d = new Date(y, mon - 1, day); return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s); return isNaN(d.getTime()) ? null : d
}

function parseAmount(v) {
  if (typeof v === 'number' && isFinite(v)) return v
  let s = String(v ?? '').replace(/[^\d.,-]/g, '').trim()
  if (!s) return null
  const hasComma = s.includes(','), hasDot = s.includes('.')
  if (hasComma && hasDot) { s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '') }
  else if (hasComma) { s = s.replace(',', '.') }
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

function normalizeType(v, amount) {
  const s = norm(v)
  if (/(income|credit|masuk|pemasukan|pendapatan|gelir)/.test(s)) return 'income'
  if (/(expense|debit|keluar|pengeluaran|perbelanjaan|gider|belanja)/.test(s)) return 'expense'
  if (/(transfer|pindah|kirim)/.test(s)) return 'transfer'
  return (amount != null && amount < 0) ? 'expense' : 'income'
}

function matchCategory(v) {
  const s = norm(v)
  if (!s) return 'other'
  if (CAT_IDS.includes(s)) return s
  const hit = CAT_IDS.find((id) => s.includes(id) || id.includes(s))
  return hit || 'other'
}

export default function ImportTransactionsSheet({ open, onClose }) {
  const { t, accounts = [], store, refresh, home, rates } = useApp()
  const fileRef = useRef(null)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [destAccountId, setDestAccountId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const reset = () => { setRows([]); setFileName('') }

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets?.[wb.SheetNames?.[0]]
      if (!ws) throw new Error('empty')
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })
      if (!aoa || aoa.length < 2) throw new Error('empty')
      const headers = (aoa[0] || []).map((h) => String(h ?? ''))
      const idx = {
        date: findIdx(headers, ['date', 'tanggal', 'tarikh', 'tarih']),
        amount: findIdx(headers, ['amount', 'jumlah', 'nominal', 'value', 'tutar', 'miktar']),
        type: findIdx(headers, ['type', 'tipe', 'jenis', 'tür', 'tur']),
        category: findIdx(headers, ['category', 'kategori', 'kategate']),
        note: findIdx(headers, ['note', 'desc', 'description', 'catatan', 'keterangan', 'açıklama', 'aciklama']),
        currency: findIdx(headers, ['currency', 'mata', 'kur', 'para']),
        account: findIdx(headers, ['account', 'akun', 'akaun', 'hesap', 'rekening']),
        payment: findIdx(headers, ['payment', 'method', 'pembayaran', 'bayaran', 'ödeme', 'odeme']),
      }
      const parsed = []
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r] || []
        const cell = (i) => (i >= 0 ? row[i] : '')
        const amount = parseAmount(cell(idx.amount))
        if (amount == null) continue
        const d = normalizeDate(cell(idx.date)) || new Date()
        parsed.push({
          date: d,
          type: normalizeType(cell(idx.type), amount),
          category: matchCategory(cell(idx.category)),
          amount: Math.abs(amount),
          currency: (String(cell(idx.currency) || '').trim().toUpperCase().match(/^[A-Z]{3}$/) ? String(cell(idx.currency)).trim().toUpperCase() : home),
          accountName: String(cell(idx.account) || '').trim(),
          payment_method: String(cell(idx.payment) || '').trim(),
          note: String(cell(idx.note) || '').trim(),
        })
      }
      if (!parsed.length) throw new Error('no valid rows')
      setRows(parsed)
      setFileName(file.name || 'file')
      setDestAccountId((accounts || [])[0]?.id || null)
    } catch (e) {
      reset()
      toast.error(t('invalid_file'))
    } finally { setBusy(false) }
  }

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f) }

  const accByName = (name) => {
    const s = norm(name)
    if (!s) return null
    return (accounts || []).find((a) => norm(a?.name) === s)?.id || null
  }

  const doImport = async () => {
    if (busy || !(rows || []).length) return
    setBusy(true)
    let ok = 0
    const netByAcc = {}
    try {
      for (const r of (rows || [])) {
        const accId = accByName(r?.accountName) || destAccountId || null
        try {
          await store?.createTransaction?.({
            type: r?.type || 'expense',
            amount: Number(r?.amount) || 0,
            currency: r?.currency || home,
            category: r?.category || 'other',
            account_id: accId,
            date: (r?.date instanceof Date ? r.date : new Date()).toISOString(),
            payment_method: r?.payment_method || '',
            note: r?.note || '',
          })
          ok += 1
          if (accId) {
            const acc = (accounts || []).find((a) => a?.id === accId)
            const accCur = acc?.currency || home
            let delta = 0
            try { delta = convert(Number(r?.amount) || 0, r?.currency || home, accCur, rates) } catch { delta = Number(r?.amount) || 0 }
            if (r?.type === 'expense') delta = -delta
            else if (r?.type === 'transfer') delta = 0
            netByAcc[accId] = (netByAcc[accId] || 0) + (isFinite(delta) ? delta : 0)
          }
        } catch { /* skip bad row */ }
      }
      // Update affected account balances
      for (const accId of Object.keys(netByAcc)) {
        const acc = (accounts || []).find((a) => a?.id === accId)
        if (!acc) continue
        try {
          const accCur = acc?.currency || home
          const next = roundMoney((Number(acc?.balance) || 0) + (netByAcc[accId] || 0), accCur)
          await store?.updateAccount?.(accId, { balance: next })
        } catch { /* ignore balance update failure */ }
      }
      if (refresh) await refresh()
      toast.success(t('import_success').replace('{n}', String(ok)))
      reset(); onClose?.()
    } catch (e) {
      toast.error(t('error'))
    } finally { setBusy(false) }
  }

  const preview = useMemo(() => (rows || []).slice(0, 5), [rows])
  const card = 'rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5'

  return (
    <Sheet open={open} onClose={() => { reset(); onClose?.() }} title={t('import_data')}>
      <div className="pt-1 space-y-4">
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="import-file" />

        {!(rows || []).length ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn('w-full border border-dashed rounded-2xl p-6 text-center transition-colors', dragOver ? 'border-foreground bg-muted/40' : 'border-border')}
            data-testid="import-dropzone"
          >
            <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto"><UploadCloud size={24} className="text-muted-foreground" strokeWidth={1.5} /></div>
            <p className="font-semibold mt-3">{busy ? t('processing') : t('import_data')}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-snug">{t('upload_area_hint')}</p>
          </button>
        ) : (
          <>
            <div className={cn(card, 'p-4 flex items-center gap-3')}>
              <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0"><FileSpreadsheet size={18} strokeWidth={1.75} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px]">{t('import_found').replace('{n}', String((rows || []).length))}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{fileName}</p>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-muted-foreground">{t('edit')}</button>
            </div>

            {/* Preview mini table */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 px-1">{t('import_preview')}</p>
              <div className={cn(card, 'overflow-hidden')}>
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40">
                  <span>{t('hdr_date')}</span><span className="text-right">{t('amount')}</span><span className="truncate">{t('category')}</span>
                </div>
                {(preview || []).map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] gap-2 px-3 py-2 text-sm border-b border-border/30 last:border-0">
                    <span className="tabular-nums text-muted-foreground">{r?.date instanceof Date ? `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}-${String(r.date.getDate()).padStart(2, '0')}` : ''}</span>
                    <span className={cn('text-right tabular-nums font-semibold', r?.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{r?.type === 'expense' ? '-' : '+'}{Number(r?.amount) || 0} {r?.currency}</span>
                    <span className="truncate">{t(`cat_${r?.category}`)}</span>
                  </div>
                ))}
              </div>
            </div>

            <Field label={t('dest_account')}>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                <button type="button" onClick={() => setDestAccountId(null)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium', destAccountId === null ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{t('no_account_opt')}</button>
                {(accounts || []).map((a) => (
                  <button key={a.id} type="button" onClick={() => setDestAccountId(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap', destAccountId === a.id ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{a.name}</button>
                ))}
              </div>
            </Field>

            <button type="button" onClick={doImport} disabled={busy} className={cn('w-full rounded-xl bg-foreground text-background font-semibold py-3.5 text-[15px] flex items-center justify-center gap-2', busy && 'opacity-40')} data-testid="import-execute">
              <CheckCircle2 size={18} /> {t('import_btn').replace('{n}', String((rows || []).length))}
            </button>
          </>
        )}
        <div className="h-2" />
      </div>
    </Sheet>
  )
}
