'use client'
import type { ColorPrediction } from '@/lib/types'

interface Props {
  prediction: ColorPrediction | null
}

const BASE_ROUGE = 48.65  // P(rouge) théorique en %
const BASE_NOIR  = 48.65  // P(noir)  théorique en %

function Bar({ value, base, color }: { value: number; base: number; color: string }) {
  const clamped = Math.min(99, Math.max(1, value))
  const diff = value - base
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-3 bg-black rounded-full overflow-hidden relative">
        {/* Baseline marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/20 z-10"
          style={{ left: `${base}%` }}
        />
        {/* Value bar */}
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span className="text-xs font-black tabular-nums w-10 text-right" style={{ color }}>
        {value.toFixed(1)}%
      </span>
      <span className={`text-[8px] font-black w-10 tabular-nums ${Math.abs(diff) > 2 ? (diff > 0 ? 'text-orange' : 'text-neon') : 'text-muted'}`}>
        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
      </span>
    </div>
  )
}

export default function ColorCard({ prediction }: Props) {
  if (!prediction) {
    return (
      <div className="rk-card" style={{ padding: '8px 10px' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="rk-label" style={{ marginBottom: 0 }}>COULEUR</div>
          <div className="text-[8px] text-muted">En attente de données…</div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-3 bg-black rounded-full opacity-30" />
          <div className="h-3 bg-black rounded-full opacity-30" />
        </div>
      </div>
    )
  }

  const { rougeProb, noirProb, signal, confidence, streakCount, streakColor,
          ewmaRouge, zScore, conditionalP } = prediction

  const signalColor = signal === 'ROUGE' ? '#ef5350'
                    : signal === 'NOIR'  ? '#bdbdbd'
                    : '#555'
  const signalBg    = signal === 'ROUGE' ? 'rgba(239,83,80,0.12)'
                    : signal === 'NOIR'  ? 'rgba(189,189,189,0.08)'
                    : 'transparent'

  const streakEmoji = streakColor === 'rouge' ? '🔴'
                    : streakColor === 'noir'  ? '⚫'
                    : '🟢'

  return (
    <div className={`rk-card ${signal === 'ROUGE' ? 'glow-red' : signal === 'NOIR' ? '' : ''}`}
      style={{ padding: '8px 10px' }}>

      {/* Row 1 : header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="rk-label" style={{ marginBottom: 0 }}>COULEUR</div>
        <div className="flex items-center gap-2">
          {/* Streak badge */}
          {streakCount >= 2 && streakColor && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-black">
              {streakEmoji} {streakCount}× série
            </span>
          )}
          {/* Signal badge */}
          {signal !== 'NEUTRE' && (
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ color: signalColor, borderColor: signalColor + '60', background: signalBg }}
            >
              {signal === 'ROUGE' ? '🔴' : '⚫'} {signal} {confidence}%
            </span>
          )}
        </div>
      </div>

      {/* Row 2 : barres */}
      <div className="flex flex-col gap-1.5 mb-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[9px] w-3">🔴</span>
          <div className="flex-1">
            <Bar value={rougeProb} base={BASE_ROUGE} color="#ef5350" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] w-3">⚫</span>
          <div className="flex-1">
            <Bar value={noirProb} base={BASE_NOIR} color="#bdbdbd" />
          </div>
        </div>
      </div>

      {/* Row 3 : métriques */}
      <div className="grid grid-cols-3 gap-1">
        <div className="bg-black rounded-md text-center" style={{ padding: '3px 4px' }}>
          <div className="text-[7px] text-muted">Z-score</div>
          <div className={`text-[9px] font-black tabular-nums ${
            Math.abs(zScore) > 1.0 ? (zScore > 0 ? 'text-orange' : 'text-neon') : 'text-muted'
          }`}>
            {zScore > 0 ? '+' : ''}{zScore.toFixed(2)}σ
          </div>
        </div>
        <div className="bg-black rounded-md text-center" style={{ padding: '3px 4px' }}>
          <div className="text-[7px] text-muted">EWMA</div>
          <div className={`text-[9px] font-black tabular-nums ${
            Math.abs(ewmaRouge - BASE_ROUGE) > 3 ? 'text-orange' : 'text-muted'
          }`}>
            {ewmaRouge.toFixed(1)}%
          </div>
        </div>
        <div className="bg-black rounded-md text-center" style={{ padding: '3px 4px' }}>
          <div className="text-[7px] text-muted">P(même)</div>
          <div className={`text-[9px] font-black tabular-nums ${
            conditionalP !== null && Math.abs(conditionalP - 50) > 10
              ? conditionalP > 50 ? 'text-orange' : 'text-neon'
              : 'text-muted'
          }`}>
            {conditionalP !== null ? `${conditionalP}%` : '—'}
          </div>
        </div>
      </div>

    </div>
  )
}
