'use client'

import React, { useRef } from 'react'
import { motion, useMotionValue, useTransform, useReducedMotion, animate } from 'framer-motion'
import { cn } from '@/lib/utils'

const COMMIT_X = 90 // px — jarak geser minimum untuk pindah kartu
const COMMIT_V = 550 // px/s — atau velocity cukup tinggi (flick)
const EXIT_MS = 0.22 // durasi kartu keluar, sinkron dengan pola triage
const SPRING = { type: 'spring', stiffness: 480, damping: 34, mass: 0.9 }
const PEEK_Y = 13 // offset vertikal tiap kartu di belakang
const PEEK_SCALE = 0.05 // susut skala tiap kartu di belakang

function haptic(ms = 8) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms)
  } catch {
    /* abaikan — haptic hanya enhancement */
  }
}

/**
 * AccountDeck — tumpukan kartu akun dengan gesture geser untuk BERPINDAH kartu.
 *
 * Berbeda dengan pola triage (swipe-to-dismiss): di sini swipe MEMUTAR deck,
 * tidak ada kartu yang dibuang. Kartu-kartu di belakang mengintip dari atas
 * sebagai affordance bahwa ada kartu lain di tumpukan.
 *
 * Props:
 * - slides: Array<{ id: string, label: string, node: ReactNode }>
 *   `node` harus mengisi penuh wrapper (w-full h-full); rasio & tinggi
 *   diatur oleh deck agar semua kartu konsisten.
 * - index: posisi kartu aktif (controlled oleh parent)
 * - onIndexChange(i): dipanggil setelah kartu selesai berpindah
 * - regionLabel: aria-label untuk region carousel
 */
export default function AccountDeck({ slides, index, onIndexChange, regionLabel, className }) {
  const reduceMotion = useReducedMotion()
  const trackRef = useRef(null)
  const total = slides.length

  const [visual, setVisual] = React.useState(() => Math.max(0, Math.min(index, total - 1)))
  const [leaving, setLeaving] = React.useState(null) // { step, target } saat kartu sedang keluar
  const [announcement, setAnnouncement] = React.useState('')

  const x = useMotionValue(0)
  const cardOpacity = useMotionValue(1)
  const rotate = useTransform(x, [-280, 280], [-3.5, 3.5])
  const behindX = useTransform(x, (v) => v * 0.05) // parallax halus kartu belakang

  const announce = React.useCallback(
    (i) => {
      const s = slides[i]
      if (s) setAnnouncement(`Kartu ${i + 1} dari ${total}: ${s.label}`)
    },
    [slides, total]
  )

  // Lompatan dari luar (dots / panah / keyboard): potong langsung tanpa animasi palsu.
  // Jangan pernah mengganggu animasi keluar yang sedang berjalan.
  React.useEffect(() => {
    const clamped = Math.max(0, Math.min(index, total - 1))
    if (clamped !== visual && !leaving) {
      setVisual(clamped)
      x.set(0)
      cardOpacity.set(1)
      announce(clamped)
    }
  }, [index, total, visual, leaving, announce, x, cardOpacity])

  const settle = React.useCallback(() => {
    if (reduceMotion) {
      x.set(0)
      return
    }
    animate(x, 0, SPRING)
  }, [reduceMotion, x])

  const commit = React.useCallback(
    (step) => {
      const target = visual + step
      // Di luar batas (kartu pertama/terakhir): pegas kembali, jangan commit.
      if (target < 0 || target >= total || leaving) {
        settle()
        return
      }
      haptic()
      setLeaving({ step, target })
      announce(target)
      const w = trackRef.current?.clientWidth || 320
      const exitX = step > 0 ? -(w + 64) : w + 64
      const dur = reduceMotion ? 0 : EXIT_MS
      animate(x, exitX, { duration: dur, ease: [0.32, 0, 0.67, 0] })
      animate(cardOpacity, 0, {
        duration: dur,
        ease: 'easeIn',
        onComplete: () => {
          onIndexChange(target)
          setVisual(target)
          setLeaving(null)
          x.set(0)
          cardOpacity.set(1)
        },
      })
    },
    [visual, total, leaving, settle, announce, onIndexChange, reduceMotion, x, cardOpacity]
  )

  const onDragEnd = React.useCallback(
    (_, info) => {
      const { offset, velocity } = info
      if (offset.x <= -COMMIT_X || velocity.x <= -COMMIT_V) commit(1) // geser kiri → kartu berikut
      else if (offset.x >= COMMIT_X || velocity.x >= COMMIT_V) commit(-1) // geser kanan → kartu sebelum
      else settle() // di bawah threshold → pegas kembali
    },
    [commit, settle]
  )

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      commit(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      commit(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onIndexChange(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onIndexChange(total - 1)
    }
  }

  const active = slides[visual]

  return (
    <div className={cn('relative', className)}>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={regionLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-2xl pt-7 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Kartu belakang: mengintip dari atas sebagai affordance tumpukan */}
        {[2, 1].map((k) => {
          const s = slides[visual + k]
          if (!s) return null
          return (
            <motion.div
              key={s.id}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-7 h-[calc(100%-1.75rem)]"
              initial={false}
              animate={{ y: -PEEK_Y * k, scale: 1 - PEEK_SCALE * k }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
              style={{ x: behindX, zIndex: 10 - k }}
            >
              {s.node}
            </motion.div>
          )
        })}

        {/* Kartu aktif: satu-satunya yang bisa di-drag horizontal */}
        {active && (
          <motion.div
            key={active.id}
            className="relative aspect-[1.58/1] min-h-[185px] cursor-grab active:cursor-grabbing"
            style={{ x, rotate, opacity: cardOpacity, zIndex: 20, touchAction: 'pan-y' }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${active.label} (${visual + 1} dari ${total})`}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.08}
            onDragEnd={onDragEnd}
          >
            {active.node}
          </motion.div>
        )}
      </div>

      {/* Live region: umumkan kartu aktif ke screen reader */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
