'use client'
import type { EngineResult, SectorKey } from '@/lib/types'
import { SECTOR_COLORS, SECTOR_LABELS } from '@/lib/constants'

interface Props {
  result:   EngineResult | null
  bankroll: number
  profit:   number
}

function fmtBet(n: number) {
  return Math.round(n).toLocaleString('fr-FR') + '€'
}
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

function getSectorKey(target: string): SectorKey | null {
  const t = target.toLowerCase()
  if (t.includes('orphelin')) return 'orphelins'
  if (t.includes('voisin'))   return 'voisins'
  if (t.includes('tiers'))    return 'tiers'
  return null
}

export default function BetCard({ result, bankroll, profit }: Props) {
  // ── Derive all display values from engine result — ZERO hardcoded ──
  const status    = result?.status ?? 'WAIT'
  const isActive  = status === 'PLAY' || status === 'KILLER'
  const isKiller  = status === 'KILLER'
  const isSniper  = result?.phase === 'Sniper'

  // Recommendation: only use when engine is active
  const rec         = isActive ? result?.recommendation ?? null : null
  const splits      = rec?.splits      ?? []
  const betValue    = rec?.bet_value    ?? 0
  const betPerSplit = rec?.bet_per_split ?? 0
  const numBets     = rec?.num_bets     ?? 0
  const potGain     = isActive ? (result?.potential_gain ?? 0) : 0

  // Sector metadata
  const sectorKey   = rec ? getSectorKey(rec.target) : null
  const sectorColor = sectorKey ? SECTOR_COLORS[sectorKey] : '#555'
  const sectorLabel = sectorKey ? SECTOR_LABELS[sectorKey] : (rec?.target ?? '—')
  const sectorData  = sectorKey && result?.sectors ? result.sectors[sectorKey] : null

  // Unique stamp: changes every time sector or splits change → forces chip remount
  const splitsKey   = `${sectorKey ?? 'none'}-${splits.join(',')}`

  const betColor   = isKiller ? 'text-gold' : 'text-neon'
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

      {/* ── Header ── */}
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
        /* ── Waiting / Noise ── */
        <div className="flex items-center justify-center py-2">
          <span className="text-muted text-[10px] tracking-widest font-black">
            {status === 'NOISE'
              ? 'Distributions normales — ne pas jouer'
              : 'Recherche de tendance…'}
          </span>
        </div>
      ) : (
        <>
          {/* ── Engine proof: Z-score + obs/exp ── */}
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
                → {numBets} positions · {fmtBet(betPerSplit)}/pos
              </span>
            </div>
          )}

          {/* ── Mise totale / par position / gain potentiel ── */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { val: fmtBet(betValue),                                    label: 'MISE TOTALE' },
              { val: fmtBet(betPerSplit),                                  label: 'PAR POSITION' },
              { val: potGain > 0 ? `+${fmtBet(potGain)}` : '—',          label: 'GAIN POTENTIEL' },
            ].map(({ val, label }) => (
              <div key={label} className="bg-black rounded-lg text-center" style={{ padding: '4px 2px' }}>
                <div className={`text-sm font-black ${betColor}`}>{val}</div>
                <div className="text-[7px] text-muted">{label}</div>
              </div>
            ))}
          </div>

          {/* ── Chips des mises — key={splitsKey} force le remount quand le secteur change ── */}
          {splits.length > 0 && (
            <div key={splitsKey} className="flex flex-wrap gap-1">
              {splits.map((split, i) => (
                <span
                  key={`${splitsKey}-${i}`}
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
