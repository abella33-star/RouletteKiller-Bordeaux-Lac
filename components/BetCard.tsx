'use client'
import type { EngineResult, SectorKey } from '@/lib/types'
import { SECTOR_COLORS, SECTOR_LABELS } from '@/lib/constants'

interface Props {
  result:   EngineResult | null
  bankroll: number
  profit:   number
}

/** Whole-euro amounts */
function fmtBet(n: number) {
  return Math.round(n).toLocaleString('fr-FR') + '€'
}
/** 2-decimal for bankroll */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

/** Derive the active sector key from the recommendation target */
function getSectorKey(target: string): SectorKey | null {
  if (target.toLowerCase().includes('orphelin')) return 'orphelins'
  if (target.toLowerCase().includes('voisin'))   return 'voisins'
  if (target.toLowerCase().includes('tiers'))    return 'tiers'
  return null
}

export default function BetCard({ result, bankroll, profit }: Props) {
  const status    = result?.status ?? 'WAIT'
  const isActive  = status === 'PLAY' || status === 'KILLER'
  const isKiller  = status === 'KILLER'
  const isSniper  = result?.phase === 'Sniper'
  const r         = result?.recommendation

  // Derive sector info for dynamic display
  const sectorKey   = isActive && r ? getSectorKey(r.target) : null
  const sectorColor = sectorKey ? SECTOR_COLORS[sectorKey] : '#555'
  const sectorLabel = sectorKey ? SECTOR_LABELS[sectorKey] : r?.target ?? '—'
  const sectorData  = sectorKey && result?.sectors ? result.sectors[sectorKey] : null

  const betColor = isKiller ? 'text-gold' : 'text-neon'
  const cardBorder = isKiller
    ? 'border-gold/40 bg-gold/5'
    : isActive
      ? 'border-neon/20'
      : 'border-border'

  return (
    <div
      className={`rk-card flex flex-col gap-1 ${cardBorder}`}
      style={{ padding: '8px 10px' }}
    >

      {/* ── Header: label + sector badge + mode ── */}
      <div className="flex items-center justify-between">
        <div className="rk-label" style={{ marginBottom: 0 }}>
          {isSniper ? '🎯 SMART SPLITS — SNIPER' : 'SMART SPLITS — PRUDENT'}
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && sectorKey && (
            <span
              className="text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest"
              style={{ background: sectorColor + '22', color: sectorColor, border: `1px solid ${sectorColor}55` }}
            >
              {sectorLabel.toUpperCase()}
            </span>
          )}
          {isKiller && (
            <span className="text-[8px] font-black text-gold tracking-widest animate-pulse">⚡ KILLER</span>
          )}
          {status === 'NOISE' && (
            <span className="text-[8px] font-black text-crimson tracking-widest">🚫 BRUIT</span>
          )}
        </div>
      </div>

      {!isActive ? (
        /* ── Waiting / Noise state ── */
        <div className="flex items-center justify-center py-2">
          <span className="text-muted text-[10px] tracking-widest font-black">
            {status === 'NOISE'
              ? 'Distributions normales — ne pas jouer'
              : 'Recherche de faille…'}
          </span>
        </div>
      ) : (
        <>
          {/* ── Engine proof row: sector + Z + obs/exp ── */}
          {sectorData && (
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1"
              style={{ background: sectorColor + '11', border: `1px solid ${sectorColor}33` }}
            >
              <span className="text-[9px] font-black tabular-nums" style={{ color: sectorColor }}>
                Z = +{sectorData.Z.toFixed(2)}σ
              </span>
              <span className="text-[8px] text-muted">
                Obs {sectorData.k} / Att {sectorData.E.toFixed(1)}
              </span>
              <span className="text-[8px] text-muted ml-auto">
                → {r!.num_bets} positions · {fmtBet(r!.bet_per_split)}/pos
              </span>
            </div>
          )}

          {/* ── Bet amounts: 3 cells ── */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { val: fmtBet(r!.bet_value),     label: 'MISE TOTALE' },
              { val: fmtBet(r!.bet_per_split), label: 'PAR POSITION' },
              { val: result!.potential_gain > 0 ? `+${fmtBet(result!.potential_gain)}` : '—', label: 'GAIN POTENTIEL' },
            ].map(({ val, label }) => (
              <div key={label} className="bg-black rounded-lg text-center" style={{ padding: '4px 2px' }}>
                <div className={`text-sm font-black ${betColor}`}>{val}</div>
                <div className="text-[7px] text-muted">{label}</div>
              </div>
            ))}
          </div>

          {/* ── Split chips — key={i} handles duplicate labels (voisins ×2) ── */}
          {r!.splits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r!.splits.map((split, i) => (
                <span
                  key={i}
                  className="text-[10px] font-black px-2 py-0.5 rounded border"
                  style={
                    split.includes('plein')
                      ? { borderColor: '#FFD70066', background: '#FFD70011', color: '#FFD700' }
                      : { borderColor: sectorColor + '55', background: sectorColor + '11', color: sectorColor }
                  }
                >
                  {split}
                </span>
              ))}
            </div>
          )}

          {/* ── Bankroll footer ── */}
          <div className="flex justify-between text-[9px] text-muted" style={{ marginTop: 2 }}>
            <span>Bankroll: {fmt(bankroll)}</span>
            <span className={profit >= 0 ? 'text-neon' : 'text-crimson'}>
              Profit: {profit >= 0 ? '+' : ''}{fmt(profit)}
            </span>
          </div>
        </>
      )}

    </div>
  )
}
