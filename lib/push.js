// lib/push.js
// Helper client-side untuk Web Push Notification.
import { supabase } from './supabase'

// VAPID public key (public, aman di-hardcode).
// PENTING: pakai hardcoded langsung — env var rawan typo satu huruf yang
// bikin key tidak valid secara kriptografi (pernah kejadian: Y vs U).
const VAPID_PUBLIC_KEY = 'BLJFYLWaspuB9gzdmzKai492UwIUpP4FIxmf-sqt11j0nH9kai24zu_xXitKfpZ-yS2qZ0LxAUFjYio0Xaac2WQ'

function isValidVapidKey(key) {
  if (!key || typeof key !== 'string') return false
  const clean = key.trim()
  // VAPID public key: base64url 87 chars -> 65 bytes (uncompressed P-256)
  if (clean.length !== 87) return false
  try {
    const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
    const bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return bin.length === 65 && bin.charCodeAt(0) === 0x04
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getPermissionState() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

async function apiFetch(path, method, body) {
  const token = await getToken()
  if (!token) throw new Error('Belum login')
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Gagal')
  return data
}

// Minta izin + subscribe ke push manager + simpan ke server
export async function enablePush() {
  if (!isPushSupported()) throw new Error('Perangkat tidak mendukung push notification')
  if (!isValidVapidKey(VAPID_PUBLIC_KEY)) {
    throw new Error('Konfigurasi push bermasalah (VAPID key tidak valid). Coba lagi nanti.')
  }

  // 1. Minta izin
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Izin notifikasi diblokir. Aktifkan lewat Settings HP > Aplikasi > Paralar > Notifikasi.'
        : 'Izin notifikasi belum diberikan'
    )
  }

  // 2. Pastikan SW terdaftar
  const reg = await navigator.serviceWorker.ready

  // 3. Subscribe
  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // 4. Kirim ke server
  const subJson = subscription.toJSON()
  await apiFetch('/api/push/subscribe', 'POST', {
    endpoint: subJson.endpoint,
    keys: subJson.keys,
    userAgent: navigator.userAgent,
  })

  // 5. Tandai push aktif di settings
  await apiFetch('/api/push/settings', 'PUT', { push_enabled: true })

  return subscription
}

// Unsubscribe: hapus dari push manager + server
export async function disablePush() {
  const token = await getToken()
  if (!token) throw new Error('Belum login')

  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      // Hapus dari server
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {})
    }
  } catch {}

  await apiFetch('/api/push/settings', 'PUT', { push_enabled: false })
}

export async function getPushSettings() {
  return apiFetch('/api/push/settings', 'GET')
}

export async function updatePushSettings(patch) {
  return apiFetch('/api/push/settings', 'PUT', patch)
}

// Kirim notifikasi test (untuk memastikan push berfungsi)
export async function sendTestPush() {
  const token = await getToken()
  if (!token) throw new Error('Belum login')
  // Pakai endpoint cron dengan header test
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Gagal kirim test')
  return data
}
