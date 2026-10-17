// Shape-distinct icons so status never relies on color alone (spec §7).
export type IconName = 'expired' | 'soon' | 'stalled' | 'done' | 'all'

const PATHS: Record<IconName, string> = {
  expired: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM5.5 5.5l5 5m0-5-5 5',
  soon: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 4.5V8l2.5 1.5',
  stalled: 'M5.5 3.5v9m5-9v9',
  done: 'M3 8.5l3 3 7-7',
  all: 'M2.5 4h11M2.5 8h11M2.5 12h11',
}

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
