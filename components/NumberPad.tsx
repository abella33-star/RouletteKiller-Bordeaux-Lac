'use client'
import { useMemo, useState } from 'react'
import type { Spin } from '@/lib/types'

interface Props {
  onSpin:      (n: number) => void
  recentSpins: Spin[]
  disabled:    boolean
}

// Casino tableau: 3 rows × 12 cols
const ROWS: number[][] = [
  [3,  6,  9,  12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2,  5,  8,  11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1,  4,  7,  10, 13, 16, 19, 22, 25, 28, 31, 34],
]
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

function baseBg(n: number): string {
  if (n === 0) return '#14532d'
  return REDS.has(n) ? '#7f1d1d' : '#1c1c1c'
}

function vibrate() { try { window.navigator.vibrate(10) } catch {} }

export default function NumberPad({ onSpin, recentSpins, disabled }: Props) {
  const [flashNum, setFlashNum] = useState<number | null>(null)

  const lastHit = recentSpins[recentSpins.length - 1]?.number ?? null
  const prevSet = useMemo(
    () => new Set(recentSpins.slice(-6).map(s => s.number)),
    [recentSpins]
  )

  function handleTap(n: number) {
    if (disabled) return
    vibrate()
    // Flash visual confirmation — clears after 140 ms
    setFlashNum(n)
    setTimeout(() => setFlashNum(f => f === n ? null : f), 140)
    onSpin(n)
  }

  // Shared iOS-safe button style additions
  const iosSafe: React.CSSProperties = {
    touchAction:              'manipulation',   // no 300ms delay
    WebkitTapHighlightColor: 'transparent',    // no grey flash
    cursor:                   'pointer',
    userSelect:               'none',
    WebkitUserSelect:         'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>

      {/* ── Zero: full-width ── */}
      <button
        onClick={() => handleTap(0)}
        disabled={disabled}
        style={{
          ...iosSafe,
          flexShrink:      0,
          height:          28,
          width:           '100%',
          background:      flashNum === 0 ? '#FFFFFF' :
                           lastHit  === 0 ? '#00E676' : '#14532d',
          color:           (flashNum === 0 || lastHit === 0) ? '#000' : '#fff',
          border:          lastHit  === 0 ? '2px solid #00E676' : '1px solid #333',
          borderRadius:    5,
          fontWeight:      900,
          fontSize:        13,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          transition:      'background 0.08s',
        }}
      >
        0
      </button>

      {/* ── 1–36 grid — 12 columns ── */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap:                 3,
          flex:                1,
          alignContent:        'start',
        }}
      >
        {ROWS.flat().map(n => {
          const isFlash = n === flashNum
          const isLast  = n === lastHit
          const isPrev  = prevSet.has(n) && !isLast

          const bg = isFlash ? '#FFFFFF' :
                     isLast  ? '#00E676' : baseBg(n)
          const fg = (isFlash || isLast) ? '#000' : '#fff'
          const bd = isFlash ? '2px solid #FFFFFF' :
                     isLast  ? '2px solid #00E676'  : '1px solid #2a2a2a'

          return (
            <button
              key={n}
              onClick={() => handleTap(n)}
              disabled={disabled}
              style={{
                ...iosSafe,
                aspectRatio: '1 / 1',
                width:       '100%',
                background:  bg,
                color:       fg,
                opacity:     isPrev ? 0.45 : 1,
                border:      bd,
                borderRadius: 4,
                fontWeight:  900,
                fontSize:    9,
                display:     'flex',
                alignItems:  'center',
                justifyContent: 'center',
                padding:     0,
                transition:  'background 0.08s',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>

    </div>
  )
}
