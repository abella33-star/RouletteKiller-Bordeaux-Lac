'use strict';
// ============================================================
//  BORDEAUX CORE ENGINE — Worker Thread
//  Isolation totale : aucune dépendance externe, aucun import
//  Latence cible < 50 ms sur fenêtre de 18-24 spins
// ============================================================

// -------- CONFIGURATION CYLINDRE EUROPÉEN (Alfastreet) -------
const CYLINDER = {
  voisins:   [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],  // 17 numbers
  tiers:     [27,13,36,11,30,8,23,10,5,24,16,33],               // 12 numbers
  orphelins: [1,20,14,31,9,17,34,6]                              // 8 numbers
};
const SECTOR_LABELS = {
  voisins:   'Voisins du Zéro',
  tiers:     'Tiers du Cylindre',
  orphelins: 'Orphelins'
};
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

// -------- SIGNAL WINDOW ---------
const WIN_MIN = 18;
const WIN_MAX = 24;

// ================================================================
//  MATH UTILITIES
// ================================================================

/**
 * Normal CDF  Φ(z)  — Abramowitz & Stegun 26.2.17
 * Max absolute error ≈ 7.5 × 10⁻⁸
 */
function normalCDF(z) {
  if (z < -8) return 0;
  if (z >  8) return 1;
  const a = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (a[0] + t * (a[1] + t * (a[2] + t * (a[3] + t * a[4]))));
  const pdf  = Math.exp(-0.5 * z * z) * 0.3989422804;
  const p    = 1 - pdf * poly;
  return z >= 0 ? p : 1 - p;
}

/**
 * One-tailed p-value  P(Z ≥ z)  under N(0,1)
 */
function pValueNormal(z) { return 1 - normalCDF(z); }

/**
 * Chi-square p-value  P(χ²(df) ≥ x)
 *  df=1 : 2·(1 − Φ(√x))            (exact)
 *  df=2 : exp(−x/2)                 (exact)
 *  df≥3 : Wilson-Hilferty normal approx (error < 0.001)
 */
function chiSquarePValue(chi2, df) {
  if (chi2 <= 0) return 1;
  if (df === 1) return 2 * (1 - normalCDF(Math.sqrt(chi2)));
  if (df === 2) return Math.exp(-chi2 / 2);
  // Wilson-Hilferty
  const k  = df;
  const z  = Math.pow(chi2 / k, 1/3) - (1 - 2/(9*k));
  const se = Math.sqrt(2/(9*k));
  return 1 - normalCDF(z / se);
}

// ================================================================
//  SECTOR STATISTICS
// ================================================================

/**
 * Z-Score for a sector in the given spin window.
 *  H₀: numbers distributed uniformly (p = |sector| / 37)
 *  Z  = (k − np) / √(np(1−p))
 */
function zScore(window, numbers) {
  const n = window.length;
  if (n < 5) return 0;
  const k = window.filter(s => numbers.includes(s.number)).length;
  const p = numbers.length / 37;
  const E = n * p;
  const sigma = Math.sqrt(E * (1 - p));
  return sigma > 0 ? (k - E) / sigma : 0;
}

/**
 * Bayesian posterior probability that the true sector frequency
 * exceeds the prior p, using Beta–Binomial conjugate model.
 *
 * Prior: Beta(α₀, β₀) where α₀ = p·m, β₀ = (1−p)·m  (m = strength)
 * Posterior mean: (k + α₀) / (n + m)
 *
 * Returns the posterior probability as a fraction [0,1].
 */
function bayesianPosterior(window, numbers, priorStrength = 4) {
  const n = window.length;
  if (n === 0) return numbers.length / 37;
  const k  = window.filter(s => numbers.includes(s.number)).length;
  const p  = numbers.length / 37;
  const a0 = p * priorStrength;
  const b0 = (1 - p) * priorStrength;
  return (k + a0) / (n + priorStrength);
}

/**
 * Composite confidence score [0–100] for a sector.
 *  60 % weight → Z-Score CDF (frequentist signal)
 *  40 % weight → Bayesian excess over prior
 */
function sectorConfidence(window, numbers) {
  const n  = window.length;
  if (n < 10) return 0;
  const Z        = zScore(window, numbers);
  const prior    = numbers.length / 37;
  const post     = bayesianPosterior(window, numbers);
  const zConf    = normalCDF(Z) * 100;
  const excess   = Math.max(0, (post - prior) / prior);  // relative Bayesian excess
  const bayConf  = Math.min(100, excess * 120);           // scale: 80 % excess → 96 pts
  return Math.min(100, zConf * 0.60 + bayConf * 0.40);
}

// ================================================================
//  COLOR CHI-SQUARE NOISE FILTER
// ================================================================

/**
 * Chi-square goodness-of-fit test on colour distribution.
 *  H₀: numbers drawn uniformly from {rouge, noir, vert}
 *  df  = 2  (3 categories − 1)
 *  p-value = exp(−χ²/2)  [exact for df=2]
 *
 *  Returns { chi2, pValue, isNoise }
 *  isNoise = true when p > 0.05 (cannot reject H₀ = pure randomness)
 */
function colorChiSquare(window) {
  const n     = window.length;
  if (n < 10) return { chi2: 0, pValue: 1, isNoise: true };
  const rouge = window.filter(s => RED_NUMBERS.includes(s.number)).length;
  const vert  = window.filter(s => s.number === 0).length;
  const noir  = n - rouge - vert;
  const E_r   = n * (18 / 37);
  const E_n   = n * (18 / 37);
  const E_v   = n * ( 1 / 37);
  const chi2  = Math.pow(rouge - E_r, 2) / E_r
              + Math.pow(noir  - E_n, 2) / E_n
              + Math.pow(vert  - E_v, 2) / E_v;
  const pValue = chiSquarePValue(chi2, 2);
  return { chi2, pValue, isNoise: pValue > 0.05 };
}

// ================================================================
//  FRACTIONAL KELLY BET SIZING
// ================================================================

/**
 * Kelly fraction: f* = (b·p − q) / b  capped at 2 % bankroll.
 * We estimate  p  from normalised confidence and use
 * payout b = 36/|sector| − 1  for the best-confidence sector.
 *
 * Safety: returns 0 when confidence < 70.
 */
function kellyBet(confidence, bankroll, sectorSize) {
  if (confidence < 70) return 0;
  // Simplified thresholds from spec (safety override of full Kelly)
  if (confidence < 85) return Math.round(bankroll * 0.01 * 100) / 100;
  return Math.round(bankroll * 0.02 * 100) / 100;
}

// ================================================================
//  MASTER ANALYSIS FUNCTION
// ================================================================

/**
 * @param {Array}  spins    — array of { number, color, zone, timestamp }
 * @param {number} bankroll — current bankroll in €
 * @returns {Object} Decision JSON per spec §5
 */
function analyze(spins, bankroll) {
  const t0  = performance.now();
  // Clamp window to [WIN_MIN, WIN_MAX]
  const n   = spins.length;
  const win = spins.slice(-Math.min(WIN_MAX, Math.max(WIN_MIN, n)));

  // ── Insufficient data ─────────────────────────────────────────
  if (win.length < 10) {
    return _result('Low', 0, 'CALIBRATION', 0,
      `Données insuffisantes — ${win.length} spin(s) · minimum 10 requis`,
      null, null, performance.now() - t0);
  }

  // ── Chi-Square noise filter ────────────────────────────────────
  const colorTest = colorChiSquare(win);

  // ── Sector analysis ───────────────────────────────────────────
  const sectors = {};
  for (const [key, nums] of Object.entries(CYLINDER)) {
    const Z    = zScore(win, nums);
    const post = bayesianPosterior(win, nums);
    const conf = sectorConfidence(win, nums);
    const k    = win.filter(s => nums.includes(s.number)).length;
    const E    = win.length * (nums.length / 37);
    sectors[key] = { Z, posterior: post, confidence: conf, k, E };
  }

  // ── Best sector ───────────────────────────────────────────────
  const bestKey  = Object.entries(sectors).reduce((a, b) =>
    a[1].confidence >= b[1].confidence ? a : b)[0];
  const best     = sectors[bestKey];
  const conf     = best.confidence;
  const target   = SECTOR_LABELS[bestKey];

  // ── Noise gate (Chi-Square) ────────────────────────────────────
  // Hard block: random colour distribution AND weak sector signal
  if (colorTest.isNoise && conf < 75) {
    return _result('Noise', conf, 'NOISE / DO NOT PLAY', 0,
      `Distribution couleurs aléatoire — χ²=${colorTest.chi2.toFixed(2)}, p=${colorTest.pValue.toFixed(3)} > 0.05`,
      sectors, colorTest, performance.now() - t0);
  }

  // ── Signal classification & bet ───────────────────────────────
  const bet    = kellyBet(conf, bankroll, CYLINDER[bestKey].length);
  const signal = conf >= 85 ? 'High' : conf >= 70 ? 'Medium' : 'Low';

  // Build reason string
  const zStr   = best.Z.toFixed(2);
  const kStr   = best.k;
  const eStr   = best.E.toFixed(1);
  const pzStr  = pValueNormal(best.Z).toFixed(3);
  const postPct = (best.posterior * 100).toFixed(1);
  const chi2Str = colorTest.chi2.toFixed(2);
  const cpStr   = colorTest.pValue.toFixed(3);

  let reason;
  if (signal === 'High') {
    reason = `${target}: Z=+${zStr}σ (p=${pzStr}) · Obs=${kStr}/Att=${eStr} · P_post=${postPct}% · χ²-col=${chi2Str} (p=${cpStr})`;
  } else if (signal === 'Medium') {
    reason = `${target}: Z=+${zStr}σ · Biais modéré (P_post=${postPct}%) — confirmer sur 3-4 spins`;
  } else {
    reason = `Signal faible (${conf.toFixed(0)}%) — Z=${zStr}σ · attendre renforcement`;
  }

  return _result(signal, conf, target, bet, reason, sectors, colorTest, performance.now() - t0);
}

function _result(signal, confidence, target, bet_units, reason, sectors, colorTest, latency) {
  return {
    signal,
    confidence: Math.round(confidence * 10) / 10,
    target,
    bet_units,
    reason,
    sectors,   // detailed per-sector breakdown
    colorTest,
    latency: Math.round(latency * 100) / 100
  };
}

// ================================================================
//  WORKER MESSAGE HANDLER
// ================================================================
self.onmessage = function (e) {
  const { id, spins, bankroll } = e.data;
  const result = analyze(spins, bankroll);
  self.postMessage({ id, result });
};
