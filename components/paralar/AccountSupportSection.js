'use client'
import { useEffect, useMemo, useState } from 'react'
import { FolderX, LogOut, Trash2, MessageSquareDot, ChevronRight, AlertTriangle, Bug, MessageSquare, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Field, TextInput, Segmented, PrimaryButton } from './ui'
import { cn } from '@/lib/utils'

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rp_${Date.now()}_${Math.random().toString(36).slice(2)}`)
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

function MenuRow({ icon: Icon, label, sub, onClick, danger, testId }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left" data-testid={testId}>
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={cn('w-5 h-5 shrink-0', danger && 'text-rose-500')} strokeWidth={1.75} />
        <div className="min-w-0">
          <p className={cn('font-medium text-[15px]', danger && 'text-rose-500')}>{label}</p>
          {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
    </button>
  )
}

export default function AccountSupportSection() {
  const { t, session, isGuest, store, refresh, signOut, transactions = [], accounts = [] } = useApp()
  const scope = session?.user?.id || 'guest'
  const REPORTS_KEY = `paralar_reports_${scope}`

  // Clear transactions
  const [clearOpen, setClearOpen] = useState(false)
  const [clearScope, setClearScope] = useState('all')
  const [accId, setAccId] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [clearStep, setClearStep] = useState(0)
  const [busy, setBusy] = useState(false)

  // Sign out
  const [signOutOpen, setSignOutOpen] = useState(false)

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  // Reports & support
  const [reportsOpen, setReportsOpen] = useState(false)
  const [reports, setReports] = useState([])
  const [rptCat, setRptCat] = useState('bug')
  const [rptMsg, setRptMsg] = useState('')

  useEffect(() => { if (reportsOpen) setReports(lsGet(REPORTS_KEY, []) || []) }, [reportsOpen]) // eslint-disable-line

  const matched = useMemo(() => {
    const list = transactions || []
    if (clearScope === 'account') return list.filter((tx) => tx?.account_id === accId)
    if (clearScope === 'range') {
      return list.filter((tx) => {
        const d = new Date(tx?.date || tx?.created_at || 0)
        if (isNaN(d.getTime())) return false
        const day = new Date(d).setHours(0, 0, 0, 0)
        if (from) { const f = new Date(from).setHours(0, 0, 0, 0); if (day < f) return false }
        if (to) { const tt = new Date(to).setHours(0, 0, 0, 0); if (day > tt) return false }
        return true
      })
    }
    return list
  }, [transactions, clearScope, accId, from, to])

  const openClear = () => { setClearScope('all'); setAccId((accounts || [])[0]?.id || null); setFrom(''); setTo(''); setClearStep(0); setClearOpen(true) }

  const doClear = async () => {
    setBusy(true)
    try {
      for (const tx of (matched || [])) { try { await store?.deleteTransaction?.(tx.id) } catch {} }
      if (refresh) await refresh()
      toast.success(t('cleared_msg'))
    } catch { toast.error(t('error')) }
    setBusy(false); setClearOpen(false); setClearStep(0)
  }

  const doSignOut = async () => { setSignOutOpen(false); try { await signOut?.() } catch {} }

  const doDelete = async () => {
    if (deleteText.trim().toUpperCase() !== 'DELETE') return
    setBusy(true)
    try {
      for (const tx of (transactions || [])) { try { await store?.deleteTransaction?.(tx.id) } catch {} }
      for (const a of (accounts || [])) { try { await store?.deleteAccount?.(a.id) } catch {} }
      try { const goals = (await store?.listGoals?.()) || []; for (const g of goals) { try { await store?.deleteGoal?.(g.id) } catch {} } } catch {}
      // wipe device-local modules
      ;['paralar_recurring', 'paralar_networth_assets', 'paralar_networth_liabs', `paralar_invoices_${scope}`, `paralar_bills_${scope}`, REPORTS_KEY, 'paralar_business_cfg'].forEach((k) => { try { localStorage.removeItem(k) } catch {} })
    } catch {}
    setBusy(false); setDeleteOpen(false); setDeleteText('')
    toast.success(t('account_deleted'))
    try { await signOut?.() } catch {}
  }

  const submitReport = () => {
    if (!rptMsg.trim()) return
    const row = { id: uid(), category: rptCat, message: rptMsg.trim(), status: 'open', created_at: new Date().toISOString() }
    const next = [row, ...(reports || [])]
    setReports(next); lsSet(REPORTS_KEY, next)
    setRptMsg(''); toast.success(t('report_submitted'))
  }

  const catIcon = { bug: Bug, feedback: MessageSquare, question: HelpCircle }
  const catLabel = { bug: t('report_bug'), feedback: t('report_feedback'), question: t('report_question') }
  const canDelete = deleteText.trim().toUpperCase() === 'DELETE'

  return (
    <>
      {/* ACCOUNT */}
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2 px-1 mt-7">{t('account_section')}</p>
      <div className="rounded-2xl divide-y divide-border/40 border border-border/40 bg-card overflow-hidden">
        <MenuRow icon={FolderX} label={t('clear_tx')} sub={t('clear_tx_sub')} onClick={openClear} testId="acc-clear-tx" />
        <MenuRow icon={LogOut} label={t('sign_out')} sub={t('sign_out_sub')} onClick={() => setSignOutOpen(true)} testId="acc-signout" />
        <MenuRow icon={Trash2} label={t('delete_account')} sub={t('delete_account_sub')} onClick={() => { setDeleteText(''); setDeleteOpen(true) }} danger testId="acc-delete" />
      </div>

      {/* SUPPORT */}
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2 px-1 mt-4">{t('support_section')}</p>
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <MenuRow icon={MessageSquareDot} label={t('reports_support')} sub={t('reports_support_sub')} onClick={() => setReportsOpen(true)} testId="acc-reports" />
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground/60 text-center py-6">Paralar v1.0.0 · Finance app</p>

      {/* Clear Transactions sheet */}
      <Sheet open={clearOpen} onClose={() => { setClearOpen(false); setClearStep(0) }} title={t('clear_tx')}>
        {clearStep === 0 ? (
          <div className="pt-1 space-y-4">
            <Field label={t('filter')}>
              <Segmented value={clearScope} onChange={(v) => setClearScope(v)} options={[{ id: 'all', label: t('clear_scope_all') }, { id: 'range', label: t('clear_scope_range') }, { id: 'account', label: t('clear_scope_account') }]} />
            </Field>
            {clearScope === 'range' ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('from')}><TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="clear-from" /></Field>
                <Field label={t('to')}><TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="clear-to" /></Field>
              </div>
            ) : null}
            {clearScope === 'account' ? (
              <Field label={t('source_account')}>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {(accounts || []).length === 0 ? <p className="text-sm text-muted-foreground">{t('no_account_opt')}</p> : null}
                  {(accounts || []).map((a) => (
                    <button key={a.id} type="button" onClick={() => setAccId(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap', accId === a.id ? 'bg-foreground text-background border-foreground' : 'bg-background border-border/60')}>{a.name}</button>
                  ))}
                </div>
              </Field>
            ) : null}
            <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
              <span className="font-semibold tabular-nums">{(matched || []).length}</span> {t('clear_count_suffix')}
            </div>
            <button type="button" disabled={(matched || []).length === 0} onClick={() => setClearStep(1)} className={cn('w-full rounded-xl bg-rose-500 text-white font-semibold py-3.5 text-[15px]', (matched || []).length === 0 && 'opacity-40')} data-testid="clear-next">{t('clear_now')}</button>
          </div>
        ) : (
          <div className="pt-1">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto"><AlertTriangle size={24} strokeWidth={1.75} /></div>
            <h3 className="text-lg font-bold text-center mt-3">{t('clear_confirm_title')}</h3>
            <p className="text-sm text-muted-foreground text-center mt-1.5 px-4">{t('clear_confirm_body')}</p>
            <div className="mt-5 space-y-2">
              <button type="button" disabled={busy} onClick={doClear} className="w-full rounded-xl bg-rose-500 text-white font-semibold py-3.5 text-[15px] disabled:opacity-50" data-testid="clear-confirm">{t('confirm_again')}</button>
              <button type="button" onClick={() => setClearStep(0)} className="w-full rounded-xl bg-card border border-border/60 font-semibold py-3.5 text-[15px]">{t('cancel')}</button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Sign Out sheet */}
      <Sheet open={signOutOpen} onClose={() => setSignOutOpen(false)} title={t('sign_out')}>
        <div className="pt-1">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto"><LogOut size={22} strokeWidth={1.75} /></div>
          <h3 className="text-lg font-bold text-center mt-3">{t('sign_out_confirm')}</h3>
          <p className="text-sm text-muted-foreground text-center mt-1.5">{t('sign_out_confirm_body')}</p>
          <div className="mt-5 space-y-2">
            <PrimaryButton onClick={doSignOut} data-testid="signout-confirm">{t('sign_out')}</PrimaryButton>
            <button type="button" onClick={() => setSignOutOpen(false)} className="w-full rounded-xl bg-card border border-border/60 font-semibold py-3.5 text-[15px]">{t('cancel')}</button>
          </div>
        </div>
      </Sheet>

      {/* Delete Account sheet */}
      <Sheet open={deleteOpen} onClose={() => { setDeleteOpen(false); setDeleteText('') }} title={t('delete_account')}>
        <div className="pt-1">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto"><AlertTriangle size={24} strokeWidth={1.75} /></div>
          <h3 className="text-lg font-bold text-center mt-3">{t('delete_danger_title')}</h3>
          <p className="text-sm text-muted-foreground text-center mt-1.5 px-2">{t('delete_danger_body')}</p>
          <div className="mt-4">
            <Field label={t('delete_type_hint')}>
              <TextInput value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" autoCapitalize="characters" data-testid="delete-input" />
            </Field>
          </div>
          <div className="mt-5 space-y-2">
            <button type="button" disabled={!canDelete || busy} onClick={doDelete} className={cn('w-full rounded-xl bg-rose-500 text-white font-semibold py-3.5 text-[15px]', (!canDelete || busy) && 'opacity-40')} data-testid="delete-confirm">{t('delete_confirm_btn')}</button>
            <button type="button" onClick={() => { setDeleteOpen(false); setDeleteText('') }} className="w-full rounded-xl bg-card border border-border/60 font-semibold py-3.5 text-[15px]">{t('cancel')}</button>
          </div>
        </div>
      </Sheet>

      {/* Reports & Support sheet */}
      <Sheet open={reportsOpen} onClose={() => setReportsOpen(false)} full title={t('reports_support')}
        left={<button type="button" onClick={() => setReportsOpen(false)} className="text-[15px] font-medium py-1 px-1">{t('done')}</button>}>
        <div className="pt-1 space-y-4">
          <div className="rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-4 space-y-4">
            <Field label={t('report_category')}>
              <Segmented value={rptCat} onChange={setRptCat} options={[{ id: 'bug', label: t('report_bug') }, { id: 'feedback', label: t('report_feedback') }, { id: 'question', label: t('report_question') }]} />
            </Field>
            <Field label={t('report_message')}>
              <textarea value={rptMsg} onChange={(e) => setRptMsg(e.target.value)} rows={4} placeholder={t('report_message_ph')} className="w-full rounded-xl bg-card border border-border/60 dark:border-white/10 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-ring/60 placeholder:text-muted-foreground resize-none" data-testid="report-msg" />
            </Field>
            <PrimaryButton onClick={submitReport} disabled={!rptMsg.trim()} data-testid="report-submit">{t('report_submit')}</PrimaryButton>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2 px-1">{t('your_reports')}</p>
            <div className="space-y-2">
              {(reports || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center mb-3"><MessageSquareDot size={22} className="text-muted-foreground" strokeWidth={1.5} /></div>
                  <p className="font-semibold">{t('report_none')}</p>
                  <p className="text-sm text-muted-foreground mt-1">{t('report_none_sub')}</p>
                </div>
              ) : null}
              {(reports || []).map((r) => {
                const Ic = catIcon[r?.category] || MessageSquare
                return (
                  <div key={r?.id} className="flex items-start gap-3 rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 px-4 py-3.5" data-testid="report-row">
                    <div className="h-9 w-9 rounded-xl bg-background flex items-center justify-center text-foreground shrink-0"><Ic size={16} strokeWidth={1.75} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[14px]">{catLabel[r?.category] || r?.category}</p>
                        <span className="rounded-full border border-border/70 text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">{t('report_status_open')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{r?.message}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="h-6" />
      </Sheet>
    </>
  )
}
