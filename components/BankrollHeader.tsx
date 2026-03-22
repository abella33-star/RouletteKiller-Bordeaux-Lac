'use client'
interface Props {
  bankroll:       number
  initialDeposit: number
  wins:           number
  losses:         number
  onOpenSettings: () => void
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

export default function BankrollHeader({
  bankroll, initialDeposit, wins, losses, onOpenSettings,
}: Props) {
  const profit  = bankroll - initialDeposit
  const pct     = initialDeposit > 0 ? (profit / initialDeposit * 100) : 0
  const isUp    = profit >= 0
  const profitColor = isUp ? '#00E676' : '#FF1744'

  return (
    <div
      className="flex items-center justify-between px-1"
      style={{ height: 36, flexShrink: 0 }}
    >
      {/* Bankroll */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[8px] text-muted tracking-widest font-black">BK</span>
        <span className="text-base font-black text-gold tabular-nums leading-none">{fmt(bankroll)}</span>
      </div>

      {/* Session profit */}
      <div className="flex items-baseline gap-1" style={{ color: profitColor }}>
        <span className="text-sm font-black tabular-nums leading-none">
          {profit >= 0 ? '+' : ''}{fmt(profit)}
        </span>
        <span className="text-[9px] font-black">
          ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
        </span>
      </div>

      {/* W/L + settings */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-muted tabular-nums">{wins}V/{losses}D</span>
        <button
          onClick={onOpenSettings}
          className="bg-card border border-border rounded-lg active:bg-border"
          style={{ padding: '4px 8px', fontSize: 14, touchAction: 'manipulation' }}
          aria-label="Paramètres bankroll"
        >
          💰
        </button>
      </div>
    </div>
  )
}
