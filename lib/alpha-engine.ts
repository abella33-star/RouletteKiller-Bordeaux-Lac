/**
 * Bordeaux Alpha-Predator Engine — TypeScript (synchronous version)
 * Mirrors the logic in public/alpha-worker.js exactly.
 * Used as: direct call OR via Web Worker (alpha-worker.js in public/).
 */
import type { Spin, EngineResult, SectorData, SectorKey, OffsetAnalysis } from './types'
import {
  CYLINDER, SMART_SPLITS, SECTOR_LABELS, RED_NUMBERS, EVEN_NUMBERS,
  WHEEL_POS, SIGNAL_THRESHOLDS, BET_RULES,
} from './constants'

// ── Math helpers ─────────────────────────────────────────────

function normalCDF(z: number): number {
  if (z < -8) return 0
  if (z >  8) return 1
  const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429]
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const poly = t * (a[0] + t * (a[1] + t * (a[2] + t * (a[3] + t * a[4]))))
  const p = 1 - Math.exp(-0.5 * z * z) * 0.3989422804 * poly
  return z >= 0 ? p : 1 - p
}

function chiSqPValue(chi2: number, df: number): number {
  if (chi2 <= 0) return 1
  if (df === 1) return 2 * (1 - normalCDF(Math.sqrt(chi2)))
  if (df === 2) return Math.exp(-chi2 / 2)
  const z = Math.pow(chi2 / df, 1 / 3) - (1 - 2 / (9 * df))
  return 1 - normalCDF(z / Math.sqrt(2 / (9 * df)))
}

// ── Sector statistics ─────────────────────────────────────────

function zScore(win: Spin[], nums: number[]): number {
  const n = win.length
  const k = win.filter(s => nums.includes(s.number)).length
  const p = nums.length / 37
  const sigma = Math.sqrt(n * p * (1 - p))
  return sigma > 0 ? (k - n * p) / sigma : 0
}

function bayesianPosterior(win: Spin[], nums: number[], m = 4): number {
  const n = win.length
  const k = win.filter(s => nums.includes(s.number)).length
  const p = nums.length / 37
  return (k + p * m) / (n + m)
}

function sectorConfidence(win: Spin[], nums: number[]): number {
  if (win.length < 1) return 0
  const N = win.length
  const Z = zScore(win, nums)
  if (Z <= 0) return 0
  // Dampened by sample size: needs N≥10 + strong Z to reach PLAY threshold
  return Math.min(100, Math.max(0, (N / 30) * (Z / 2) * 100))
}

// ── Chi-Square noise filters ──────────────────────────────────

function colorChiSquare(win: Spin[]) {
  const n = win.length
  if (n < 3) return { chi2: 0, pValue: 0.5, isNoise: false }
  const r  = win.filter(s => RED_NUMBERS.has(s.number)).length
  const v  = win.filter(s => s.number === 0).length
  const b  = n - r - v
  const Er = n * 18 / 37, Eb = n * 18 / 37, Ev = n / 37
  const chi2 = (r-Er)**2/Er + (b-Eb)**2/Eb + (v-Ev)**2/Ev
  const pValue = chiSqPValue(chi2, 2)
  return { chi2, pValue, isNoise: pValue > 0.05 }
}

function parityChiSquare(win: Spin[]) {
  const n    = win.length
  if (n < 3) return { chi2: 0, pValue: 0.5, isNoise: false }
  const even = win.filter(s => s.number > 0 && EVEN_NUMBERS.has(s.number)).length
  const odd  = win.filter(s => s.number > 0 && !EVEN_NUMBERS.has(s.number)).length
  const nz   = even + odd
  if (nz < 5) return { chi2: 0, pValue: 1, isNoise: true }
  const Ep   = nz / 2
  const chi2 = (even-Ep)**2/Ep + (odd-Ep)**2/Ep
  const pValue = chiSqPValue(chi2, 1)
  return { chi2, pValue, isNoise: pValue > 0.05 }
}

// ── Mechanical Signature (Offset Cluster) ────────────────────

function analyzeOffset(spins: Spin[]): OffsetAnalysis {
  const NONE: OffsetAnalysis = { detected:false, boost:0, center:null, count:0, total:0, detail:null }

  const enriched = spins.map((s, i) => ({
    ...s,
    starting_point: s.starting_point ?? (i > 0 ? spins[i-1].number : undefined),
  }))

  const valid = enriched.filter(s =>
    s.starting_point != null &&
    WHEEL_POS[s.starting_point!] !== undefined &&
    WHEEL_POS[s.number] !== undefined
  )
  const recent = valid.slice(-10)
  if (recent.length < 3) return NONE

  // Bidirectional: cylinder rotates CW, ball CCW — take minimum physical distance
  const DAMPING = 1          // ±1 pocket glissement on Alfastreet carpet
  const CLUSTER_TOL = 2 + DAMPING  // = 3 positions tolerance

  const offsets = recent.map(s => {
    const sp = WHEEL_POS[s.starting_point!]
    const rp = WHEEL_POS[s.number]
    const cw  = (rp - sp + 37) % 37
    const ccw = (sp - rp + 37) % 37
    return Math.min(cw, ccw)
  })

  let best = { center: -1, count: 0 }
  for (let c = 0; c < 37; c++) {
    const cnt = offsets.filter(o => Math.min(Math.abs(o-c), 37-Math.abs(o-c)) <= CLUSTER_TOL).length
    if (cnt > best.count) best = { center: c, count: cnt }
  }

  const detected = best.count >= 3
  return {
    detected,
    boost:  detected ? 30 : 0,
    center: best.center >= 0 ? best.center : null,
    count:  best.count,
    total:  recent.length,
    detail: detected ? `Offset ~${best.center} cases (${best.count}/${recent.length} rép.)` : null,
  }
}

// ── Strategy ─────────────────────────────────────────────────

function formatSplits(key: SectorKey): string[] {
  const s = SMART_SPLITS[key]
  return [
    ...s.splits.map(([a,b]) => `${a}/${b}`),
    ...s.pleins.map(n => `${n}-plein`),
  ]
}

function numBets(key: SectorKey): number {
  return SMART_SPLITS[key].splits.length + SMART_SPLITS[key].pleins.length
}

function getStrategy(key: SectorKey, confidence: number, bankroll: number, profit: number) {
  const allSplits = formatSplits(key)
  const maxN      = numBets(key)

  let phase: 'Sniper' | 'Prudent', totalBet: number
  if (confidence >= SIGNAL_THRESHOLDS.KILLER &&
      profit     >= BET_RULES.KILLER_MIN_PROFIT) {
    phase    = 'Sniper'
    totalBet = profit * BET_RULES.SNIPER_PROFIT
  } else {
    phase    = 'Prudent'
    const pct = confidence >= 85 ? BET_RULES.PRUDENT_MAX : BET_RULES.PRUDENT_PCT
    totalBet  = bankroll * pct
  }

  // Enforce 1€ minimum per position — round to whole euros, trim positions if needed
  let bps = Math.round(totalBet / maxN)
  let n: number
  if (bps < 1) {
    bps = 1
    n   = Math.max(1, Math.floor(totalBet))
  } else {
    n = maxN
  }
  totalBet = bps * n

  const splits        = allSplits.slice(0, n)
  // Always use 35x payout (consistent with bankroll win formula)
  const potentialGain = bps * 35 - totalBet

  return { phase, totalBet, bps, n, splits, potentialGain }
}

// ── Main ─────────────────────────────────────────────────────

export function processData(
  spins:         Spin[],
  bankroll:      number,
  initialDeposit: number,
): EngineResult {
  const t0   = performance.now()
  const profit = bankroll - initialDeposit

  // Need at least 1 spin to analyze
  if (spins.length < 1) {
    return _out('WAIT', 0,
      { target:'—', type:'Calibration', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
      'En attente du premier numéro', 0, '—',
      null, null, null, null, performance.now()-t0)
  }

  // Analysis window: use all available spins, max 24
  const win = spins.slice(-Math.min(24, spins.length))

  // 1. Chi-Square filters
  const cTest = colorChiSquare(win)
  const pTest = parityChiSquare(win)
  const noise = cTest.isNoise && pTest.isNoise

  // 2. Sector scores
  const sectors = {} as Record<SectorKey, SectorData>
  for (const [key, nums] of Object.entries(CYLINDER) as [SectorKey, number[]][]) {
    const Z    = zScore(win, nums)
    const post = bayesianPosterior(win, nums)
    const conf = sectorConfidence(win, nums)
    const k    = win.filter(s => nums.includes(s.number)).length
    const E    = win.length * (nums.length / 37)
    sectors[key] = { Z, posterior: post, confidence: conf, k, E }
  }

  // 3. Mechanical signature
  const offset = analyzeOffset(spins)

  // 4. Best sector + boost
  const bestKey = (Object.keys(sectors) as SectorKey[])
    .reduce((a, b) => sectors[a].confidence >= sectors[b].confidence ? a : b)
  const best = sectors[bestKey]
  let confidence = best.confidence
  if (offset.detected) confidence = Math.min(100, confidence * 1.30)
  confidence = Math.round(confidence * 10) / 10

  // 5. Noise gate
  if (noise && confidence < SIGNAL_THRESHOLDS.NOISE_GATE) {
    return _out('NOISE', confidence,
      { target:'NOISE', type:'—', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
      `Distributions aléatoires — χ²-col p=${cTest.pValue.toFixed(3)}, χ²-par p=${pTest.pValue.toFixed(3)}`,
      0, '—', sectors, cTest, pTest, offset, performance.now()-t0)
  }

  // 6. Status
  let status: 'WAIT' | 'PLAY' | 'KILLER'
  if (confidence >= SIGNAL_THRESHOLDS.KILLER) {
    status = 'KILLER'
  } else if (confidence >= SIGNAL_THRESHOLDS.PLAY) {
    status = 'PLAY'
  } else {
    status = 'WAIT'
  }

  if (status === 'WAIT') {
    return _out('WAIT', confidence,
      { target:SECTOR_LABELS[bestKey], type:'Attendre', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
      `Signal faible (${confidence}%) — Z=${best.Z.toFixed(2)}σ · attendre renforcement`,
      0, '—', sectors, cTest, pTest, offset, performance.now()-t0)
  }

  // 7. Strategy
  const strat = getStrategy(bestKey, confidence, bankroll, profit)

  // 8. Reason
  const parts: string[] = []
  if (offset.detected) parts.push(`Signature Offset: ${offset.detail}`)
  parts.push(`${SECTOR_LABELS[bestKey]}: Z=+${best.Z.toFixed(2)}σ · Obs=${best.k}/Att=${best.E.toFixed(1)}`)
  if (!cTest.isNoise)  parts.push(`χ²-col p=${cTest.pValue.toFixed(3)}`)
  if (!pTest.isNoise)  parts.push(`χ²-par p=${pTest.pValue.toFixed(3)}`)

  return _out(
    status, confidence,
    { target:SECTOR_LABELS[bestKey], type:strat.phase==='Sniper'?'🎯 Smart Splits SNIPER':'Smart Splits Prudent',
      splits:strat.splits, bet_per_split:strat.bps, bet_value:strat.totalBet, num_bets:strat.n },
    parts.join(' + '),
    strat.potentialGain,
    strat.phase,
    sectors, cTest, pTest, offset, performance.now()-t0
  )
}

function _out(
  status: EngineResult['status'], confidence: number,
  recommendation: EngineResult['recommendation'],
  reason: string, potential_gain: number, phase: EngineResult['phase'],
  sectors: EngineResult['sectors'], colorTest: EngineResult['colorTest'],
  parityTest: EngineResult['parityTest'], offsetAnalysis: EngineResult['offsetAnalysis'],
  latency: number
): EngineResult {
  return {
    status, confidence, recommendation, reason, potential_gain, phase,
    sectors, colorTest, parityTest, offsetAnalysis,
    latency: Math.round(latency * 100) / 100,
  }
}

// ── Per-number heat (for heatmap) ────────────────────────────
/** Returns a Z-score-like heat value for each number in [0,36] */
export function computeNumberHeat(spins: Spin[]): Record<number, number> {
  const win = spins.slice(-Math.min(24, Math.max(18, spins.length)))
  const counts: Record<number, number> = {}
  for (let n = 0; n <= 36; n++) counts[n] = 0
  win.forEach(s => { counts[s.number] = (counts[s.number] || 0) + 1 })

  const n = win.length
  if (n < 1) return counts

  const p = 1 / 37
  const E = n * p
  const sigma = Math.sqrt(n * p * (1 - p))

  const heat: Record<number, number> = {}
  for (let num = 0; num <= 36; num++) {
    heat[num] = sigma > 0 ? (counts[num] - E) / sigma : 0
  }
  return heat
}
