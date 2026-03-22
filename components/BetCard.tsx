'use client'
import type { EngineResult } from '@/lib/types'

interface Props {
  result:   EngineResult | null
  bankroll: number
  profit:   number
}

/** Whole-euro display for bet amounts (no decimals) */
function fmtBet(n: number) {
  return Math.round(n).toLocaleString('fr-FR') + '€'
}
/** 2-decimal display for bankroll / profit tracking */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

export default function BetCard({ result, bankroll, profit }: Props) {
  if (!result || result.status === 'WAIT' || result.status === 'NOISE') {
    return (
      <div className="rk-card flex items-center justify-center" style={{ height: 48, padding: '6px 10px' }}>
        <span className="text-muted text-[10px] tracking-widest font-black">
          {result?.status === 'NOISE' ? '🚫 BRUIT — NE PAS JOUER' : '⏳ EN ATTENTE DU SIGNAL…'}
        </span>
      </div>
    )
  }

  const r        = result.recommendation
  const isKiller = result.status === 'KILLER'
  const isSniper = result.phase === 'Sniper'
  const betColor = isKiller ? 'text-gold' : 'text-neon'

  return (
    <div
      className={`rk-card flex flex-col gap-1 ${isKiller ? 'border-gold/40 bg-gold/5' : 'border-neon/20'}`}
      style={{ padding: '8px 10px' }}
    >

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="rk-label" style={{ marginBottom: 0 }}>
          {isSniper ? '🎯 SMART SPLITS — SNIPER' : 'SMART SPLITS — PRUDENT'}
        </div>
        {isKiller && (
          <span className="text-[8px] font-black text-gold tracking-widest animate-pulse">⚡ KILLER</span>
        )}
      </div>

      {/* Bet numbers — 3 cols */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { val: fmtBet(r.bet_value),     label: 'MISE TOTALE' },
          { val: fmtBet(r.bet_per_split), label: 'PAR POSITION' },
          { val: result.potential_gain > 0 ? `+${fmtBet(result.potential_gain)}` : '—', label: 'GAIN POTENTIEL' },
        ].map(({ val, label }) => (
          <div key={label} className="bg-black rounded-lg text-center" style={{ padding: '4px 2px' }}>
            <div className={`text-sm font-black ${betColor}`}>{val}</div>
            <div className="text-[7px] text-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* Split chips — wrapping row */}
      {r.splits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {r.splits.map(split => (
            <span
              key={split}
              className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                split.includes('plein')
                  ? 'border-gold/40 bg-gold/10 text-gold'
                  : 'border-border bg-card text-white'
              }`}
            >
              {split}
            </span>
          ))}
        </div>
      )}

      {/* Bankroll context */}
      <div className="flex justify-between text-[9px] text-muted" style={{ marginTop: 2 }}>
        <span>Bankroll: {fmt(bankroll)}</span>
        <span className={profit >= 0 ? 'text-neon' : 'text-crimson'}>
          Profit: {profit >= 0 ? '+' : ''}{fmt(profit)}
        </span>
        <span>{r.num_bets} positions · {fmtBet(r.bet_per_split)}/pos</span>
      </div>

    </div>
  )
}
