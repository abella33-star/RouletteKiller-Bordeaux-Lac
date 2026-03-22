'use client'
import type { EngineResult } from '@/lib/types'
import { SECTOR_COLORS } from '@/lib/constants'

interface Props {
  result:     EngineResult | null
  bufferSize: number
}

export default function SignalCard({ result, bufferSize }: Props) {
  const status = result?.status ?? 'WAIT'
  const conf   = result?.confidence ?? 0

  const pillClass = {
    WAIT:   'pill-wait',
    PLAY:   'pill-play',
    KILLER: 'pill-killer',
    NOISE:  'pill-noise',
  }[status]

  const barColor = {
    WAIT:   '#555',
    PLAY:   '#00E676',
    KILLER: '#FFD700',
    NOISE:  '#FF1744',
  }[status]

  const glowClass = status === 'KILLER' ? 'glow-gold' : status === 'PLAY' ? 'glow-green' : ''

  // Dominant sector for target label
  const dominantSector = result?.sectors
    ? (Object.keys(result.sectors) as (keyof typeof result.sectors)[])
        .reduce((a, b) => result.sectors![a].confidence >= result.sectors![b].confidence ? a : b)
    : null

  return (
    <div className={`rk-card flex flex-col gap-1 ${glowClass}`} style={{ padding: '8px 10px' }}>

      {/* Row 1: label + buffer + phase badge */}
      <div className="flex items-center justify-between">
        <div className="rk-label" style={{ marginBottom: 0 }}>SIGNAL</div>
        <div className="flex items-center gap-2">
          {result && result.phase !== '—' && (
            <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded ${
              result.phase === 'Sniper'
                ? 'bg-orange/20 text-orange'
                : 'bg-neon/10 text-neon'
            }`}>
              {result.phase === 'Sniper' ? '🎯' : '●'} {result.phase}
            </span>
          )}
          <div className="text-[8px] text-muted font-mono">{bufferSize}/36</div>
        </div>
      </div>

      {/* Row 2: pill + confidence bar + % + target */}
      <div className="flex items-center gap-2">
        <span className={`${pillClass} text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0`}>
          {status === 'KILLER' ? '⚡ KILLER' : status}
        </span>
        <div className="flex-1 conf-track">
          <div className="conf-fill" style={{ width: `${conf}%`, background: barColor }} />
        </div>
        <span className="text-xs font-black tabular-nums flex-shrink-0" style={{ color: barColor }}>
          {conf}%
        </span>
        {result && result.status !== 'WAIT' && result.status !== 'NOISE' && dominantSector && (
          <span className="text-xs font-black flex-shrink-0" style={{ color: SECTOR_COLORS[dominantSector] }}>
            {result.recommendation.target}
          </span>
        )}
      </div>

      {/* Row 3: Chi-square indicators */}
      {result && (
        <div className="grid grid-cols-3 gap-1">
          {[
            { label: 'χ² coul.', test: result.colorTest },
            { label: 'χ² par.',  test: result.parityTest },
            { label: 'Offset',   test: null, custom:
              result.offsetAnalysis?.detected
                ? { val: `~${result.offsetAnalysis.center}`, ok: true }
                : null
            },
          ].map(({ label, test, custom }) => {
            const isNoise = test ? test.isNoise : !custom?.ok
            const val     = custom?.val ?? (test ? `p=${test.pValue.toFixed(3)}` : '—')
            return (
              <div key={label} className="bg-black rounded-md text-center" style={{ padding: '3px 4px' }}>
                <div className="text-[7px] text-muted leading-none">{label}</div>
                <div className={`text-[9px] font-black tabular-nums ${isNoise ? 'text-crimson' : 'text-neon'}`}>
                  {val}
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
