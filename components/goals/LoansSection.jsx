'use client'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CreditCard,
  Plus,
  ShoppingBag,
  Zap,
  Wallet,
  Building2,
  Smartphone,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import LoanModal from './LoanModal'
import PostpaidPlanModal from './PostpaidPlanModal'

// Provider to Icon mapping helper
function getProviderIcon(item) {
  const provId = item?.provider_id?.toLowerCase() || ''
  const name = (item?.name || item?.title || '').toLowerCase()

  if (provId.includes('spay') || name.includes('spay') || name.includes('shopee')) return ShoppingBag
  if (provId.includes('kredivo') || name.includes('kredivo')) return Zap
  if (provId.includes('gopay') || name.includes('gopay')) return Wallet
  if (provId.includes('akulaku') || name.includes('akulaku')) return Wallet
  if (provId.includes('kta') || name.includes('kta') || name.includes('bca') || name.includes('mandiri') || name.includes('bank')) return Building2
  if (provId.includes('cc') || name.includes('kartu kredit') || name.includes('credit')) return CreditCard
  return CreditCard
}

export default function LoansSection({
  loans = [],
  home = 'IDR',
  accounts = [],
  rates = {},
  store,
  fmt = (amt, curr) => `${curr} ${amt}`,
  t = (k) => k,
  onRefresh,
}) {
  // State for Type Action Sheet (Mengacu image_15.png)
  const [typeActionSheetOpen, setTypeActionSheetOpen] = useState(false)

  // State for Loan/Instalment Modal
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)

  // State for Postpaid Plan Modal
  const [postpaidModalOpen, setPostpaidModalOpen] = useState(false)
  const [selectedPostpaid, setSelectedPostpaid] = useState(null)

  // Calculate total monthly installment
  const totalLoanInstallment = useMemo(() => {
    return (loans || []).reduce((sum, l) => {
      const amt = Number(l?.installment_amount || l?.monthly_payment || l?.amount) || 0
      return sum + amt
    }, 0)
  }, [loans])

  // Subtitle based on currency
  const bnplSubtitle = useMemo(() => {
    if (home === 'IDR') return 'SPayLater, Kredivo, GoPay Later, Cicilan'
    if (home === 'MYR') return 'Atome, Grab PayLater, SPayLater'
    if (home === 'TRY') return 'Taksit, Papara, Kredi'
    return 'PayLater, Installments, Loans'
  }, [home])

  // Open appropriate edit modal
  const handleCardClick = (item) => {
    if (item?.debt_mode === 'postpaid') {
      setSelectedPostpaid(item)
      setPostpaidModalOpen(true)
    } else {
      setSelectedLoan(item)
      setLoanModalOpen(true)
    }
  }

  return (
    <div>
      {/* Header section with (+) button */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          LOANS & BNPL
        </span>
        <div className="flex items-center">
          <span className="text-xs text-muted-foreground mr-3 font-medium">
            {fmt(totalLoanInstallment, home)}/mo
          </span>
          <button
            type="button"
            onClick={() => setTypeActionSheetOpen(true)}
            className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer"
            aria-label="Tambah Pinjaman atau BNPL"
            data-testid="new-loan"
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/80 mb-3 font-normal">
        {bnplSubtitle}
      </p>

      {/* List or Empty State */}
      {(!loans || loans.length === 0) ? (
        <button
          type="button"
          onClick={() => setTypeActionSheetOpen(true)}
          className="w-full min-h-[90px] rounded-2xl border border-dashed border-border/70 py-7 px-4 text-center text-sm font-medium text-muted-foreground hover:border-foreground/40 hover:bg-muted/15 transition-all cursor-pointer flex items-center justify-center"
        >
          + Tambah pinjaman atau cicilan BNPL
        </button>
      ) : (
        <div className="space-y-2.5">
          {loans.map((loan) => {
            // Pemetaan properti yang aman dan kompatibel dengan skema Supabase & modal
            const installmentAmt = Number(
              loan.monthly_installment || 
              loan.installment_amount || 
              loan.monthly_payment || 
              loan.target_amount || 
              loan.amount
            ) || 0

            const isPostpaid = loan.debt_type === 'postpaid' || loan.debt_mode === 'postpaid'
            const tenor = Number(loan.tenure_months || loan.remaining_tenor || loan.tenor_months) || 0
            const totalPrincipal = Number(loan.total_loan_amount || loan.total_amount || loan.target_amount) || 0
            const dueDay = loan.due_day_of_month || loan.due_day || 10
            const Icon = getProviderIcon(loan)

            // Teks Subjudul yang adaptif
            let subtitleText = ''
            if (isPostpaid) {
              subtitleText = `Tagihan Bulanan · Tempo tgl ${dueDay}`
            } else if (tenor > 0) {
              subtitleText = `${tenor} bulan tersisa · Tempo tgl ${dueDay}`
            } else {
              subtitleText = `Tempo tgl ${dueDay}`
            }

            return (
              <div
                key={loan.id}
                onClick={() => handleCardClick(loan)}
                className="rounded-2xl border border-border/40 bg-card p-4 flex items-center justify-between hover:bg-muted/20 transition-all cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-muted/60 text-foreground flex items-center justify-center shrink-0 border border-border/20">
                    <Icon size={18} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-foreground/90">
                      {loan.title || loan.name || loan.provider_name || 'Pinjaman'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {subtitleText}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    {fmt(installmentAmt, loan.currency || home)}
                    <span className="text-[11px] font-normal text-muted-foreground">/mo</span>
                  </p>
                  {totalPrincipal > 0 && !isPostpaid && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      Pokok: {fmt(totalPrincipal, loan.currency || home)}
                    </p>
                  )}
                  {isPostpaid && Number(loan.credit_limit) > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      Limit: {fmt(Number(loan.credit_limit), loan.currency || home)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. DIALOG AKSI PEMILIH JENIS UTANG (TYPE ACTION SHEET) */}
      {/* Mengacu image_15.png: Action Sheet / Modal dengan backdrop gelap */}
      {/* ============================================================ */}
      <AnimatePresence>
        {typeActionSheetOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => setTypeActionSheetOpen(false)}
            />

            {/* Modal Bottom Sheet Shell */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative z-10 w-full max-w-sm sm:max-w-md bg-card border border-border/40 rounded-t-3xl sm:rounded-3xl p-5 pt-3 shadow-2xl"
            >
              {/* Drag Handle Bar */}
              <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-4" />

              {/* Judul kecil atas */}
              <div className="text-center mb-4">
                <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  TAMBAH PINJAMAN / BNPL
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  Pilih Format Penagihan
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {/* Tombol Pilihan 1: Pinjaman atau Cicilan BNPL */}
                <button
                  type="button"
                  onClick={() => {
                    setTypeActionSheetOpen(false)
                    setSelectedLoan(null)
                    setLoanModalOpen(true)
                  }}
                  className="w-full p-4 rounded-2xl bg-muted/40 hover:bg-muted/70 active:scale-[0.99] border border-border/40 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
                      <CreditCard size={20} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Pinjaman atau Cicilan BNPL
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cicilan tenor 3–36 bln, KTA, Kartu Kredit, atau PayLater
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>

                {/* Tombol Pilihan 2: Tagihan Bulanan PayLater (SPayLater, GoPay Later, dll.) */}
                <button
                  type="button"
                  onClick={() => {
                    setTypeActionSheetOpen(false)
                    setSelectedPostpaid(null)
                    setPostpaidModalOpen(true)
                  }}
                  className="w-full p-4 rounded-2xl bg-muted/40 hover:bg-muted/70 active:scale-[0.99] border border-border/40 text-left transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0">
                      <ShoppingBag size={20} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Tagihan Bulanan PayLater
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        SPayLater, GoPay Later, Kredivo 30 hari tanpa tenor tetap
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>

                {/* Tombol Pilihan 3: Batal (Cancel) */}
                <button
                  type="button"
                  onClick={() => setTypeActionSheetOpen(false)}
                  className="w-full py-3.5 rounded-2xl text-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer mt-1"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* 2. MODAL CICILAN & PINJAMAN (LOAN MODAL) */}
      {/* ============================================================ */}
      <LoanModal
        open={loanModalOpen}
        onClose={() => {
          setLoanModalOpen(false)
          setSelectedLoan(null)
        }}
        loan={selectedLoan}
        onSaved={async () => {
          await onRefresh?.()
          setLoanModalOpen(false)
          setSelectedLoan(null)
        }}
        onDeleted={async () => {
          setSelectedLoan(null)
          setLoanModalOpen(false)
          await onRefresh?.()
        }}
        home={home}
        accounts={accounts}
        store={store}
        t={t}
      />

      {/* ============================================================ */}
      {/* 3. MODAL TAGIHAN BULANAN PAYLATER (POSTPAID PLAN MODAL) */}
      {/* ============================================================ */}
      <PostpaidPlanModal
        open={postpaidModalOpen}
        onClose={() => {
          setPostpaidModalOpen(false)
          setSelectedPostpaid(null)
        }}
        plan={selectedPostpaid}
        onSaved={async () => {
          await onRefresh?.()
          setPostpaidModalOpen(false)
          setSelectedPostpaid(null)
        }}
        onDeleted={async () => {
          setSelectedPostpaid(null)
         setPostpaidModalOpen(false)
          await onRefresh?.()
          }}
        home={home}
        store={store}
        t={t}
      />
    </div>
  )
}
