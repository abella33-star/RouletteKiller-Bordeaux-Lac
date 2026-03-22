'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouletteState } from '@/lib/useRouletteState'
import BankrollHeader from '@/components/BankrollHeader'
import SignalCard     from '@/components/SignalCard'
import BetCard        from '@/components/BetCard'
import NumberPad      from '@/components/NumberPad'
import ControlBar     from '@/components/ControlBar'

// Heatmap is client-only (SVG, no SSR needed)
const SectorHeatmap = dynamic(() => import('@/components/SectorHeatmap'), { ssr: false })

// ── Settings Modal ────────────────────────────────────────────
function SettingsModal({
  current, onApply, onClose
}: { current: number; onApply: (v: number) => void; onClose: () => void }) {
  const [val, setVal] = useState(current.toString())
  const PRESETS = [200, 500, 1000, 2000, 5000]

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ paddingBottom: 'var(--sab)' }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-surface rounded-t-3xl p-6 border-t border-border animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-black tracking-widest">💰 BANKROLL</span>
          <button onClick={onClose} className="text-muted text-xl">✕</button>
        </div>
        <input
          type="number"
          value={val}
          onChange={e => setVal(e.target.value)}
          className="w-full bg-card border border-border rounded-xl p-3 text-xl font-black
                     text-gold text-center mb-3 outline-none focus:border-gold/50"
          placeholder="Montant €"
          inputMode="decimal"
        />
        <div className="grid grid-cols-5 gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setVal(p.toString())}
              className="bg-card border border-border rounded-lg py-2 text-xs font-black active:bg-border"
            >
              {p}€
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const v = parseFloat(val)
            if (v > 0) onApply(v)
          }}
          className="w-full btn-giant bg-gold/10 text-gold border border-gold/40 rounded-2xl"
        >
          ✓ CONFIRMER
        </button>
      </div>
    </div>
  )
}

// ── Victory Overlay ───────────────────────────────────────────
function VictoryOverlay({
  bankroll, initialDeposit, wins, losses,
  onAcknowledge
}: {
  bankroll: number; initialDeposit: number; wins: number; losses: number;
  onAcknowledge: () => void;
}) {
  function fmt(n: number) {
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + '€'
  }
  const mult = initialDeposit > 0 ? (bankroll / initialDeposit).toFixed(2) : '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
        <div className="text-6xl glow-gold" style={{ animation: 'glowGold 0.7s ease-in-out infinite' }}>
          💰
        </div>
        <h1 className="text-4xl font-black tracking-[6px] text-gold">VICTOIRE</h1>
        <div className="text-gold font-black tracking-[3px]">ENCAISSE ET SORS</div>
        <div className="bg-card border border-gold/30 rounded-2xl p-4 w-full text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted">Dépôt initial</span>
            <span className="font-black">{fmt(initialDeposit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Bankroll</span>
            <span className="font-black text-gold">{fmt(bankroll)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Profit</span>
            <span className="font-black text-neon">+{fmt(bankroll - initialDeposit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Multiplicateur</span>
            <span className="font-black text-gold">×{mult}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Ratio V/D</span>
            <span className="font-black">{losses > 0 ? (wins/losses).toFixed(2) : '∞'}</span>
          </div>
        </div>
        <p className="text-muted text-sm leading-relaxed">
          Le moteur a détecté l'objectif optimal.<br />
          <em>Un joueur discipliné sait quand s'arrêter.</em>
        </p>
        <button
          onClick={onAcknowledge}
          className="btn-giant w-full bg-gold/10 text-gold border border-gold/40 rounded-2xl text-base"
        >
          ✓ ENCAISSER
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Home() {
  const {
    state, heat, bufferSize, loaded,
    showVictory, setShowVictory,
    showSettings, setShowSettings,
    addSpin, undoSpin, resetCycle, applyBankroll,
  } = useRouletteState()

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <div className="text-muted text-xs tracking-widest animate-pulse">
          BORDEAUX ALPHA ENGINE…
        </div>
      </div>
    )
  }

  const profit = state.bankroll - state.initialDeposit
  const result = state.lastEngineResult

  return (
    <>
      {/* ── Victory overlay ── */}
      {showVictory && (
        <VictoryOverlay
          bankroll={state.bankroll}
          initialDeposit={state.initialDeposit}
          wins={state.wins}
          losses={state.losses}
          onAcknowledge={() => setShowVictory(false)}
        />
      )}

      {/* ── Settings modal ── */}
      {showSettings && (
        <SettingsModal
          current={state.bankroll}
          onApply={applyBankroll}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── Main layout ── */}
      <main
        className="h-screen flex flex-col bg-black"
        style={{
          paddingTop:    'var(--sat)',
          paddingBottom: 'var(--sab)',
          paddingLeft:   'var(--sal)',
          paddingRight:  'var(--sar)',
        }}
      >
        {/* ── Top 70%: analysis zone ── */}
        <div className="flex flex-col flex-1 min-h-0 px-3 pt-2 gap-2 overflow-y-auto scroll-zone">

          {/* Header */}
          <BankrollHeader
            bankroll={state.bankroll}
            initialDeposit={state.initialDeposit}
            wins={state.wins}
            losses={state.losses}
            onOpenSettings={() => setShowSettings(true)}
          />

          {/* Heatmap + Signal side by side on wide screens, stacked on iPhone */}
          <div className="flex gap-2 items-start">
            {/* Heatmap */}
            <div className="w-[200px] flex-shrink-0 aspect-square">
              <SectorHeatmap
                heat={heat}
                engineResult={result}
                lastNumber={state.spins[state.spins.length - 1]?.number ?? null}
              />
            </div>

            {/* Signal card */}
            <div className="flex-1 min-w-0">
              <SignalCard result={result} bufferSize={bufferSize} />
            </div>
          </div>

          {/* Bet card */}
          <BetCard result={result} bankroll={state.bankroll} profit={profit} />
        </div>

        {/* ── Bottom 30%: number pad + controls (thumb zone) ── */}
        <div
          className="flex-shrink-0 px-3 pb-2 pt-2 border-t border-border flex flex-col gap-2"
          style={{ minHeight: '30vh' }}
        >
          <NumberPad
            onSpin={addSpin}
            recentSpins={state.spins}
            disabled={false}
          />
          <ControlBar
            onUndo={undoSpin}
            onReset={resetCycle}
            canUndo={state.spins.length > 0}
            latency={result?.latency}
          />
        </div>
      </main>
    </>
  )
}
