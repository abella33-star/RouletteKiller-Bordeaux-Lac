'use client'
import { useMemo } from 'react'
import { getColor } from '@/lib/constants'
import type { Spin } from '@/lib/types'

interface Props {
  onSpin:      (n: number) => void
  recentSpins: Spin[]
  disabled:    boolean
}

// Casino tableau layout: 3 rows × 12 cols (top = high numbers)
const ROWS: number[][] = [
  [3,  6,  9,  12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2,  5,  8,  11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1,  4,  7,  10, 13, 16, 19, 22, 25, 28, 31, 34],
]

// Roulette red numbers
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

function numBg(n: number, isLast: boolean, isPrev: boolean): string {
  if (isLast) return '#00E676'   // neon green highlight
  const base = n === 0 ? '#065f46' : REDS.has(n) ? '#7f1d1d' : '#1a1a1a'
  return isPrev ? base + 'aa' : base
}

function numText(n: number, isLast: boolean): string {
  if (isLast) return '#000'
  return '#fff'
}

function vibrate() {
  try { window.navigator.vibrate(10) } catch {}
}

export default function NumberPad({ onSpin, recentSpins, disabled }: Props) {
  const lastHit = recentSpins[recentSpins.length - 1]?.number ?? null
  const prevSet = useMemo(
    () => new Set(recentSpins.slice(-6).map(s => s.number)),
    [recentSpins]
  )

  function handleTap(n: number) {
    if (disabled) return
    vibrate()
    onSpin(n)
  }

  const btnBase = `
    flex items-center justify-center rounded
    text-xs font-black select-none cursor-pointer
    active:scale-90 transition-transform duration-75
    border border-[#222]
  `

  return (
    <div className="flex flex-col gap-1 h-full">

      {/* ── Zero: full-width, fixed height (NEVER aspect-square) ── */}
      <button
        onClick={() => handleTap(0)}
        disabled={disabled}
        style={{
          background: numBg(0, lastHit === 0, false),
          color:      numText(0, lastHit === 0),
          height:     '2rem',
          width:      '100%',
          flexShrink: 0,
          aspectRatio: 'unset',
        }}
        className={btnBase + (lastHit === 0 ? ' ring-2 ring-[#00E676]' : '')}
        aria-label="0"
      >
        0
      </button>

      {/* ── 1–36 grid: 12 columns × 3 rows ── */}
      <div
        className="grid gap-0.5 flex-1"
        style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}
      >
        {ROWS.flat().map(n => {
          const isLast = n === lastHit
          const isPrev = prevSet.has(n) && !isLast
          return (
            <button
              key={n}
              onClick={() => handleTap(n)}
              disabled={disabled}
              style={{
                background:  numBg(n, isLast, isPrev),
                color:       numText(n, isLast),
                aspectRatio: '1 / 1',
                width:       '100%',
              }}
              className={btnBase + (isLast ? ' ring-2 ring-[#00E676] z-10' : '')}
              aria-label={String(n)}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
