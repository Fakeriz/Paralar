// lib/push.js
// Helper client-side untuk Web Push Notification.
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

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
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID key belum dikonfigurasi')

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
