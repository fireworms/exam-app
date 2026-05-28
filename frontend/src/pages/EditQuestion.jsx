import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axios from '../axios'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

import API from '../api'

function getCroppedBlob(image, crop) {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  canvas.width = Math.floor(crop.width * scaleX)
  canvas.height = Math.floor(crop.height * scaleY)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
}

export function EditQuestionContent({ questionId, onClose, onDirtyChange }) {
  const [q, setQ] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [imageUrl, setImageUrl] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)

  const [cropMode, setCropMode] = useState(false)
  const [cropSrc, setCropSrc] = useState(null)
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState()
  const imgRef = useRef()
  const fileInputRef = useRef()

  useEffect(() => { loadQuestion() }, [questionId])

  const loadQuestion = async () => {
    setLoading(true)
    setSaved(false)
    onDirtyChange?.(false)
    try {
      const res = await axios.get(`${API}/questions/${questionId}`)
      setQ(res.data)
      try {
        await axios.get(`${API}/questions/${questionId}/image`, { responseType: 'blob' })
        setImageUrl(`${API}/questions/${questionId}/image?t=${Date.now()}`)
      } catch { setImageUrl(null) }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleFileSelected = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setCropSrc(e.target.result)
      setCrop(undefined)
      setCompletedCrop(undefined)
      setCropMode(true)
    }
    reader.readAsDataURL(file)
  }

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget
    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, width / height, width, height), width, height))
  }, [])

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) return
    setImageLoading(true)
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop)
      const formData = new FormData()
      formData.append('file', blob, 'cropped.jpg')
      await axios.post(`${API}/questions/${questionId}/image`, formData)
      setImageUrl(`${API}/questions/${questionId}/image?t=${Date.now()}`)
      setCropMode(false)
      setCropSrc(null)
    } catch (e) { alert('업로드 실패: ' + e.message) }
    setImageLoading(false)
  }

  const handleCropCancel = () => { setCropMode(false); setCropSrc(null) }

  const handleImageDelete = async () => {
    if (!confirm('이미지를 삭제할까요?')) return
    try {
      await axios.delete(`${API}/questions/${questionId}/image`)
      setImageUrl(null)
    } catch (e) { alert('삭제 실패: ' + e.message) }
  }

  const markDirty = () => { setSaved(false); onDirtyChange?.(true) }
  const handleTextChange = (field, value) => { setQ(prev => ({ ...prev, [field]: value })); markDirty() }
  const handleChoiceChange = (idx, field, value) => {
    setQ(prev => ({ ...prev, choices: prev.choices.map((c, i) => i === idx ? { ...c, [field]: value } : c) }))
    markDirty()
  }
  const handleCorrectChange = (idx) => {
    setQ(prev => ({ ...prev, choices: prev.choices.map((c, i) => ({ ...c, is_correct: i === idx })) }))
    markDirty()
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await axios.put(`${API}/questions/${questionId}`, {
        question_text: q.question_text,
        explanation: q.explanation,
        choices: q.choices.map(c => ({ id: c.id, text: c.text, is_correct: !!c.is_correct }))
      })
      setSaved(true)
      onDirtyChange?.(false)
    } catch (e) { alert('저장 실패: ' + e.message) }
    setSaving(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>불러오는 중...</div>
  if (!q) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text2)' }}>문제를 찾을 수 없어요</div>

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          {onClose && <button onClick={onClose} style={styles.backBtn}>← 목록으로</button>}
          <h2 style={{ margin: '8px 0 4px', fontSize: 20, fontWeight: 700 }}>문제 편집</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{q.subject} · {q.year}년 {q.month}월 · Q{q.number}</div>
        </div>
        <button onClick={handleSave} disabled={saving} style={{ ...styles.saveBtn, ...(saved ? styles.saveBtnDone : {}) }}>
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>문제 이미지</div>
        {cropMode && cropSrc ? (
          <div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>드래그해서 원하는 영역을 선택하세요</div>
              <ReactCrop crop={crop} onChange={(_, pct) => setCrop(pct)} onComplete={(c) => setCompletedCrop(c)} style={{ maxWidth: '100%' }}>
                <img ref={imgRef} src={cropSrc} onLoad={onImageLoad} style={{ maxWidth: '100%', display: 'block' }} alt="크롭할 이미지" />
              </ReactCrop>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCropConfirm} disabled={imageLoading || !completedCrop} style={{ ...styles.saveBtn, flex: 1 }}>
                {imageLoading ? '업로드 중...' : '✂️ 이 영역으로 저장'}
              </button>
              <button onClick={handleCropCancel} style={styles.cancelBtn}>취소</button>
            </div>
          </div>
        ) : imageUrl ? (
          <div>
            <img src={imageUrl} alt="문제 이미지" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => fileInputRef.current.click()} style={styles.imgBtn}>🔄 교체 & 크롭</button>
              <button onClick={handleImageDelete} style={{ ...styles.imgBtn, color: 'var(--wrong)' }}>🗑 삭제</button>
            </div>
          </div>
        ) : (
          <div
            style={styles.dropzone}
            onClick={() => fileInputRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFileSelected(e.dataTransfer.files[0]) }}
          >
            {imageLoading ? (
              <span style={{ color: 'var(--text2)' }}>업로드 중...</span>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                <div style={{ fontSize: 14, color: 'var(--text2)' }}>클릭하거나 드래그해서 이미지 추가</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>업로드 후 크롭할 수 있어요</div>
              </>
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelected(e.target.files[0])} />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>문제</div>
        <textarea value={q.question_text} onChange={e => handleTextChange('question_text', e.target.value)} style={{ ...styles.textarea, minHeight: 280 }} />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>선지</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.choices.map((choice, idx) => (
            <div key={choice.id} style={{ ...styles.choiceRow, borderColor: choice.is_correct ? 'var(--correct)' : 'var(--border)', background: choice.is_correct ? 'rgba(74,222,128,0.06)' : 'var(--bg2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: choice.is_correct ? 'var(--correct)' : 'var(--text2)', minWidth: 20 }}>{choice.number}.</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', marginLeft: 'auto' }}>
                  <input type="radio" name={`correct_${questionId}`} checked={!!choice.is_correct} onChange={() => handleCorrectChange(idx)} />
                  정답
                </label>
              </div>
              <textarea value={choice.text} onChange={e => handleChoiceChange(idx, 'text', e.target.value)} style={{ ...styles.textarea, minHeight: 56 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>해설</div>
        <textarea value={q.explanation} onChange={e => handleTextChange('explanation', e.target.value)} style={{ ...styles.textarea, minHeight: 200 }} />
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        {onClose && <button onClick={onClose} style={styles.cancelBtn}>취소</button>}
        <button onClick={handleSave} disabled={saving} style={{ ...styles.saveBtn, ...(saved ? styles.saveBtnDone : {}) }}>
          {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
        </button>
      </div>
    </div>
  )
}

export default function EditQuestion() {
  const { question_id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('return') || '/quiz'

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingBottom: 60 }}>
      <EditQuestionContent questionId={question_id} onClose={() => navigate(returnTo)} />
    </div>
  )
}

const styles = {
  backBtn: { background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 4 },
  saveBtn: { background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s' },
  saveBtnDone: { background: 'var(--correct)' },
  cancelBtn: { background: 'var(--bg3)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 },
  textarea: { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 14, lineHeight: 1.7, color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  choiceRow: { border: '1px solid', borderRadius: 10, padding: '12px 14px', transition: 'all 0.15s' },
  dropzone: { border: '2px dashed var(--border)', borderRadius: 10, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg2)', transition: 'border-color 0.2s' },
  imgBtn: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text)' },
}
