import { useState, useEffect, useRef, useCallback } from 'react'
import NoteForm from './components/NoteForm.jsx'
import NotesList from './components/NotesList.jsx'

const STORAGE_KEY = 'noteflow-notes'
const THEME_KEY = 'noteflow-theme'

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Validate note shape
    return parsed.filter(
      (n) =>
        n &&
        typeof n.id === 'string' &&
        typeof n.title === 'string' &&
        typeof n.body === 'string' &&
        typeof n.updatedAt === 'number'
    )
  } catch (e) {
    console.warn('Failed to load notes from localStorage')
    return []
  }
}

function saveNotes(notes, onQuotaError) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch (err) {
    console.warn('Failed to save notes to localStorage', err)
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      onQuotaError?.()
    }
  }
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark'
  } catch (e) {
    return 'dark'
  }
}

export default function App() {
  const [notes, setNotes] = useState(() => loadNotes())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('newest') // 'newest' | 'oldest'
  const [activeTab, setActiveTab] = useState('notes') // 'notes' | 'trash'
  const [theme, setTheme] = useState(() => loadTheme())
  const [recentNoteId, setRecentNoteId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, permanent }
  const [lightbox, setLightbox] = useState(null) // { name, dataUrl }
  const [toasts, setToasts] = useState([])

  const searchRef = useRef(null)
  const debounceRef = useRef(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Toast helper (defined before effects that use it)
  const addToast = useCallback((message, icon = '✅') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev.slice(-2), { id, message, icon }])
  }, [])

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch (e) { /* ignore */ }
  }, [theme])

  // Save notes to localStorage
  useEffect(() => {
    saveNotes(notes, () => {
      addToast('Storage full! Consider removing files or old notes.', '⚠️')
    })
  }, [notes, addToast])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 200)
    return () => clearTimeout(debounceRef.current)
  }, [searchQuery])

  // Clear recent note highlight after 5s
  useEffect(() => {
    if (!recentNoteId) return
    const timer = setTimeout(() => setRecentNoteId(null), 5000)
    return () => clearTimeout(timer)
  }, [recentNoteId])

  // Auto-remove toasts
  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, 3000)
    return () => clearTimeout(timer)
  }, [toasts])


  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  // ===== CRUD Operations =====
  const handleAddNote = useCallback((note) => {
    setNotes((prev) => [note, ...prev])
    setRecentNoteId(note.id)
    addToast('Note created!', '✨')
  }, [addToast])

  const handleEditNote = useCallback((id, updates) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === id
          ? { ...note, ...updates, updatedAt: Date.now() }
          : note
      )
    )
    setRecentNoteId(id)
    addToast('Note updated!', '💾')
  }, [addToast])

  const handleSoftDelete = useCallback((id) => {
    setDeleteConfirm({ id, permanent: false })
  }, [])

  const handlePermanentDelete = useCallback((id) => {
    setDeleteConfirm({ id, permanent: true })
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) return
    const { id, permanent } = deleteConfirm

    if (permanent) {
      setNotes((prev) => prev.filter((n) => n.id !== id))
      addToast('Note permanently deleted', '💀')
    } else {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, deleted: true, updatedAt: Date.now() } : n
        )
      )
      addToast('Moved to trash', '🗑️')
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, addToast])

  const handleRestore = useCallback((id) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, deleted: false, updatedAt: Date.now() } : n
      )
    )
    addToast('Note restored!', '♻️')
  }, [addToast])

  const handleTogglePin = useCallback((id) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
      )
    )
  }, [])

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
  }

  // ===== Derived Data =====
  const activeNotes = notes.filter((n) => !n.deleted)
  const trashedNotes = notes.filter((n) => n.deleted)

  const filteredNotes = (activeTab === 'notes' ? activeNotes : trashedNotes).filter(
    (note) => {
      if (!debouncedSearch.trim()) return true
      const q = debouncedSearch.toLowerCase()
      return (
        note.title.toLowerCase().includes(q) ||
        note.body.toLowerCase().includes(q)
      )
    }
  )

  // Sort: pinned always first (in notes view), then by date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (activeTab === 'notes') {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
    }
    return sortOrder === 'newest'
      ? b.updatedAt - a.updatedAt
      : a.updatedAt - b.updatedAt
  })

  const pinnedCount = activeNotes.filter((n) => n.pinned).length

  return (
    <div className="app-container">
      {/* ===== HEADER ===== */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">📝</div>
          <div>
            <h1>NoteFlow</h1>
            <div className="subtitle">Smart Notes App</div>
          </div>
        </div>
        <div className="header-actions">
          <button
            id="theme-toggle"
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ===== STATS BAR ===== */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-icon">📋</span>
          <span>Total:</span>
          <span className="stat-value">{activeNotes.length}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-icon">📌</span>
          <span>Pinned:</span>
          <span className="stat-value">{pinnedCount}</span>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <span className="stat-icon">🗑️</span>
          <span>Trash:</span>
          <span className="stat-value">{trashedNotes.length}</span>
        </div>
      </div>

      {/* ===== NOTE FORM ===== */}
      {activeTab === 'notes' && <NoteForm onAddNote={handleAddNote} />}

      {/* ===== TAB NAVIGATION ===== */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          📋 Notes
          <span className="tab-badge">{activeNotes.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'trash' ? 'active' : ''}`}
          onClick={() => setActiveTab('trash')}
        >
          🗑️ Trash
          <span className="tab-badge">{trashedNotes.length}</span>
        </button>
      </div>

      {/* ===== TOOLBAR ===== */}
      <div className="toolbar">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            ref={searchRef}
            id="search-input"
            type="text"
            className="search-input"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="toolbar-actions">
          <button
            id="sort-toggle"
            className="btn btn-ghost sort-btn"
            onClick={toggleSort}
            title={`Sort by ${sortOrder === 'newest' ? 'oldest' : 'newest'} first`}
          >
            {sortOrder === 'newest' ? '⬇️' : '⬆️'}{' '}
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {/* ===== NOTES LIST ===== */}
      <NotesList
        notes={sortedNotes}
        recentNoteId={recentNoteId}
        onEdit={handleEditNote}
        onDelete={handleSoftDelete}
        onTogglePin={handleTogglePin}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
        onLightbox={(att) => setLightbox(att)}
        searchQuery={debouncedSearch}
        isTrash={activeTab === 'trash'}
        emptyTitle={
          activeTab === 'trash'
            ? 'Trash is empty'
            : debouncedSearch
            ? 'No matching notes'
            : 'No notes yet'
        }
        emptyMessage={
          activeTab === 'trash'
            ? 'Deleted notes will appear here.'
            : debouncedSearch
            ? 'Try a different search term.'
            : 'Create your first note above to get started! ✨'
        }
        emptyIcon={
          activeTab === 'trash' ? '🗑️' : debouncedSearch ? '🔍' : '📝'
        }
      />

      {/* ===== DELETE CONFIRMATION MODAL ===== */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-icon">
              {deleteConfirm.permanent ? '💀' : '🗑️'}
            </div>
            <h3>
              {deleteConfirm.permanent
                ? 'Delete Permanently?'
                : 'Move to Trash?'}
            </h3>
            <p>
              {deleteConfirm.permanent
                ? 'This action cannot be undone. The note will be gone forever.'
                : 'You can restore this note from the Trash anytime.'}
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className={`btn ${
                  deleteConfirm.permanent ? 'btn-danger' : 'btn-primary'
                }`}
                onClick={confirmDelete}
              >
                {deleteConfirm.permanent ? '🔥 Delete Forever' : '🗑️ Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== IMAGE LIGHTBOX ===== */}
      {lightbox && (
        <div
          className="modal-overlay lightbox-overlay"
          onClick={() => setLightbox(null)}
        >
          <div
            className="lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lightbox-close"
              onClick={() => setLightbox(null)}
              title="Close"
            >
              ✕
            </button>
            <img
              src={lightbox.dataUrl}
              alt={lightbox.name}
              className="lightbox-image"
            />
            <div className="lightbox-caption">{lightbox.name}</div>
          </div>
        </div>
      )}

      {/* ===== TOAST NOTIFICATIONS ===== */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div key={toast.id} className="toast">
              <span>{toast.icon}</span>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
