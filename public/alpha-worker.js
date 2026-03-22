'use strict';
// ============================================================
//  BORDEAUX ALPHA-PREDATOR ENGINE — Worker Thread
//  Détection d'anomalies mécaniques et statistiques en temps réel
//  Latence cible < 50 ms  ·  Aucune dépendance externe
// ============================================================

// ───────────────────────────────────────────────────────────────
//  CYLINDRE EUROPÉEN (ordre physique Alfastreet)
// ───────────────────────────────────────────────────────────────
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WHEEL_POS   = {};   // number → position index on wheel
WHEEL_ORDER.forEach((n, i) => { WHEEL_POS[n] = i; });

const CYLINDER = {
  voisins:   [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],  // 17
  tiers:     [27,13,36,11,30,8,23,10,5,24,16,33],               // 12
  orphelins: [1,20,14,31,9,17,34,6]                              //  8
};
const SECTOR_LABELS = {
  voisins:   'Voisins du Zéro',
  tiers:     'Tiers du Cylindre',
  orphelins: 'Orphelins'
};

// Smart Splits per sector (chevals + pleins)
// Voisins: 9 jetons — 0/2/3 (×2), 4/7, 12/15, 18/21, 19/22, carré 25/26/28/29 (×2), 32/35
// Tiers: 6 jetons — 5/8, 10/11, 13/16, 23/24, 27/30, 33/36
// Orphelins: 5 jetons — 1-plein, 6/9, 14/17, 17/20, 31/34
const SMART_SPLITS = {
  voisins:   { splits: [[0,3],[0,2],[4,7],[12,15],[18,21],[19,22],[25,28],[26,29],[32,35]], pleins: [] },
  tiers:     { splits: [[5,8],[10,11],[13,16],[23,24],[27,30],[33,36]], pleins: [] },
  orphelins: { splits: [[6,9],[14,17],[17,20],[31,34]], pleins: [1] }
};

const RED_NUMBERS  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const EVEN_NUMBERS = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36];

// ───────────────────────────────────────────────────────────────
//  MATH
// ───────────────────────────────────────────────────────────────

/** Normal CDF Φ(z) — Abramowitz & Stegun 26.2.17, error < 7.5×10⁻⁸ */
function normalCDF(z) {
  if (z < -8) return 0;
  if (z >  8) return 1;
  const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (a[0] + t * (a[1] + t * (a[2] + t * (a[3] + t * a[4]))));
  const p = 1 - Math.exp(-0.5 * z * z) * 0.3989422804 * poly;
  return z >= 0 ? p : 1 - p;
}

/** Chi-square p-value P(χ²(df) ≥ x) */
function chiSqPValue(chi2, df) {
  if (chi2 <= 0) return 1;
  if (df === 1) return 2 * (1 - normalCDF(Math.sqrt(chi2)));
  if (df === 2) return Math.exp(-chi2 / 2);                  // exact
  const z  = Math.pow(chi2 / df, 1 / 3) - (1 - 2 / (9 * df));
  return 1 - normalCDF(z / Math.sqrt(2 / (9 * df)));
}

// ───────────────────────────────────────────────────────────────
//  SECTOR STATISTICS (same kernel as Bordeaux engine)
// ───────────────────────────────────────────────────────────────

function zScore(win, nums) {
  const n = win.length, k = win.filter(s => nums.includes(s.number)).length;
  const p = nums.length / 37, sigma = Math.sqrt(n * p * (1 - p));
  return sigma > 0 ? (k - n * p) / sigma : 0;
}

function bayesianPosterior(win, nums, m = 4) {
  const n = win.length, k = win.filter(s => nums.includes(s.number)).length;
  const p = nums.length / 37;
  return (k + p * m) / (n + m);
}

/** Composite confidence score [0–100] for a sector */
function sectorConfidence(win, nums) {
  if (win.length < 1) return 0;
  const N = win.length;
  const Z = zScore(win, nums);
  if (Z <= 0) return 0;
  // Dampened by sample size: needs N≥10 + strong Z to reach PLAY threshold
  return Math.min(100, Math.max(0, (N / 30) * (Z / 2) * 100));
}

// ───────────────────────────────────────────────────────────────
//  CHI-SQUARE FILTERS  (Rouge/Noir/Vert  +  Pair/Impair)
// ───────────────────────────────────────────────────────────────

function colorChiSquare(win) {
  const n = win.length;
  if (n < 3) return { chi2: 0, pValue: 0.5, isNoise: false };
  const r = win.filter(s => RED_NUMBERS.includes(s.number)).length;
  const v = win.filter(s => s.number === 0).length;
  const b = n - r - v;
  const Er = n * 18 / 37, Eb = n * 18 / 37, Ev = n / 37;
  const chi2 = (r - Er) ** 2 / Er + (b - Eb) ** 2 / Eb + (v - Ev) ** 2 / Ev;
  const pValue = chiSqPValue(chi2, 2);    // df=2 → exact: exp(−χ²/2)
  return { chi2, pValue, isNoise: pValue > 0.05 };
}

function parityChiSquare(win) {
  const n    = win.length;
  if (n < 3) return { chi2: 0, pValue: 0.5, isNoise: false };
  const even = win.filter(s => s.number > 0 && EVEN_NUMBERS.includes(s.number)).length;
  const odd  = win.filter(s => s.number > 0 && !EVEN_NUMBERS.includes(s.number)).length;
  const nz   = even + odd;
  if (nz < 2) return { chi2: 0, pValue: 0.5, isNoise: false };
  const Ep   = nz / 2;
  const chi2 = (even - Ep) ** 2 / Ep + (odd - Ep) ** 2 / Ep;
  const pValue = chiSqPValue(chi2, 1);
  return { chi2, pValue, isNoise: pValue > 0.05 };
}

// ───────────────────────────────────────────────────────────────
//  MECHANICAL SIGNATURE — Offset Cluster
//  Offset = distance (wheel positions) between starting_point and result
//  Auto-derived as previous spin's number when not provided explicitly.
//  Cluster detected when ≥3 offsets fall within ±2 positions (wrapping)
// ───────────────────────────────────────────────────────────────

function analyzeOffset(spins, lookback = 10) {
  const NONE = { detected: false, boost: 0, center: null, count: 0, total: 0, detail: null };

  // Enrich spins: auto-set starting_point from previous spin if absent
  const enriched = spins.map((s, i) => ({
    ...s,
    starting_point: s.starting_point != null ? s.starting_point : (i > 0 ? spins[i - 1].number : null)
  }));

  const valid = enriched.filter(s =>
    s.starting_point != null &&
    WHEEL_POS[s.starting_point] !== undefined &&
    WHEEL_POS[s.number] !== undefined
  );
  const recent = valid.slice(-lookback);
  if (recent.length < 3) return NONE;

  // Bidirectional: cylinder rotates CW, ball CCW — take minimum physical distance
  const DAMPING = 1;          // ±1 pocket glissement on Alfastreet carpet
  const CLUSTER_TOL = 2 + DAMPING;  // = 3 positions tolerance

  const offsets = recent.map(s => {
    const sp = WHEEL_POS[s.starting_point];
    const rp = WHEEL_POS[s.number];
    const cw  = (rp - sp + 37) % 37;
    const ccw = (sp - rp + 37) % 37;
    return Math.min(cw, ccw);
  });

  // Scan for best cluster center with ±CLUSTER_TOL tolerance (circular wrap)
  let best = { center: -1, count: 0 };
  for (let c = 0; c < 37; c++) {
    const cnt = offsets.filter(o => {
      const d = Math.abs(o - c);
      return Math.min(d, 37 - d) <= CLUSTER_TOL;
    }).length;
    if (cnt > best.count) best = { center: c, count: cnt };
  }

  const detected = best.count >= 3;
  return {
    detected,
    boost:  detected ? 30 : 0,
    center: best.center,
    count:  best.count,
    total:  recent.length,
    detail: detected
      ? `Offset ~${best.center} cases (${best.count}/${recent.length} répétitions)`
      : null
  };
}

// ───────────────────────────────────────────────────────────────
//  EXECUTION STRATEGY — Fractional Kelly + Smart Splits
// ───────────────────────────────────────────────────────────────

function formatSplits(sectorKey) {
  const s = SMART_SPLITS[sectorKey];
  const parts = s.splits.map(([a, b]) => `${a}/${b}`);
  s.pleins.forEach(n => parts.push(`${n}-plein`));
  return parts;
}

function numBets(sectorKey) {
  const s = SMART_SPLITS[sectorKey];
  return s.splits.length + s.pleins.length;
}

/**
 * getExecutionStrategy(bankroll, profit, signalScore, bestSector)
 *  Phase 1 (Safe)       — profit < 50€  : 1-2 % bankroll / numBets
 *  Phase 2 (Aggressive) — profit ≥ 50€ & score > 85% : 50 % profit / numBets
 */
function getExecutionStrategy(bankroll, profit, signalScore, bestSector) {
  const allSplits = formatSplits(bestSector);
  const maxN      = numBets(bestSector);

  let phase, totalBet;
  if (profit >= 50 && signalScore > 85) {
    phase    = 'Sniper';
    totalBet = profit * 0.50;
  } else {
    phase    = 'Prudent';
    const pct = signalScore >= 85 ? 0.02 : 0.01;
    totalBet  = bankroll * pct;
  }

  // Always cover the FULL sector — 1€ minimum per position, never trim
  const betPerSplit = Math.max(1, Math.round(totalBet / maxN));
  const n           = maxN;
  totalBet          = betPerSplit * n;

  const splits        = allSplits;
  // Win = bet_per_split × 35 − mise_totale
  const potentialGain = betPerSplit * 35 - totalBet;

  return { phase, totalBet, betPerSplit, numBets: n, splits, potentialGain };
}

// ───────────────────────────────────────────────────────────────
//  MAIN ENGINE  processData()
// ───────────────────────────────────────────────────────────────

function processData(history, bankroll, initialDeposit, profit) {
  const t0 = performance.now();

  // Circuit Breaker: signal flagged externally (passed as isExpired flag)
  // ── Insufficient data ─────────────────────────────────────────
  if (history.length < 1) {
    return _out('WAIT', 0,
      { target: '—', type: 'Calibration', splits: [], bet_per_split: 0, bet_value: 0, num_bets: 0 },
      'En attente du premier numéro', 0, '—',
      null, null, null, performance.now() - t0
    );
  }

  // Analysis window: use all available spins, max 24
  const win = history.slice(-Math.min(24, history.length));

  // ── 1. Chi-Square: colour + parity ─────────────────────────
  const cTest = colorChiSquare(win);
  const pTest = parityChiSquare(win);
  const noiseGlobal = cTest.isNoise && pTest.isNoise;

  // ── 2. Sector scoring ──────────────────────────────────────
  const sectorData = {};
  for (const [key, nums] of Object.entries(CYLINDER)) {
    const Z    = zScore(win, nums);
    const post = bayesianPosterior(win, nums);
    const conf = sectorConfidence(win, nums);
    const k    = win.filter(s => nums.includes(s.number)).length;
    const E    = win.length * (nums.length / 37);
    sectorData[key] = { Z, posterior: post, confidence: conf, k, E };
  }

  // ── 3. Mechanical Signature ─────────────────────────────────
  const offset = analyzeOffset(history);   // use full buffer for offset

  // ── 4. Best sector + confidence boost ──────────────────────
  const bestKey = Object.entries(sectorData)
    .reduce((a, b) => a[1].confidence >= b[1].confidence ? a : b)[0];
  const best = sectorData[bestKey];
  let confidence = best.confidence;
  if (offset.detected) confidence = Math.min(100, confidence * 1.30);

  // ── 5. Noise gate ────────────────────────────────────────────
  if (noiseGlobal && confidence < 75) {
    return _out('NOISE', confidence,
      { target: 'NOISE', type: '—', splits: [], bet_per_split: 0, bet_value: 0, num_bets: 0 },
      `Distributions aléatoires — χ²-col p=${cTest.pValue.toFixed(3)}, χ²-par p=${pTest.pValue.toFixed(3)}`,
      0, '—', sectorData, cTest, pTest, offset, performance.now() - t0
    );
  }

  // ── 6. Execution strategy ────────────────────────────────────
  const strat = getExecutionStrategy(bankroll, profit, confidence, bestKey);
  const target = SECTOR_LABELS[bestKey];

  // ── 7. Reason ────────────────────────────────────────────────
  const parts = [];
  if (offset.detected) parts.push(`Signature Offset: ${offset.detail}`);
  parts.push(`${target}: Z=+${best.Z.toFixed(2)}σ · Obs=${best.k}/Att=${best.E.toFixed(1)}`);
  if (!cTest.isNoise)  parts.push(`Signal couleurs p=${cTest.pValue.toFixed(3)}`);
  if (!pTest.isNoise)  parts.push(`Signal parité p=${pTest.pValue.toFixed(3)}`);
  const reason = parts.join(' + ');

  let status;
  if (confidence >= 90) status = 'KILLER';
  else if (confidence >= 70) status = 'PLAY';
  else status = 'WAIT';

  const type = strat.phase === 'Sniper'
    ? '🎯 Smart Splits SNIPER'
    : `Smart Splits Prudent`;

  return _out(
    status,
    Math.round(confidence * 10) / 10,
    {
      target,
      type,
      splits:        strat.splits,
      bet_per_split: strat.betPerSplit,
      bet_value:     strat.totalBet,
      num_bets:      strat.numBets
    },
    reason,
    strat.potentialGain,
    strat.phase,
    sectorData, cTest, pTest, offset,
    performance.now() - t0
  );
}

function _out(status, confidence, recommendation, reason, potential_gain, phase,
              sectors, colorTest, parityTest, offsetAnalysis, latency) {
  return {
    status,
    confidence: Math.round((confidence || 0) * 10) / 10,
    recommendation,
    reason,
    potential_gain: potential_gain || 0,
    phase,
    sectors,
    colorTest,
    parityTest,
    offsetAnalysis,
    latency: Math.round((latency || 0) * 100) / 100
  };
}

// ───────────────────────────────────────────────────────────────
//  WORKER INTERFACE
// ───────────────────────────────────────────────────────────────
self.onmessage = function (e) {
  const { id, history, bankroll, initialDeposit, profit } = e.data;
  const result = processData(history, bankroll, initialDeposit, profit);
  self.postMessage({ id, result });
};
