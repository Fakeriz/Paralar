'use client'
import { Bell } from 'lucide-react'
import { useApp } from './context'
import { Sheet, EmptyState } from './ui'

export default function NotificationsSheet({ open, onClose }) {
  const { t } = useApp()
  return (
    <Sheet open={open} onClose={onClose} title={t('notifications')}>
      <EmptyState icon={Bell} title={t('no_notifications')} />
    </Sheet>
  )
}
