'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet, FileText, Sparkles, CheckCircle2, ChevronLeft, Plus, AlertTriangle, Undo2, Check, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Field, Segmented, Card, PrimaryButton, CategoryBadge, SectionLabel, TextInput } from './ui'
import { CATEGORIES } from '@/lib/categories'
import { convert, getRate } from '@/lib/rates'
import { roundMoney } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import * as SI from '@/lib/statement-import'

// Wizard impor rekening koran: upload → setup (wallet + mapping) → review → selesai.
// Seluruh parsing/normalisasi/dedup jalan client-side (privasi); server hanya
// menerima baris final + catatan batch (jika migrasi import_batches sudah jalan).

const STEPS = ['upload', 'setup', 'review', 'done']

export default function ImportTransactionsSheet({ open, onClose }) {
  const { t, accounts = [], store, refresh, home, rates, session, open: openSheet } = useApp()
  const fileRef = useRef(null)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [aoa, setAoa] = useState([])
  const [mapping, setMapping] = useState({ date: -1, desc: -1, amount: -1, debit: -1, credit: -1, balance: -1 })
  const [dirMode, setDirMode] = useState('signed')
  // Mode PDF+AI: file PDF dikirim ke AI, kolom sudah berlabel → mapping di-skip
  const [aiMode, setAiMode] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [aiRows, setAiRows] = useState(null)
  const [walletId, setWalletId] = useState(null)
  const [newWallet, setNewWallet] = useState(false)
  const [nwName, setNwName] = useState('')
  const [nwCurrency, setNwCurrency] = useState(home || 'MYR')
  const [rows, setRows] = useState([])
  const [excluded, setExcluded] = useState({})
  const [catEdits, setCatEdits] = useState({})
  const [pickCatFor, setPickCatFor] = useState(null)
  const [catSearch, setCatSearch] = useState('')
  const [caps, setCaps] = useState({ batchTable: false, columns: false })
  const [overlap, setOverlap] = useState([])
  const [balanceCheck, setBalanceCheck] = useState({ checked: false })
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [batchId, setBatchId] = useState(null)
  const [batchRecId, setBatchRecId] = useState(null)
  const [netDelta, setNetDelta] = useState(0)
  const [showDupes, setShowDupes] = useState(false)

  const wallet = useMemo(() => (accounts || []).find((a) => a.id === walletId) || null, [accounts, walletId])
  const walletCur = wallet?.currency || home || 'MYR'

  const reset = () => {
    setStep(0); setBusy(false); setFileName(''); setHeaders([]); setAoa([])
    setMapping({ date: -1, desc: -1, amount: -1, debit: -1, credit: -1, balance: -1 })
    setDirMode('signed'); setWalletId(null); setNewWallet(false); setNwName(''); setNwCurrency(home || 'MYR')
    setRows([]); setExcluded({}); setCatEdits({}); setPickCatFor(null); setCatSearch('')
    setOverlap([]); setBalanceCheck({ checked: false }); setProgress({ done: 0, total: 0 })
    setResult(null); setBatchId(null); setBatchRecId(null); setNetDelta(0); setShowDupes(false)
    setAiMode(false); setPdfFile(null); setAiRows(null)
  }

  // Probe kapabilitas server sekali saat sheet dibuka
  useEffect(() => {
    if (open && store?.getImportCapabilities) {
      store.getImportCapabilities().then(setCaps).catch(() => {})
    }
  }, [open, store])

  const close = () => { reset(); onClose?.() }

  // ------------------------------------------------------------ langkah 1: file
  const isPdfFile = (file) => {
    if (!file) return false
    if ((file.type || '').toLowerCase().includes('pdf')) return true
    return /\.pdf$/i.test(file.name || '')
  }

  const handleFile = async (file) => {
    if (!file || busy) return
    // PDF → jalur AI (butuh persetujuan + kuota); parsing di langkah setup
    if (isPdfFile(file)) {
      setFileName(file.name || 'statement.pdf')
      setPdfFile(file)
      setAiMode(true); setAiRows(null)
      setWalletId((accounts || [])[0]?.id || null)
      setStep(1)
      return
    }
    setBusy(true)
    try {
      const { fileName: fn, headers: h, rows: body } = await SI.parseStatementFile(file)
      const { mapping: m, dirMode: dm } = SI.detectMapping(h, body)
      setFileName(fn); setHeaders(h); setAoa(body)
      setMapping(m); setDirMode(dm)
      setAiMode(false); setPdfFile(null); setAiRows(null)
      setWalletId((accounts || [])[0]?.id || null)
      setStep(1)
    } catch {
      toast.error(t('invalid_file'))
    } finally { setBusy(false) }
  }

  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) handleFile(f) }

  // ------------------------------------------------------------ wallet baru
  const createWallet = async () => {
    const name = nwName.trim()
    if (!name) { toast.error(t('import_wallet_name')); return }
    setBusy(true)
    try {
      const w = await store.createAccount({ name, currency: (nwCurrency || home || 'MYR').toUpperCase(), type: 'bank', balance: 0 })
      if (refresh) await refresh()
      setWalletId(w?.id || null)
      setNewWallet(false); setNwName('')
      toast.success(name)
    } catch { toast.error(t('error')) }
    finally { setBusy(false) }
  }

  // ------------------------------------------------------------ langkah 2 → review
  const mappingValid = () => {
    if (mapping.date < 0 || mapping.desc < 0) return false
    if (dirMode === 'split') return mapping.debit >= 0 && mapping.credit >= 0
    return mapping.amount >= 0
  }

  // Finalisasi baris kanonis → review. Dipakai jalur CSV/XLSX (buildReview)
  // maupun jalur PDF+AI (continueAiReview) — dedup, cek saldo, overlap sama.
  const finalizeParsedRows = async (parsed) => {
    parsed = parsed.map((r, i) => ({
      ...r,
      idx: i,
      fingerprint: SI.rowFingerprint(r),
      category: SI.suggestCategory(r.desc, r.type) || 'other',
    }))
    SI.markInFileDuplicates(parsed)
    // Dedup terhadap data existing di rentang tanggal file
    const range = SI.getDateRange(parsed)
    let existingKeys = new Set()
    if (range && store?.findTransactionsInRange) {
      const from = new Date(range.min); from.setHours(0, 0, 0, 0)
      const to = new Date(range.max); to.setHours(23, 59, 59, 999)
      const existing = await store.findTransactionsInRange(walletId, from.toISOString(), to.toISOString())
      existingKeys = new Set((existing || []).map((x) => SI.rowKey({
        dateStr: SI.fmtDateStr(new Date(x.date || x.transaction_date)),
        amount: Math.abs(Number(x.amount) || 0),
        currency: x.currency,
        desc: x.note || x.description || '',
      })))
    }
    for (const r of parsed) r.dupExisting = existingKeys.has(SI.rowKey(r))
    setBalanceCheck(SI.checkBalanceContinuity(parsed))
    // Overlap dengan batch sebelumnya
    if (range && store?.listImportBatches) {
      const batches = await store.listImportBatches(walletId, 20)
      setOverlap((batches || []).filter((b) => {
        if (!b.date_from || !b.date_to || b.status === 'undone') return false
        return SI.rangesOverlap(range, { min: new Date(b.date_from), max: new Date(b.date_to) })
      }))
    }
    setRows(parsed)
    setExcluded({}); setCatEdits({}); setShowDupes(false)
    setStep(2)
  }

  const buildReview = async () => {
    if (!walletId) { toast.error(t('import_no_wallet')); return }
    if (!mappingValid()) { toast.error(t('import_map_incomplete')); return }
    setBusy(true)
    try {
      const parsed = SI.normalizeRows(aoa, mapping, dirMode, walletCur)
      if (!parsed.length) throw new Error('empty')
      await finalizeParsedRows(parsed)
    } catch {
      toast.error(t('invalid_file'))
    } finally { setBusy(false) }
  }

  // Konversi ArrayBuffer → base64 per chunk (btoa langsung bisa stack overflow)
  const arrayBufferToBase64 = (buf) => {
    const bytes = new Uint8Array(buf)
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
    }
    return btoa(bin)
  }

  // ------------------------------------------------------------ jalur PDF+AI
  const processPdfWithAi = async () => {
    if (!pdfFile || busy) return
    if (!walletId) { toast.error(t('import_no_wallet')); return }
    setBusy(true)
    try {
      const buf = await pdfFile.arrayBuffer()
      const b64 = arrayBufferToBase64(buf)
      const headers = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
      const res = await fetch('/api/ai/parse-statement', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pdfBase64: b64, fileName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 403 || data?.code === 'AI_PREMIUM_REQUIRED') {
          close(); openSheet?.('aiPremium'); return
        }
        if (res.status === 429 || data?.code === 'AI_QUOTA_EXCEEDED') {
          toast.error(data?.error || t('import_ai_quota')); return
        }
        throw new Error(data?.error || t('import_pdf_failed'))
      }
      const rows = SI.aiTransactionsToRows(data?.transactions, walletCur)
      if (!rows.length) throw new Error('empty')
      setAiRows(rows)
      toast.success(t('import_pdf_found').replace('{n}', String(rows.length)))
    } catch (e) {
      toast.error(e?.message || t('import_pdf_failed'))
    } finally { setBusy(false) }
  }

  const continueAiReview = async () => {
    if (!walletId) { toast.error(t('import_no_wallet')); return }
    if (!aiRows?.length) return
    setBusy(true)
    try {
      await finalizeParsedRows(aiRows)
    } catch {
      toast.error(t('error'))
    } finally { setBusy(false) }
  }

  const catOf = (r) => catEdits[r.idx] || r.category || 'other'
  const readyRows = useMemo(() => rows.filter((r) => !r.dupInFile && !r.dupExisting && !excluded[r.idx]), [rows, excluded])
  const dupeRows = useMemo(() => rows.filter((r) => r.dupInFile || r.dupExisting), [rows])
  const range = useMemo(() => SI.getDateRange(rows), [rows])

  // Rekonsiliasi: saldo akhir statement vs saldo wallet
  const recon = useMemo(() => {
    const withBal = rows.filter((r) => r.balanceAfter != null && !r.dupInFile)
    if (!withBal.length || !wallet) return null
    const last = [...withBal].sort((a, b) => b.date - a.date)[0]
    let stmtEnd = last.balanceAfter
    try { stmtEnd = convert(last.balanceAfter, last.currency, walletCur, rates) } catch {}
    const diff = Math.abs(stmtEnd - (Number(wallet.balance) || 0))
    return { stmtEnd, walletBal: Number(wallet.balance) || 0, match: diff < 0.01, cur: walletCur }
  }, [rows, wallet, walletCur, rates])

  // ------------------------------------------------------------ impor
  const runImport = async () => {
    if (busy || !readyRows.length || !walletId) return
    setBusy(true)
    const bId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `batch-${Date.now()}`
    setBatchId(bId)
    setProgress({ done: 0, total: readyRows.length })
    let ok = 0, net = 0, recId = null
    try {
      if (caps.batchTable && range) {
        const rec = await store.createImportBatch({
          account_id: walletId,
          file_name: fileName,
          row_count: rows.length,
          date_from: range.min.toISOString(),
          date_to: range.max.toISOString(),
          status: 'importing',
        })
        recId = rec?.id || null
        setBatchRecId(recId)
      }
      const importOne = async (r) => {
        try {
          const payload = {
            type: r.type,
            amount: r.amount,
            currency: r.currency,
            home_currency: home,
            home_currency_amount: roundMoney(convert(r.amount, r.currency, home, rates), home),
            rate: getRate(r.currency, home, rates),
            category: catOf(r),
            account_id: walletId,
            date: r.date.toISOString(),
            transaction_date: r.date.toISOString(),
            payment_method: 'bank',
            note: r.desc,
            description: r.desc,
            ...(caps.columns ? { import_batch_id: bId, fingerprint: r.fingerprint } : {}),
          }
          await store.createTransaction(payload)
          const delta = convert(r.amount, r.currency, walletCur, rates)
          net += r.type === 'income' ? delta : -delta
          // Pelajari kategori pilihan user untuk file berikutnya
          if (catEdits[r.idx]) SI.learnCategory(r.desc, catEdits[r.idx])
          else if (r.category !== 'other') SI.learnCategory(r.desc, r.category)
          ok += 1
        } catch { /* baris gagal dilewati, dihitung di akhir */ }
      }
      const CONC = 8
      for (let i = 0; i < readyRows.length; i += CONC) {
        await Promise.all(readyRows.slice(i, i + CONC).map(importOne))
        setProgress({ done: Math.min(i + CONC, readyRows.length), total: readyRows.length })
      }
      // Satu update saldo di akhir (bukan per baris)
      const w = (accounts || []).find((a) => a.id === walletId)
      if (w && net !== 0) {
        try { await store.updateAccount(walletId, { balance: roundMoney((Number(w.balance) || 0) + net, walletCur) }) } catch {}
      }
      setNetDelta(net)
      if (recId) await store.updateImportBatch(recId, { imported_count: ok, skipped_count: rows.length - ok, status: 'completed' })
      if (refresh) await refresh()
      setResult({ ok, skipped: rows.length - ok })
      setStep(3)
    } catch {
      toast.error(t('error'))
    } finally { setBusy(false) }
  }

  const undoImport = async () => {
    if (busy || !batchId) return
    setBusy(true)
    try {
      if (caps.columns) await store.deleteTransactionsByImportBatch(batchId)
      const w = (accounts || []).find((a) => a.id === walletId)
      if (w && netDelta !== 0) {
        try { await store.updateAccount(walletId, { balance: roundMoney((Number(w.balance) || 0) - netDelta, walletCur) }) } catch {}
      }
      if (batchRecId) await store.updateImportBatch(batchRecId, { status: 'undone' })
      if (refresh) await refresh()
      toast.success(t('import_undone'))
      close()
    } catch { toast.error(t('error')) }
    finally { setBusy(false) }
  }

  // ------------------------------------------------------------ render helpers
  const card = 'rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5'

  const stepLabel = (i) => t(`import_step_${STEPS[i]}`)

  const MapRow = ({ role, label, required }) => {
    const show = role === 'date' || role === 'desc' || role === 'balance'
      || (dirMode === 'signed' && role === 'amount')
      || (dirMode === 'split' && (role === 'debit' || role === 'credit'))
    if (!show) return null
    const colCount = Math.max(headers.length, ...aoa.map((r) => (r || []).length), 0)
    const sampleRow = aoa[0] || []
    return (
      <div className="mb-3">
        <p className="text-xs font-semibold text-muted-foreground px-1 mb-1.5">{label}{required ? ' *' : ''}</p>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-stretch">
          <button
            type="button"
            onClick={() => setMapping((m) => ({ ...m, [role]: -1 }))}
            className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium self-center', mapping[role] === -1 ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60 text-muted-foreground')}
          >—</button>
          {Array.from({ length: colCount }, (_, i) => {
            const colLabel = (headers[i] || '').trim() || t('import_col_n').replace('{n}', i + 1)
            const sample = String(sampleRow[i] ?? '').trim()
            const active = mapping[role] === i
            return (
              <button
                key={i}
                type="button"
                onClick={() => setMapping((m) => ({ ...m, [role]: i }))}
                className={cn('shrink-0 min-w-[136px] max-w-[220px] rounded-xl border px-3 py-2 text-left', active ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}
              >
                <span className="block text-[13px] font-semibold truncate">{colLabel}</span>
                {sample ? <span className={cn('block text-[11px] truncate mt-0.5', active ? 'opacity-70' : 'text-muted-foreground')}>{sample}</span> : null}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase()
    return CATEGORIES.filter((c) => !q || (t(`cat_${c.id}`) || c.id).toLowerCase().includes(q))
  }, [catSearch, t])

  return (
    <>
      <Sheet open={open} onClose={close} title={t('import_data')}>
        <div className="pt-1">
          {/* hairline progress */}
          <div className="flex gap-1 mb-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={cn('h-1 rounded-full', i <= step ? 'bg-foreground' : 'bg-border/60')} />
                <p className={cn('text-[10px] font-semibold mt-1', i === step ? 'text-foreground' : 'text-muted-foreground')}>{stepLabel(i)}</p>
              </div>
            ))}
          </div>

          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="import-file" />

          {/* ============ STEP 0: upload ============ */}
          {step === 0 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="w-full border border-dashed border-border rounded-2xl p-6 text-center"
              data-testid="import-dropzone"
            >
              <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto"><UploadCloud size={24} className="text-muted-foreground" strokeWidth={1.5} /></div>
              <p className="font-semibold mt-3">{busy ? t('processing') : t('import_data')}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-snug">{t('upload_area_hint')}</p>
            </button>
          )}

          {/* ============ STEP 1: setup ============ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className={cn(card, 'p-4 flex items-center gap-3')}>
                <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0">
                  {aiMode ? <FileText size={18} strokeWidth={1.75} /> : <FileSpreadsheet size={18} strokeWidth={1.75} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px] truncate flex items-center gap-2">
                    <span className="truncate">{fileName}</span>
                    {aiMode && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand/15 text-brand">{t('import_pdf_badge')}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{aiMode ? t('import_pdf_ai_title') : `${aoa.length} ${t('import_rows_unit')}`}</p>
                </div>
                <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-muted-foreground shrink-0">{t('edit')}</button>
              </div>

              <Field label={t('import_choose_wallet')}>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {(accounts || []).map((a) => (
                    <button key={a.id} type="button" onClick={() => { setWalletId(a.id); setNewWallet(false) }}
                      className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap', walletId === a.id && !newWallet ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>
                      {a.name} <span className="opacity-60">· {a.currency}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => { setNewWallet(true); setWalletId(null) }}
                    className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium flex items-center gap-1', newWallet ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60 border-dashed')}>
                    <Plus size={14} /> {t('import_new_wallet')}
                  </button>
                </div>
              </Field>

              {newWallet && (
                <div className={cn(card, 'p-4 space-y-3')}>
                  <Field label={t('import_wallet_name')}>
                    <TextInput value={nwName} onChange={(e) => setNwName(e.target.value)} placeholder={t('import_wallet_name_ph')} />
                  </Field>
                  <Field label={t('import_currency')}>
                    <TextInput value={nwCurrency} onChange={(e) => setNwCurrency(e.target.value.toUpperCase().slice(0, 3))} placeholder="MYR" maxLength={3} />
                  </Field>
                  <button type="button" onClick={createWallet} disabled={busy} className="w-full rounded-xl bg-foreground text-background font-semibold py-2.5 text-sm disabled:opacity-40">
                    {t('import_create')}
                  </button>
                </div>
              )}

              {aiMode ? (
                <>
                  <div className={cn(card, 'p-4 flex items-start gap-3')}>
                    <div className="h-10 w-10 rounded-xl bg-brand/15 text-brand flex items-center justify-center shrink-0"><Sparkles size={18} strokeWidth={1.75} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{t('import_pdf_ai_title')}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t('import_pdf_ai_desc')}</p>
                      {aiRows && <p className="text-xs font-semibold text-emerald-500 mt-1.5">{t('import_pdf_found').replace('{n}', String(aiRows.length))}</p>}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStep(0)} className="rounded-xl border border-border/60 px-4 py-3.5 text-sm font-semibold flex items-center gap-1">
                      <ChevronLeft size={16} /> {t('import_back')}
                    </button>
                    {aiRows ? (
                      <PrimaryButton onClick={continueAiReview} disabled={busy} className="flex-1">
                        {busy ? t('processing') : t('import_continue')}
                      </PrimaryButton>
                    ) : (
                      <PrimaryButton onClick={processPdfWithAi} disabled={busy} className="flex-1">
                        {busy ? t('processing') : t('import_pdf_process')}
                      </PrimaryButton>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <SectionLabel>{t('import_map_title')}</SectionLabel>
                    <p className="text-xs text-muted-foreground px-1 -mt-1 mb-2">{t('import_map_hint')}</p>
                    <MapRow role="date" label={t('import_col_date')} required />
                    <MapRow role="desc" label={t('import_col_desc')} required />
                    <MapRow role="amount" label={t('import_col_amount')} required={dirMode === 'signed'} />
                    <MapRow role="debit" label={t('import_col_debit')} required={dirMode === 'split'} />
                    <MapRow role="credit" label={t('import_col_credit')} required={dirMode === 'split'} />
                    <MapRow role="balance" label={t('import_col_balance')} />
                  </div>

                  <Field label={t('import_direction')}>
                    <Segmented
                      value={dirMode}
                      onChange={setDirMode}
                      options={[
                        { id: 'signed', label: t('import_dir_signed') },
                        { id: 'split', label: t('import_dir_split') },
                        { id: 'type_col', label: t('import_dir_type') },
                      ]}
                    />
                  </Field>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStep(0)} className="rounded-xl border border-border/60 px-4 py-3.5 text-sm font-semibold flex items-center gap-1">
                      <ChevronLeft size={16} /> {t('import_back')}
                    </button>
                    <PrimaryButton onClick={buildReview} disabled={busy} className="flex-1">
                      {busy ? t('processing') : t('import_continue')}
                    </PrimaryButton>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ STEP 2: review ============ */}
          {step === 2 && (
            <div className="space-y-3">
              {/* ringkasan validasi */}
              <div className="space-y-2">
                <div className={cn(card, 'p-3 flex items-center gap-2.5')}>
                  <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
                  <p className="text-sm font-semibold">{t('import_ready').replace('{n}', String(readyRows.length))}</p>
                </div>
                {balanceCheck.checked && (
                  <div className={cn(card, 'p-3 flex items-center gap-2.5')}>
                    {balanceCheck.ok
                      ? <><CheckCircle2 size={17} className="text-emerald-500 shrink-0" /><p className="text-sm font-medium">{t('import_balance_ok')}</p></>
                      : <><AlertTriangle size={17} className="text-amber-500 shrink-0" /><p className="text-sm font-medium">{t('import_balance_warn')}</p></>}
                  </div>
                )}
                {overlap.length > 0 && (
                  <div className={cn(card, 'p-3 flex items-start gap-2.5')}>
                    <AlertTriangle size={17} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      {overlap.map((b) => (
                        <p key={b.id} className="text-sm font-medium">{t('import_overlap_warn').replace('{name}', b.file_name || '').replace('{range}', `${SI.fmtDateStr(new Date(b.date_from))} → ${SI.fmtDateStr(new Date(b.date_to))}`)}</p>
                      ))}
                    </div>
                  </div>
                )}
                {recon && (
                  <div className={cn(card, 'p-3 flex items-center gap-2.5')}>
                    {recon.match
                      ? <><CheckCircle2 size={17} className="text-emerald-500 shrink-0" /><p className="text-sm font-medium">{t('import_recon_match')}</p></>
                      : <><AlertTriangle size={17} className="text-amber-500 shrink-0" /><p className="text-sm font-medium">{t('import_recon_diff').replace('{a}', `${recon.stmtEnd.toLocaleString()} ${recon.cur}`).replace('{b}', `${recon.walletBal.toLocaleString()} ${recon.cur}`)}</p></>}
                  </div>
                )}
                {dupeRows.length > 0 && (
                  <button type="button" onClick={() => setShowDupes((v) => !v)} className={cn(card, 'w-full p-3 flex items-center justify-between')}>
                    <p className="text-sm font-semibold text-muted-foreground">{t('import_dup_title').replace('{n}', String(dupeRows.length))}</p>
                    <ChevronLeft size={16} className={cn('text-muted-foreground transition-transform', showDupes ? 'rotate-90' : '-rotate-90')} />
                  </button>
                )}
              </div>

              {showDupes && dupeRows.length > 0 && (
                <div className="space-y-2 opacity-60">
                  {dupeRows.map((r) => (
                    <div key={r.idx} className={cn(card, 'p-3 flex items-center gap-3')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.desc}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{r.dateStr} · {r.dupInFile ? t('import_dup_infile') : t('import_dup_exists')}</p>
                      </div>
                      <p className={cn('text-sm font-semibold tabular-nums', r.type === 'expense' ? 'text-rose-500' : 'text-emerald-500')}>
                        {r.type === 'expense' ? '−' : '+'}{r.amount.toLocaleString()} {r.currency}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* daftar baris (kartu, bukan tabel) */}
              <div className="space-y-2">
                {readyRows.map((r) => {
                  const off = !!excluded[r.idx]
                  return (
                    <div key={r.idx} className={cn(card, 'p-3 flex items-center gap-3', off && 'opacity-40')}>
                      <button
                        type="button"
                        onClick={() => setExcluded((e) => ({ ...e, [r.idx]: !e[r.idx] }))}
                        className={cn('h-6 w-6 rounded-full border flex items-center justify-center shrink-0', off ? 'border-border text-transparent' : 'bg-foreground border-foreground text-background')}
                        aria-label={off ? t('import_include') : t('import_exclude')}
                      ><Check size={14} strokeWidth={3} /></button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.desc}</p>
                        <button type="button" onClick={() => { setPickCatFor(r.idx); setCatSearch('') }}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-background border border-border/60 pl-1 pr-2 py-0.5">
                          <CategoryBadge id={catOf(r)} size="sm" />
                          <span className="text-xs font-medium">{t(`cat_${catOf(r)}`)}</span>
                        </button>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn('text-sm font-bold tabular-nums', r.type === 'expense' ? 'text-foreground' : 'text-foreground')}>
                          {r.type === 'expense' ? '−' : '+'}{r.amount.toLocaleString()} <span className="text-[11px] font-medium text-muted-foreground">{r.currency}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">{r.dateStr}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-border/60 px-4 py-3.5 text-sm font-semibold flex items-center gap-1">
                  <ChevronLeft size={16} /> {t('import_back')}
                </button>
                <PrimaryButton onClick={runImport} disabled={busy || !readyRows.length} className="flex-1" data-testid="import-execute">
                  {busy ? t('import_importing') : t('import_btn').replace('{n}', String(readyRows.length))}
                </PrimaryButton>
              </div>
              {busy && (
                <div>
                  <div className="h-1.5 rounded-full bg-border/60 overflow-hidden">
                    <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1.5 tabular-nums">{progress.done}/{progress.total}</p>
                </div>
              )}
            </div>
          )}

          {/* ============ STEP 3: selesai ============ */}
          {step === 3 && result && (
            <div className="space-y-4 text-center pt-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-lg">{t('import_done_title')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('import_results').replace('{ok}', String(result.ok)).replace('{skip}', String(result.skipped))}</p>
              </div>
              {caps.columns && batchId && (
                <button type="button" onClick={undoImport} disabled={busy}
                  className="w-full rounded-xl border border-border/60 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40">
                  <Undo2 size={16} /> {t('import_undo')}
                </button>
              )}
              <PrimaryButton onClick={close} className="w-full">{t('done')}</PrimaryButton>
            </div>
          )}

          <div className="h-2" />
        </div>
      </Sheet>

      {/* picker kategori */}
      <Sheet open={pickCatFor != null} onClose={() => { setPickCatFor(null); setCatSearch('') }} title={t('select_category')} zIndex={80} noPadding>
        <div className="px-4 pt-2 pb-6">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-xl border border-border/60 bg-background pl-9 pr-3 py-2.5 text-sm outline-none"
            />
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
            {filteredCats.map((c) => {
              const active = pickCatFor != null && catOf(rows.find((r) => r.idx === pickCatFor) || {}) === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCatEdits((e) => ({ ...e, [pickCatFor]: c.id })); setPickCatFor(null); setCatSearch('') }}
                  className="flex flex-col items-center gap-1.5 py-2"
                >
                  <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center border transition-all', active ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-white/10')}>
                    <CategoryBadge id={c.id} size="md" />
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight">{t(`cat_${c.id}`)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Sheet>
    </>
  )
}
