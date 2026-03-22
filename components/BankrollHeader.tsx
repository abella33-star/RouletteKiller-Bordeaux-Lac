'use client'
interface Props {
  bankroll:      number
  initialDeposit: number
  wins:          number
  losses:        number
  onOpenSettings: () => void
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

export default function BankrollHeader({
  bankroll, initialDeposit, wins, losses, onOpenSettings
}: Props) {
  const profit    = bankroll - initialDeposit
  const profitPct = initialDeposit > 0
    ? ((bankroll - initialDeposit) / initialDeposit * 100)
    : 0
  const isUp = profit >= 0

  return (
    <div className="flex items-center justify-between px-1">
      {/* Bankroll */}
      <div>
        <div className="text-[9px] text-muted tracking-widest font-black">BANKROLL</div>
        <div className="text-xl font-black text-gold tabular-nums leading-tight">
          {fmt(bankroll)}
        </div>
      </div>

      {/* Profit */}
      <div className="text-center">
        <div className="text-[9px] text-muted tracking-widest font-black">SESSION</div>
        <div className={`text-lg font-black tabular-nums leading-tight ${isUp ? 'text-neon' : 'text-crimson'}`}>
          {profit >= 0 ? '+' : ''}{fmt(profit)}
        </div>
        <div className={`text-[10px] font-black ${isUp ? 'text-neon/70' : 'text-crimson/70'}`}>
          {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(1)}%
        </div>
      </div>

      {/* W/L + settings */}
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={onOpenSettings}
          className="text-lg bg-card border border-border rounded-xl px-3 py-1.5 active:bg-border"
          aria-label="Paramètres bankroll"
        >
          💰
        </button>
        <div className="text-[9px] text-muted tabular-nums">
          {wins}V / {losses}D
        </div>
      </div>
    </div>
  )
}
