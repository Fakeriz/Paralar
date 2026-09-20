'use client'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Utensils, ShoppingBasket, Car, ShoppingBag, Receipt, Clapperboard, HeartPulse, GraduationCap, Plane, Home, User,
  Briefcase, Wallet, Laptop, TrendingUp, Gift, ArrowLeftRight, CircleDashed, X, Check,
} from 'lucide-react'
import { getCategory, getLogo } from '@/lib/categories'

const ICONS = { Utensils, ShoppingBasket, Car, ShoppingBag, Receipt, Clapperboard, HeartPulse, GraduationCap, Plane, Home, User, Briefcase, Wallet, Laptop, TrendingUp, Gift, ArrowLeftRight, CircleDashed }

export function CategoryIcon({ id, className, size = 18 }) {
  const cat = getCategory(id)
  const Icon = ICONS[cat?.icon] || CircleDashed
  return <Icon size={size} className={className} strokeWidth={2} />
}

export function CategoryBadge({ id, className, size = 'md' }) {
  const dims = size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
  return (
    <div className={cn('flex items-center justify-center bg-foreground text-background shrink-0', dims, className)}>
      <CategoryIcon id={id} size={size === 'lg' ? 24 : size === 'sm' ? 16 : 18} />
    </div>
  )
}

export function LogoBadge({ logoId, className, size = 'md' }) {
  const logo = getLogo(logoId)
  const dims = size === 'lg' ? 'h-12 w-12 text-sm' : size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-9 w-9 text-[10px]'
  if (!logo) return <div className={cn('rounded-xl bg-white/15 border border-white/20', dims, className)} />
  return (
    <div className={cn('rounded-xl flex items-center justify-center font-extrabold tracking-tight shrink-0', dims, className)} style={{ background: logo.color, color: logo.dark ? '#111' : '#fff' }}>
      {logo.short}
    </div>
  )
}

export function SectionLabel({ children, className }) {
  return <p className={cn('label-upper', className)}>{children}</p>
}

export function Segmented({ options = [], value, onChange, className, size = 'md' }) {
  return (
    <div className={cn('flex bg-muted rounded-xl p-1 gap-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange?.(o.id)}
          className={cn(
            'flex-1 rounded-lg font-semibold transition-all',
            size === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm',
            value === o.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium transition-all',
        active ? 'bg-foreground text-background border-foreground' : 'bg-card border-border/60 text-foreground hover:bg-muted',
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
      className={cn('w-full rounded-xl bg-foreground text-background font-semibold py-3.5 text-[15px] transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100', className)}
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
      className={cn('w-full rounded-xl bg-card border border-border/60 text-foreground font-semibold py-3.5 text-[15px] transition-all active:scale-[0.98]', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className, onClick }) {
  return (
    <div onClick={onClick} className={cn('rounded-2xl bg-card border border-border/40 dark:border-white/5', onClick && 'cursor-pointer active:scale-[0.99] transition-transform', className)}>
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
      className={cn('w-full rounded-xl bg-card border border-border/60 dark:border-white/10 px-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-ring/60 placeholder:text-muted-foreground', className)}
      {...props}
    />
  )
}

export function Avatar({ profile, size = 'md', onClick, className }) {
  const name = profile?.full_name || ''
  const initial = (name.trim()[0] || 'U').toUpperCase()
  const dims = size === 'lg' ? 'h-24 w-24 text-3xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-base'
  return (
    <button type="button" onClick={onClick} className={cn('rounded-full overflow-hidden bg-foreground text-background font-bold flex items-center justify-center shrink-0', dims, className)}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" /> : initial}
    </button>
  )
}

export function CheckIcon({ active }) {
  return active ? <Check size={18} className="text-foreground" strokeWidth={2.5} /> : null
}

// Bottom sheet built on framer-motion (supports stacking)
export function Sheet({ open, onClose, children, title, left, right, full = false, className, zIndex = 50, noPadding = false }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

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
            className={cn(
              'absolute inset-x-0 bottom-0 mx-auto w-full max-w-md bg-background rounded-t-[28px] shadow-2xl flex flex-col border-t border-border/40 dark:border-white/5',
              full ? 'h-[96dvh]' : 'max-h-[92dvh]',
              className
            )}
          >
            <div className="pt-3 pb-1 flex justify-center" onClick={onClose}>
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            {(title || left || right) ? (
              <div className="flex items-center justify-between px-5 py-2 min-h-[44px]">
                <div className="min-w-[64px] flex justify-start">{left}</div>
                <h2 className="text-base font-bold text-center flex-1">{title}</h2>
                <div className="min-w-[64px] flex justify-end">{right}</div>
              </div>
            ) : null}
            <div className={cn('flex-1 overflow-y-auto no-scrollbar safe-bottom', noPadding ? '' : 'px-5 pb-8')}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function SheetTextButton({ children, onClick, bold, muted, className }) {
  return (
    <button type="button" onClick={onClick} className={cn('text-[15px] py-1', bold && 'font-bold', muted && 'text-muted-foreground', className)}>
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, className, ...props }) {
  return (
    <button type="button" onClick={onClick} className={cn('h-10 w-10 rounded-full flex items-center justify-center bg-card border border-border/50 dark:border-white/5 active:scale-95 transition', className)} {...props}>
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

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">{Icon ? <Icon size={26} className="text-muted-foreground" /> : null}</div>
      <p className="font-semibold">{title}</p>
      {subtitle ? <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">{subtitle}</p> : null}
    </div>
  )
}
