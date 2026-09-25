'use client'

import { useState } from 'react'
import { Eye, HardDrive, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function getDriveThumbnailUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (url.includes('drive.google.com')) {
    // Extract fileId from /file/d/{fileId}/view or ?id={fileId}
    const matchD = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (matchD?.[1]) {
      return `https://drive.google.com/thumbnail?id=${matchD[1]}&sz=w800`
    }
    const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (matchId?.[1]) {
      return `https://drive.google.com/thumbnail?id=${matchId[1]}&sz=w800`
    }
  }
  return url
}

export default function ReceiptPreviewWithDrive({
  receiptUrl,
  storageProvider,
  merchantName,
  onOpenFullImage,
}) {
  const [imgError, setImgError] = useState(false)

  if (!receiptUrl) return null

  const isGoogleDrive =
    storageProvider === 'google_drive' ||
    (typeof receiptUrl === 'string' && receiptUrl.includes('drive.google.com'))

  const displayImageSrc = getDriveThumbnailUrl(receiptUrl)

  const handleEyeClick = (e) => {
    e.stopPropagation()
    if (onOpenFullImage) {
      onOpenFullImage(receiptUrl)
    } else if (typeof window !== 'undefined') {
      window.open(receiptUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="w-full space-y-3 mt-4" data-testid="receipt-preview-unified">
      {/* BAGIAN ATAS: Pratinjau Gambar */}
      <div className="relative w-full h-56 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 overflow-hidden flex items-center justify-center">
        {!imgError ? (
          <img
            src={displayImageSrc}
            alt={merchantName ? `Struk ${merchantName}` : 'Receipt preview'}
            className="w-full h-full object-contain p-2"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
            <ImageIcon size={32} strokeWidth={1.5} />
            <span className="text-xs font-medium">
              {isGoogleDrive ? 'Tersimpan di Google Drive' : 'Pratinjau struk'}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleEyeClick}
          aria-label="Lihat gambar penuh"
          className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-black/75 hover:bg-black text-white flex items-center justify-center backdrop-blur-md shadow-md transition-all active:scale-95 cursor-pointer"
          data-testid="receipt-preview-eye-btn"
        >
          <Eye size={16} strokeWidth={2} />
        </button>
      </div>

      {/* BAGIAN BAWAH: Kartu Tautan Google Drive */}
      {isGoogleDrive ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full rounded-2xl bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-white/10 p-3.5 flex items-center justify-between hover:border-zinc-300 dark:hover:border-white/20 transition-all cursor-pointer group"
          data-testid="receipt-drive-card"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-800 dark:text-zinc-200">
              <HardDrive size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-bold text-zinc-950 dark:text-white">
                Google Drive Receipt
              </p>
              <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[210px] sm:max-w-xs">
                {receiptUrl}
              </p>
            </div>
          </div>
          <ExternalLink
            size={15}
            className="text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white shrink-0 ml-2 transition-colors"
          />
        </a>
      ) : null}
    </div>
  )
}
