// app/api/push/cron/route.js
// Cron harian: cek tagihan/budget/pengumuman per user, kirim web push.
// Dipanggil dengan header Authorization: Bearer <CRON_SECRET>.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { SUPABASE_URL } from '@/lib/supabase'
import { deriveNotifications } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const json = (data, status = 200) => NextResponse.json(data, { status })

function getAdminSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diset')
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

function initWebPush() {
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim()
  if (!priv) throw new Error('VAPID_PRIVATE_KEY belum diset')
  // Public key di-hardcode (sama persis dengan yang dipakai client untuk subscribe).
  // Jangan pakai env var — rawan typo satu huruf yang bikin VAPID auth gagal.
  const VAPID_PUBLIC_KEY = 'BLJFYLWaspuB9gzdmzKai492UwIUpP4FIxmf-sqt11j0nH9kai24zu_xXitKfpZ-yS2qZ0LxAUFjYio0Xaac2WQ'
  // Validasi keypair
  try {
    const crypto = require('crypto')
    const privKey = b64urlDecode(priv)
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(privKey)
    if (!ecdh.getPublicKey().equals(b64urlDecode(VAPID_PUBLIC_KEY))) {
      throw new Error('VAPID private key tidak cocok dengan public key (typo?)')
    }
  } catch (e) {
    throw new Error('VAPID key tidak valid: ' + e.message)
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@paralar.app',
    VAPID_PUBLIC_KEY,
    priv
  )
}

// Format rupiah sederhana untuk push (tanpa dependensi client)
function fmtAmt(amount, currency) {
  const n = Number(amount) || 0
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency || 'IDR',
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `${currency || ''} ${n.toLocaleString('id-ID')}`
  }
}

export async function POST(request) {
  // Verifikasi cron secret
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || token !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let sb
  try {
    sb = getAdminSupabase()
    initWebPush()
  } catch (e) {
    return json({ error: e.message }, 500)
  }

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Ambil semua user yang push-nya aktif
  const { data: settings, error: setErr } = await sb
    .from('notification_settings')
    .select('user_id, bill_enabled, budget_enabled, announcement_enabled')
    .eq('push_enabled', true)

  if (setErr) return json({ error: 'Gagal baca settings: ' + setErr.message }, 500)
  if (!settings?.length) return json({ ok: true, sent: 0, message: 'Tidak ada user dengan push aktif' })

  let sent = 0
  let skipped = 0
  const errors = []

  for (const s of settings) {
    const userId = s.user_id
    try {
      // Ambil subscriptions user
      const { data: subs } = await sb
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId)
      if (!subs?.length) { skipped++; continue }

      // Ambil data user untuk derivasi notifikasi
      const [billsRes, budgetsRes, txRes, profileRes] = await Promise.all([
        sb.from('bills').select('*').eq('user_id', userId),
        sb.from('budgets').select('*').eq('user_id', userId),
        sb.from('transactions').select('type, amount, currency, category, date, transaction_date').eq('user_id', userId),
        sb.from('profiles').select('home_currency').eq('id', userId).maybeSingle(),
      ])

      const bills = billsRes.data || []
      const budgets = budgetsRes.data || []
      const transactions = txRes.data || []
      const home = profileRes.data?.home_currency || 'IDR'

      // Derivasi notifikasi (pakai logic yang sama dengan client)
      const { notifications } = deriveNotifications({
        bills,
        budgets,
        goals: [],
        transactions,
        home,
        rates: {},
        fmt: fmtAmt,
        t: (k) => k,
      })

      // Filter berdasarkan settings per jenis (welcome tidak di-push)
      const wanted = notifications.filter((n) => {
        if (n.type === 'bill') return s.bill_enabled !== false
        if (n.type === 'budget') return s.budget_enabled !== false
        return false
      })

      // Tambah pengumuman baru (dibuat 24 jam terakhir & aktif)
      if (s.announcement_enabled !== false) {
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
        const { data: anns } = await sb
          .from('announcements')
          .select('id, title, content')
          .eq('is_active', true)
          .gte('created_at', yesterday)
        for (const a of anns || []) {
          wanted.push({
            id: `ann-${a.id}`,
            type: 'announcement',
            title: a.title || 'Pengumuman',
            description: (a.content || '').slice(0, 120),
            action: 'notifications',
          })
        }
      }

      if (!wanted.length) { skipped++; continue }

      // Dedup: cek yang sudah dikirim
      const ids = wanted.map((n) => n.id)
      const { data: alreadySent } = await sb
        .from('push_sent')
        .select('notification_id')
        .eq('user_id', userId)
        .in('notification_id', ids)
      const sentIds = new Set((alreadySent || []).map((r) => r.notification_id))
      const fresh = wanted.filter((n) => !sentIds.has(n.id))
      if (!fresh.length) { skipped++; continue }

      // Kirim ke semua device user
      for (const n of fresh) {
        const payload = JSON.stringify({
          title: n.title,
          body: n.description,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          data: { action: n.action || 'notifications', type: n.type },
        })

        const results = await Promise.allSettled(
          subs.map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
          )
        )

        // Hapus subscription yang expired (410 Gone)
        for (let i = 0; i < results.length; i++) {
          const r = results[i]
          if (r.status === 'rejected' && r.reason?.statusCode === 410) {
            await sb.from('push_subscriptions').delete().eq('endpoint', subs[i].endpoint)
          }
        }

        // Catat sebagai terkirim (dedup)
        await sb.from('push_sent').upsert(
          { user_id: userId, notification_id: n.id },
          { onConflict: 'user_id,notification_id' }
        )
        sent++
      }
    } catch (e) {
      errors.push({ userId, error: String(e?.message || e) })
    }
  }

  // Bersihkan push_sent yang lebih dari 60 hari (hemat storage)
  try {
    const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
    await sb.from('push_sent').delete().lt('sent_at', cutoff)
  } catch {}

  return json({ ok: true, sent, skipped, errors: errors.slice(0, 5) })
}

// GET untuk test manual (butuh CRON_SECRET juga)
export async function GET(request) {
  return POST(request)
}
