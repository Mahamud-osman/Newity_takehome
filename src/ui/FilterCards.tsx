import { CARDS } from '../domain/pipeline'
import type { Card } from '../domain/pipeline'
import { Icon } from './Icon'
import type { IconName } from './Icon'

const CARD_LABEL: Record<Card, string> = {
  all: 'All applications',
  stalled: 'Stalled',
  expired: 'Expired documents',
  expiring: 'Expiring soon',
}

const CARD_ICON: Record<Card, IconName> = {
  all: 'all',
  stalled: 'stalled',
  expired: 'expired',
  expiring: 'soon',
}

const CARD_HINT: Record<Card, string> = {
  all: 'Every application in the pipeline',
  stalled: 'Waiting on documents with nothing received in 21+ days',
  expired: 'Has a document past its expiration date',
  expiring: 'Has a document expiring in the next 14 days',
}

interface Props {
  active: Card
  counts: Record<Card, number>
  onSelect(card: Card): void
}

/** Filter cards drawn as file-folder tabs; the active tab joins the table below it. */
export function FilterCards({ active, counts, onSelect }: Props) {
  return (
    <div className="folder-tabs" role="group" aria-label="Filter applications">
      {CARDS.map(card => (
        <button
          key={card}
          type="button"
          className={`folder-tab folder-tab-${card}${card === active ? ' is-active' : ''}`}
          aria-pressed={card === active}
          title={CARD_HINT[card]}
          onClick={() => onSelect(card)}
        >
          <span className="folder-tab-label">
            <Icon name={CARD_ICON[card]} />
            {CARD_LABEL[card]}
          </span>
          <span className="folder-tab-count">{counts[card]}</span>
        </button>
      ))}
    </div>
  )
}
