import { useState, useRef } from 'react'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB per file
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

export default function NoteForm({ onAddNote }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const titleRef = useRef(null)
  const fileInputRef = useRef(null)

  const canSubmit = title.trim().length > 0 && body.trim().length > 0

  const processFiles = async (files) => {
    setUploadError('')
    const fileArray = Array.from(files)
    const remaining = MAX_FILES - attachments.length

    if (remaining <= 0) {
      setUploadError(`Maximum ${MAX_FILES} files per note`)
      return
    }

    const toProcess = fileArray.slice(0, remaining)
    if (fileArray.length > remaining) {
      setUploadError(`Only ${remaining} more file(s) allowed`)
    }

    const results = []
    for (const file of toProcess) {
      try {
        const att = await fileToAttachment(file)
        results.push(att)
      } catch (err) {
        setUploadError(err.message)
      }
    }

    if (results.length > 0) {
      setAttachments((prev) => [...prev, ...results])
    }
  }

  const handleFileSelect = (e) => {
    if (e.target.files) {
      processFiles(e.target.files)
      e.target.value = '' // reset for re-upload of same file
    }
  }

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    setUploadError('')
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canSubmit) return

    onAddNote({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      title: title.trim(),
      body: body.trim(),
      updatedAt: Date.now(),
      pinned: false,
      deleted: false,
      attachments: attachments,
    })

    setTitle('')
    setBody('')
    setAttachments([])
    setUploadError('')

    setTimeout(() => titleRef.current?.focus(), 50)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit(e)
    }
  }

  const wordCount = (str) => str.trim() ? str.trim().split(/\s+/).length : 0
  const imageAttachments = attachments.filter((a) => a.isImage)
  const fileAttachments = attachments.filter((a) => !a.isImage)

  return (
    <div className="note-form-wrapper">
      <form className="note-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
        <div className="form-row">
          <input
            ref={titleRef}
            id="note-title-input"
            type="text"
            className="form-input"
            placeholder="✨ Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            autoFocus
          />
        </div>
        <div className="form-row">
          <textarea
            id="note-body-input"
            className="form-input form-textarea"
            placeholder="Write your thoughts..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
          />
        </div>

        {/* ===== UPLOAD AREA ===== */}
        <div
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip,.rar"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div className="upload-zone-content">
            <span className="upload-icon">{isDragging ? '📥' : '📎'}</span>
            <span className="upload-text">
              {isDragging
                ? 'Drop files here...'
                : 'Drag & drop files or click to browse'}
            </span>
            <span className="upload-hint">
              Images, PDFs, documents · Max 2MB each · Up to {MAX_FILES} files
            </span>
          </div>
        </div>

        {uploadError && (
          <div className="upload-error">⚠️ {uploadError}</div>
        )}

        {/* ===== ATTACHMENT PREVIEWS ===== */}
        {attachments.length > 0 && (
          <div className="attachments-preview">
            {imageAttachments.length > 0 && (
              <div className="image-previews">
                {imageAttachments.map((att) => (
                  <div key={att.id} className="image-preview-item">
                    <img src={att.dataUrl} alt={att.name} />
                    <button
                      type="button"
                      className="remove-attachment-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAttachment(att.id)
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                    <div className="image-preview-name">{att.name}</div>
                  </div>
                ))}
              </div>
            )}
            {fileAttachments.length > 0 && (
              <div className="file-previews">
                {fileAttachments.map((att) => (
                  <div key={att.id} className="file-preview-item">
                    <span className="file-icon">📄</span>
                    <div className="file-info">
                      <span className="file-name">{att.name}</span>
                      <span className="file-size">{formatFileSize(att.size)}</span>
                    </div>
                    <button
                      type="button"
                      className="remove-attachment-btn-inline"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAttachment(att.id)
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

        <div className="form-footer">
          <div className="char-counter">
            <span>📝 {title.length}/120</span>
            <span>📖 {wordCount(body)} words</span>
            {attachments.length > 0 && (
              <span>📎 {attachments.length}/{MAX_FILES} files</span>
            )}
          </div>
          <button
            id="add-note-btn"
            type="submit"
            className="btn btn-primary"
            disabled={!canSubmit}
          >
            ➕ Add Note
          </button>
        </div>
      </form>
    </div>
  )
}
