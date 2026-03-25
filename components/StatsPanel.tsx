'use client'
import type { Spin, ChiSquareResult } from '@/lib/types'

// ── Helpers ────────────────────────────────────────────────────

interface NumberFreq {
  number:    number
  count:     number
  deviation: number  // % vs attendu
}

interface MarkovRow {
  from:      string
  voisins:   number
  tiers:     number
  orphelins: number
  none:      number
  total:     number
}

function computeNumberFreqs(spins: Spin[]): NumberFreq[] {
  if (spins.length === 0) return []
  const counts: Record<number, number> = {}
  for (let i = 0; i <= 36; i++) counts[i] = 0
  for (const s of spins) counts[s.number]++
  const expected = spins.length / 37
  return Array.from({ length: 37 }, (_, i) => ({
    number:    i,
    count:     counts[i],
    deviation: expected > 0 ? (counts[i] - expected) / expected * 100 : 0,
  }))
}

function computeMarkov(spins: Spin[]): MarkovRow[] | null {
  if (spins.length < 5) return null
  const keys = ['voisins', 'tiers', 'orphelins', 'none'] as const
  const counts: Record<string, Record<string, number>> = {}
  for (const k of keys) counts[k] = { voisins: 0, tiers: 0, orphelins: 0, none: 0 }

  for (let i = 0; i < spins.length - 1; i++) {
    const from = spins[i].zone ?? 'none'
    const to   = spins[i + 1].zone ?? 'none'
    counts[from][to]++
  }

  return keys.map(from => {
    const total = Object.values(counts[from]).reduce((a, b) => a + b, 0)
    return {
      from,
      voisins:   total > 0 ? Math.round(counts[from].voisins   / total * 100) : 0,
      tiers:     total > 0 ? Math.round(counts[from].tiers     / total * 100) : 0,
      orphelins: total > 0 ? Math.round(counts[from].orphelins / total * 100) : 0,
      none:      total > 0 ? Math.round(counts[from].none      / total * 100) : 0,
      total,
    }
  }).filter(r => r.total > 0)
}

// ── Sparkline SVG ──────────────────────────────────────────────
function Sparkline({ history, initialDeposit }: { history: number[]; initialDeposit: number }) {
  if (history.length < 2) return null
  const W = 300, H = 50
  const min  = Math.min(...history, initialDeposit * 0.8)
  const max  = Math.max(...history, initialDeposit * 1.2)
  const rng  = max - min || 1

  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W
    const y = H - ((v - min) / rng) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  // Baseline y for initialDeposit
  const baseY = H - ((initialDeposit - min) / rng) * (H - 4) - 2
  const isProfit = history[history.length - 1] >= initialDeposit

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Baseline (dépôt initial) */}
      <line x1="0" y1={baseY} x2={W} y2={baseY}
        stroke="#555" strokeWidth="1" strokeDasharray="4 3" />
      {/* Courbe bankroll */}
      <polyline
        points={pts}
        fill="none"
        stroke={isProfit ? '#00E676' : '#FF1744'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dernier point */}
      <circle
        cx={W}
        cy={H - ((history[history.length - 1] - min) / rng) * (H - 4) - 2}
        r="3"
        fill={isProfit ? '#00E676' : '#FF1744'}
      />
    </svg>
  )
}

// ── Main Component ─────────────────────────────────────────────
interface Props {
  spins:           Spin[]
  bankrollHistory: number[]
  initialDeposit:  number
  colorTest:       ChiSquareResult | null
  parityTest:      ChiSquareResult | null
  onClose:         () => void
}

const SECTOR_LABEL: Record<string, string> = {
  voisins: 'VOI', tiers: 'TIE', orphelins: 'ORP', none: '—',
}
const SECTOR_COLOR: Record<string, string> = {
  voisins: '#4FC3F7', tiers: '#FFD54F', orphelins: '#CE93D8', none: '#555',
}

export default function StatsPanel({ spins, bankrollHistory, initialDeposit, colorTest, parityTest, onClose }: Props) {
  const n     = spins.length
  const freqs = computeNumberFreqs(spins)
  const hot5  = [...freqs].sort((a, b) => b.count - a.count).slice(0, 5)
  const cold5 = [...freqs].sort((a, b) => a.count - b.count).slice(0, 5)
  const markov = computeMarkov(spins)

  // Color stats
  const rouge    = spins.filter(s => s.color === 'rouge').length
  const noir     = spins.filter(s => s.color === 'noir').length
  const vert     = spins.filter(s => s.color === 'vert').length
  const pair     = spins.filter(s => s.number > 0 && s.number % 2 === 0).length
  const impair   = spins.filter(s => s.number % 2 !== 0).length

  const pct = (v: number) => n > 0 ? (v / n * 100).toFixed(1) + '%' : '—'

  // Bankroll summary
  const lastBR   = bankrollHistory[bankrollHistory.length - 1] ?? initialDeposit
  const profit   = lastBR - initialDeposit
  const isProfit = profit >= 0
  const roi      = initialDeposit > 0 ? (profit / initialDeposit * 100).toFixed(1) : '0'

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ paddingBottom: 'var(--sab)' }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full bg-surface rounded-t-3xl border-t border-border overflow-y-auto"
        style={{ maxHeight: '88dvh' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border flex items-center justify-between px-4 py-3 z-10">
          <span className="text-xs font-black tracking-widest">STATISTIQUES AVANCÉES</span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-muted font-mono">{n} spins</span>
            <button onClick={onClose} className="text-muted text-xl leading-none">✕</button>
          </div>
        </div>

        <div className="p-3 flex flex-col gap-3">

          {/* ── Bankroll sparkline ─── */}
          {bankrollHistory.length > 1 && (
            <div className="rk-card">
              <div className="rk-label">ÉVOLUTION BANKROLL</div>
              <Sparkline history={bankrollHistory} initialDeposit={initialDeposit} />
              <div className="flex justify-between items-center mt-1.5">
                <div className="text-[9px] text-muted">
                  Dépôt: <span className="font-black text-white">{initialDeposit.toFixed(2)}€</span>
                </div>
                <div className={`text-[10px] font-black ${isProfit ? 'text-neon' : 'text-crimson'}`}>
                  {isProfit ? '+' : ''}{profit.toFixed(2)}€ ({isProfit ? '+' : ''}{roi}% ROI)
                </div>
                <div className="text-[9px] text-muted">
                  Actuel: <span className="font-black text-white">{lastBR.toFixed(2)}€</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Biais Couleur / Parité ─── */}
          <div className="rk-card">
            <div className="rk-label">BIAIS COULEUR & PARITÉ</div>
            <div className="grid grid-cols-2 gap-2">

              <div className="bg-black rounded-xl p-3">
                <div className="text-[8px] text-muted mb-2 font-black tracking-wider">ROUGE / NOIR / VERT</div>
                <div className="space-y-1">
                  {[
                    { label: '🔴 Rouge',  count: rouge, color: '#ef5350', expected: 48.65 },
                    { label: '⚫ Noir',   count: noir,  color: '#bdbdbd', expected: 48.65 },
                    { label: '🟢 Vert',  count: vert,  color: '#66bb6a', expected: 2.70  },
                  ].map(({ label, count, color, expected }) => {
                    const actual = n > 0 ? count / n * 100 : 0
                    const diff   = actual - expected
                    return (
                      <div key={label} className="flex justify-between items-center text-[9px]">
                        <span className="text-muted">{label}</span>
                        <span className="font-black tabular-nums" style={{ color }}>
                          {pct(count)}
                          <span className={`ml-1 text-[8px] ${Math.abs(diff) > 3 ? (diff > 0 ? 'text-orange' : 'text-neon') : 'text-muted'}`}>
                            ({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
                {colorTest && (
                  <div className={`text-[8px] font-black mt-2 pt-1 border-t border-border ${colorTest.pValue < 0.05 ? 'text-orange' : 'text-muted'}`}>
                    χ² p={colorTest.pValue.toFixed(3)} {colorTest.pValue < 0.05 ? '← BIAIS SIGNIFICATIF' : '(distribution normale)'}
                  </div>
                )}
              </div>

              <div className="bg-black rounded-xl p-3">
                <div className="text-[8px] text-muted mb-2 font-black tracking-wider">PAIR / IMPAIR</div>
                <div className="space-y-1">
                  {[
                    { label: '🟣 Pair',   count: pair,   color: '#ab47bc', expected: 48.65 },
                    { label: '🔵 Impair', count: impair, color: '#42a5f5', expected: 48.65 },
                  ].map(({ label, count, color, expected }) => {
                    const actual = n > 0 ? count / n * 100 : 0
                    const diff   = actual - expected
                    return (
                      <div key={label} className="flex justify-between items-center text-[9px]">
                        <span className="text-muted">{label}</span>
                        <span className="font-black tabular-nums" style={{ color }}>
                          {pct(count)}
                          <span className={`ml-1 text-[8px] ${Math.abs(diff) > 3 ? (diff > 0 ? 'text-orange' : 'text-neon') : 'text-muted'}`}>
                            ({diff > 0 ? '+' : ''}{diff.toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
                {parityTest && (
                  <div className={`text-[8px] font-black mt-2 pt-1 border-t border-border ${parityTest.pValue < 0.05 ? 'text-orange' : 'text-muted'}`}>
                    χ² p={parityTest.pValue.toFixed(3)} {parityTest.pValue < 0.05 ? '← BIAIS SIGNIFICATIF' : '(distribution normale)'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Numéros Chauds / Froids ─── */}
          {n >= 10 && (
            <div className="rk-card">
              <div className="rk-label">NUMÉROS CHAUDS & FROIDS</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[8px] font-black mb-1.5" style={{ color: '#ff7043' }}>🔥 TOP 5 CHAUDS</div>
                  {hot5.map((f, i) => (
                    <div key={f.number} className="flex items-center gap-1.5 py-0.5">
                      <span className="text-[8px] text-muted w-3">{i + 1}.</span>
                      <span className="text-xs font-black text-white w-5 text-center">{f.number}</span>
                      <span className="text-[8px] text-muted">{f.count}×</span>
                      <span className="text-[8px] font-black ml-auto" style={{ color: '#ff7043' }}>
                        +{f.deviation.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[8px] font-black mb-1.5 text-neon">❄️ TOP 5 FROIDS</div>
                  {cold5.map((f, i) => (
                    <div key={f.number} className="flex items-center gap-1.5 py-0.5">
                      <span className="text-[8px] text-muted w-3">{i + 1}.</span>
                      <span className="text-xs font-black text-white w-5 text-center">{f.number}</span>
                      <span className="text-[8px] text-muted">{f.count}×</span>
                      <span className="text-[8px] font-black ml-auto text-neon">
                        {f.deviation.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Matrice de Markov ─── */}
          {markov && markov.length > 0 && (
            <div className="rk-card">
              <div className="rk-label">TRANSITIONS MARKOV (secteur → secteur suivant)</div>
              <div className="text-[8px] text-muted mb-2">
                Probabilité qu'après le secteur X, le prochain spin tombe dans Y.
                Valeurs &gt;40% indiquent un clustering potentiel.
              </div>
              <table className="w-full text-[9px] font-mono">
                <thead>
                  <tr>
                    <th className="text-left text-muted py-1 pr-2">DE ↓ / VERS →</th>
                    {['voisins', 'tiers', 'orphelins', 'none'].map(k => (
                      <th key={k} className="text-center py-1 font-black" style={{ color: SECTOR_COLOR[k] }}>
                        {SECTOR_LABEL[k]}
                      </th>
                    ))}
                    <th className="text-right text-muted py-1">n</th>
                  </tr>
                </thead>
                <tbody>
                  {markov.map(row => (
                    <tr key={row.from} className="border-t border-border/30">
                      <td className="py-1.5 pr-2 font-black" style={{ color: SECTOR_COLOR[row.from] }}>
                        {SECTOR_LABEL[row.from]}
                      </td>
                      {(['voisins', 'tiers', 'orphelins', 'none'] as const).map(k => {
                        const val = row[k]
                        const highlight = val > 40
                        return (
                          <td key={k} className="text-center py-1.5">
                            <span className={`font-black ${highlight ? '' : 'text-muted'}`}
                              style={{ color: highlight ? SECTOR_COLOR[k] : undefined }}>
                              {val}%
                            </span>
                          </td>
                        )
                      })}
                      <td className="text-right py-1.5 text-muted">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[7px] text-muted mt-2 leading-relaxed">
                Distribution aléatoire théorique : VOI≈46% | TIE≈32% | ORP≈22%.
                Un écart significatif (&gt;±15%) sur &gt;50 transitions mérite attention.
              </div>
            </div>
          )}

          {/* Empty state */}
          {n < 5 && (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-muted text-xs">Enregistrez au moins 5 spins</div>
              <div className="text-muted text-xs">pour afficher les statistiques</div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
