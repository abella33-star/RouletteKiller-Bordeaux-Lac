'use client'
import { useState, useCallback } from 'react'
import type { Spin, ChiSquareResult, ChanceZone, MonteCarloResult } from '@/lib/types'
import { analyzeAllChances, runMonteCarlo } from '@/lib/alpha-engine'

// ── Sub-components ─────────────────────────────────────────────

interface NumberFreq { number: number; count: number; deviation: number }
interface MarkovRow  { from: string; voisins: number; tiers: number; orphelins: number; none: number; total: number }

function computeNumberFreqs(spins: Spin[]): NumberFreq[] {
  if (!spins.length) return []
  const counts: Record<number, number> = {}
  for (let i = 0; i <= 36; i++) counts[i] = 0
  for (const s of spins) counts[s.number]++
  const exp = spins.length / 37
  return Array.from({ length: 37 }, (_, i) => ({
    number: i, count: counts[i],
    deviation: exp > 0 ? (counts[i] - exp) / exp * 100 : 0,
  }))
}

function computeMarkov(spins: Spin[]): MarkovRow[] | null {
  if (spins.length < 5) return null
  const keys = ['voisins', 'tiers', 'orphelins', 'none'] as const
  const counts: Record<string, Record<string, number>> = {}
  for (const k of keys) counts[k] = { voisins: 0, tiers: 0, orphelins: 0, none: 0 }
  for (let i = 0; i < spins.length - 1; i++) {
    counts[spins[i].zone ?? 'none'][spins[i+1].zone ?? 'none']++
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

function Sparkline({ history, initialDeposit }: { history: number[]; initialDeposit: number }) {
  if (history.length < 2) return null
  const W = 300, H = 50
  const min = Math.min(...history, initialDeposit * 0.8)
  const max = Math.max(...history, initialDeposit * 1.2)
  const rng = max - min || 1
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W
    const y = H - ((v - min) / rng) * (H - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const baseY = H - ((initialDeposit - min) / rng) * (H - 4) - 2
  const last = history[history.length - 1]
  const isProfit = last >= initialDeposit
  const lastY = H - ((last - min) / rng) * (H - 4) - 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="#555" strokeWidth="1" strokeDasharray="4 3" />
      <polyline points={pts} fill="none" stroke={isProfit ? '#00E676' : '#FF1744'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W} cy={lastY} r="3" fill={isProfit ? '#00E676' : '#FF1744'} />
    </svg>
  )
}

// ── Variance théorique ─────────────────────────────────────────
const N_VALS = [10, 50, 100, 500, 1000]
const BET_TYPES = [
  { name: 'Plein (1/37)',     p: 1/37 },
  { name: 'Simple (18/37)',   p: 18/37 },
  { name: 'Douzaine (12/37)', p: 12/37 },
]

// ── MCHistogram ────────────────────────────────────────────────
function MCHistogram({ histogram }: { histogram: number[] }) {
  const W = 280, H = 60
  const n = histogram.length
  const bw = W / n
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* 100% initial line at bucket 10 */}
      <line x1={bw * 10} y1={0} x2={bw * 10} y2={H} stroke="#FFD700" strokeWidth="1" strokeDasharray="3 2" />
      {histogram.map((v, i) => {
        const barH = v * (H - 2)
        const x = i * bw + 0.5
        return (
          <rect key={i} x={x} y={H - barH} width={bw - 1} height={barH}
            fill={i < 10 ? '#FF1744' : '#00E676'} opacity={0.8} rx={1} />
        )
      })}
      {/* Labels */}
      <text x={bw * 10} y={H - 2} textAnchor="middle" fill="#FFD700" fontSize={7}>= dépôt</text>
    </svg>
  )
}

// ── Sigma badge ────────────────────────────────────────────────
function SigmaBadge({ z }: { z: number }) {
  const abs = Math.abs(z)
  if (abs < 1)   return <span className="text-[7px] text-muted">—</span>
  if (abs < 2)   return <span className="text-[7px] font-black text-yellow-400">1σ</span>
  if (abs < 3)   return <span className="text-[8px] font-black text-orange">2σ ⚠️</span>
  return              <span className="text-[8px] font-black text-crimson">3σ 🚨</span>
}

// ── Props ──────────────────────────────────────────────────────
interface Props {
  spins:           Spin[]
  bankrollHistory: number[]
  initialDeposit:  number
  bankroll:        number
  colorTest:       ChiSquareResult | null
  parityTest:      ChiSquareResult | null
  onClose:         () => void
}

const SECTOR_COLOR: Record<string, string> = {
  voisins: '#4FC3F7', tiers: '#FFD54F', orphelins: '#CE93D8', none: '#555',
}
const SECTOR_LABEL: Record<string, string> = {
  voisins: 'VOI', tiers: 'TIE', orphelins: 'ORP', none: '—',
}

// ── Main ──────────────────────────────────────────────────────
export default function StatsPanel({
  spins, bankrollHistory, initialDeposit, bankroll,
  colorTest, parityTest, onClose,
}: Props) {
  const [tab, setTab] = useState<'session' | 'zones' | 'montecarlo'>('session')

  // Monte Carlo state
  const [mcSpins,  setMcSpins]  = useState(100)
  const [mcBetPct, setMcBetPct] = useState(2)
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null)
  const [mcRunning, setMcRunning] = useState(false)

  const runMC = useCallback(() => {
    setMcRunning(true)
    setTimeout(() => {
      const res = runMonteCarlo(bankroll || 100, mcBetPct / 100, mcSpins, 2000)
      setMcResult(res)
      setMcRunning(false)
    }, 10)
  }, [bankroll, mcBetPct, mcSpins])

  const n      = spins.length
  const freqs  = computeNumberFreqs(spins)
  const hot5   = [...freqs].sort((a, b) => b.count - a.count).slice(0, 5)
  const cold5  = [...freqs].sort((a, b) => a.count - b.count).slice(0, 5)
  const markov = computeMarkov(spins)
  const zones  = tab === 'zones' ? analyzeAllChances(spins) : []

  const lastBR   = bankrollHistory[bankrollHistory.length - 1] ?? initialDeposit
  const profit   = lastBR - initialDeposit
  const roi      = initialDeposit > 0 ? (profit / initialDeposit * 100).toFixed(1) : '0'
  const isProfit = profit >= 0

  // Color counts
  const rouge   = spins.filter(s => s.color === 'rouge').length
  const noir    = spins.filter(s => s.color === 'noir').length
  const vert    = spins.filter(s => s.color === 'vert').length
  const pair    = spins.filter(s => s.number > 0 && s.number % 2 === 0).length
  const impair  = spins.filter(s => s.number % 2 !== 0).length
  const pct = (v: number) => n > 0 ? (v / n * 100).toFixed(1) + '%' : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ paddingBottom: 'var(--sab)' }}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl border-t border-border overflow-hidden flex flex-col" style={{ maxHeight: '90dvh' }}>

        {/* ── Header ── */}
        <div className="flex-shrink-0 border-b border-border flex items-center justify-between px-4 py-2.5">
          <span className="text-xs font-black tracking-widest">ANALYSE STATISTIQUE</span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-muted font-mono">{n} spins</span>
            <button onClick={onClose} className="text-muted text-xl leading-none">✕</button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex-shrink-0 grid grid-cols-3 border-b border-border">
          {(['session', 'zones', 'montecarlo'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2 text-[9px] font-black tracking-wider transition-colors ${
                tab === t
                  ? 'text-neon border-b-2 border-neon bg-neon/5'
                  : 'text-muted hover:text-white'
              }`}>
              {t === 'session' ? '📊 SESSION' : t === 'zones' ? '🎯 ZONES' : '🎲 MONTE CARLO'}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ════════════ TAB SESSION ════════════ */}
          {tab === 'session' && (
            <div className="p-3 flex flex-col gap-3">

              {/* Sparkline */}
              {bankrollHistory.length > 1 && (
                <div className="rk-card">
                  <div className="rk-label">ÉVOLUTION BANKROLL</div>
                  <Sparkline history={bankrollHistory} initialDeposit={initialDeposit} />
                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[9px] text-muted">Dépôt: <b className="text-white">{initialDeposit.toFixed(2)}€</b></span>
                    <span className={`text-[10px] font-black ${isProfit ? 'text-neon' : 'text-crimson'}`}>
                      {isProfit ? '+' : ''}{profit.toFixed(2)}€ ({isProfit ? '+' : ''}{roi}% ROI)
                    </span>
                    <span className="text-[9px] text-muted">Actuel: <b className="text-white">{lastBR.toFixed(2)}€</b></span>
                  </div>
                </div>
              )}

              {/* Biais couleur & parité */}
              <div className="rk-card">
                <div className="rk-label">BIAIS COULEUR & PARITÉ</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black rounded-xl p-3">
                    <div className="text-[8px] text-muted mb-2 font-black tracking-wider">ROUGE / NOIR / VERT</div>
                    {[
                      { label: '🔴 Rouge', count: rouge, color: '#ef5350', exp: 48.65 },
                      { label: '⚫ Noir',  count: noir,  color: '#bdbdbd', exp: 48.65 },
                      { label: '🟢 Vert', count: vert,  color: '#66bb6a', exp: 2.70  },
                    ].map(({ label, count, color, exp }) => {
                      const actual = n > 0 ? count / n * 100 : 0
                      const diff = actual - exp
                      return (
                        <div key={label} className="flex justify-between items-center text-[9px] py-0.5">
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
                    {colorTest && (
                      <div className={`text-[8px] font-black mt-1.5 pt-1 border-t border-border ${colorTest.pValue < 0.05 ? 'text-orange' : 'text-muted'}`}>
                        χ² p={colorTest.pValue.toFixed(3)} {colorTest.pValue < 0.05 ? '← BIAIS DÉTECTÉ' : '(normal)'}
                      </div>
                    )}
                  </div>
                  <div className="bg-black rounded-xl p-3">
                    <div className="text-[8px] text-muted mb-2 font-black tracking-wider">PAIR / IMPAIR</div>
                    {[
                      { label: '🟣 Pair',   count: pair,   color: '#ab47bc', exp: 48.65 },
                      { label: '🔵 Impair', count: impair, color: '#42a5f5', exp: 48.65 },
                    ].map(({ label, count, color, exp }) => {
                      const actual = n > 0 ? count / n * 100 : 0
                      const diff = actual - exp
                      return (
                        <div key={label} className="flex justify-between items-center text-[9px] py-0.5">
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
                    {parityTest && (
                      <div className={`text-[8px] font-black mt-1.5 pt-1 border-t border-border ${parityTest.pValue < 0.05 ? 'text-orange' : 'text-muted'}`}>
                        χ² p={parityTest.pValue.toFixed(3)} {parityTest.pValue < 0.05 ? '← BIAIS DÉTECTÉ' : '(normal)'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hot / Cold */}
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

              {/* Markov */}
              {markov && markov.length > 0 && (
                <div className="rk-card">
                  <div className="rk-label">TRANSITIONS MARKOV (secteur → secteur suivant)</div>
                  <div className="text-[8px] text-muted mb-2">
                    Valeurs &gt;40% → clustering potentiel. Théorie : VOI≈46% | TIE≈32% | ORP≈22%
                  </div>
                  <table className="w-full text-[9px] font-mono">
                    <thead>
                      <tr>
                        <th className="text-left text-muted py-1 pr-2">DE↓ / VERS→</th>
                        {['voisins','tiers','orphelins','none'].map(k => (
                          <th key={k} className="text-center py-1 font-black" style={{ color: SECTOR_COLOR[k] }}>{SECTOR_LABEL[k]}</th>
                        ))}
                        <th className="text-right text-muted py-1">n</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markov.map(row => (
                        <tr key={row.from} className="border-t border-border/30">
                          <td className="py-1.5 pr-2 font-black" style={{ color: SECTOR_COLOR[row.from] }}>{SECTOR_LABEL[row.from]}</td>
                          {(['voisins','tiers','orphelins','none'] as const).map(k => {
                            const val = row[k]
                            return (
                              <td key={k} className="text-center py-1.5">
                                <span className={`font-black ${val > 40 ? '' : 'text-muted'}`} style={{ color: val > 40 ? SECTOR_COLOR[k] : undefined }}>{val}%</span>
                              </td>
                            )
                          })}
                          <td className="text-right py-1.5 text-muted">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {n < 5 && (
                <div className="text-center py-10">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-muted text-xs">Enregistrez au moins 5 spins</div>
                </div>
              )}
            </div>
          )}

          {/* ════════════ TAB ZONES ════════════ */}
          {tab === 'zones' && (
            <div className="p-3 flex flex-col gap-3">

              {/* Rappel théorique */}
              <div className="rk-card">
                <div className="rk-label">PROBABILITÉS THÉORIQUES & VARIANCE (σ = √(n·p·(1−p)))</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[8px] font-mono">
                    <thead>
                      <tr>
                        <th className="text-left text-muted py-1 pr-2">Type / n→</th>
                        {N_VALS.map(nv => (
                          <th key={nv} className="text-center text-muted py-1">{nv}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {BET_TYPES.map(bt => (
                        <tr key={bt.name} className="border-t border-border/30">
                          <td className="py-1.5 pr-2 font-black text-white text-[7px]">{bt.name}</td>
                          {N_VALS.map(nv => {
                            const sigma = Math.sqrt(nv * bt.p * (1 - bt.p))
                            const twoS  = 2 * sigma
                            return (
                              <td key={nv} className="text-center py-1.5 text-[7px]">
                                <span className="text-muted">±</span>
                                <span className="text-neon font-black">{sigma.toFixed(1)}</span>
                                <br />
                                <span className="text-[6px] text-muted">(2σ={twoS.toFixed(0)})</span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-[7px] text-muted mt-2 leading-relaxed">
                  Un écart de 2σ se produit naturellement ~4.6% du temps. À 3σ : ~0.3%. Ce sont des variations normales, pas des anomalies.
                </div>
              </div>

              {/* Zones analysées */}
              {n >= 5 ? (
                <>
                  {(['simple', 'douzaine', 'colonne'] as ChanceZone['category'][]).map(cat => {
                    const catZones = zones.filter(z => z.category === cat)
                    const catName = cat === 'simple' ? 'CHANCES SIMPLES' : cat === 'douzaine' ? 'DOUZAINES' : 'COLONNES'
                    return (
                      <div key={cat} className="rk-card">
                        <div className="rk-label">{catName}</div>
                        <table className="w-full text-[9px]">
                          <thead>
                            <tr>
                              <th className="text-left text-muted py-1">Zone</th>
                              <th className="text-center text-muted py-1">Obs.</th>
                              <th className="text-center text-muted py-1">Att.</th>
                              <th className="text-center text-muted py-1">Z-score</th>
                              <th className="text-center text-muted py-1">σ</th>
                              <th className="text-right text-muted py-1">p-val</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catZones.map(z => {
                              const abs = Math.abs(z.zScore)
                              const zColor = abs >= 3 ? '#FF1744' : abs >= 2 ? '#FF6D00' : abs >= 1 ? '#FFD700' : '#555'
                              return (
                                <tr key={z.name} className="border-t border-border/20">
                                  <td className="py-1.5 font-black text-white">{z.name}</td>
                                  <td className="text-center py-1.5">{z.observed}</td>
                                  <td className="text-center py-1.5 text-muted">{z.expected}</td>
                                  <td className="text-center py-1.5 font-black tabular-nums" style={{ color: zColor }}>
                                    {z.zScore > 0 ? '+' : ''}{z.zScore.toFixed(2)}
                                  </td>
                                  <td className="text-center py-1.5">
                                    <SigmaBadge z={z.zScore} />
                                  </td>
                                  <td className="text-right py-1.5 font-mono" style={{ color: z.pValue < 0.05 ? '#FF6D00' : '#555', fontSize: 8 }}>
                                    {z.pValue.toFixed(3)}
                                    {z.pValue < 0.05 && ' *'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        <div className="text-[7px] text-muted mt-1">
                          * p&lt;0.05 : écart statistiquement notable (peut être du hasard avec 20 zones testées simultanément)
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : (
                <div className="text-center py-10 text-muted text-xs">Minimum 5 spins pour l'analyse des zones</div>
              )}
            </div>
          )}

          {/* ════════════ TAB MONTE CARLO ════════════ */}
          {tab === 'montecarlo' && (
            <div className="p-3 flex flex-col gap-3">

              {/* Explication */}
              <div className="rk-card">
                <div className="rk-label">SIMULATION MONTE CARLO — LOI DES GRANDS NOMBRES</div>
                <div className="text-[8px] text-muted leading-relaxed">
                  Simule 2 000 sessions indépendantes. Chaque spin = chance simple (rouge/noir).
                  <br />
                  <span className="text-orange font-black">P(gagner) = 18/37 ≈ 48.65% — EV = −1/37 ≈ −2.70% par spin.</span>
                  <br />
                  Peu importe la stratégie : l'espérance reste négative. Le Kelly optimal = 0€.
                </div>
              </div>

              {/* Paramètres */}
              <div className="rk-card">
                <div className="rk-label">PARAMÈTRES</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="text-muted">Spins par session</span>
                      <span className="font-black text-white">{mcSpins}</span>
                    </div>
                    <input type="range" min={20} max={500} step={10} value={mcSpins}
                      onChange={e => setMcSpins(Number(e.target.value))}
                      className="w-full accent-neon" />
                    <div className="flex justify-between text-[7px] text-muted mt-0.5">
                      <span>20</span><span>500</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[9px] mb-1">
                      <span className="text-muted">Mise par spin (% bankroll)</span>
                      <span className="font-black text-white">{mcBetPct}%</span>
                    </div>
                    <input type="range" min={1} max={10} step={0.5} value={mcBetPct}
                      onChange={e => setMcBetPct(Number(e.target.value))}
                      className="w-full accent-neon" />
                    <div className="flex justify-between text-[7px] text-muted mt-0.5">
                      <span>1%</span><span>10%</span>
                    </div>
                  </div>
                  <button
                    onClick={runMC}
                    disabled={mcRunning}
                    className="w-full rounded-xl py-3 font-black text-xs tracking-widest border transition-all active:scale-95"
                    style={{
                      background: mcRunning ? '#111' : 'rgba(0,230,118,0.1)',
                      borderColor: mcRunning ? '#333' : '#00E676',
                      color: mcRunning ? '#555' : '#00E676',
                    }}>
                    {mcRunning ? '⏳ SIMULATION EN COURS…' : '▶ LANCER 2 000 SIMULATIONS'}
                  </button>
                </div>
              </div>

              {/* Résultats */}
              {mcResult && (
                <>
                  <div className="rk-card">
                    <div className="rk-label">RÉSULTATS — {mcResult.simulations.toLocaleString('fr-FR')} SIMULATIONS</div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: 'Probabilité de ruine', val: `${mcResult.ruinProbability}%`, color: '#FF1744' },
                        { label: 'Médiane finale',       val: `${mcResult.medianFinal}%`,     color: mcResult.medianFinal >= 100 ? '#00E676' : '#FF1744' },
                        { label: 'Moyenne finale',       val: `${mcResult.meanFinal}%`,       color: mcResult.meanFinal >= 100 ? '#00E676' : '#FF1744' },
                        { label: 'EV théorique',         val: `${mcResult.theoreticalEV.toFixed(2)}€`, color: '#FF1744' },
                        { label: '5e percentile',        val: `${mcResult.p5}%`,              color: '#FF1744' },
                        { label: '95e percentile',       val: `${mcResult.p95}%`,             color: mcResult.p95 >= 100 ? '#00E676' : '#FF6D00' },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="bg-black rounded-xl p-2.5">
                          <div className="text-[7px] text-muted mb-0.5">{label}</div>
                          <div className="text-sm font-black tabular-nums" style={{ color }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Histogramme */}
                    <div className="rk-label">DISTRIBUTION DES BANKROLLS FINALES</div>
                    <MCHistogram histogram={mcResult.histogram} />
                    <div className="flex justify-between text-[7px] text-muted mt-1">
                      <span>0%</span>
                      <span className="text-yellow-400">= dépôt initial</span>
                      <span>200%+</span>
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[7px]">
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{background:'#FF1744'}} /> Perte</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm" style={{background:'#00E676'}} /> Profit</span>
                    </div>
                  </div>

                  <div className="rk-card">
                    <div className="rk-label">INTERPRÉTATION MATHÉMATIQUE</div>
                    <div className="text-[8px] text-muted leading-relaxed space-y-1.5">
                      <p>• La médiane <span className="font-black text-white">{mcResult.medianFinal}%</span> confirme : après {mcResult.spinsPerSession} spins à {(mcResult.betFraction*100)}% de mise, la moitié des joueurs perd de l'argent.</p>
                      <p>• L'EV théorique est <span className="font-black text-crimson">{mcResult.theoreticalEV.toFixed(2)}€</span> — toujours négatif, quelle que soit la stratégie.</p>
                      <p>• Le critère de Kelly optimal pour cette mise est <span className="font-black text-crimson">0%</span> (ne pas miser) car l'espérance est négative.</p>
                      <p>• Augmenter la mise accélère la ruine — c'est l'effet de la <span className="font-black text-orange">loi des grands nombres</span>.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
