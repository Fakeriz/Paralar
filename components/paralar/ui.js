'use client'
import { useEffect, Component } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useApp } from './context'
import {
  Utensils, ShoppingBasket, Car, ShoppingBag, Receipt, Clapperboard, HeartPulse, GraduationCap, Plane, Home, User,
  Briefcase, Wallet, Laptop, TrendingUp, Gift, ArrowLeftRight, CircleDashed, X, Check,
  CreditCard, Banknote, Landmark, Smartphone, BarChart3, Vault, PiggyBank, Bitcoin,
} from 'lucide-react'
import { getCategory, getLogo } from '@/lib/categories'

const ICONS = { Utensils, ShoppingBasket, Car, ShoppingBag, Receipt, Clapperboard, HeartPulse, GraduationCap, Plane, Home, User, Briefcase, Wallet, Laptop, TrendingUp, Gift, ArrowLeftRight, CircleDashed }

// Icons usable by outline bank/e-wallet logos and account icons.
export const LOGO_ICONS = { CreditCard, Banknote, Landmark, Smartphone, BarChart3, Vault, PiggyBank, Bitcoin, Wallet, TrendingUp, Briefcase }

export function CategoryIcon({ id, className, size = 18 }) {
  const cat = getCategory(id)
  const Icon = ICONS[cat?.icon] || CircleDashed
  return <Icon size={size} className={className} strokeWidth={2} />
}

export function CategoryBadge({ id, className, size = 'md' }) {
  const dims = size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
  return (
    <div className={cn('flex items-center justify-center bg-[#0c0c0e] text-white dark:bg-white dark:text-[#0c0c0e] shrink-0', dims, className)}>
      <CategoryIcon id={id} size={size === 'lg' ? 24 : size === 'sm' ? 16 : 18} />
    </div>
  )
}

export function LogoBadge({ logoId, className, size = 'md' }) {
  const logo = getLogo(logoId)
  const dims = size === 'lg' ? 'h-12 w-12 text-sm' : size === 'bank' ? 'w-12 h-12 text-[11px]' : size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-9 w-9 text-[10px]'
  const iconSize = size === 'lg' ? 22 : size === 'bank' ? 20 : size === 'sm' ? 14 : 18
  if (!logo) return <div className={cn('rounded-xl bg-muted/60 dark:bg-white/10 border border-border/60 shrink-0', dims, className)} />
  if (logo.outline) {
    const Icon = LOGO_ICONS[logo.icon] || Wallet
    return (
      <div className={cn('rounded-xl flex items-center justify-center border border-current text-current shrink-0', dims, className)}>
        <Icon size={iconSize} strokeWidth={1.5} />
      </div>
    )
  }
  return (
    <div className={cn('rounded-xl flex items-center justify-center font-extrabold tracking-tight shrink-0 select-none shadow-xs', dims, className)} style={{ background: logo.color, color: logo.dark ? '#111' : '#fff' }}>
      {logo.short}
    </div>
  )
}

export function SectionLabel({ children, className }) {
  return <p className={cn('text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground', className)}>{children}</p>
}

export function Segmented({ options = [], value, onChange, className, size = 'md' }) {
  return (
    <div className={cn('flex bg-muted/70 dark:bg-[#121214] border border-border/50 rounded-2xl p-1 gap-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange?.(o.id)}
          className={cn(
            'flex-1 rounded-xl transition-all cursor-pointer',
            size === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm',
            value === o.id
              ? 'bg-[#0c0c0e] text-white dark:bg-white dark:text-[#0c0c0e] font-bold shadow-xs'
              : 'text-muted-foreground hover:text-foreground font-semibold'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Pill({ active, children, onClick, className, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm transition-all cursor-pointer',
        active
          ? 'bg-[#0c0c0e] text-white border-[#0c0c0e] dark:bg-white dark:text-[#0c0c0e] dark:border-white font-bold shadow-xs'
          : 'bg-white dark:bg-[#121214] border-border/60 text-foreground font-medium hover:bg-muted/40',
        className
      )}
    >
      {Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  )
}

export function PrimaryButton({ children, className, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'w-full rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-[#0c0c0e] font-bold py-3.5 text-[15px] transition-all shadow-md shadow-black/15 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn('w-full rounded-2xl bg-white dark:bg-[#121214] border border-border/80 text-foreground hover:bg-muted/40 font-semibold py-3.5 text-[15px] transition-all active:scale-[0.98]', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className, onClick }) {
  return (
    <div onClick={onClick} className={cn('rounded-2xl bg-white dark:bg-[#121214] border border-border/60 shadow-xs', onClick && 'cursor-pointer active:scale-[0.99] transition-transform', className)}>
      {children}
    </div>
  )
}

export function Field({ label, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </div>
  )
}

export function TextInput({ className, ...props }) {
  return (
    <input
      className={cn('w-full rounded-2xl bg-[#F6F6F6] dark:bg-[#121214] border border-border/70 text-foreground placeholder:text-muted-foreground/60 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-foreground/15 focus:border-foreground transition-all', className)}
      {...props}
    />
  )
}

export function Avatar({ profile, size = 'md', onClick, className }) {
  const name = profile?.full_name || ''
  const initial = (name.trim()[0] || 'U').toUpperCase()
  const dims = size === 'lg' ? 'h-24 w-24 text-3xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-base'
  return (
    <button type="button" onClick={onClick} className={cn('rounded-full overflow-hidden bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold flex items-center justify-center shrink-0', dims, className)}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" /> : initial}
    </button>
  )
}

export function CheckIcon({ active }) {
  return active ? <Check size={18} className="text-foreground" strokeWidth={2.5} /> : null
}

// Bottom sheet built on framer-motion (supports stacking, swipe-to-dismiss, standardized header)
export function Sheet({ open, onClose, children, title, left, right, full = false, className, zIndex = 70, noPadding = false }) {
  const app = useApp()
  const cancelText = app?.t ? app.t('cancel') : 'Cancel'
  const controls = useDragControls()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const startDrag = (e) => { try { controls.start(e) } catch { /* ignore */ } }
  const onDragEnd = (_e, info) => { if ((info?.offset?.y || 0) > 90 || (info?.velocity?.y || 0) > 500) onClose?.() }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0" style={{ zIndex }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={onDragEnd}
            className={cn(
              'absolute inset-x-0 bottom-0 mx-auto w-full max-w-md bg-white dark:bg-[#121214] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t border-border/50 max-h-[90vh]',
              full && 'h-[90vh]',
              className
            )}
          >
            {/* Drag handle + sticky header */}
            <div className="shrink-0">
              <div onPointerDown={startDrag} className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto my-2.5 cursor-grab active:cursor-grabbing touch-none" />
              <div className="flex items-center justify-between px-5 pb-2 min-h-[40px] gap-2">
                <div className="min-w-[72px] flex justify-start">
                  {left !== undefined ? left : (
                    <button type="button" onClick={onClose} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">{cancelText}</button>
                  )}
                </div>
                <h2 onPointerDown={startDrag} className="text-base font-bold text-foreground text-center flex-1 truncate cursor-grab active:cursor-grabbing">{title}</h2>
                <div className="min-w-[72px] flex justify-end">{right}</div>
              </div>
            </div>
            <div className={cn('flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar safe-bottom', noPadding ? '' : 'px-5 pb-8')}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function SheetTextButton({ children, onClick, bold, muted, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-[15px] py-1 transition-colors cursor-pointer',
        bold && 'font-bold text-foreground hover:opacity-80',
        muted && 'font-medium text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, className, ...props }) {
  return (
    <button type="button" onClick={onClick} className={cn('h-10 w-10 rounded-full flex items-center justify-center bg-white dark:bg-[#121214] border border-border/70 text-foreground shadow-xs active:scale-95 transition cursor-pointer', className)} {...props}>
      {children}
    </button>
  )
}

export function CloseButton({ onClick }) {
  return (
    <IconButton onClick={onClick} aria-label="close">
      <X size={18} />
    </IconButton>
  )
}

// Local React Error Boundary — prevents a single bad tab from crashing the whole app.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundary caught:', error?.message, info?.componentStack)
  }
  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') return this.props.fallback(() => this.setState({ hasError: false }))
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-2xl bg-white dark:bg-[#121214] border border-border/60 shadow-xs flex items-center justify-center mb-4">{Icon ? <Icon size={26} className="text-foreground" /> : null}</div>
      <p className="font-bold text-foreground">{title}</p>
      {subtitle ? <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">{subtitle}</p> : null}
    </div>
  )
}
