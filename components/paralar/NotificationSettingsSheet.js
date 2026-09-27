'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, CalendarClock, Wallet, Megaphone, Send, Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SectionLabel } from './ui'
import { cn } from '@/lib/utils'
import {
  isPushSupported,
  getPermissionState,
  enablePush,
  disablePush,
  getPushSettings,
  updatePushSettings,
  sendTestPush,
} from '@/lib/push'

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange?.(!checked) }}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-zinc-950 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700',
        disabled && 'opacity-40'
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white dark:bg-zinc-950 shadow transition-all duration-200',
          checked ? 'left-6' : 'left-1',
          // Kontras knob saat aktif di dark mode
          checked && 'dark:bg-zinc-950',
          !checked && 'dark:bg-zinc-300'
        )}
        style={checked ? { background: '#fff' } : undefined}
      />
    </button>
  )
}

function SettingRow({ icon: Icon, title, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
        <Icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] text-zinc-950 dark:text-white">{title}</p>
        {desc ? <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{desc}</p> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function NotificationSettingsSheet({ open, onClose }) {
  const { t } = useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [supported] = useState(() => isPushSupported())
  const [permission, setPermission] = useState('default')
  const [devices, setDevices] = useState(0)
  const [settings, setSettings] = useState({
    push_enabled: false,
    bill_enabled: true,
    budget_enabled: true,
    announcement_enabled: true,
  })

  useEffect(() => {
    if (!open) return
    setPermission(getPermissionState())
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await getPushSettings()
        if (active && data?.settings) {
          setSettings(data.settings)
          setDevices(data.devices || 0)
          // Sinkronkan: kalau permission granted tapi push_enabled false, biarkan user aktifkan manual
        }
      } catch (e) {
        console.warn('load push settings:', e?.message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [open ])

  const handleMasterToggle = async (next) => {
    if (saving) return
    setSaving(true)
    try {
      if (next) {
        await enablePush()
        setSettings((s) => ({ ...s, push_enabled: true }))
        setPermission('granted')
        const data = await getPushSettings().catch(() => null)
        if (data) setDevices(data.devices || 0)
        toast.success(t('push_enabled_toast') || 'Push notification aktif!')
      } else {
        await disablePush()
        setSettings((s) => ({ ...s, push_enabled: false }))
        toast.success(t('push_disabled_toast') || 'Push notification dimatikan')
      }
    } catch (e) {
      toast.error(e?.message || 'Gagal mengubah pengaturan')
      setPermission(getPermissionState())
    } finally {
      setSaving(false)
    }
  }

  const handleTypeToggle = async (key, next) => {
    if (saving) return
    const prev = settings[key]
    setSettings((s) => ({ ...s, [key]: next }))
    try {
      await updatePushSettings({ [key]: next })
    } catch (e) {
      setSettings((s) => ({ ...s, [key]: prev }))
      toast.error(e?.message || 'Gagal menyimpan')
    }
  }

  const handleTest = async () => {
    if (testing) return
    setTesting(true)
    try {
      const res = await sendTestPush()
      if (res?.sent > 0) {
        toast.success('Notifikasi test dikirim! Cek panel notifikasi HP.')
      } else {
        toast.error('Gagal kirim: ' + (res?.lastError || 'tidak ada device yang menerima'))
      }
    } catch (e) {
      toast.error(e?.message || 'Gagal kirim test')
    } finally {
      setTesting(false)
    }
  }

  const pushOn = settings.push_enabled && permission === 'granted'
  const box = 'rounded-2xl divide-y divide-zinc-200 dark:divide-white/10 border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121214] overflow-hidden'

  return (
    <Sheet open={open} onClose={onClose} title={t('notifications') || 'Notifikasi'}>
      <div className="pt-1 space-y-5 pb-6">
        {!supported ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 flex gap-3">
            <BellOff size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Perangkat/browser ini tidak mendukung push notification.
            </p>
          </div>
        ) : null}

        {permission === 'denied' ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 flex gap-3">
            <BellOff size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">
              Izin notifikasi diblokir. Aktifkan lewat <b>Settings HP → Aplikasi → Paralar → Notifikasi</b>, lalu kembali ke sini.
            </p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            <div>
              <SectionLabel>{t('push_notification') || 'Push Notification'}</SectionLabel>
              <div className={box}>
                <SettingRow
                  icon={pushOn ? Bell : BellOff}
                  title="Notifikasi Perangkat"
                  desc={pushOn ? `Aktif di ${devices} perangkat` : 'Terima notifikasi walau aplikasi tertutup'}
                  checked={pushOn}
                  onChange={handleMasterToggle}
                  disabled={!supported || saving}
                />
              </div>
              {pushOn && devices > 0 ? (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121214] px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white active:scale-[0.98] transition disabled:opacity-50"
                >
                  {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {testing ? 'Mengirim...' : 'Kirim Notifikasi Test'}
                </button>
              ) : null}
            </div>

            <div className={cn(!pushOn && 'opacity-40 pointer-events-none')}>
              <SectionLabel>{t('notification_types') || 'Jenis Notifikasi'}</SectionLabel>
              <div className={box}>
                <SettingRow
                  icon={CalendarClock}
                  title="Tagihan"
                  desc="Pengingat tagihan jatuh tempo & yang terlewat"
                  checked={settings.bill_enabled}
                  onChange={(v) => handleTypeToggle('bill_enabled', v)}
                  disabled={!pushOn}
                />
                <SettingRow
                  icon={Wallet}
                  title="Budget"
                  desc="Peringatan saat budget 85% terpakai & terlampaui"
                  checked={settings.budget_enabled}
                  onChange={(v) => handleTypeToggle('budget_enabled', v)}
                  disabled={!pushOn}
                />
                <SettingRow
                  icon={Megaphone}
                  title="Pengumuman"
                  desc="Info & pengumuman terbaru dari Paralar"
                  checked={settings.announcement_enabled}
                  onChange={(v) => handleTypeToggle('announcement_enabled', v)}
                  disabled={!pushOn}
                />
              </div>
              {!pushOn ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 px-1 flex items-center gap-1.5">
                  <Smartphone size={13} />
                  Aktifkan "Notifikasi Perangkat" dulu untuk mengatur jenis notifikasi.
                </p>
              ) : null}
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500 px-1 leading-relaxed">
              Notifikasi dikirim maksimal 1x per pengingat. Kamu bisa menonaktifkan jenis tertentu tanpa mematikan semuanya.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
