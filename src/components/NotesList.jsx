import NoteCard from './NoteCard.jsx'

export default function NotesList({
  notes,
  recentNoteId,
  onEdit,
  onDelete,
  onTogglePin,
  onRestore,
  onPermanentDelete,
  onLightbox,
  searchQuery,
  isTrash,
  emptyTitle,
  emptyMessage,
  emptyIcon,
}) {
  if (notes.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">{emptyIcon || '📝'}</div>
        <h3>{emptyTitle || 'No notes yet'}</h3>
        <p>{emptyMessage || 'Create your first note above to get started!'}</p>
      </div>
    )
  }

  return (
    <div className="notes-list">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          isRecentlyUpdated={note.id === recentNoteId}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onLightbox={onLightbox}
          searchQuery={searchQuery}
          isTrash={isTrash}
        />
      ))}
    </div>
  )
}
