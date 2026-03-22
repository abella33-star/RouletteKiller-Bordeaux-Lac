'use client'
import type { EngineResult } from '@/lib/types'
import { SECTOR_COLORS } from '@/lib/constants'

interface Props {
  result: EngineResult | null
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

  return (
    <div className={`rk-card flex flex-col gap-2 ${glowClass}`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="rk-label">SIGNAL</div>
        <div className="text-[9px] text-muted font-mono">
          Buffer: {bufferSize}/36
        </div>
      </div>

      {/* Status + confidence */}
      <div className="flex items-center gap-3">
        <span className={`${pillClass} text-xs font-black tracking-widest px-3 py-1 rounded-full border`}>
          {status === 'KILLER' ? '⚡ KILLER' : status}
        </span>
        <div className="flex-1 conf-track">
          <div
            className="conf-fill"
            style={{ width: `${conf}%`, background: barColor }}
          />
        </div>
        <span className="text-sm font-black tabular-nums" style={{ color: barColor }}>
          {conf}%
        </span>
      </div>

      {/* Target */}
      {result && result.status !== 'WAIT' && result.status !== 'NOISE' && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Cible</span>
          <span className="font-black" style={{
            color: result.sectors
              ? SECTOR_COLORS[
                  (Object.keys(result.sectors) as (keyof typeof result.sectors)[])
                    .reduce((a, b) => result.sectors![a].confidence >= result.sectors![b].confidence ? a : b)
                ]
              : '#FFF'
          }}>
            {result.recommendation.target}
          </span>
        </div>
      )}

      {/* Chi-Square indicators */}
      {result && (
        <div className="grid grid-cols-3 gap-1.5 mt-0.5">
          {[
            { label: 'χ² couleurs', test: result.colorTest },
            { label: 'χ² parité',   test: result.parityTest },
            { label: 'Offset mec.', test: null, custom:
              result.offsetAnalysis?.detected
                ? { val: `~${result.offsetAnalysis.center}`, ok: true }
                : null
            },
          ].map(({ label, test, custom }) => {
            const isNoise = test ? test.isNoise : !custom?.ok
            const val     = custom?.val ?? (test ? `p=${test.pValue.toFixed(3)}` : '—')
            return (
              <div key={label} className="bg-black rounded-lg p-1.5 text-center">
                <div className="text-[8px] text-muted leading-none mb-0.5">{label}</div>
                <div className={`text-[10px] font-black tabular-nums ${
                  isNoise ? 'text-crimson' : 'text-neon'
                }`}>
                  {val}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Phase tag */}
      {result && result.phase !== '—' && (
        <div className="flex justify-end">
          <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded-md ${
            result.phase === 'Sniper'
              ? 'bg-orange/20 text-orange'
              : 'bg-neon/10 text-neon'
          }`}>
            {result.phase === 'Sniper' ? '🎯 SNIPER' : 'PRUDENT'}
          </span>
        </div>
      )}

      {/* Reason text */}
      {result?.reason && (
        <div className={`text-[10px] leading-4 rounded-lg p-2 tabular-nums border-l-2 ${
          status === 'KILLER' ? 'border-gold bg-gold/5 text-gold/80' :
          status === 'PLAY'   ? 'border-neon bg-neon/5 text-white/70' :
          status === 'NOISE'  ? 'border-crimson bg-crimson/5 text-crimson/80' :
                                'border-border bg-card text-muted'
        }`}>
          {result.reason}
        </div>
      )}
    </div>
  )
}
