'use client'

import React, { useRef } from 'react'
import { motion, useMotionValue, useTransform, useReducedMotion, animate } from 'framer-motion'
import { cn } from '@/lib/utils'

const COMMIT_X = 90 // px — jarak geser minimum untuk pindah kartu
const COMMIT_V = 550 // px/s — atau velocity cukup tinggi (flick)
const EXIT_MS = 0.24 // durasi kartu keluar: meluncur halus (easeOut)
const EXIT_EASE = [0.22, 1, 0.36, 1] // glide-out, bukan dihentak
const SPRING = { type: 'spring', stiffness: 480, damping: 34, mass: 0.9 }
const PEEK_Y = 11 // offset vertikal tiap kartu di belakang (rapat agar hero tidak renggang)
const PEEK_SCALE = 0.05 // susut skala tiap kartu di belakang
const RISE_PX = 170 // rentang geser untuk kartu belakang naik penuh satu slot

function haptic(ms = 8) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms)
  } catch {
    /* abaikan — haptic hanya enhancement */
  }
}

/**
 * PeekCard — satu kartu di belakang tumpukan.
 *
 * Naik menyambut saat kartu depan digeser ke kiri: y dan scale didorong oleh
 * motion value `rise` (0 → 1 mengikuti jari), sehingga kartu berikut terasa
 * "datang menemui" alih-alih diam menunggu. Kedalaman `k` disalurkan lewat
 * motion value agar update depth & rise atomik dalam satu frame — tanpa flicker.
 */
function PeekCard({ slide, k, rise, reduceMotion }) {
  const kMv = useMotionValue(k)
  kMv.set(k) // idempoten: nilai sama → tidak memicu notifikasi/render ulang
  const y = useTransform([rise, kMv], ([r, kk]) => -PEEK_Y * kk + PEEK_Y * r)
  const scale = useTransform([rise, kMv], ([r, kk]) => 1 - PEEK_SCALE * kk + PEEK_SCALE * r)
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-6 h-[calc(100%-1.5rem)]"
      // fade-in lembut saat kartu baru masuk ke tumpukan belakang
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.3 }}
      style={{ y, scale, zIndex: 10 - k }}
    >
      {slide.node}
    </motion.div>
  )
}

/**
 * AccountDeck — tumpukan kartu akun dengan gesture geser untuk BERPINDAH kartu.
 *
 * Berbeda dengan pola triage (swipe-to-dismiss): di sini swipe MEMUTAR deck,
 * tidak ada kartu yang dibuang. Kartu-kartu di belakang mengintip dari atas
 * sebagai affordance bahwa ada kartu lain di tumpukan, dan naik menyambut
 * mengikuti jari saat deck digeser — transisi terasa kontinyu.
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
  // rise: 0 saat diam / geser kanan → 1 saat kartu depan digeser kiri penuh.
  // Kartu belakang naik satu slot mengikutinya — transisi terasa kontinyu.
  const rise = useTransform(x, (v) => Math.min(1, Math.max(0, -v / RISE_PX)))
  // 'peek' | 'risen' — dari pose mana kartu baru masuk menjadi kartu depan.
  const enterFromRef = useRef('peek')
  // firstMount: kartu pertama tampil instan, tanpa animasi masuk.
  const firstMount = useRef(true)
  React.useEffect(() => {
    firstMount.current = false
  }, [])

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
      enterFromRef.current = 'peek' // lompatan dots: selalu spring dari pose peek
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
      // Kalau kartu belakang sudah naik mengikuti jari (risen), kartu baru
      // melanjutkan persis dari pose itu — tanpa animasi masuk tambahan.
      // Kalau tidak (keyboard/dots), ia spring dari pose peek seperti biasa.
      enterFromRef.current = step > 0 && rise.get() > 0.12 ? 'risen' : 'peek'
      setLeaving({ step, target })
      announce(target)
      const w = trackRef.current?.clientWidth || 320
      const exitX = step > 0 ? -(w + 64) : w + 64
      const dur = reduceMotion ? 0 : EXIT_MS
      // Keluar meluncur (easeOut): kartu baru sudah menunggu di bawah dalam
      // pose depan, jadi pergantian terasa kontinyu tanpa jeda.
      animate(x, exitX, { duration: dur, ease: EXIT_EASE })
      animate(cardOpacity, 0, {
        duration: dur,
        ease: 'easeOut',
        onComplete: () => {
          onIndexChange(target)
          setVisual(target)
          setLeaving(null)
          x.set(0)
          cardOpacity.set(1)
        },
      })
    },
    [visual, total, leaving, settle, announce, onIndexChange, reduceMotion, x, cardOpacity, rise]
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
        className="relative rounded-2xl pt-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Kartu belakang: mengintip dari atas, naik menyambut saat deck digeser */}
        {[2, 1].map((k) => {
          const s = slides[visual + k]
          if (!s) return null
          return <PeekCard key={s.id} slide={s} k={k} rise={rise} reduceMotion={reduceMotion} />
        })}

        {/* Kartu aktif: satu-satunya yang bisa di-drag horizontal */}
        {active && (
          <motion.div
            // Key dibedakan dari peek agar selalu remount saat jadi kartu depan.
            // 'risen': kartu sudah di pose depan sebagai peek → tampil instan,
            // tanpa animasi (seamless). 'peek': spring dari pose peek.
            key={`front-${active.id}`}
            className="relative aspect-[1.58/1] min-h-[185px] cursor-grab active:cursor-grabbing"
            style={{ x, rotate, opacity: cardOpacity, zIndex: 20, touchAction: 'pan-y' }}
            initial={
              firstMount.current || enterFromRef.current === 'risen'
                ? false
                : { y: -PEEK_Y, scale: 1 - PEEK_SCALE, opacity: 0.92 }
            }
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${active.label} (${visual + 1} dari ${total})`}
            drag="x"
            // 1:1 mengikuti jari dalam batas wajar (±170px, threshold 90px ada di dalam).
            // Di luar batas ada rubber-band lembut, bukan tembok kaku.
            // dragElastic 0.08 + constraints 0 dulu bikin kartu cuma gerak 8% dari
            // jari → terasa tersendat/ketinggalan.
            dragConstraints={{ left: -170, right: 170 }}
            dragElastic={0.35}
            // Tanpa momentum: perilaku saat lepas sepenuhnya dikontrol
            // commit()/settle(), tidak rebutan dengan inertia framer.
            dragMomentum={false}
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
