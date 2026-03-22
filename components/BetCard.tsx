'use client'
import type { EngineResult } from '@/lib/types'

interface Props {
  result:   EngineResult | null
  bankroll: number
  profit:   number
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

export default function BetCard({ result, bankroll, profit }: Props) {
  if (!result || result.status === 'WAIT' || result.status === 'NOISE') {
    return (
      <div className="rk-card flex items-center justify-center h-24">
        <span className="text-muted text-xs tracking-widest">
          {result?.status === 'NOISE' ? '🚫 BRUIT — NE PAS JOUER' : 'ATTENTE DU SIGNAL…'}
        </span>
      </div>
    )
  }

  const r          = result.recommendation
  const isKiller   = result.status === 'KILLER'
  const isSniper   = result.phase === 'Sniper'
  const betColor   = isKiller ? 'text-gold' : 'text-neon'
  const gainColor  = 'text-neon'

  return (
    <div className={`rk-card flex flex-col gap-2 ${
      isKiller ? 'border-gold/40 bg-gold/5' : 'border-neon/20'
    }`}>
      <div className="flex items-center justify-between">
        <div className="rk-label">
          {isSniper ? '🎯 SMART SPLITS — MODE SNIPER' : 'SMART SPLITS — PRUDENT'}
        </div>
        {isKiller && (
          <span className="text-[9px] font-black text-gold tracking-widest animate-pulse">
            ⚡ KILLER MODE
          </span>
        )}
      </div>

      {/* Main bet numbers */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-black rounded-xl p-2 text-center">
          <div className={`text-lg font-black ${betColor}`}>{fmt(r.bet_value)}</div>
          <div className="text-[8px] text-muted">MISE TOTALE</div>
        </div>
        <div className="bg-black rounded-xl p-2 text-center">
          <div className={`text-lg font-black ${betColor}`}>{fmt(r.bet_per_split)}</div>
          <div className="text-[8px] text-muted">PAR POSITION</div>
        </div>
        <div className="bg-black rounded-xl p-2 text-center">
          <div className={`text-lg font-black ${gainColor}`}>
            {result.potential_gain > 0 ? `+${fmt(result.potential_gain)}` : '—'}
          </div>
          <div className="text-[8px] text-muted">GAIN POTENTIEL</div>
        </div>
      </div>

      {/* Split chips */}
      {r.splits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.splits.map(split => {
            const isPlein = split.includes('plein')
            return (
              <span
                key={split}
                className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                  isPlein
                    ? 'border-gold/40 bg-gold/10 text-gold'
                    : 'border-border bg-card text-white'
                }`}
              >
                {split}
              </span>
            )
          })}
        </div>
      )}

      {/* Bankroll context */}
      <div className="flex justify-between text-[9px] text-muted mt-0.5">
        <span>Bankroll: {fmt(bankroll)}</span>
        <span className={profit >= 0 ? 'text-neon' : 'text-crimson'}>
          Profit: {profit >= 0 ? '+' : ''}{fmt(profit)}
        </span>
        <span>{r.num_bets} positions · {fmt(r.bet_per_split)}/pos</span>
      </div>
    </div>
  )
}
