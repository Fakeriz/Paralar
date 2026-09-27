'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Model interaksi disamakan dengan paralar-g (WalletCardDeck) yang terbukti
 * tidak nge-bug di HP Ahmad:
 *
 *  1. Drag = TRIGGER, bukan 1:1 tracking. Kartu cuma "ngeganjel" elastis
 *     (dragElastic 0.2, constraints 0/0) — tidak pernah terbang jauh
 *     mengikuti jari ke seluruh layar.
 *  2. Lepas melewati threshold (40px / 200px/s) -> ganti kartu via
 *     AnimatePresence: kartu lama geser +/-40px + fade + scale 0.98 keluar,
 *     kartu baru masuk dari +/-40px ke posisi diam. 0.25s ease [0.16,1,0.3,1].
 *  3. TANPA rotasi, TANPA fling off-screen, TANPA motion value yang di-share
 *     antar kartu. Kartu peek di belakang STATIS (CSS transition saja).
 *
 * Pelajaran: tiga fix sebelumnya (clamp extrapolasi, easing commit, hapus tilt)
 * menambal gejala pada arsitektur "kartu mengikuti jari 1:1 lalu fling keluar
 * layar" — arsitektur itu sendiri yang rapuh di HP. Versi ini membuang
 * arsitektur tersebut dan memakai pola yang sudah terbukti mulus.
 */

const SWIPE_OFFSET = 40 // px — sama seperti paralar-g
const SWIPE_VELOCITY = 200 // px/s — sama seperti paralar-g
const PEEK_Y = 12 // offset vertikal per kartu di belakang (px)
const PEEK_SCALE = 0.055 // susut skala per kartu di belakang

// Transisi kartu — identik dengan paralar-g
const CARD_TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] }

function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {}
}

/**
 * PeekCard — kartu di belakang tumpukan. STATIS: posisi & opacity murni dari
 * props + CSS transition. Tidak ada motion value, tidak ada transform yang
 * terikat gesture — nol permukaan glitch.
 */
function PeekCard({ slide, diff }) {
  return (
    <div
      key={`peek-${slide.id}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full select-none transition-all duration-300"
      style={{
        transform: `translateY(${-PEEK_Y * diff}px) scale(${1 - PEEK_SCALE * diff})`,
        opacity: diff === 1 ? 0.9 : diff === 2 ? 0.7 : 0.45,
        zIndex: 10 - diff,
      }}
    >
      <div className="h-full w-full rounded-2xl shadow-md overflow-hidden">
        {slide.node}
      </div>
    </div>
  )
}

/**
 * AccountDeck — Carousel tumpukan kartu bank. Gesture swipe = trigger
 * (lihat catatan arsitektur di atas), bukan drag 1:1 full-travel.
 */
export default function AccountDeck({
  slides = [],
  index = 0,
  onIndexChange,
  regionLabel,
  className,
}) {
  const reduceMotion = useReducedMotion()
  const trackRef = useRef(null)
  const total = slides.length

  const [activeIdx, setActiveIdx] = useState(() =>
    Math.max(0, Math.min(index || 0, total - 1))
  )
  const [direction, setDirection] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const goTo = useCallback(
    (next, dir) => {
      const clamped = Math.max(0, Math.min(next, total - 1))
      if (clamped === activeIdx) return
      setDirection(dir)
      setActiveIdx(clamped)
      onIndexChange?.(clamped)
      haptic()
    },
    [activeIdx, total, onIndexChange]
  )

  const handleDragEnd = useCallback(
    (_, info) => {
      const { offset, velocity } = info
      if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) {
        goTo(activeIdx + 1, 1)
      } else if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) {
        goTo(activeIdx - 1, -1)
      }
      // Di bawah threshold: framer otomatis spring-back ke 0
      // (dragConstraints 0/0). Tidak ada kode manual — tidak ada glitch.
    },
    [activeIdx, goTo]
  )

  // Sinkronisasi index dari luar (misal: klik dot navigasi)
  useEffect(() => {
    const clamped = Math.max(0, Math.min(index || 0, total - 1))
    if (clamped !== activeIdx) {
      setDirection(clamped > activeIdx ? 1 : -1)
      setActiveIdx(clamped)
    }
  }, [index, total, activeIdx])

  // Pengumuman pembaca layar
  useEffect(() => {
    const s = slides[activeIdx]
    if (s) setAnnouncement(`Kartu ${activeIdx + 1} dari ${total}: ${s.label}`)
  }, [activeIdx, slides, total])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(activeIdx + 1, 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(activeIdx - 1, -1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(0, -1)
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(total - 1, 1)
    }
  }

  const active = slides[activeIdx]

  return (
    <div className={cn('relative', className)}>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={regionLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-2xl pt-7 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Frame deck dengan aspect ratio standar kartu ATM/Bank (1.58 : 1) */}
        <div className="relative aspect-[1.58/1] min-h-[190px] w-full select-none">
          {/* Kartu di belakang tumpukan (statis, CSS transition) */}
          {[3, 2, 1].map((k) => {
            const slide = slides[activeIdx + k]
            if (!slide) return null
            return <PeekCard key={`peek-${slide.id}`} slide={slide} diff={k} />
          })}

          {/* Kartu aktif: AnimatePresence + drag sebagai trigger */}
          <div className="absolute inset-0 z-20 touch-pan-y">
            <AnimatePresence initial={false} mode="popLayout" custom={direction}>
              {active && (
                <motion.div
                  key={`active-${active.id}`}
                  custom={direction}
                  variants={{
                    enter: (d) => ({ x: d * 40, opacity: 0.85, scale: 0.98 }),
                    center: { x: 0, opacity: 1, scale: 1 },
                    exit: (d) => ({ x: -d * 40, opacity: 0, scale: 0.98 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={reduceMotion ? { duration: 0 } : CARD_TRANSITION}
                  drag={reduceMotion ? false : 'x'}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  dragMomentum={false}
                  onDragEnd={handleDragEnd}
                  className="h-full w-full cursor-grab active:cursor-grabbing"
                  style={{ touchAction: 'pan-y' }}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={active.label}
                >
                  <div className="h-full w-full rounded-2xl shadow-lg">
                    {active.node}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Live region: umumkan kartu aktif ke screen reader */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
