'use strict';
// ============================================================
//  BORDEAUX ALPHA-PREDATOR ENGINE v2 — Worker Thread
//  Miroir de lib/alpha-engine.ts en plain JS
//  v2: λ=0.75, normalCDF confidence, dual-fenêtre, sous-arc chaud
// ============================================================

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WHEEL_POS   = {};
WHEEL_ORDER.forEach((n, i) => { WHEEL_POS[n] = i; });

const CYLINDER = {
  voisins:   [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],  // 17 — ordre physique cylindre
  tiers:     [27,13,36,11,30,8,23,10,5,24,16,33],               // 12
  orphelins: [1,20,14,31,9,17,34,6],                            //  8
};
const SECTOR_LABELS = {
  voisins:   'Voisins du Zéro',
  tiers:     'Tiers du Cylindre',
  orphelins: 'Orphelins',
};

// D. Tailles d'arc pour détection sous-arc chaud
const SUB_ARC_SIZES = {
  voisins:   { min: 5, max: 9 },
  tiers:     { min: 4, max: 7 },
  orphelins: { min: 3, max: 5 },
};

const MIN_SPINS       = 10;
const THRESHOLD_PLAY  = 84;   // normalCDF(1.0)×100 — Z ≥ 1.0σ
const THRESHOLD_KILLER= 97;   // normalCDF(2.0)×100 — Z ≥ 2.0σ

const RED_NUMBERS  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const EVEN_NUMBERS = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36];

// ── Math ────────────────────────────────────────────────────

function normalCDF(z) {
  if (z < -8) return 0;
  if (z >  8) return 1;
  const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (a[0] + t * (a[1] + t * (a[2] + t * (a[3] + t * a[4]))));
  const p = 1 - Math.exp(-0.5 * z * z) * 0.3989422804 * poly;
  return z >= 0 ? p : 1 - p;
}

function chiSqPValue(chi2, df) {
  if (chi2 <= 0) return 1;
  if (df === 1) return 2 * (1 - normalCDF(Math.sqrt(chi2)));
  if (df === 2) return Math.exp(-chi2 / 2);
  const z = Math.pow(chi2 / df, 1/3) - (1 - 2/(9*df));
  return 1 - normalCDF(z / Math.sqrt(2/(9*df)));
}

// ── Statistics ───────────────────────────────────────────────

// A. λ=0.75 → nEff ≈ 4.0 spins effectifs (était 1.4 avec λ=0.3)
const RECENCY_LAMBDA = 0.75;

function zScore(win, nums) {
  const n = win.length;
  if (n === 0) return 0;
  const p = nums.length / 37;
  let nEff = 0, kEff = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(RECENCY_LAMBDA, n - 1 - i);
    nEff += w;
    if (nums.includes(win[i].number)) kEff += w;
  }
  const sigma = Math.sqrt(nEff * p * (1 - p));
  return sigma > 0 ? (kEff - nEff * p) / sigma : 0;
}

function bayesianPosterior(win, nums, m = 4) {
  const n = win.length;
  if (n === 0) return nums.length / 37;
  const p = nums.length / 37;
  let nEff = 0, kEff = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(RECENCY_LAMBDA, n - 1 - i);
    nEff += w;
    if (nums.includes(win[i].number)) kEff += w;
  }
  return (kEff + p * m) / (nEff + m);
}

// B. Probabilité unilatérale exacte : normalCDF(Z) × 100
function sectorConfidence(win, nums) {
  if (win.length < 1) return 0;
  const Z = zScore(win, nums);
  if (Z <= 0) return 0;
  return Math.round(normalCDF(Z) * 1000) / 10;
}

// ── Chi-Square ───────────────────────────────────────────────

function colorChiSquare(win) {
  const n = win.length;
  if (n < 3) return { chi2: 0, pValue: 0.5, isNoise: false };
  const r = win.filter(s => RED_NUMBERS.includes(s.number)).length;
  const v = win.filter(s => s.number === 0).length;
  const b = n - r - v;
  const Er = n*18/37, Eb = n*18/37, Ev = n/37;
  const chi2 = (r-Er)**2/Er + (b-Eb)**2/Eb + (v-Ev)**2/Ev;
  const pValue = chiSqPValue(chi2, 2);
  return { chi2, pValue, isNoise: pValue > 0.05 };
}

function parityChiSquare(win) {
  const n = win.length;
  if (n < 3) return { chi2: 0, pValue: 0.5, isNoise: false };
  const even = win.filter(s => s.number > 0 && EVEN_NUMBERS.includes(s.number)).length;
  const odd  = win.filter(s => s.number > 0 && !EVEN_NUMBERS.includes(s.number)).length;
  const nz = even + odd;
  if (nz < 5) return { chi2: 0, pValue: 1, isNoise: true };
  const Ep = nz / 2;
  const chi2 = (even-Ep)**2/Ep + (odd-Ep)**2/Ep;
  const pValue = chiSqPValue(chi2, 1);
  return { chi2, pValue, isNoise: pValue > 0.05 };
}

// ── Mechanical Signature ─────────────────────────────────────

function analyzeOffset(spins) {
  const NONE = { detected: false, boost: 0, center: null, count: 0, total: 0, detail: null };
  const enriched = spins.map((s, i) => ({
    ...s,
    starting_point: s.starting_point != null ? s.starting_point : (i > 0 ? spins[i-1].number : null),
  }));
  const valid = enriched.filter(s =>
    s.starting_point != null &&
    WHEEL_POS[s.starting_point] !== undefined &&
    WHEEL_POS[s.number] !== undefined
  );
  const recent = valid.slice(-10);
  if (recent.length < 3) return NONE;

  const CLUSTER_TOL = 3;
  const offsets = recent.map(s => {
    const sp = WHEEL_POS[s.starting_point];
    const rp = WHEEL_POS[s.number];
    const cw = (rp - sp + 37) % 37;
    const ccw = (sp - rp + 37) % 37;
    return Math.min(cw, ccw);
  });

  let best = { center: -1, count: 0 };
  for (let c = 0; c < 37; c++) {
    const cnt = offsets.filter(o => Math.min(Math.abs(o-c), 37-Math.abs(o-c)) <= CLUSTER_TOL).length;
    if (cnt > best.count) best = { center: c, count: cnt };
  }
  const detected = best.count >= 3;
  return {
    detected,
    boost:  detected ? 30 : 0,
    center: best.center >= 0 ? best.center : null,
    count:  best.count,
    total:  recent.length,
    detail: detected ? `Offset ~${best.center} cases (${best.count}/${recent.length} rép.)` : null,
  };
}

// ── C. Double fenêtre de confirmation ─────────────────────────

function dualWindowDominant(spins) {
  const winShort = spins.slice(-8);
  const winLong  = spins.slice(-Math.min(24, spins.length));
  if (winShort.length < 4) return null;

  const keys = ['voisins', 'tiers', 'orphelins'];
  const dominantIn = (win) =>
    keys.reduce((best, k) =>
      zScore(win, CYLINDER[k]) > zScore(win, CYLINDER[best]) ? k : best
    , keys[0]);

  const shortDom = dominantIn(winShort);
  const longDom  = dominantIn(winLong);
  return shortDom === longDom ? shortDom : null;
}

// ── D. Sous-arc chaud ────────────────────────────────────────

function findHotSubArc(win, sectorKey) {
  const nums = CYLINDER[sectorKey];
  const { min, max } = SUB_ARC_SIZES[sectorKey];
  const n = nums.length;
  let bestZ = 0, bestArc = [];

  for (let arcLen = min; arcLen <= max; arcLen++) {
    for (let start = 0; start < n; start++) {
      const arc = [];
      for (let j = 0; j < arcLen; j++) arc.push(nums[(start + j) % n]);
      const z = zScore(win, arc);
      if (z > bestZ) { bestZ = z; bestArc = arc.slice(); }
    }
  }

  if (bestZ <= 0 || bestArc.length === 0) return null;
  return {
    numbers:       bestArc,
    arcZ:          Math.round(bestZ * 1000) / 1000,
    arcConfidence: Math.round(normalCDF(bestZ) * 1000) / 10,
  };
}

// ── Strategy ─────────────────────────────────────────────────

function getExecutionStrategy(bankroll, profit, confidence, bestSector, subArc) {
  const playNums = subArc ? subArc.numbers : CYLINDER[bestSector];
  const splits   = playNums.map(n => `${n}-plein`);
  const maxN     = playNums.length;

  let phase, totalBet;
  if (confidence >= THRESHOLD_KILLER && profit >= 50) {
    phase    = 'Sniper';
    totalBet = profit * 0.50;
  } else {
    phase    = 'Prudent';
    const pct = confidence >= 90 ? 0.02 : 0.01;
    totalBet  = bankroll * pct;
  }

  const betPerSplit = Math.max(1, Math.round(totalBet / maxN));
  const n           = maxN;
  totalBet          = betPerSplit * n;
  const potentialGain = betPerSplit * 35 - totalBet;  // plein 35:1

  return { phase, totalBet, betPerSplit, numBets: n, splits, potentialGain };
}

// ── Main engine ───────────────────────────────────────────────

function processData(history, bankroll, initialDeposit, profit) {
  const t0 = performance.now();

  if (history.length < MIN_SPINS) {
    return _out('WAIT', 0,
      { target:'—', type:'Calibration', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
      `En attente (${history.length}/${MIN_SPINS} spins)`,
      0, '—', null, null, null, null, false, null, performance.now()-t0
    );
  }

  const win = history.slice(-Math.min(24, history.length));

  const cTest = colorChiSquare(win);
  const pTest = parityChiSquare(win);
  const noiseGlobal = cTest.isNoise && pTest.isNoise;

  const sectorData = {};
  for (const [key, nums] of Object.entries(CYLINDER)) {
    const Z    = zScore(win, nums);
    const post = bayesianPosterior(win, nums);
    const conf = sectorConfidence(win, nums);
    const k    = win.filter(s => nums.includes(s.number)).length;
    const E    = win.length * (nums.length / 37);
    sectorData[key] = { Z, posterior: post, confidence: conf, k, E };
  }

  const offset = analyzeOffset(history);

  const bestKey = Object.entries(sectorData)
    .reduce((a, b) => a[1].confidence >= b[1].confidence ? a : b)[0];
  const best = sectorData[bestKey];
  let confidence = best.confidence;
  if (offset.detected) confidence = Math.min(100, confidence * 1.30);
  confidence = Math.round(confidence * 10) / 10;

  // C. Double fenêtre
  const dualSector = dualWindowDominant(history);
  const dualWindowConfirmed = dualSector !== null && dualSector === bestKey;

  // Noise gate (désactivé à seuil 0)
  if (noiseGlobal && confidence < 0 && best.Z <= 2.5) {
    return _out('NOISE', confidence,
      { target:'NOISE', type:'—', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
      `Distributions aléatoires χ²-col p=${cTest.pValue.toFixed(3)}, χ²-par p=${pTest.pValue.toFixed(3)}`,
      0, '—', sectorData, cTest, pTest, offset, dualWindowConfirmed, null, performance.now()-t0
    );
  }

  let status;
  if      (confidence >= THRESHOLD_KILLER) status = 'KILLER';
  else if (confidence >= THRESHOLD_PLAY)   status = 'PLAY';
  else                                      status = 'WAIT';

  if (status === 'WAIT') {
    return _out('WAIT', confidence,
      { target: SECTOR_LABELS[bestKey], type:'Attendre', splits:[], bet_per_split:0, bet_value:0, num_bets:0 },
      `Signal ${confidence}% (Z=${best.Z.toFixed(2)}σ) — attendre confirmation${dualWindowConfirmed ? ' ✓ dual' : ''}`,
      0, '—', sectorData, cTest, pTest, offset, dualWindowConfirmed, null, performance.now()-t0
    );
  }

  // D. Sous-arc chaud
  const subArc = findHotSubArc(win, bestKey);

  const strat = getExecutionStrategy(bankroll, profit, confidence, bestKey, subArc);

  const parts = [];
  if (offset.detected)     parts.push(`Offset: ${offset.detail}`);
  if (subArc)              parts.push(`Arc ${subArc.numbers.length}num Z=+${subArc.arcZ.toFixed(2)}σ`);
  if (dualWindowConfirmed) parts.push(`✓ dual-fenêtre`);
  parts.push(`${SECTOR_LABELS[bestKey]}: Z=+${best.Z.toFixed(2)}σ · Obs=${best.k}/Att=${best.E.toFixed(1)}`);
  if (!cTest.isNoise) parts.push(`χ²-col p=${cTest.pValue.toFixed(3)}`);
  if (!pTest.isNoise) parts.push(`χ²-par p=${pTest.pValue.toFixed(3)}`);

  const type = strat.phase === 'Sniper' ? '🎯 Smart Pleins SNIPER' : 'Smart Pleins Prudent';

  return _out(
    status, confidence,
    { target: SECTOR_LABELS[bestKey], type,
      splits: strat.splits, bet_per_split: strat.betPerSplit,
      bet_value: strat.totalBet, num_bets: strat.numBets },
    parts.join(' · '),
    strat.potentialGain,
    strat.phase,
    sectorData, cTest, pTest, offset,
    dualWindowConfirmed, subArc,
    performance.now()-t0
  );
}

function _out(status, confidence, recommendation, reason, potential_gain, phase,
              sectors, colorTest, parityTest, offsetAnalysis,
              dualWindowConfirmed, subArc, latency) {
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
    dualWindowConfirmed: dualWindowConfirmed || false,
    subArc: subArc || null,
    latency: Math.round((latency || 0) * 100) / 100,
  };
}

// ── Worker Interface ─────────────────────────────────────────
self.onmessage = function (e) {
  const { id, history, bankroll, initialDeposit, profit } = e.data;
  const result = processData(history, bankroll, initialDeposit, profit);
  self.postMessage({ id, result });
};
