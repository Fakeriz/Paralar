'use client'
import { useMemo } from 'react'
import { CreditCard, Wallet, Banknote, Landmark, Smartphone, BarChart3, Briefcase, GripVertical } from 'lucide-react'
import { getTheme, ACCOUNT_TYPES } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { LogoBadge } from './ui'
import { cn } from '@/lib/utils'

const ICON_MAP = {
  card: CreditCard,
  creditcard: CreditCard,
  wallet: Wallet,
  cash: Banknote,
  banknote: Banknote,
  bankbuilding: Landmark,
  bank: Landmark,
  landmark: Landmark,
  phone: Smartphone,
  smartphone: Smartphone,
  chart: BarChart3,
  barchart3: BarChart3,
  business: Briefcase,
  briefcase: Briefcase,
}

// Deterministic last-4 digits
export function digits4(s) {
  let h = 0
  const str = String(s || 'paralar')
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return String(h % 10000).padStart(4, '0')
}

// Gold EMV Chip standar kartu fisik (Kotak proporsional, tidak melengkung, tidak gepeng)
export function EmvChip({ className = '', isLight = false }) {
  return (
    <div
      className={cn(
        "w-[32px] h-[24px] rounded-[3px] relative overflow-hidden shrink-0 select-none shadow-xs border border-amber-600/60 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600",
        className
      )}
    >
      {/* Garis-garis sirkit microchip EMV */}
      <div className="absolute inset-[1.5px] border border-amber-800/40 rounded-[2px]">
        {/* Kotak kontak inti di tengah */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-2 border border-amber-800/40 rounded-[1px] bg-amber-400/30" />
        {/* Garis horizontal tengah */}
        <div className="absolute top-1/2 inset-x-0 h-px bg-amber-800/35 -translate-y-1/2" />
        {/* Garis vertikal pembagi kiri dan kanan */}
        <div className="absolute inset-y-0 left-[30%] w-px bg-amber-800/35" />
        <div className="absolute inset-y-0 right-[30%] w-px bg-amber-800/35" />
      </div>
    </div>
  )
}

// Contactless / NFC Wave Icon
export function ContactlessWave({ className = '' }) {
  return (
    <svg className={cn('w-4 h-4 shrink-0', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6.5 9a6 6 0 0 1 0 6" opacity="0.65" />
      <path d="M10.5 6a10 10 0 0 1 0 12" opacity="0.85" />
      <path d="M14.5 3a14 14 0 0 1 0 18" />
    </svg>
  )
}

// Network Logo (VISA or Mastercard)
export function NetworkBadge({ network = 'visa', isLight = false, className = '' }) {
  if (network === 'mastercard') {
    return (
      <div className={cn('flex items-center -space-x-2 shrink-0', className)} title="Mastercard">
        <div className="w-5 h-5 rounded-full bg-[#EB001B] shadow-sm" />
        <div className="w-5 h-5 rounded-full bg-[#F79E1B] mix-blend-screen opacity-95 shadow-sm" />
      </div>
    )
  }
  return (
    <span
      className={cn(
        'font-black italic tracking-tighter text-sm shrink-0 font-sans select-none',
        isLight ? 'text-[#09090B] font-black' : 'text-white/95 drop-shadow-sm',
        className
      )}
    >
      VISA
    </span>
  )
}

// SVG Backgrounds for the 6 Physical Motifs (100% Solid background, SVG pattern 10%-25% opacity)
export function CardMotifTexture({ motif = 'parang', isLight = false }) {
  if (motif === 'obsidian') {
    // 1) Obsidian: Solid #0C0C0E with soft top-left surface reflection
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#0C0C0E]">
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white/[0.04] blur-2xl pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-36 h-36 rounded-full bg-white/[0.02] blur-xl pointer-events-none" />
      </div>
    )
  }

  if (motif === 'glacier') {
    // 2) Glacier Frost: Solid #FFFFFF marble texture with 15% opacity veins, text #09090B
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#FFFFFF]">
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 320 200" fill="none" preserveAspectRatio="none">
          <path d="M -10 30 Q 80 40 130 90 T 260 110 T 340 180" stroke="#09090B" strokeWidth="1.2" fill="none" />
          <path d="M 40 -10 Q 90 70 170 80 T 290 140" stroke="#09090B" strokeWidth="1" fill="none" />
          <path d="M 130 90 L 170 140 M 170 80 L 150 40" stroke="#09090B" strokeWidth="0.8" fill="none" />
          <path d="M 210 -10 Q 240 60 300 80" stroke="#09090B" strokeWidth="1" fill="none" />
        </svg>
        <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-slate-200/40 blur-2xl" />
      </div>
    )
  }

  if (motif === 'spider') {
    // 3) Web Hero (Spider): Solid gradient #7F1D1D to #09090B with 15% opacity spiderweb
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-[#7F1D1D] to-[#09090B]">
        <svg className="absolute -top-12 -right-12 w-64 h-64 opacity-15" viewBox="0 0 200 200" fill="none">
          <line x1="200" y1="0" x2="0" y2="20" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="0" y2="70" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="0" y2="130" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="0" y2="200" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="60" y2="200" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="120" y2="200" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="170" y2="200" stroke="#ffffff" strokeWidth="1" />
          <path d="M 170 0 L 150 15 L 140 35 L 145 60 L 165 75 L 190 70 Z" stroke="#ffffff" strokeWidth="0.9" fill="none" />
          <path d="M 140 0 L 110 25 L 95 65 L 105 105 L 140 135 L 180 130 Z" stroke="#ffffff" strokeWidth="0.9" fill="none" />
          <path d="M 100 0 L 60 40 L 40 95 L 60 155 L 110 195 L 160 190 Z" stroke="#ffffff" strokeWidth="0.9" fill="none" />
          <path d="M 60 0 L 10 55 L -10 130 L 15 200" stroke="#ffffff" strokeWidth="0.8" fill="none" />
        </svg>
      </div>
    )
  }

  if (motif === 'kawung') {
    // 4) Batik Kawung: Solid #0C0C0E with 10% opacity 4-petaled symmetric circles
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#0C0C0E]">
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="batik-kawung" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="0" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <circle cx="20" cy="40" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <circle cx="0" cy="20" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <circle cx="40" cy="20" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <rect x="18" y="18" width="4" height="4" transform="rotate(45 20 20)" fill="#ffffff" />
              <circle cx="20" cy="8" r="1.5" fill="#ffffff" />
              <circle cx="20" cy="32" r="1.5" fill="#ffffff" />
              <circle cx="8" cy="20" r="1.5" fill="#ffffff" />
              <circle cx="32" cy="20" r="1.5" fill="#ffffff" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#batik-kawung)" />
        </svg>
      </div>
    )
  }

  if (motif === 'matrix') {
    // 5) Cyber Matrix: Solid #0A0F1D with 20% opacity teal hex grid
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#0A0F1D]">
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cyber-hex" width="30" height="51.96" patternUnits="userSpaceOnUse">
              <path d="M 15 0 L 30 8.66 L 30 25.98 L 15 34.64 L 0 25.98 L 0 8.66 Z" fill="none" stroke="#14b8a6" strokeWidth="1" />
              <path d="M 15 34.64 L 30 43.3 L 30 60.62 L 15 69.28 L 0 60.62 L 0 43.3 Z" fill="none" stroke="#0d9488" strokeWidth="1" />
              <circle cx="15" cy="0" r="1.5" fill="#14b8a6" />
              <circle cx="15" cy="34.64" r="1.5" fill="#2dd4bf" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cyber-hex)" />
        </svg>
      </div>
    )
  }

  // 6) Batik Parang (Default): Solid #121216 with 20% opacity subtle gold diagonal blades
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#121216]">
      <svg className="absolute -inset-4 w-[120%] h-[120%] opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="batik-parang" width="60" height="60" patternTransform="rotate(-40 0 0)" patternUnits="userSpaceOnUse">
            <path d="M 10 0 C 15 15, 30 15, 35 30 C 40 45, 55 45, 60 60" fill="none" stroke="#eab308" strokeWidth="1.5" />
            <path d="M 0 20 C 5 35, 20 35, 25 50" fill="none" stroke="#ca8a04" strokeWidth="1.2" />
            <path d="M 20 0 C 25 15, 40 15, 45 30" fill="none" stroke="#d4af37" strokeWidth="1.2" />
            <circle cx="15" cy="18" r="2.5" fill="#facc15" />
            <circle cx="35" cy="38" r="2.5" fill="#facc15" />
            <path d="M 10 10 Q 18 14 14 22 Q 10 18 10 10 Z" fill="#d4af37" />
            <path d="M 30 30 Q 38 34 34 42 Q 30 38 30 30 Z" fill="#d4af37" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#batik-parang)" />
      </svg>
    </div>
  )
}

/**
 * Standard Bank Physical Card Component
 * Conforms to:
 * - Aspect ratio: w-full aspect-[1.58/1] min-h-[185px] rounded-2xl relative overflow-hidden flex flex-col justify-between
 * - Occlusion Shadow: shadow-[0_-8px_24px_rgba(0,0,0,0.5)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.7)]
 * - Border top: border-t border-white/20 (or border-zinc-300 for Glacier)
 * - Collapsed mode (isCollapsed = true): Only Account Name (top-left) & Bank Logo (top-right) in ~55px header strip.
 */
export function BankCard({
  name,
  balance,
  currency = 'USD',
  theme = 'parang',
  logo = null,
  icon = 'card',
  type = 'bank',
  id = null,
  fmt = null,
  className = '',
  hideBalance = false,
  showNetwork = true,
  rightHeader = null,
  approxHome = null,
  isCollapsed = false,
  showOcclusionShadow = true,
  flat = false,
  onClick = null,
  style = {},
}) {
  const th = getTheme(theme)
  const cur = getCurrency(currency)
  const typeLabel = ACCOUNT_TYPES.find((x) => x.id === type)?.label || 'Account'
  const last4 = digits4(id || name)
  const isCardLight = Boolean(th.isLight || th.id === 'glacier' || theme === 'glacier' || theme === 'white')
  const motif = th.motif || theme || 'parang'

  // Text color palette (Glacier Frost is 100% black #09090B, others crisp white)
  const titleCls = isCardLight ? 'text-[#09090B]' : 'text-white'
  const subCls = isCardLight ? 'text-zinc-600' : 'text-zinc-300'
  const accentCls = isCardLight ? 'text-zinc-700' : 'text-zinc-200'
  const waveCls = isCardLight ? 'text-zinc-700 opacity-80' : 'text-white/80'

  const formattedBalance = useMemo(() => {
    if (hideBalance) return '••••••••'
    if (fmt) return fmt(balance ?? 0, currency)
    return `${cur.symbol} ${Number(balance || 0).toLocaleString()}`
  }, [balance, currency, fmt, hideBalance, cur.symbol])

  // Resolve generic icon fallback when logo is null
  const FallbackIcon = ICON_MAP[icon] || CreditCard

  // Occlusion shadow for physical separation when stacked in Apple Wallet
  const occlusionShadowCls = (!flat && showOcclusionShadow)
    ? 'shadow-[0_-8px_24px_rgba(0,0,0,0.5)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.7)]'
    : 'shadow-none'

  // Top gloss border
  const topBorderCls = isCardLight
    ? 'border-t border-t-zinc-300 border-zinc-200'
    : 'border-t border-t-white/20 border-white/10'

  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'w-full aspect-[1.58/1] min-h-[185px] max-h-[220px] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between shrink-0 select-none transform-gpu will-change-transform',
        th.className,
        topBorderCls,
        occlusionShadowCls,
        className
      )}
    >
      {/* 1) Motif Background Texture (100% Solid background + low opacity SVG pattern) */}
      <CardMotifTexture motif={motif} isLight={isCardLight} />

      {/* 
        2) Collapsed Visibility (Header ~55px):
        Jika isCollapsed === true, HANYA tampilkan Nama Akun (kiri atas) dan Logo/Badge Bank (kanan atas).
        SEMBUNYIKAN nominal saldo, chip EMV, ikon contactless, dan 4 digit nomor kartu.
      */}
      {isCollapsed ? (
        <div className="flex items-center justify-between gap-3 relative z-10 w-full pt-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <p className={cn('font-bold text-base truncate tracking-tight', titleCls)}>
              {name || '—'}
            </p>
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-md shrink-0',
                isCardLight ? 'bg-black/5 text-zinc-700' : 'bg-white/10 text-zinc-300'
              )}
            >
              {typeLabel}
            </span>
          </div>

          <div className="shrink-0">
            {logo ? (
              <LogoBadge logoId={logo} />
            ) : (
              <div
                className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center border shrink-0',
                  isCardLight
                    ? 'bg-zinc-950/5 border-zinc-300 text-zinc-900'
                    : 'bg-white/10 border-white/20 text-white'
                )}
                title="Account Icon"
              >
                <FallbackIcon size={18} strokeWidth={2} />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Full Physical Card view when expanded (isCollapsed === false) */
        <>
          {/* Top Section: Chip EMV + Contactless Wave + Bank/Icon Badge */}
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2.5">
              <EmvChip isLight={isCardLight} />
              <ContactlessWave className={cn('w-4 h-4', waveCls)} />
            </div>

            {rightHeader ? (
              rightHeader
            ) : (
              <div className="shrink-0">
                {logo ? (
                  <LogoBadge logoId={logo} />
                ) : (
                  <div
                    className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center border shrink-0',
                      isCardLight
                        ? 'bg-zinc-950/5 border-zinc-300 text-zinc-900'
                        : 'bg-white/10 border-white/20 text-white'
                    )}
                    title="Account Icon"
                  >
                    <FallbackIcon size={18} strokeWidth={2} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Middle Section: Account Name & Balance */}
          <div className="relative z-10 my-auto py-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className={cn('font-bold text-base truncate max-w-[70%]', titleCls)}>{name || '—'}</p>
              <span className={cn('text-[10px] font-semibold uppercase tracking-[0.14em] shrink-0', subCls)}>
                {typeLabel}
              </span>
            </div>
            <p
              className={cn(
                'text-[22px] sm:text-2xl font-extrabold tabular-nums tracking-tight truncate mt-0.5',
                titleCls
              )}
              title={typeof balance === 'number' ? String(balance) : ''}
            >
              {formattedBalance}
            </p>
            {approxHome ? (
              <p className={cn('text-[11px] font-medium mt-0.5 truncate', subCls)}>
                {hideBalance ? '≈ ••••••' : `≈ ${approxHome}`}
              </p>
            ) : null}
          </div>

          {/* Bottom Section: Masked Number + Currency + Network Logo */}
          <div className="flex items-end justify-between relative z-10 pt-1">
            <div className={cn('flex items-center gap-3 text-xs font-semibold', accentCls)}>
              <span className="font-mono tracking-[0.22em] text-[11px] opacity-90">•••• {last4}</span>
            </div>

            {showNetwork && (
              <NetworkBadge network={th.network || 'visa'} isLight={isCardLight} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
