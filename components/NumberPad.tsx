'use client'
/**
 * Roulette Number Pad — 37 buttons in European casino layout.
 * 0 at top, then 3 columns: 1-2-3 / 4-5-6 / … / 34-35-36
 * Row order matches the actual tableau de jeu.
 */
import { useMemo } from 'react'
import { getColor } from '@/lib/constants'
import type { Spin } from '@/lib/types'

interface Props {
  onSpin:      (n: number) => void
  recentSpins: Spin[]
  disabled:    boolean
}

// European roulette table layout rows (bottom of table = high numbers)
// Format: 3 columns, rows go from 1 upward
const TABLE_ROWS: number[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
]

export default function NumberPad({ onSpin, recentSpins, disabled }: Props) {
  const lastHit  = recentSpins[recentSpins.length - 1]?.number ?? null
  const prevHits = useMemo(
    () => new Set(recentSpins.slice(-5).map(s => s.number)),
    [recentSpins]
  )

  function renderBtn(n: number) {
    const color    = getColor(n)
    const isLast   = n === lastHit
    const isPrev   = prevHits.has(n) && !isLast

    const base = 'num-btn h-full w-full'
    const cls  = isLast  ? `${base} num-hit num-${color}` :
                 isPrev  ? `${base} num-${color} opacity-60 ring-1 ring-white/20` :
                           `${base} num-${color}`

    return (
      <button
        key={n}
        className={cls}
        onClick={() => !disabled && onSpin(n)}
        disabled={disabled}
        aria-label={`Numéro ${n}`}
      >
        {n}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1 select-none">
      {/* Zero — full width */}
      <button
        className={`num-btn num-zero w-full py-2 text-base ${
          lastHit === 0 ? 'num-hit' : ''
        }`}
        onClick={() => !disabled && onSpin(0)}
        disabled={disabled}
        aria-label="Zéro"
      >
        0
      </button>

      {/* 3-column grid of 12 rows */}
      <div className="grid grid-cols-12 gap-1">
        {TABLE_ROWS.map((row, ri) =>
          row.map(n => (
            <div key={n} className="aspect-square">
              {renderBtn(n)}
            </div>
          ))
        )}
      </div>

      {/* Sector legend */}
      <div className="flex justify-center gap-4 pt-1">
        {[
          { label: 'Voisins', color: '#C8A951' },
          { label: 'Tiers',   color: '#4E88FF' },
          { label: 'Orphel.', color: '#FF6B35' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[9px] text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
