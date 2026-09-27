'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import { useHaptic } from '@/hooks/useHaptic'
import { useApp } from './context'
import {
  Home6Outline,
  Home6Filled,
  TransactionMinusOutline,
  TransactionMinusFilled,
  PlusOutline,
  FlameOutline,
  FlameFilled,
  UserOutline,
  UserFilled,
} from './ReiconIcons'

const ITEMS = [
  {
    id: 'home',
    label: 'Home',
    Outline: Home6Outline,
    Filled: Home6Filled,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    Outline: TransactionMinusOutline,
    Filled: TransactionMinusFilled,
  },
  {
    id: 'add',
    label: 'Add transaction',
    Outline: PlusOutline,
    Filled: PlusOutline,
  },
  {
    id: 'goals',
    label: 'Goals',
    Outline: FlameOutline,
    Filled: FlameFilled,
  },
  {
    id: 'more',
    label: 'Profile',
    Outline: UserOutline,
    Filled: UserFilled,
  },
]

// Bubble indikator: lingkaran raised yang sedikit lebih besar dari tinggi bar,
// "duduk" di atas pil dan meluap ke atas-bawah — ciri khas navbar Muse.
const BUBBLE = 76
const BAR_H = 64

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value))

function isOpen(value) {
  if (!value) return false

  if (typeof value === 'boolean') return value

  if (typeof value === 'string') {
    return !['none', 'closed'].includes(value)
  }

  if (typeof value === 'object') {
    if ('open' in value) return value.open === true
    if ('isOpen' in value) return value.isOpen === true
    if ('visible' in value) return value.visible === true
    if ('status' in value) return value.status === 'open'
  }

  return false
}

export default function BottomNav({
  tab,
  onTab,
  onPlus,
  scrollContainerRef,
  modalOpen,
  onReselect,
}) {
  const app = useApp()
  const { t, open } = app || {}
  const haptic = useHaptic()
  const reduced = useReducedMotion()

  const navRef = useRef(null)
  const trackRef = useRef(null)
  const btnRefs = useRef([])

  const [scrollVisible, setScrollVisible] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [centers, setCenters] = useState([])

  const selected = ITEMS.findIndex(
    item => item.id === tab && item.id !== 'add'
  )

  // Bubble meluncur antar tab dengan pegas snappy — tanpa deformasi,
  // cukup solid & presisi seperti referensi.
  const bubbleTarget = useMotionValue(0)
  const bubbleX = useSpring(bubbleTarget, {
    stiffness: 520,
    damping: 36,
    mass: 0.7,
  })

  const contextOpen = [
    app?.modal,
    app?.activeModal,
    app?.activeSheet,
    app?.sheet,
    app?.currentModal,
    app?.subModal,
    app?.paywallOpen,
    app?.isPaywallOpen,
    ...Object.values(app?.sheets || {}),
  ].some(isOpen)

  const blocked = modalOpen ?? (sheetOpen || contextOpen)
  const visible = !blocked && scrollVisible

  // Ukur titik tengah tiap tab untuk posisi bubble
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const rect = track.getBoundingClientRect()
      setCenters(
        btnRefs.current.map(element => {
          if (!element) return 0
          const r = element.getBoundingClientRect()
          return r.left - rect.left + r.width / 2
        })
      )
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(track)
    window.addEventListener('resize', measure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Pindahkan bubble ke tab aktif
  useEffect(() => {
    const center = centers[selected]
    if (center == null) return

    const target = center - BUBBLE / 2
    bubbleTarget.set(target)
    if (reduced) bubbleX.set(target)
  }, [selected, centers, reduced, bubbleTarget, bubbleX])

  useEffect(() => {
    const read = () => {
      const value = document.body.getAttribute('data-paralar-sheet-open')
      setSheetOpen(value !== null && value !== 'false' && value !== '0')
    }

    const toggle = event => {
      if (typeof event.detail?.open === 'boolean') {
        setSheetOpen(event.detail.open)
      } else {
        read()
      }
    }

    read()

    const observer = new MutationObserver(read)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-paralar-sheet-open'],
    })

    window.addEventListener('paralar-sheet-toggle', toggle)

    return () => {
      observer.disconnect()
      window.removeEventListener('paralar-sheet-toggle', toggle)
    }
  }, [])

  useEffect(() => {
    const container = scrollContainerRef?.current
    const source = container || window

    const readY = () => {
      const max = container
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight

      return clamp(
        container ? container.scrollTop : window.scrollY,
        0,
        Math.max(0, max)
      )
    }

    let last = readY()
    let distance = 0
    let direction = 0
    let frame = 0

    setScrollVisible(true)

    const update = () => {
      frame = 0

      const y = readY()
      const delta = y - last
      last = y

      const keyboardFocus =
        navRef.current?.contains(document.activeElement) &&
        document.activeElement?.matches(':focus-visible')

      if (blocked || keyboardFocus) {
        distance = 0
        return
      }

      if (y <= 30) {
        setScrollVisible(true)
        distance = 0
        return
      }

      if (Math.abs(delta) < 0.5) return

      const nextDirection = Math.sign(delta)
      distance = nextDirection === direction ? distance + Math.abs(delta) : Math.abs(delta)
      direction = nextDirection

      if (direction > 0 && y > 60 && distance >= 24) {
        setScrollVisible(false)
      }

      if (direction < 0 && distance >= 12) {
        setScrollVisible(true)
      }
    }

    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update)
      }
    }

    source.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      source.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [tab, blocked, scrollContainerRef])

  useEffect(() => {
    if (visible) return

    const focused = document.activeElement
    if (navRef.current?.contains(focused)) {
      focused?.blur?.()
    }
  }, [visible])

  function feedback(kind) {
    try {
      if (typeof haptic?.[kind] === 'function') {
        haptic[kind]()
      } else if (typeof navigator !== 'undefined') {
        navigator.vibrate?.(8)
      }
    } catch {}
  }

  function activate(index) {
    if (!visible) return

    const id = ITEMS[index]?.id
    if (!id) return

    feedback(id === 'add' ? 'buttonPress' : 'toggleTab')

    if (id === 'add') {
      if (typeof onPlus === 'function') {
        onPlus()
      } else if (typeof open === 'function') {
        open('quickActions')
      }
    } else if (id === tab) {
      onReselect?.(id)
    } else {
      onTab?.(id)
    }
  }

  const iconLayers = (item, index) => {
    const isActive = selected === index

    return (
      <span
        className={
          isActive
            ? 'relative z-20 block h-[26px] w-[26px] text-zinc-950 dark:text-white'
            : 'relative z-20 block h-[26px] w-[26px] text-zinc-900 dark:text-zinc-200'
        }
        aria-hidden="true"
      >
        <motion.span
          className="absolute inset-0"
          initial={false}
          animate={{
            opacity: isActive ? 0 : 1,
          }}
          transition={{
            duration: reduced ? 0 : 0.15,
          }}
        >
          <item.Outline className="h-full w-full" />
        </motion.span>

        <motion.span
          className="absolute inset-0"
          initial={false}
          animate={{
            opacity: isActive ? 1 : 0,
          }}
          transition={{
            duration: reduced ? 0 : 0.15,
          }}
        >
          <item.Filled className="h-full w-full" />
        </motion.span>
      </span>
    )
  }

  return (
    <motion.nav
      ref={navRef}
      aria-label="Main navigation"
      aria-hidden={!visible}
      initial={false}
      animate={{
        y: visible ? 0 : 80,
        opacity: visible ? 1 : 0,
      }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              type: 'spring',
              stiffness: 450,
              damping: 35,
              mass: 0.5,
            }
      }
      className="fixed inset-x-0 bottom-0 z-50 flex select-none justify-center px-4 pb-[max(14px,env(safe-area-inset-bottom))] pointer-events-none transform-gpu"
    >
      <div
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
        className="relative w-full max-w-[400px]"
        // Ruang napas vertikal agar bubble yang meluap tidak terpotong
        // dan tidak menabrak konten di atasnya.
      >
        {/* Pil kaca */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-x-0 top-1/2 z-0
            overflow-hidden rounded-full
            bg-white/[0.85] dark:bg-[#1c1c1e]/[0.85]
            border border-black/[0.04] dark:border-white/[0.08]
            shadow-[0_12px_36px_rgba(0,0,0,0.12)]
            dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)]
          "
          style={{
            height: BAR_H,
            transform: 'translateY(-50%)',
            backdropFilter: 'blur(28px) saturate(170%)',
            WebkitBackdropFilter: 'blur(28px) saturate(170%)',
          }}
        />

        <div
          ref={trackRef}
          className="relative z-10 flex w-full items-center"
          style={{ height: BUBBLE }}
        >
          {/* Bubble raised — meluap ke atas & bawah pil */}
          <motion.div
            aria-hidden="true"
            className="absolute top-1/2 left-0 z-10"
            style={{
              x: bubbleX,
              y: '-50%',
              width: BUBBLE,
              height: BUBBLE,
            }}
          >
            <div
              className="absolute inset-0 rounded-full bg-white dark:bg-[#2c2c2e]"
              style={{
                boxShadow:
                  '0 10px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.08), inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -4px 8px rgba(0,0,0,0.05)',
              }}
            />
            {/* Tint sejuk samar di dasar bubble */}
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0) 55%, rgba(147,197,253,0.14) 100%)',
              }}
            />
          </motion.div>

          {ITEMS.map((item, index) => (
            <motion.button
              key={item.id}
              ref={element => {
                btnRefs.current[index] = element
              }}
              type="button"
              disabled={!visible}
              tabIndex={visible ? 0 : -1}
              aria-current={item.id === tab ? 'page' : undefined}
              aria-label={t?.(item.id === 'more' ? 'profile' : item.id) || item.label}
              data-testid={item.id === 'add' ? 'fab-add' : `nav-${item.id}`}
              className="
                relative flex h-full min-w-0 flex-1
                cursor-pointer items-center justify-center
                focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-sky-500
              "
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              whileTap={reduced ? undefined : { scale: 0.92 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                mass: 0.6,
              }}
              onClick={() => activate(index)}
            >
              {iconLayers(item, index)}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.nav>
  )
}
