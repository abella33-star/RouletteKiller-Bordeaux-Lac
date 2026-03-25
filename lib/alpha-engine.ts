/**
 * Bordeaux Alpha-Predator Engine v2 — TypeScript (synchronous version)
 * Mirrors the logic in public/alpha-worker.js exactly.
 *
 * Améliorations v2 :
 *   A. RECENCY_LAMBDA 0.3 → 0.75  (nEff ≈ 4 spins effectifs, Z plus stable)
 *   B. sectorConfidence = normalCDF(Z)×100  (probabilité unilatérale exacte)
 *   C. dualWindowDominant()  — confirmation courte (8) + longue (24) fenêtre
 *   D. findHotSubArc()       — arc consécutif le plus chaud dans le secteur
 */
import type { Spin, EngineResult, SectorData, SectorKey, OffsetAnalysis, SubArcResult, ColorPrediction } from './types'
import {
  CYLINDER, SMART_SPLITS, SECTOR_LABELS, RED_NUMBERS, EVEN_NUMBERS,
  WHEEL_POS, SIGNAL_THRESHOLDS, BET_RULES, SUB_ARC_SIZES,
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

// A. λ=0.75 → nEff = 1/(1-0.75) ≈ 4.0 spins effectifs (était 1.4 avec λ=0.3)
const RECENCY_LAMBDA = 0.75

function zScore(win: Spin[], nums: number[]): number {
  const n = win.length
  if (n === 0) return 0
  const p = nums.length / 37
  let nEff = 0, kEff = 0
  for (let i = 0; i < n; i++) {
    const w = Math.pow(RECENCY_LAMBDA, n - 1 - i) // oldest→lowest, newest→1.0
    nEff += w
    if (nums.includes(win[i].number)) kEff += w
  }
  const sigma = Math.sqrt(nEff * p * (1 - p))
  return sigma > 0 ? (kEff - nEff * p) / sigma : 0
}

function bayesianPosterior(win: Spin[], nums: number[], m = 4): number {
  const n = win.length
  if (n === 0) return nums.length / 37
  const p = nums.length / 37
  let nEff = 0, kEff = 0
  for (let i = 0; i < n; i++) {
    const w = Math.pow(RECENCY_LAMBDA, n - 1 - i)
    nEff += w
    if (nums.includes(win[i].number)) kEff += w
  }
  return (kEff + p * m) / (nEff + m)
}

// B. Probabilité unilatérale exacte : normalCDF(Z) × 100
function sectorConfidence(win: Spin[], nums: number[]): number {
  if (win.length < 1) return 0
  const Z = zScore(win, nums)
  if (Z <= 0) return 0
  return Math.round(normalCDF(Z) * 1000) / 10  // 0.0 – 100.0
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

  const DAMPING = 1
  const CLUSTER_TOL = 2 + DAMPING  // ±3 positions

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

// ── C. Double fenêtre de confirmation ─────────────────────────

/**
 * Retourne le secteur dominant UNIQUEMENT si les deux fenêtres s'accordent.
 * Fenêtre courte = 8 derniers spins.
 * Fenêtre longue = 24 derniers spins (fenêtre principale).
 */
function dualWindowDominant(spins: Spin[]): SectorKey | null {
  const winShort = spins.slice(-8)
  const winLong  = spins.slice(-Math.min(24, spins.length))

  if (winShort.length < 4) return null  // pas assez de données pour la courte fenêtre

  const keys: SectorKey[] = ['voisins', 'tiers', 'orphelins']
  const dominantIn = (win: Spin[]): SectorKey =>
    keys.reduce((best, k) =>
      zScore(win, CYLINDER[k]) > zScore(win, CYLINDER[best]) ? k : best
    , keys[0])

  const shortDom = dominantIn(winShort)
  const longDom  = dominantIn(winLong)

  return shortDom === longDom ? shortDom : null  // null = désaccord entre fenêtres
}

// ── D. Sous-arc chaud (sliding window sur cylindre physique) ──

/**
 * Trouve l'arc consécutif de min à max numéros dans le secteur
 * avec le Z-score le plus élevé.
 * CYLINDER[key] est déjà en ordre physique cylindre → les indices consécutifs
 * correspondent à des poches consécutives sur la roue.
 */
function findHotSubArc(win: Spin[], sectorKey: SectorKey): SubArcResult | null {
  const nums = CYLINDER[sectorKey]
  const { min, max } = SUB_ARC_SIZES[sectorKey]
  const n = nums.length
  let bestZ = 0, bestArc: number[] = []

  for (let arcLen = min; arcLen <= max; arcLen++) {
    for (let start = 0; start < n; start++) {
      const arc: number[] = []
      for (let j = 0; j < arcLen; j++) arc.push(nums[(start + j) % n])
      const z = zScore(win, arc)
      if (z > bestZ) { bestZ = z; bestArc = arc }
    }
  }

  if (bestZ <= 0 || bestArc.length === 0) return null
  return {
    numbers:       bestArc,
    arcZ:          Math.round(bestZ * 1000) / 1000,
    arcConfidence: Math.round(normalCDF(bestZ) * 1000) / 10,
  }
}

// ── Strategy ─────────────────────────────────────────────────

function getStrategy(
  key: SectorKey,
  confidence: number,
  bankroll: number,
  profit: number,
  subArc: SubArcResult | null,
) {
  // Jouer le sous-arc si disponible, sinon tout le secteur
  const playNums  = subArc ? subArc.numbers : CYLINDER[key]
  const splits    = playNums.map(n => `${n}-plein`)
  const maxN      = playNums.length

  let phase: 'Sniper' | 'Prudent', totalBet: number
  if (confidence >= SIGNAL_THRESHOLDS.KILLER &&
      profit     >= BET_RULES.KILLER_MIN_PROFIT) {
    phase    = 'Sniper'
    totalBet = profit * BET_RULES.SNIPER_PROFIT
  } else {
    phase    = 'Prudent'
    const pct = confidence >= 90 ? BET_RULES.PRUDENT_MAX : BET_RULES.PRUDENT_PCT
    totalBet  = bankroll * pct
  }

  const bps       = Math.max(1, Math.round(totalBet / maxN))
  const n         = maxN
  totalBet        = bps * n
  const potentialGain = bps * 35 - totalBet   // plein 35:1

  return { phase, totalBet, bps, n, splits, potentialGain }
}

// ── Colour Bias Analysis ──────────────────────────────────────
/**
 * 4 méthodes combinées :
 *   1. EWMA (λ=0.75) — estime P(rouge) récent, très réactif
 *   2. Z-score binomial — mesure l'écart vs baseline 18/37
 *   3. Streak actuelle — séquence consécutive de même couleur
 *   4. Markov 1er ordre — P(même couleur | couleur précédente) sur la session
 *
 * Signal ROUGE/NOIR uniquement si EWMA ET Z-score sont alignés (n≥12).
 * Pas de gambler's fallacy : le streak seul ne génère pas de signal.
 */
export function analyzeColorBias(spins: Spin[]): ColorPrediction | null {
  if (spins.length < 5) return null

  const win = spins.slice(-Math.min(24, spins.length))
  const n   = win.length

  // ── 1. EWMA pondéré (λ=0.75) ────────────────────────────────
  const p0 = 18 / 37       // baseline P(rouge) = 48.65%
  let ewma = p0             // initialise au prior
  for (const s of win) {
    ewma = RECENCY_LAMBDA * ewma + (1 - RECENCY_LAMBDA) * (RED_NUMBERS.has(s.number) ? 1 : 0)
  }

  // ── 2. Z-score binomial (fenêtre courte 12 ET longue 24) ─────
  // Court terme
  const winShort = spins.slice(-Math.min(12, spins.length))
  const kS = winShort.filter(s => RED_NUMBERS.has(s.number)).length
  const nS = winShort.length
  const zS = nS > 0 ? (kS - nS * p0) / Math.sqrt(nS * p0 * (1 - p0)) : 0

  // Long terme
  const kL = win.filter(s => RED_NUMBERS.has(s.number)).length
  const sigmaL = Math.sqrt(n * p0 * (1 - p0))
  const zL = sigmaL > 0 ? (kL - n * p0) / sigmaL : 0

  // Z composite : moyenne géométrique orientée des deux
  const zComposite = Math.sign(zS + zL) * Math.sqrt(Math.abs(zS) * Math.abs(zL))

  // ── 3. Streak actuelle ───────────────────────────────────────
  let streakCount = 0
  let streakColor: 'rouge' | 'noir' | 'vert' | null = null
  for (let i = spins.length - 1; i >= 0; i--) {
    const c = spins[i].color
    if (streakCount === 0) { streakColor = c; streakCount = 1 }
    else if (c === streakColor) streakCount++
    else break
  }

  // ── 4. Markov P(même couleur | couleur précédente) ──────────
  const colorOnly = spins.filter(s => s.number !== 0)
  let sameCount = 0, pairCount = 0
  for (let i = 1; i < colorOnly.length; i++) {
    const prevR = RED_NUMBERS.has(colorOnly[i - 1].number)
    const currR = RED_NUMBERS.has(colorOnly[i].number)
    pairCount++
    if (prevR === currR) sameCount++
  }
  const conditionalP = pairCount >= 10
    ? Math.round(sameCount / pairCount * 100)
    : null

  // ── 5. Probabilités estimées ─────────────────────────────────
  // EWMA = meilleur estimateur empirique de P(rouge) actuel
  const rougeProb = Math.round(Math.min(99, Math.max(1, ewma * 100)) * 10) / 10
  const noirProb  = Math.round(Math.min(99, Math.max(1, (1 - ewma - 1 / 37) * 100)) * 10) / 10

  // ── 6. Signal combiné ────────────────────────────────────────
  // Exige EWMA + Z du même signe + n suffisant (≥12 spins)
  let signal: 'ROUGE' | 'NOIR' | 'NEUTRE' = 'NEUTRE'
  let confidence = 50
  if (n >= 12) {
    if (ewma > p0 + 0.04 && zComposite > 0.8) {
      signal     = 'ROUGE'
      confidence = Math.round(normalCDF(zComposite) * 100)
    } else if (ewma < p0 - 0.04 && zComposite < -0.8) {
      signal     = 'NOIR'
      confidence = Math.round(normalCDF(-zComposite) * 100)
    }
  }

  return {
    rougeProb,
    noirProb,
    signal,
    confidence,
    streakCount,
    streakColor,
    ewmaRouge:    Math.round(ewma * 1000) / 10,
    zScore:       Math.round(zComposite * 100) / 100,
    conditionalP,
  }
}

// ── Main ─────────────────────────────────────────────────────

export function processData(
  spins:          Spin[],
  bankroll:       number,
  initialDeposit: number,
): EngineResult {
  const t0     = performance.now()
  const profit = bankroll - initialDeposit

  // Analyse couleur (disponible dès 5 spins, avant le seuil secteur)
  const colorPred = analyzeColorBias(spins)

  // Minimum spins requis pour l'analyse secteur
  if (spins.length < SIGNAL_THRESHOLDS.MIN_SPINS) {
    return {
      ..._out('WAIT', 0,
        { target:'—', type:'Calibration', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
        `En attente (${spins.length}/${SIGNAL_THRESHOLDS.MIN_SPINS} spins)`,
        0, '—', null, null, null, null, false, null, performance.now()-t0),
      colorPrediction: colorPred,
    }
  }

  // Fenêtre principale : 24 spins max
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

  // 4. Best sector + boost offset
  const bestKey = (Object.keys(sectors) as SectorKey[])
    .reduce((a, b) => sectors[a].confidence >= sectors[b].confidence ? a : b)
  const best = sectors[bestKey]
  let confidence = best.confidence
  if (offset.detected) confidence = Math.min(100, confidence * 1.30)
  confidence = Math.round(confidence * 10) / 10

  // 5. C. Double fenêtre — les deux doivent désigner le même secteur
  const dualSector = dualWindowDominant(spins)
  const dualWindowConfirmed = dualSector !== null && dualSector === bestKey

  // 6. Noise gate (seuil désactivé à 0 donc quasi-inactif, garde Z>2.5 override)
  if (noise && confidence < SIGNAL_THRESHOLDS.NOISE_GATE && best.Z <= 2.5) {
    return {
      ..._out('NOISE', confidence,
        { target:'NOISE', type:'—', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
        `Distributions aléatoires — χ²-col p=${cTest.pValue.toFixed(3)}, χ²-par p=${pTest.pValue.toFixed(3)}`,
        0, '—', sectors, cTest, pTest, offset, dualWindowConfirmed, null, performance.now()-t0),
      colorPrediction: colorPred,
    }
  }

  // 7. Status
  let status: 'WAIT' | 'PLAY' | 'KILLER'
  if      (confidence >= SIGNAL_THRESHOLDS.KILLER) status = 'KILLER'
  else if (confidence >= SIGNAL_THRESHOLDS.PLAY)   status = 'PLAY'
  else                                               status = 'WAIT'

  if (status === 'WAIT') {
    return {
      ..._out('WAIT', confidence,
        { target:SECTOR_LABELS[bestKey], type:'Attendre', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
        `Signal ${confidence}% (Z=${best.Z.toFixed(2)}σ) — attendre confirmation${dualWindowConfirmed ? ' ✓ dual-fenêtre' : ''}`,
        0, '—', sectors, cTest, pTest, offset, dualWindowConfirmed, null, performance.now()-t0),
      colorPrediction: colorPred,
    }
  }

  // 8. D. Sous-arc chaud
  const subArc = findHotSubArc(win, bestKey)

  // 9. Strategy — utilise le sous-arc si disponible
  const strat = getStrategy(bestKey, confidence, bankroll, profit, subArc)

  // 10. Reason
  const parts: string[] = []
  if (offset.detected)      parts.push(`Offset: ${offset.detail}`)
  if (subArc)               parts.push(`Arc ${subArc.numbers.length}num Z=+${subArc.arcZ.toFixed(2)}σ`)
  if (dualWindowConfirmed)  parts.push(`✓ dual-fenêtre`)
  parts.push(`${SECTOR_LABELS[bestKey]}: Z=+${best.Z.toFixed(2)}σ · Obs=${best.k}/Att=${best.E.toFixed(1)}`)
  if (!cTest.isNoise)  parts.push(`χ²-col p=${cTest.pValue.toFixed(3)}`)
  if (!pTest.isNoise)  parts.push(`χ²-par p=${pTest.pValue.toFixed(3)}`)

  const colorPred = analyzeColorBias(spins)

  return {
    ..._out(
      status, confidence,
      { target:SECTOR_LABELS[bestKey],
        type: strat.phase === 'Sniper' ? '🎯 Smart Pleins SNIPER' : 'Smart Pleins Prudent',
        splits: strat.splits, bet_per_split: strat.bps, bet_value: strat.totalBet, num_bets: strat.n },
      parts.join(' · '),
      strat.potentialGain,
      strat.phase,
      sectors, cTest, pTest, offset,
      dualWindowConfirmed, subArc,
      performance.now()-t0
    ),
    colorPrediction: colorPred,
  }
}

function _out(
  status:              EngineResult['status'],
  confidence:          number,
  recommendation:      EngineResult['recommendation'],
  reason:              string,
  potential_gain:      number,
  phase:               EngineResult['phase'],
  sectors:             EngineResult['sectors'],
  colorTest:           EngineResult['colorTest'],
  parityTest:          EngineResult['parityTest'],
  offsetAnalysis:      EngineResult['offsetAnalysis'],
  dualWindowConfirmed: boolean,
  subArc:              SubArcResult | null,
  latency:             number,
): EngineResult {
  return {
    status, confidence, recommendation, reason, potential_gain, phase,
    sectors, colorTest, parityTest, offsetAnalysis,
    dualWindowConfirmed, subArc,
    colorPrediction: null,
    latency: Math.round(latency * 100) / 100,
  }
}

// ── Per-number heat (for heatmap) ────────────────────────────
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
