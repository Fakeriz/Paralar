'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
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

// Diameter bubble lensa indikator aktif
const BUBBLE = 56

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

  // Bubble mengikuti target dengan pegas — overshoot halus ala cairan
  const bubbleTarget = useMotionValue(0)
  const bubbleX = useSpring(bubbleTarget, {
    stiffness: 420,
    damping: 32,
    mass: 0.7,
  })

  // Stretch & chromatic fringe diturunkan dari velocity bubble:
  // makin cepat bergerak → makin melar + fringe makin kuat,
  // otomatis kembali ke 1 saat settle. Murni transform/opacity.
  const velocity = useVelocity(bubbleX)
  const stretchX = useTransform(velocity, v =>
    reduced ? 1 : 1 + Math.min(Math.abs(v) / 4500, 0.38)
  )
  const squashY = useTransform(stretchX, s => 1 - (s - 1) * 0.55)
  const fringe = useTransform(velocity, v =>
    reduced ? 0 : Math.min(Math.abs(v) / 2200, 0.85)
  )

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
            ? 'relative z-10 block h-[26px] w-[26px] text-zinc-950 dark:text-white'
            : 'relative z-10 block h-[26px] w-[26px] text-zinc-800 dark:text-zinc-300'
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
      className="fixed inset-x-0 bottom-0 z-50 flex select-none justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none transform-gpu"
    >
      <div
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
        className="relative h-[64px] w-full max-w-[400px] rounded-full"
      >
        {/* Kaca bar */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-0
            overflow-hidden rounded-full
            bg-white/[0.6] dark:bg-[#1c1c1e]/[0.7]
            border border-black/[0.06] dark:border-white/[0.08]
            shadow-[0_8px_28px_rgba(0,0,0,0.10)]
            dark:shadow-[0_10px_32px_rgba(0,0,0,0.55)]
          "
          style={{
            backdropFilter: 'blur(36px) saturate(180%)',
            WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          }}
        >
          <div
            className="absolute inset-x-[16%] top-0 h-px opacity-40 dark:opacity-25"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)',
            }}
          />
        </div>

        <div ref={trackRef} className="relative z-10 flex h-full w-full">
          {/* Bubble lensa cair — melar mengikuti velocity, fringe pelangi
              hanya muncul saat bergerak */}
          <motion.div
            aria-hidden="true"
            className="absolute top-1/2 left-0 z-0"
            style={{
              x: bubbleX,
              y: '-50%',
              width: BUBBLE,
              height: BUBBLE,
              scaleX: stretchX,
              scaleY: squashY,
            }}
          >
            <div
              className="
                absolute inset-0 rounded-full
                bg-white/[0.45] dark:bg-white/[0.14]
                border border-white/[0.6] dark:border-white/[0.22]
              "
              style={{
                boxShadow:
                  'inset 0 2px 4px rgba(255,255,255,0.55), inset 0 -3px 6px rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.10)',
                backdropFilter: 'blur(12px) saturate(160%)',
                WebkitBackdropFilter: 'blur(12px) saturate(160%)',
              }}
            />
            <motion.div
              aria-hidden="true"
              className="absolute -inset-[3px] rounded-full"
              style={{
                opacity: fringe,
                boxShadow:
                  'inset 3px 0 4px -2px rgba(34,211,238,0.9), inset -3px 0 4px -2px rgba(251,191,36,0.9)',
              }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-3 bottom-1 h-3 rounded-full bg-amber-300/[0.85] dark:bg-amber-300/[0.7]"
              style={{ filter: 'blur(6px)' }}
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
                cursor-pointer items-center justify-center rounded-full
                focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-sky-500
              "
              style={{
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
              }}
              whileTap={reduced ? undefined : { scale: 0.9 }}
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
