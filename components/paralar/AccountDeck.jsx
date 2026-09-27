'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
} from 'framer-motion'
import { cn } from '@/lib/utils'

const COMMIT_X = 75 // px geser minimum
const COMMIT_V = 450 // px/s flick velocity
const PEEK_Y = 12 // offset vertikal per kartu di belakang (px)
const PEEK_SCALE = 0.055 // susut skala per kartu di belakang
const RISE_PX = 160 // rentang geser untuk kartu belakang naik penuh satu slot

function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {}
}

/**
 * PrevCard — kartu sebelumnya saat ditarik masuk dari kiri.
 * Semua React Hooks ditempatkan tanpa syarat di baris teratas komponen.
 */
function PrevCard({ slide, dragX, trackWidth, reduceMotion }) {
  const x = useTransform(
    dragX,
    [0, Math.max(1, trackWidth * 0.7)],
    [-trackWidth - 40, 0],
    { clamp: true }
  )
  const rotate = useTransform(
    dragX,
    [0, Math.max(1, trackWidth * 0.7)],
    [-5, 0],
    { clamp: true }
  )
  const opacity = useTransform(dragX, [0, 30], [0, 1], { clamp: true })

  return (
    <motion.div
      key={slide.id}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      style={{
        x: reduceMotion ? 0 : x,
        rotate: reduceMotion ? 0 : rotate,
        opacity: reduceMotion ? 1 : opacity,
        y: 0,
        scale: 1,
        zIndex: 30,
      }}
    >
      <div className="h-full w-full rounded-2xl shadow-xl overflow-hidden">
        {slide.node}
      </div>
    </motion.div>
  )
}

/**
 * ActiveCard — kartu aktif terdepan yang dapat di-drag horizontal.
 * Semua React Hooks ditempatkan tanpa syarat di baris teratas komponen.
 */
function ActiveCard({ slide, dragX, isCommitting, reduceMotion, onDragEnd }) {
  // 1:1 mengikuti jari ke dua arah. JANGAN di-damping (mis. v*0.15):
  // kartu cuma gerak 15% dari jari → terasa tersendat/ketinggalan.
  // Pelajaran lama yang sempat tertulis di kode: "dragElastic 0.08 +
  // constraints 0 dulu bikin kartu cuma gerak 8% dari jari".
  const x = dragX
  // clamp:true — tanpa ini, transform berekstrapolasi keluar rentang:
  // swipe kiri bikin kartu AMBLES (+) & MEMBESAR, commit kanan bikin
  // kartu overshoot lalu POP saat handoff. Itu glitch-nya.
  const rotate = useTransform(dragX, [-280, 0], [-5, 0], { clamp: true })
  const y = useTransform(dragX, [0, 160], [0, -PEEK_Y], { clamp: true })
  const scale = useTransform(dragX, [0, 160], [1.0, 1 - PEEK_SCALE], {
    clamp: true,
  })
  const opacity = useTransform(dragX, [0, 160], [1.0, 0.9], { clamp: true })

  return (
    <motion.div
      key={slide.id}
      className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing select-none"
      style={{
        x: reduceMotion ? 0 : x,
        rotate: reduceMotion ? 0 : rotate,
        y: reduceMotion ? 0 : y,
        scale: reduceMotion ? 1 : scale,
        opacity: reduceMotion ? 1 : opacity,
        zIndex: 20,
        touchAction: 'pan-y',
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      dragMomentum={false}
      onDrag={(_, info) => {
        if (!isCommitting) {
          dragX.set(info.offset.x)
        }
      }}
      onDragEnd={onDragEnd}
      role="group"
      aria-roledescription="slide"
      aria-label={slide.label}
    >
      <div className="h-full w-full rounded-2xl shadow-lg">
        {slide.node}
      </div>
    </motion.div>
  )
}

/**
 * PeekCard — satu kartu di belakang tumpukan yang mengintip dari atas.
 * Semua React Hooks ditempatkan tanpa syarat di baris teratas komponen.
 */
function PeekCard({ slide, diff, dragX, reduceMotion }) {
  const baseTargetY = -PEEK_Y * diff
  const risenTargetY = -PEEK_Y * (diff - 1)
  const baseScale = 1 - PEEK_SCALE * diff
  const risenScale = 1 - PEEK_SCALE * (diff - 1)
  const baseOpacity = diff === 1 ? 0.90 : diff === 2 ? 0.70 : 0.45
  const risenOpacity = diff === 1 ? 1.0 : diff === 2 ? 0.90 : 0.70

  const rise = useTransform(dragX, [-RISE_PX, 0], [1, 0], { clamp: true })
  const y = useTransform(rise, [0, 1], [baseTargetY, risenTargetY])
  const scale = useTransform(rise, [0, 1], [baseScale, risenScale])
  const opacity = useTransform(rise, [0, 1], [baseOpacity, risenOpacity])

  return (
    <motion.div
      key={slide.id}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      style={{
        y: reduceMotion ? baseTargetY : y,
        scale: reduceMotion ? baseScale : scale,
        opacity: reduceMotion ? baseOpacity : opacity,
        zIndex: 10 - diff,
      }}
    >
      <div className="h-full w-full rounded-2xl shadow-md overflow-hidden">
        {slide.node}
      </div>
    </motion.div>
  )
}

/**
 * AccountDeck — Carousel tumpukan kartu bank interaktif dengan gesture geser bebas glitch.
 * Mematuhi ketat aturan Rules of Hooks (Zero Tolerance for Error #310).
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

  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, Math.min(index || 0, total - 1)))
  const [trackWidth, setTrackWidth] = useState(360)
  const [isCommitting, setIsCommitting] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const dragX = useMotionValue(0)

  // Ukur lebar deck secara dinamis
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => {
      if (el.clientWidth) setTrackWidth(el.clientWidth)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Sinkronisasi index dari luar (misal: klik dot navigasi)
  useEffect(() => {
    const clamped = Math.max(0, Math.min(index || 0, total - 1))
    if (clamped !== activeIdx) {
      setActiveIdx(clamped)
      dragX.set(0)
    }
  }, [index, total, activeIdx, dragX])

  // Pengumuman pembaca layar
  useEffect(() => {
    const s = slides[activeIdx]
    if (s) setAnnouncement(`Kartu ${activeIdx + 1} dari ${total}: ${s.label}`)
  }, [activeIdx, slides, total])

  const handleDragEnd = useCallback(
    (_, info) => {
      if (isCommitting) return

      const { offset, velocity } = info
      const isSwipeLeft = offset.x <= -COMMIT_X || velocity.x <= -COMMIT_V
      const isSwipeRight = offset.x >= COMMIT_X || velocity.x >= COMMIT_V

      // Geser kiri: buang kartu depan ke kiri dan naikkan kartu berikutnya
      if (isSwipeLeft && activeIdx < total - 1) {
        setIsCommitting(true)
        haptic()
        const targetX = -trackWidth - 60
        animate(dragX, targetX, {
          duration: reduceMotion ? 0 : 0.22,
          ease: [0.22, 1, 0.36, 1],
          onComplete: () => {
            const next = activeIdx + 1
            setActiveIdx(next)
            onIndexChange?.(next)
            dragX.set(0)
            setIsCommitting(false)
          },
        })
        return
      }

      // Geser kanan: tarik kartu sebelumnya masuk dari kiri
      if (isSwipeRight && activeIdx > 0) {
        setIsCommitting(true)
        haptic()
        animate(dragX, trackWidth * 0.7, {
          duration: reduceMotion ? 0 : 0.22,
          ease: [0.22, 1, 0.36, 1],
          onComplete: () => {
            const prev = activeIdx - 1
            setActiveIdx(prev)
            onIndexChange?.(prev)
            dragX.set(0)
            setIsCommitting(false)
          },
        })
        return
      }

      // Jika di bawah batas geser: kembalikan ke posisi semula dengan pegas halus
      if (reduceMotion) {
        dragX.set(0)
      } else {
        animate(dragX, 0, {
          type: 'spring',
          stiffness: 450,
          damping: 32,
          mass: 0.8,
        })
      }
    },
    [activeIdx, total, trackWidth, onIndexChange, reduceMotion, dragX, isCommitting]
  )

  const onKeyDown = (e) => {
    if (isCommitting) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (activeIdx < total - 1) {
        const next = activeIdx + 1
        setActiveIdx(next)
        onIndexChange?.(next)
        haptic()
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (activeIdx > 0) {
        const prev = activeIdx - 1
        setActiveIdx(prev)
        onIndexChange?.(prev)
        haptic()
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveIdx(0)
      onIndexChange?.(0)
      haptic()
    } else if (e.key === 'End') {
      e.preventDefault()
      setActiveIdx(total - 1)
      onIndexChange?.(total - 1)
      haptic()
    }
  }

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
          {/* Kartu sebelumnya (muncul hanya jika ada kartu sebelumnya dan ditarik kanan) */}
          {activeIdx > 0 && slides[activeIdx - 1] && (
            <PrevCard
              key={`prev-${slides[activeIdx - 1].id}`}
              slide={slides[activeIdx - 1]}
              dragX={dragX}
              trackWidth={trackWidth}
              reduceMotion={reduceMotion}
            />
          )}

          {/* Kartu di belakang tumpukan (diff 3, 2, 1) */}
          {[3, 2, 1].map((k) => {
            const slide = slides[activeIdx + k]
            if (!slide) return null
            return (
              <PeekCard
                key={`peek-${slide.id}`}
                slide={slide}
                diff={k}
                dragX={dragX}
                reduceMotion={reduceMotion}
              />
            )
          })}

          {/* Kartu aktif depan */}
          {slides[activeIdx] && (
            <ActiveCard
              key={`active-${slides[activeIdx].id}`}
              slide={slides[activeIdx]}
              dragX={dragX}
              isCommitting={isCommitting}
              reduceMotion={reduceMotion}
              onDragEnd={handleDragEnd}
            />
          )}
        </div>
      </div>

      {/* Live region: umumkan kartu aktif ke screen reader */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
