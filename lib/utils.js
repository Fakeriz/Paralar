import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const triggerHaptic = (type = 'light') => {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return
  try {
    switch (type) {
      case 'light':      // Button tap, pill toggle, segmented switch
        navigator.vibrate(10)
        break
      case 'medium':     // Tab switch, swipe snap, toggle switch
        navigator.vibrate(18)
        break
      case 'success':    // Modal opening, successful transaction save
        navigator.vibrate([12, 40, 15])
        break
      case 'warning':    // Delete prompt, clear confirm
        navigator.vibrate([20, 60, 20])
        break
      case 'selection':  // Wheel scroll, carousel snap
        navigator.vibrate(8)
        break
      default:
        navigator.vibrate(10)
    }
  } catch (e) {
    // Safe fallback jika permission ditolak / tidak didukung
  }
}
