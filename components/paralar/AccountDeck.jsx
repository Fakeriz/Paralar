'use client'

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * AccountDeck — Carousel tumpukan kartu bank ultra-smooth (Framer Motion).
 *
 * Mengapa versi sebelumnya glitch/patah di HP:
 *  1. Kartu peek dipisah di <div> statis dengan CSS transition, sedangkan
 *     kartu aktif di dalam AnimatePresence. Saat index berganti, kartu
 *     di-unmount dari PeekCard dan di-mount ulang di AnimatePresence,
 *     menyebabkan elemen berkedip/hilang sesaat dan melompat dari x=+48px.
 *  2. mode="popLayout" pada AnimatePresence menyebabkan kalkulasi absolut
 *     berbenturan dengan container aspect-ratio pada mobile.
 *
 * Solusi Arsitektur (Unified Continuous Stack):
 *  - Semua kartu di-render dalam satu layer Framer Motion persisten (key tetap).
 *  - Posisi fisik (x, y, scale, opacity, brightness, zIndex) dihitung secara
 *    matematis dari selisih `diff = i - activeIdx`.
 *  - Saat berganti kartu, kartu aktif meluncur mulus ke kiri (x: -108%),
 *    kartu di belakangnya (diff: 1) membesar dari scale 0.94 -> 1.0 dan y: -14px -> 0
 *    tanpa ada unmount/remount sama sekali!
 *  - Transisi spring critically damped (stiffness 300, damping 30) bebas getar,
 *    buttery smooth, dan nyaman dilihat.
 */

const SWIPE_OFFSET = 45 // px minimum drag untuk memicu ganti kartu
const SWIPE_VELOCITY = 220 // px/s kecepatan flick untuk ganti kartu

const SPRING_TRANSITION = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

function getCardConfig(diff) {
  if (diff < 0) {
    // Kartu yang sudah di-swipe ke kiri (history)
    return {
      x: diff === -1 ? '-108%' : '-120%',
      y: 0,
      scale: 0.96,
      opacity: 0,
      brightness: 1,
      zIndex: 25, // Saat kembali dari kiri, meluncur di atas tumpukan
      pointerEvents: 'none',
      cursor: 'default',
    }
  }

  if (diff === 0) {
    // Kartu aktif di paling depan
    return {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      brightness: 1,
      zIndex: 20,
      pointerEvents: 'auto',
      cursor: 'grab',
    }
  }

  if (diff === 1) {
    // Kartu ke-1 di belakang tumpukan (peek 1)
    return {
      x: 0,
      y: -14,
      scale: 0.94,
      opacity: 0.9,
      brightness: 0.92,
      zIndex: 15,
      pointerEvents: 'auto', // Bisa di-tap untuk loncat ke kartu ini
      cursor: 'pointer',
    }
  }

  if (diff === 2) {
    // Kartu ke-2 di belakang tumpukan (peek 2)
    return {
      x: 0,
      y: -26,
      scale: 0.88,
      opacity: 0.65,
      brightness: 0.85,
      zIndex: 10,
      pointerEvents: 'auto',
      cursor: 'pointer',
    }
  }

  if (diff === 3) {
    // Kartu ke-3 di belakang tumpukan (peek 3)
    return {
      x: 0,
      y: -36,
      scale: 0.82,
      opacity: 0.38,
      brightness: 0.78,
      zIndex: 5,
      pointerEvents: 'none',
      cursor: 'default',
    }
  }

  // Kartu jauh di belakang
  return {
    x: 0,
    y: -42,
    scale: 0.78,
    opacity: 0,
    brightness: 0.7,
    zIndex: 1,
    pointerEvents: 'none',
    cursor: 'default',
  }
}

function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {}
}

export default function AccountDeck({
  slides = [],
  index = 0,
  onIndexChange,
  regionLabel = 'Bank Accounts',
  className,
}) {
  const reduceMotion = useReducedMotion()
  const trackRef = useRef(null)
  const total = slides.length

  const [activeIdx, setActiveIdx] = useState(() =>
    Math.max(0, Math.min(index || 0, Math.max(0, total - 1)))
  )
  const [announcement, setAnnouncement] = useState('')

  const goTo = useCallback(
    (next) => {
      const clamped = Math.max(0, Math.min(next, total - 1))
      if (clamped === activeIdx) return
      setActiveIdx(clamped)
      onIndexChange?.(clamped)
      haptic(10)
    },
    [activeIdx, total, onIndexChange]
  )

  const handleDragEnd = useCallback(
    (_, info) => {
      const { offset, velocity } = info
      // Swipe ke kiri -> kartu berikutnya
      if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) {
        if (activeIdx < total - 1) {
          goTo(activeIdx + 1)
          return
        }
      }
      // Swipe ke kanan -> kartu sebelumnya
      else if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) {
        if (activeIdx > 0) {
          goTo(activeIdx - 1)
          return
        }
      }
      // Di bawah threshold: Framer Motion otomatis menganimasikan kembali ke animate={{ x: 0 }}
    },
    [activeIdx, total, goTo]
  )

  // Sinkronisasi index dari kontrol luar (seperti klik dot pagination)
  useEffect(() => {
    const clamped = Math.max(0, Math.min(index ?? 0, Math.max(0, total - 1)))
    if (clamped !== activeIdx) {
      setActiveIdx(clamped)
    }
  }, [index, total, activeIdx])

  // Cegah index overflow bila list akun berubah
  useEffect(() => {
    setActiveIdx((prev) => Math.max(0, Math.min(prev, Math.max(0, total - 1))))
  }, [total])

  // Screen reader announcement
  useEffect(() => {
    const s = slides[activeIdx]
    if (s) setAnnouncement(`Kartu ${activeIdx + 1} dari ${total}: ${s.label}`)
  }, [activeIdx, slides, total])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(activeIdx + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(activeIdx - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(total - 1)
    }
  }

  const transition = useMemo(
    () => (reduceMotion ? { duration: 0 } : SPRING_TRANSITION),
    [reduceMotion]
  )

  return (
    <div className={cn('relative', className)}>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={regionLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-2xl pt-8 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background overflow-hidden"
      >
        {/* Frame deck aspect ratio standar kartu ATM/Bank (1.58 : 1) */}
        <div className="relative aspect-[1.58/1] min-h-[190px] w-full select-none">
          {slides.map((slide, i) => {
            const diff = i - activeIdx
            const isActive = diff === 0
            const isPeek = diff === 1 || diff === 2
            const config = getCardConfig(diff)

            // Optimasi render: kartu yang terlalu jauh di belakang/depan disembunyikan
            if (diff < -2 || diff > 4) {
              return null
            }

            return (
              <motion.div
                key={slide.id}
                initial={false}
                animate={{
                  x: config.x,
                  y: config.y,
                  scale: config.scale,
                  opacity: config.opacity,
                  filter: `brightness(${config.brightness})`,
                }}
                transition={transition}
                drag={isActive && !reduceMotion ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                dragMomentum={false}
                onDragEnd={isActive ? handleDragEnd : undefined}
                style={{
                  zIndex: config.zIndex,
                  touchAction: 'pan-y',
                  transformOrigin: 'bottom center',
                  pointerEvents: config.pointerEvents,
                }}
                className={cn(
                  'absolute inset-0 h-full w-full select-none transform-gpu will-change-transform',
                  isActive && 'cursor-grab active:cursor-grabbing',
                  isPeek && 'cursor-pointer'
                )}
                role="group"
                aria-roledescription="slide"
                aria-label={slide.label}
                aria-hidden={!isActive}
                onClick={isPeek ? () => goTo(i) : undefined}
              >
                <div
                  className={cn(
                    'h-full w-full rounded-2xl transition-shadow duration-300',
                    isActive
                      ? 'shadow-xl shadow-black/20 dark:shadow-black/60'
                      : 'shadow-md shadow-black/10 dark:shadow-black/30'
                  )}
                >
                  {slide.node}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Live region pengumuman screen reader */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
