type EntityPanelItem = {
  id: string
  name: string
}

type EntityPanelProps = {
  title: string
  count: number
  items: EntityPanelItem[]
  idPrefix: string
  onSelect: (id: string) => void
}

function EntityPanel({
  title,
  count,
  items,
  idPrefix,
  onSelect,
}: EntityPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      <div className="panel-list">
        {items.map((item) => (
          <button
            key={item.id}
            id={`${idPrefix}-${item.id}`}
            type="button"
            className="panel-item"
            onClick={() => onSelect(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
    </section>
  )
}

export default EntityPanel
