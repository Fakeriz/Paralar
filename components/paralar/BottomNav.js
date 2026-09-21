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
        <div className="relative bg-white/95 dark:bg-[#121214]/95 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 safe-bottom">
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
                      className="-translate-y-5 h-14 w-14 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 flex items-center justify-center shadow-xl shadow-black/25 active:scale-95 transition"
                    >
                      <Plus size={26} strokeWidth={2.5} />
                    </button>
                  </div>
                )
              }
              const Icon = it.icon
              const active = tab === it.id
              return (
                <button key={it.id} type="button" onClick={() => onTab(it.id)} data-testid={`nav-${it.id}`} className="flex flex-col items-center justify-center gap-1 h-full pb-1">
                  <Icon size={22} strokeWidth={active ? 2.5 : 2} className={cn(active ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400')} />
                  <span className={cn('text-[10px] font-bold', active ? 'text-zinc-950 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 font-medium')}>{it.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
