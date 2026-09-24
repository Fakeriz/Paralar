'use client'
import { Home, ArrowLeftRight, Target, LayoutGrid, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from './context'

export default function BottomNav({ tab, onTab, onPlus }) {
  const { t } = useApp()
  const items = [
    { id: 'home', label: t('home'), icon: Home },
    { id: 'transactions', label: t('transactions'), icon: ArrowLeftRight },
    { id: 'plus' },
    { id: 'goals', label: t('goals'), icon: Target },
    { id: 'more', label: t('more'), icon: LayoutGrid },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="relative bg-white/95 dark:bg-[#0c0c0e]/95 backdrop-blur-xl border-t border-border/50 safe-bottom shadow-lg">
          <div className="grid grid-cols-5 items-end h-[64px]">
            {items.map((it) => {
              if (it.id === 'plus') {
                return (
                  <div key="plus" className="flex justify-center">
                    <button
                      type="button"
                      onClick={onPlus}
                      aria-label="add"
                      data-testid="fab-add"
                      className="-translate-y-5 h-14 w-14 rounded-full bg-[#0c0c0e] hover:bg-zinc-900 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-[#0c0c0e] flex items-center justify-center shadow-md shadow-black/20 active:scale-95 transition-all"
                    >
                      <Plus size={26} strokeWidth={2.5} className="text-white dark:text-[#0c0c0e]" />
                    </button>
                  </div>
                )
              }
              const Icon = it.icon
              const active = tab === it.id
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onTab(it.id)}
                  data-testid={`nav-${it.id}`}
                  className="flex flex-col items-center justify-center gap-1 h-full pb-1 transition-colors group"
                >
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.5 : 2}
                    className={cn(
                      'transition-colors',
                      active ? 'text-[#0c0c0e] dark:text-white' : 'text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300'
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] transition-colors',
                      active ? 'text-[#0c0c0e] dark:text-white font-bold' : 'text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300 font-medium'
                    )}
                  >
                    {it.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
