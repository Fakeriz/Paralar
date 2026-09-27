// app/api/push/test/route.js
// Kirim notifikasi test ke device user yang sedang login.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data, status = 200) => NextResponse.json(data, { status })

// Public key di-hardcode (sama persis dengan yang dipakai client untuk subscribe).
// Jangan pakai env var — rawan typo satu huruf yang bikin VAPID auth gagal.
const VAPID_PUBLIC_KEY = 'BLJFYLWaspuB9gzdmzKai492UwIUpP4FIxmf-sqt11j0nH9kai24zu_xXitKfpZ-yS2qZ0LxAUFjYio0Xaac2WQ'

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

// Validasi: private key harus berpasangan dengan public key.
// Kalau tidak cocok, VAPID auth pasti ditolak push service.
function validateKeypair(privB64) {
  try {
    const crypto = require('crypto')
    const privKey = b64urlDecode(privB64)
    if (privKey.length !== 32) return 'private key bukan 32 byte (kemungkinan typo saat copy)'
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.setPrivateKey(privKey)
    const derived = ecdh.getPublicKey()
    const expected = b64urlDecode(VAPID_PUBLIC_KEY)
    if (!derived.equals(expected)) {
      return 'private key TIDAK cocok dengan public key (kemungkinan typo saat copy ke Vercel)'
    }
    return null
  } catch (e) {
    return 'private key tidak valid: ' + e.message
  }
}

function getServerSupabase(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  })
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const priv = process.env.VAPID_PRIVATE_KEY
  if (!priv) return json({ error: 'VAPID private key belum dikonfigurasi di server' }, 500)

  // Validasi keypair sebelum coba kirim (biar error-nya jelas, bukan misterius)
  const keyError = validateKeypair(priv.trim())
  if (keyError) return json({ error: keyError, sent: 0, failed: 0 }, 500)
  const privClean = priv.trim()

  const sb = getServerSupabase(token)
  const { data: authData, error: authError } = await sb.auth.getUser(token)
  const user = authData?.user
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@paralar.app',
    VAPID_PUBLIC_KEY,
    privClean
  )

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs?.length) {
    return json({ error: 'Belum ada device terdaftar. Aktifkan push dulu.' }, 400)
  }

  const payload = JSON.stringify({
    title: 'Paralar',
    body: 'Notifikasi test berhasil! Push notification sudah aktif di perangkat ini.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { action: 'notifications', type: 'test' },
  })

  let ok = 0
  let failed = 0
  let lastError = null
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      ok++
    } catch (e) {
      failed++
      const errorDetail = e.body ? `${e.statusCode}: ${e.body}` : (e.message || String(e))
      lastError = errorDetail
      console.error('[WebPush Test Error]:', {
        statusCode: e.statusCode,
        body: e.body,
        endpoint: sub.endpoint,
      })
      // Hapus yang expired (410 Gone) atau token invalid / registration unauthorized (401 / 404)
      if (e?.statusCode === 410 || e?.statusCode === 404 || e?.statusCode === 401) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return json({ ok: true, sent: ok, failed, devices: subs.length, lastError })
}
