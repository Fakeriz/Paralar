// app/api/push/test/route.js
// Kirim notifikasi test ke device user yang sedang login.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data, status = 200) => NextResponse.json(data, { status })

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

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!priv) return json({ error: 'VAPID private key belum dikonfigurasi di server' }, 500)
  // Public key di-hardcode (sama persis dengan yang dipakai client untuk subscribe).
  // Jangan pakai env var — rawan typo satu huruf yang bikin VAPID auth gagal.
  const VAPID_PUBLIC_KEY = 'BLJFYLWaspuB9gzdmzKai492UwIUpP4FIxmf-sqt11j0nH9kai24zu_xXitKfpZ-yS2qZ0LxAUFjYio0Xaac2WQ'

  const sb = getServerSupabase(token)
  const { data: authData, error: authError } = await sb.auth.getUser(token)
  const user = authData?.user
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@paralar.app',
    VAPID_PUBLIC_KEY,
    priv
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
      lastError = e?.message || String(e)
      // Hapus yang expired
      if (e?.statusCode === 410) {
        await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }

  return json({ ok: true, sent: ok, failed, devices: subs.length, lastError })
}
