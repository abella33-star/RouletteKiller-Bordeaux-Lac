'use client'
interface Props {
  latency?: number
}

export default function ControlBar({ latency }: Props) {
  if (latency === undefined) return null
  return (
    <div className="flex justify-center">
      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-md bg-card border border-border ${
        latency < 20 ? 'text-neon' : latency < 50 ? 'text-orange' : 'text-crimson'
      }`}>
        ⚡ {latency}ms
      </span>
    </div>
  )
}
