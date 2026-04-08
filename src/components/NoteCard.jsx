import { useState, useRef, useEffect } from 'react'

const MAX_FILE_SIZE = 2 * 1024 * 1024
const MAX_FILES = 5
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`"${file.name}" exceeds 2MB limit`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      resolve({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        name: file.name,
        type: file.type,
        size: file.size,
        isImage: IMAGE_TYPES.includes(file.type),
        dataUrl: reader.result,
      })
    }
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`))
    reader.readAsDataURL(file)
  })
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined,
  })
}

function highlightText(text, query) {
  if (!query || !query.trim()) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="highlight-match">{part}</span>
    ) : (
      part
    )
  )
}

function getFileExtIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map = {
    pdf: '📕', doc: '📘', docx: '📘', txt: '📃', csv: '📊',
    xls: '📗', xlsx: '📗', zip: '📦', rar: '📦', json: '📋',
  }
  return map[ext] || '📄'
}

export default function NoteCard({
  note,
  isRecentlyUpdated,
  onEdit,
  onDelete,
  onTogglePin,
  onRestore,
  onPermanentDelete,
  onLightbox,
  searchQuery,
  isTrash,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(note.title)
  const [editBody, setEditBody] = useState(note.body)
  const [editAttachments, setEditAttachments] = useState(note.attachments || [])
  const [editUploadError, setEditUploadError] = useState('')
  const [editIsDragging, setEditIsDragging] = useState(false)
  const editTitleRef = useRef(null)
  const editFileInputRef = useRef(null)

  useEffect(() => {
    if (isEditing) {
      editTitleRef.current?.focus()
    }
  }, [isEditing])

  const handleStartEdit = () => {
    setEditTitle(note.title)
    setEditBody(note.body)
    setEditAttachments(note.attachments || [])
    setEditUploadError('')
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    const trimmedTitle = editTitle.trim()
    const trimmedBody = editBody.trim()
    if (!trimmedTitle || !trimmedBody) return

    onEdit(note.id, {
      title: trimmedTitle,
      body: trimmedBody,
      attachments: editAttachments,
    })
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle(note.title)
    setEditBody(note.body)
    setEditAttachments(note.attachments || [])
    setEditUploadError('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // ===== Edit-mode file upload =====
  const processEditFiles = async (files) => {
    setEditUploadError('')
    const fileArray = Array.from(files)
    const remaining = MAX_FILES - editAttachments.length

    if (remaining <= 0) {
      setEditUploadError(`Maximum ${MAX_FILES} files per note`)
      return
    }

    const toProcess = fileArray.slice(0, remaining)
    if (fileArray.length > remaining) {
      setEditUploadError(`Only ${remaining} more file(s) allowed`)
    }

    const results = []
    for (const file of toProcess) {
      try {
        const att = await fileToAttachment(file)
        results.push(att)
      } catch (err) {
        setEditUploadError(err.message)
      }
    }

    if (results.length > 0) {
      setEditAttachments((prev) => [...prev, ...results])
    }
  }

  const handleEditFileSelect = (e) => {
    if (e.target.files) {
      processEditFiles(e.target.files)
      e.target.value = ''
    }
  }

  const removeEditAttachment = (id) => {
    setEditAttachments((prev) => prev.filter((a) => a.id !== id))
    setEditUploadError('')
  }

  const handleEditDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setEditIsDragging(true)
  }

  const handleEditDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setEditIsDragging(false)
  }

  const handleEditDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setEditIsDragging(false)
    if (e.dataTransfer.files?.length) {
      processEditFiles(e.dataTransfer.files)
    }
  }

  const handleDownload = (att) => {
    const link = document.createElement('a')
    link.href = att.dataUrl
    link.download = att.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const wordCount = note.body.trim() ? note.body.trim().split(/\s+/).length : 0
  const attachments = note.attachments || []
  const imageAttachments = attachments.filter((a) => a.isImage)
  const fileAttachments = attachments.filter((a) => !a.isImage)
  const attachmentCount = attachments.length

  const editImages = editAttachments.filter((a) => a.isImage)
  const editFiles = editAttachments.filter((a) => !a.isImage)

  const cardClasses = [
    'note-card',
    isRecentlyUpdated && 'recently-updated',
    note.pinned && 'pinned',
    isEditing && 'editing',
    isTrash && 'in-trash',
  ]
    .filter(Boolean)
    .join(' ')

  // ===== EDIT MODE =====
  if (isEditing) {
    return (
      <div className={cardClasses} onKeyDown={handleKeyDown}>
        <input
          ref={editTitleRef}
          className="edit-input"
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Note title..."
          maxLength={120}
        />
        <textarea
          className="edit-input edit-textarea"
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          placeholder="Note body..."
          maxLength={5000}
        />

        {/* Upload zone in edit mode */}
        <div
          className={`upload-zone upload-zone-compact ${editIsDragging ? 'dragging' : ''}`}
          onDragOver={handleEditDragOver}
          onDragLeave={handleEditDragLeave}
          onDrop={handleEditDrop}
          onClick={() => editFileInputRef.current?.click()}
        >
          <input
            ref={editFileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip,.rar"
            onChange={handleEditFileSelect}
            style={{ display: 'none' }}
          />
          <div className="upload-zone-content">
            <span className="upload-icon">{editIsDragging ? '📥' : '📎'}</span>
            <span className="upload-text">
              {editIsDragging ? 'Drop here...' : 'Add files'}
            </span>
          </div>
        </div>

        {editUploadError && (
          <div className="upload-error">⚠️ {editUploadError}</div>
        )}

        {/* Edit attachment previews */}
        {editAttachments.length > 0 && (
          <div className="attachments-preview">
            {editImages.length > 0 && (
              <div className="image-previews">
                {editImages.map((att) => (
                  <div key={att.id} className="image-preview-item">
                    <img src={att.dataUrl} alt={att.name} />
                    <button
                      type="button"
                      className="remove-attachment-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeEditAttachment(att.id)
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {editFiles.length > 0 && (
              <div className="file-previews">
                {editFiles.map((att) => (
                  <div key={att.id} className="file-preview-item">
                    <span className="file-icon">{getFileExtIcon(att.name)}</span>
                    <div className="file-info">
                      <span className="file-name">{att.name}</span>
                      <span className="file-size">{formatFileSize(att.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="remove-attachment-btn-inline"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeEditAttachment(att.id)
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="edit-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveEdit}
            disabled={!editTitle.trim() || !editBody.trim()}
          >
            💾 Save
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleCancelEdit}>
            ✕ Cancel
          </button>
          {editAttachments.length > 0 && (
            <span className="edit-file-count">📎 {editAttachments.length} file(s)</span>
          )}
          <span className="edit-hint">
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd> save · <kbd>Esc</kbd> cancel
          </span>
        </div>
      </div>
    )
  }

  // ===== VIEW MODE =====
  return (
    <div className={cardClasses}>
      <div className="note-card-header">
        <h3 className="note-title">
          {highlightText(note.title, searchQuery)}
        </h3>
        {note.pinned && !isTrash && (
          <span className="note-pin-badge">📌 Pinned</span>
        )}
      </div>

      <p className="note-body">
        {highlightText(note.body, searchQuery)}
      </p>

      {/* ===== ATTACHMENTS DISPLAY ===== */}
      {attachmentCount > 0 && (
        <div className="note-attachments">
          {imageAttachments.length > 0 && (
            <div className="note-image-gallery">
              {imageAttachments.map((att) => (
                <div
                  key={att.id}
                  className="note-image-thumb"
                  onClick={() => onLightbox && onLightbox(att)}
                  title={`${att.name} — Click to view full size`}
                >
                  <img src={att.dataUrl} alt={att.name} loading="lazy" />
                  <div className="note-image-overlay">
                    <span>🔍</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {fileAttachments.length > 0 && (
            <div className="note-file-list">
              {fileAttachments.map((att) => (
                <div
                  key={att.id}
                  className="note-file-badge"
                  onClick={() => handleDownload(att)}
                  title={`Download ${att.name}`}
                >
                  <span className="file-icon">{getFileExtIcon(att.name)}</span>
                  <span className="file-name">{att.name}</span>
                  <span className="file-size">{formatFileSize(att.size)}</span>
                  <span className="file-download-icon">⬇️</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="note-footer">
        <div className="note-meta">
          <span className="note-meta-item">🕐 {timeAgo(note.updatedAt)}</span>
          <span className="note-meta-item">📖 {wordCount} words</span>
          {attachmentCount > 0 && (
            <span className="note-meta-item">📎 {attachmentCount} file{attachmentCount > 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="note-actions">
          {isTrash ? (
            <>
              <button
                className="note-action-btn restore-btn"
                onClick={() => onRestore(note.id)}
                title="Restore note"
              >
                ♻️
              </button>
              <button
                className="note-action-btn delete-btn"
                onClick={() => onPermanentDelete(note.id)}
                title="Delete permanently"
              >
                💀
              </button>
            </>
          ) : (
            <>
              <button
                className={`note-action-btn pin-btn ${note.pinned ? 'pinned' : ''}`}
                onClick={() => onTogglePin(note.id)}
                title={note.pinned ? 'Unpin' : 'Pin'}
              >
                {note.pinned ? '📌' : '📍'}
              </button>
              <button
                className="note-action-btn edit-btn"
                onClick={handleStartEdit}
                title="Edit note"
              >
                ✏️
              </button>
              <button
                className="note-action-btn delete-btn"
                onClick={() => onDelete(note.id)}
                title="Move to trash"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
