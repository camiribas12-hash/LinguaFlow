import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { processLesson, fmt, today } from '../ai'

const C = { bg: '#f3e6d2', bg2: '#fdf8f1', bg3: '#fff', sidebar: '#2f4f3a', sidebarAct: 'rgba(227,162,90,0.18)', bor: 'rgba(47,79,58,0.12)', bor2: 'rgba(47,79,58,0.25)', orange: '#e07a3a', green: '#2f4f3a', sage: '#9baf8b', tx: '#333', muted: '#7a7a7a', w: '#fff', err: '#c0392b' }
const inp = { width: '100%', background: C.bg3, border: `1.5px solid ${C.bor}`, borderRadius: 10, padding: '11px 14px', color: C.tx, fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const crd = { background: C.bg3, borderRadius: 14, border: `1px solid ${C.bor}`, padding: 18, boxShadow: '0 2px 12px rgba(47,79,58,0.06)' }
const bp = (bg = C.orange) => ({ background: bg, color: C.w, border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
const bs = { background: 'transparent', color: C.green, border: `1.5px solid ${C.bor2}`, borderRadius: 10, padding: '10px 18px', fontSize: 13, cursor: 'pointer' }

const Tag = ({ col, children, sm }) => <span style={{ fontSize: sm ? 10 : 11, background: col + '20', color: col, padding: sm ? '2px 7px' : '3px 10px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
const Lbl = ({ children }) => <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: .5, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>{children}</label>
const Empty = ({ icon = '📭', msg, sub }) => <div style={{ textAlign: 'center', padding: '40px 16px', color: C.muted }}><div style={{ fontSize: 48, marginBottom: 8 }}>{icon}</div><div style={{ fontSize: 14, fontWeight: 600, color: C.tx, marginBottom: 4 }}>{msg}</div>{sub && <div style={{ fontSize: 12 }}>{sub}</div>}</div>
const Spin = () => <div style={{ width: 16, height: 16, border: `2px solid ${C.bor2}`, borderTopColor: C.orange, borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
const Stat = ({ icon, val, label, col }) => <div style={{ ...crd, textAlign: 'center', padding: 14 }}><div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div><div style={{ fontSize: 22, fontWeight: 800, color: col || C.tx }}>{val}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div></div>

function Toast({ t }) {
  if (!t) return null
  const co = { success: C.sage, error: C.err, info: C.orange, warning: '#f39c12' }
  return <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: C.bg3, border: `1.5px solid ${co[t.type] || C.sage}`, borderRadius: 12, padding: '12px 18px', maxWidth: 320, boxShadow: '0 8px 30px rgba(47,79,58,0.15)' }}>
    <div style={{ fontWeight: 700, color: co[t.type], fontSize: 13 }}>{t.title}</div>
    {t.msg && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{t.msg}</div>}
  </div>
}

function Modal({ open, onClose, title, children, w = 520 }) {
  if (!open) return null
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(47,79,58,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: C.bg3, borderRadius: 16, border: `1px solid ${C.bor}`, width: '100%', maxWidth: w, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(47,79,58,0.2)' }}>
      <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.bor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.green }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  </div>
}

const NAV = [
  { id: 'dash', icon: '📊', label: 'Dashboard' },
  { id: 'students', icon: '👥', label: 'Alunos' },
  { id: 'lessons', icon: '📖', label: 'Aulas' },
  { id: 'content', icon: '📚', label: 'Conteúdos' },
  { id: 'sync', icon: '🔄', label: 'Sync Zoom' },
]

const CONTENT_TYPES = [
  { value: 'vocabulary', label: 'Vocabulary', col: C.green },
  { value: 'idiom', label: 'Idiom', col: C.orange },
  { value: 'phrasal_verb', label: 'Phrasal Verb', col: C.sage },
  { value: 'grammar', label: 'Grammar', col: C.green },
  { value: 'correction', label: 'Correction', col: C.err },
]

export default function TeacherApp({ user, profile, onLogout }) {
  const [page, setPage] = useState('dash')
  const [nav, setNav] = useState(true)
  const [toast, setToast] = useState(null)
  const [allStudents, setAllStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [content, setContent] = useState([])
  const [flashcards, setFlashcards] = useState([])
  const [exSessions, setExSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((t) => { setToast(t); setTimeout(() => setToast(null), 3500) }, [])

  const [reviews, setReviews] = useState([])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: stu }, { data: les }, { data: con }, { data: fla }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }),
      supabase.from('lessons').select('*').eq('teacher_id', profile.id).order('date', { ascending: false }),
      supabase.from('content').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('flashcards').select('*, content!inner(teacher_id)').eq('content.teacher_id', profile.id),
    ])
    const students = stu || []
    setAllStudents(students)
    setLessons(les || [])
    setContent(con || [])
    setFlashcards(fla || [])

    if (students.length) {
      const ids = students.map(s => s.id)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const [{ data: ses }, { data: revs }] = await Promise.all([
        supabase.from('exercise_sessions').select('*').in('student_id', ids).gte('date', weekAgo).order('date', { ascending: false }),
        supabase.from('reviews').select('student_id, next_review, last_review, repetitions, ease_factor').in('student_id', ids)
      ])
      setExSessions(ses || [])
      setReviews(revs || [])
    }
    setLoading(false)
  }, [profile.id])

  useEffect(() => { loadAll() }, [loadAll])

  const linkedStudents = allStudents.filter(s => s.teacher_id === profile.id)
  const unlinkedStudents = allStudents.filter(s => !s.teacher_id)

  const linkStudent = async (studentId) => {
    const { error } = await supabase.from('profiles').update({ teacher_id: profile.id }).eq('id', studentId)
    if (error) showToast({ type: 'error', title: 'Erro ao vincular', msg: error.message })
    else { showToast({ type: 'success', title: '✅ Aluno vinculado!' }); await loadAll() }
  }

  const addContentManual = async (data) => {
    const { data: newContent, error } = await supabase.from('content').insert({
      lesson_id: data.lesson_id || null,
      student_id: data.student_id,
      teacher_id: profile.id,
      type: data.type,
      word: data.word || '',
      definition: data.definition || '',
      translation: data.translation || '',
      example: data.example || '',
      error_text: data.error_text || '',
      correction: data.correction || '',
      explanation: data.explanation || '',
    }).select().single()

    if (error) { showToast({ type: 'error', title: 'Erro ao salvar', msg: error.message }); return false }

    if (newContent) {
      const isCorrection = data.type === 'correction'
      const front = isCorrection ? `Corrija: "${data.error_text}"` : data.word
      const back = isCorrection
        ? `✅ ${data.correction}\n\n📖 ${data.explanation}`
        : [data.translation, data.definition ? `📖 ${data.definition}` : '', data.example ? `💬 "${data.example}"` : ''].filter(Boolean).join('\n\n')

      await supabase.from('flashcards').insert({
        content_id: newContent.id,
        student_id: data.student_id,
        type: data.type,
        front,
        back,
      })
    }
    showToast({ type: 'success', title: '✅ Conteúdo e flashcard criados!' })
    await loadAll()
    return true
  }

  const deleteContent = async (contentId) => {
    await supabase.from('content').delete().eq('id', contentId)
    showToast({ type: 'info', title: 'Item removido' })
    await loadAll()
  }

  const pages = {
    dash: <TDash profile={profile} linkedStudents={linkedStudents} unlinkedStudents={unlinkedStudents} lessons={lessons} content={content} flashcards={flashcards} exSessions={exSessions} setPage={setPage} />,
    students: <TStudents profile={profile} linkedStudents={linkedStudents} unlinkedStudents={unlinkedStudents} content={content} exSessions={exSessions} reviews={reviews} flashcards={flashcards} onLink={linkStudent} onAddContent={addContentManual} reload={loadAll} toast={showToast} />,
    lessons: <TLessons profile={profile} students={linkedStudents} lessons={lessons} content={content} reload={loadAll} toast={showToast} />,
    content: <TContent content={content} students={linkedStudents} onAdd={addContentManual} onDelete={deleteContent} toast={showToast} />,
    sync: <TSync profile={profile} reload={loadAll} toast={showToast} />,
  }

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Toast t={toast} />
      <div style={{ width: nav ? 210 : 56, background: C.sidebar, display: 'flex', flexDirection: 'column', transition: 'width .2s', flexShrink: 0 }}>
        <div style={{ padding: '14px 10px', borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧠</div>
          {nav && <div><div style={{ fontWeight: 800, fontSize: 14, color: '#f3e6d2' }}>LinguaFlow</div><div style={{ fontSize: 10, color: C.sage }}>Teacher</div></div>}
        </div>
        <nav style={{ flex: 1, padding: '10px 6px', overflowY: 'auto' }}>
          {NAV.map(it => <button key={it.id} onClick={() => setPage(it.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 8, border: 'none', background: page === it.id ? C.sidebarAct : 'transparent', color: page === it.id ? C.orange : 'rgba(243,230,210,.7)', fontSize: 13, fontWeight: page === it.id ? 700 : 400, cursor: 'pointer', marginBottom: 2, textAlign: 'left' }}>
            <span style={{ fontSize: 17, flexShrink: 0 }}>{it.icon}</span>{nav && <span>{it.label}</span>}
            {it.id === 'students' && unlinkedStudents.length > 0 && <span style={{ marginLeft: 'auto', background: C.err, color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10 }}>{unlinkedStudents.length}</span>}
          </button>)}
        </nav>
        <div style={{ padding: '10px 6px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
          {nav && <div style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: 'rgba(255,255,255,.07)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f3e6d2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</div>
            <div style={{ fontSize: 11, color: C.sage }}>Professora</div>
          </div>}
          <button onClick={() => setNav(!nav)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(243,230,210,.5)', cursor: 'pointer', fontSize: 13 }}>
            <span>{nav ? '←' : '→'}</span>{nav && <span>Recolher</span>}
          </button>
          <button onClick={onLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(255,100,100,.8)', cursor: 'pointer' }}>
            <span style={{ fontSize: 17 }}>🚪</span>{nav && <span style={{ fontSize: 13 }}>Sair</span>}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
        <div style={{ background: C.bg3, borderBottom: `1px solid ${C.bor}`, padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.green, flex: 1 }}>{NAV.find(n => n.id === page)?.label}</div>
          {unlinkedStudents.length > 0 && <Tag col={C.err}>⚠️ {unlinkedStudents.length} aluno(s) aguardando vínculo</Tag>}
        </div>
        <div style={{ padding: 24 }}>
          {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : pages[page]}
        </div>
      </div>
    </div>
  )
}

function TDash({ profile, linkedStudents, unlinkedStudents, lessons, content, flashcards, exSessions, setPage }) {
  const thisWeek = exSessions.filter(s => s.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  return <div>
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: C.green, margin: 0 }}>Olá, {profile.name.split(' ')[0]}! 👋</h2>
      <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Visão geral da sua turma</p>
    </div>
    {unlinkedStudents.length > 0 && <div onClick={() => setPage('students')} style={{ ...crd, marginBottom: 18, background: C.err + '10', border: `1.5px solid ${C.err}44`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 28 }}>⚠️</span>
      <div><div style={{ fontWeight: 700, color: C.err, fontSize: 14 }}>{unlinkedStudents.length} aluno(s) aguardando vínculo</div><div style={{ fontSize: 12, color: C.muted }}>Clique para ir à aba Alunos e vincular</div></div>
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 22 }}>
      <Stat icon="👥" val={linkedStudents.length} label="Alunos Ativos" col={C.green} />
      <Stat icon="📖" val={lessons.filter(l => l.processed).length} label="Aulas Processadas" col={C.orange} />
      <Stat icon="📚" val={content.length} label="Itens de Conteúdo" col={C.sage} />
      <Stat icon="✅" val={thisWeek.length} label="Exercícios (7 dias)" col={C.green} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={crd}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: '0 0 14px' }}>👥 Alunos Vinculados</h3>
        {linkedStudents.length === 0 ? <Empty icon="👥" msg="Nenhum aluno vinculado" sub="Vá à aba Alunos para vincular" /> : linkedStudents.map(s => {
          const stuSessions = exSessions.filter(e => e.student_id === s.id)
          const lastEx = stuSessions[0]?.date
          const stuContent = 0
          return <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.bor}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: C.sage + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: C.green, fontSize: 15, flexShrink: 0 }}>{s.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.tx }}>{s.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {lastEx ? `Último exercício: ${fmt(lastEx)}` : 'Sem exercícios ainda'}
              </div>
            </div>
            <Tag col={stuSessions.length > 0 ? C.sage : C.muted} sm>{stuSessions.length > 0 ? '✓ ativo' : '− inativo'}</Tag>
          </div>
        })}
      </div>
      <div style={crd}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: '0 0 14px' }}>📖 Últimas Aulas</h3>
        {lessons.length === 0 ? <Empty icon="📖" msg="Nenhuma aula" sub="Use o Sync Zoom ou adicione manualmente" /> : lessons.slice(0, 6).map(l => (
          <div key={l.id} style={{ padding: '9px 0', borderBottom: `1px solid ${C.bor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>{l.topic}</div><div style={{ fontSize: 11, color: C.muted }}>{fmt(l.date)}</div></div>
              <Tag col={l.processed ? C.sage : C.orange} sm>{l.processed ? '✅' : '⏳'}</Tag>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
}

function TStudents({ profile, linkedStudents, unlinkedStudents, content, exSessions, reviews, flashcards, onLink, onAddContent, reload, toast }) {
  const [addModal, setAddModal] = useState(null)
  const [form, setForm] = useState({ type: 'vocabulary', word: '', translation: '', definition: '', example: '', error_text: '', correction: '', explanation: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const todayStr = today()

  const handleAdd = async () => {
    if (!form.word.trim() && !form.error_text.trim()) { toast({ type: 'error', title: 'Preencha o campo principal' }); return }
    setSaving(true)
    const ok = await onAddContent({ ...form, student_id: addModal.id })
    if (ok) { setAddModal(null); setForm({ type: 'vocabulary', word: '', translation: '', definition: '', example: '', error_text: '', correction: '', explanation: '' }) }
    setSaving(false)
  }

  const isCorrection = form.type === 'correction'

  // Calcula progresso por aluno
  const getStudentStats = (studentId) => {
    const stuCards = flashcards.filter(f => f.student_id === studentId)
    const stuReviews = reviews.filter(r => r.student_id === studentId)
    const stuSessions = exSessions.filter(e => e.student_id === studentId)
    const stuContent = content.filter(c => c.student_id === studentId)

    const totalCards = stuCards.length
    const reviewedCards = stuReviews.filter(r => r.last_review).length
    const dueToday = stuReviews.filter(r => r.next_review && r.next_review <= todayStr).length
    const mastered = stuReviews.filter(r => (r.repetitions || 0) >= 3).length
    const lastReview = stuReviews
      .filter(r => r.last_review)
      .sort((a, b) => b.last_review.localeCompare(a.last_review))[0]?.last_review

    const totalExOk = stuSessions.reduce((a, b) => a + (b.score_ok || 0), 0)
    const totalExTotal = stuSessions.reduce((a, b) => a + (b.score_total || 0), 0)
    const exAccuracy = totalExTotal > 0 ? Math.round(totalExOk / totalExTotal * 100) : null
    const lastActivity = [lastReview, stuSessions[0]?.date].filter(Boolean).sort().reverse()[0]

    return { totalCards, reviewedCards, dueToday, mastered, exAccuracy, lastActivity, stuSessions: stuSessions.length, stuContent: stuContent.length }
  }

  const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0

  return <div>
    {unlinkedStudents.length > 0 && <div style={{ ...crd, marginBottom: 20, border: `1.5px solid ${C.err}44`, background: C.err + '08' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.err, margin: '0 0 12px' }}>⚠️ Aguardando vínculo ({unlinkedStudents.length})</h3>
      <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px' }}>Estes alunos se cadastraram mas ainda não estão vinculados à sua conta.</p>
      {unlinkedStudents.map(s => <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.bor}` }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: C.err + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: C.err, fontSize: 15, flexShrink: 0 }}>{s.name[0]}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: C.muted }}>ID Zoom: {s.zoom_meeting_id || '—'}</div>
        </div>
        <button onClick={() => onLink(s.id)} style={{ ...bp(C.green), padding: '7px 14px', fontSize: 12 }}>Vincular →</button>
      </div>)}
    </div>}

    {linkedStudents.length === 0
      ? <Empty icon="👥" msg="Nenhum aluno vinculado ainda" sub="Alunos cadastrados aparecerão acima para vincular" />
      : linkedStudents.map(s => {
        const stats = getStudentStats(s.id)
        const progress = pct(stats.reviewedCards, stats.totalCards)
        const progressCol = progress >= 80 ? C.sage : progress >= 40 ? C.orange : C.err

        return <div key={s.id} style={{ ...crd, marginBottom: 14 }}>
          {/* Header do aluno */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: C.sage + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: C.green, fontSize: 20, flexShrink: 0 }}>{s.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.tx }}>{s.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>ID Zoom: {s.zoom_meeting_id || '—'} · Nível: {s.level}</div>
              <div style={{ fontSize: 11, color: stats.lastActivity ? C.green : C.muted, marginTop: 2 }}>
                {stats.lastActivity ? `🕐 Última atividade: ${fmt(stats.lastActivity)}` : '○ Nenhuma atividade ainda'}
              </div>
            </div>
            <button onClick={() => { setAddModal(s); setForm({ type: 'vocabulary', word: '', translation: '', definition: '', example: '', error_text: '', correction: '', explanation: '' }) }} style={{ ...bp(), padding: '7px 14px', fontSize: 12, flexShrink: 0 }}>+ Conteúdo</button>
          </div>

          {/* Barra de progresso */}
          {stats.totalCards > 0 && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Progresso de revisão</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: progressCol }}>{progress}%</span>
            </div>
            <div style={{ height: 8, background: C.bor, borderRadius: 4, marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${progress}%`, background: progressCol, borderRadius: 4, transition: 'width .4s' }} />
            </div>
          </>}

          {/* Stats em grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { icon: '🃏', val: stats.totalCards, label: 'Flashcards', col: C.green },
              { icon: '✅', val: stats.reviewedCards, label: 'Revisados', col: C.sage },
              { icon: '⏰', val: stats.dueToday, label: 'Pendentes hoje', col: stats.dueToday > 0 ? C.err : C.muted },
              { icon: '🏆', val: stats.mastered, label: 'Dominados', col: C.orange },
            ].map(({ icon, val, label, col }) => (
              <div key={label} style={{ background: C.bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: col }}>{val}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 2, lineHeight: 1.3 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Exercícios */}
          {stats.stuSessions > 0 && <div style={{ marginTop: 10, padding: '8px 12px', background: C.bg, borderRadius: 10, display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 12, color: C.muted }}>✏️ {stats.stuSessions} exercício(s) na semana</span>
            {stats.exAccuracy !== null && <span style={{ fontSize: 12, fontWeight: 700, color: stats.exAccuracy >= 70 ? C.sage : C.orange }}>🎯 {stats.exAccuracy}% acerto</span>}
          </div>}

          {/* Alerta se pendente */}
          {stats.dueToday > 0 && <div style={{ marginTop: 8, padding: '6px 12px', background: C.err + '12', borderRadius: 8, fontSize: 12, color: C.err, fontWeight: 600 }}>
            ⚠️ {stats.dueToday} card{stats.dueToday !== 1 ? 's' : ''} para revisar hoje — aluno ainda não fez
          </div>}
          {stats.totalCards > 0 && stats.reviewedCards === 0 && <div style={{ marginTop: 8, padding: '6px 12px', background: C.orange + '12', borderRadius: 8, fontSize: 12, color: C.orange }}>
            📌 Aluno ainda não iniciou as revisões
          </div>}
          {stats.totalCards === 0 && <div style={{ marginTop: 8, padding: '6px 12px', background: C.bor, borderRadius: 8, fontSize: 12, color: C.muted }}>
            📭 Sem flashcards ainda — processe uma aula para gerar conteúdo
          </div>}
        </div>
      })}

    <Modal open={!!addModal} onClose={() => setAddModal(null)} title={`+ Conteúdo para ${addModal?.name}`}>
      <div style={{ marginBottom: 14 }}>
        <Lbl>TIPO</Lbl>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CONTENT_TYPES.map(t => <button key={t.value} onClick={() => setForm(p => ({ ...p, type: t.value }))} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${form.type === t.value ? t.col : C.bor}`, background: form.type === t.value ? t.col + '18' : 'transparent', color: form.type === t.value ? t.col : C.muted, fontWeight: form.type === t.value ? 700 : 400, cursor: 'pointer', fontSize: 12 }}>{t.label}</button>)}
        </div>
      </div>
      {!isCorrection ? <>
        <div style={{ marginBottom: 12 }}><Lbl>{form.type === 'grammar' ? 'PONTO GRAMATICAL' : 'PALAVRA / EXPRESSÃO'}</Lbl><input value={form.word} onChange={set('word')} style={inp} placeholder={form.type === 'phrasal_verb' ? 'Ex: bring up' : form.type === 'idiom' ? 'Ex: under the weather' : 'Ex: commitment'} /></div>
        <div style={{ marginBottom: 12 }}><Lbl>TRADUÇÃO (PT-BR)</Lbl><input value={form.translation} onChange={set('translation')} style={inp} placeholder="Ex: compromisso" /></div>
        <div style={{ marginBottom: 12 }}><Lbl>DEFINIÇÃO (EN)</Lbl><input value={form.definition} onChange={set('definition')} style={inp} placeholder="Ex: a promise to do something" /></div>
        <div style={{ marginBottom: 20 }}><Lbl>EXEMPLO (opcional)</Lbl><input value={form.example} onChange={set('example')} style={inp} placeholder="Ex: She made a commitment to study." /></div>
      </> : <>
        <div style={{ marginBottom: 12 }}><Lbl>ERRO DO ALUNO</Lbl><input value={form.error_text} onChange={set('error_text')} style={inp} placeholder="Ex: She bring up a good point." /></div>
        <div style={{ marginBottom: 12 }}><Lbl>CORREÇÃO</Lbl><input value={form.correction} onChange={set('correction')} style={inp} placeholder="Ex: She brought up a good point." /></div>
        <div style={{ marginBottom: 20 }}><Lbl>EXPLICAÇÃO</Lbl><input value={form.explanation} onChange={set('explanation')} style={inp} placeholder="Ex: Past tense of bring up." /></div>
      </>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setAddModal(null)} style={bs}>Cancelar</button>
        <button onClick={handleAdd} disabled={saving} style={{ ...bp(), opacity: saving ? .7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>{saving ? <Spin /> : ''}💾 Salvar e criar flashcard</button>
      </div>
    </Modal>
  </div>
}

function TLessons({ profile, students, lessons, content, reload, toast }) {
  const [modal, setModal] = useState(false)
  const [processing, setProcessing] = useState(null)
  const [form, setForm] = useState({ studentId: '', date: today(), topic: '', duration: 60, transcript: '' })
  // Seletor de aluno para aulas sem student_id
  const [lessonStudentMap, setLessonStudentMap] = useState({})
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const doProcess = async (lessonId, transcript, studentId, topic) => {
    if (!studentId) { toast({ type: 'error', title: 'Selecione um aluno antes de processar' }); return }
    if (!transcript || transcript.trim().length < 20) { toast({ type: 'error', title: 'Aula sem transcrição', msg: 'Adicione a transcrição para processar com IA.' }); return }
    setProcessing(lessonId)
    try {
      const { processLesson } = await import('../ai')
      const parsed = await processLesson(transcript, topic)
      const typeMap = { vocabulary: 'vocabulary', idioms: 'idiom', phrasal_verbs: 'phrasal_verb', grammar: 'grammar', corrections: 'correction' }
      const newContent = []
      for (const [k, type] of Object.entries(typeMap)) {
        for (const item of (parsed[k] || [])) {
          if (!item.word && !item.correction) continue
          newContent.push({
            lesson_id: lessonId, student_id: studentId, teacher_id: profile.id, type,
            word: item.word || item.correction || '',
            definition: item.definition || '',
            translation: item.translation || '',
            example: item.example || '',
            error_text: item.error_text || item.errorText || '',
            correction: item.correction || '',
            explanation: item.explanation || ''
          })
        }
      }
      if (newContent.length) {
        const { data: savedContent } = await supabase.from('content').insert(newContent).select()
        if (savedContent?.length) {
          const cards = savedContent.map(item => ({
            content_id: item.id,
            student_id: studentId,
            type: item.type,
            front: item.type === 'correction' ? `Corrija: "${item.error_text}"` : item.word,
            back: item.type === 'correction'
              ? `✅ ${item.correction}\n\n📖 ${item.explanation}`
              : [item.translation, item.definition ? `📖 ${item.definition}` : '', item.example ? `💬 "${item.example}"` : ''].filter(Boolean).join('\n\n'),
          }))
          await supabase.from('flashcards').insert(cards)
        }
      }
      // Atualiza a aula como processada e vincula ao aluno se necessário
      await supabase.from('lessons')
        .update({ processed: true, summary: parsed.summary || '', student_id: studentId })
        .eq('id', lessonId)
      await reload()
      toast({ type: 'success', title: '✅ Aula processada!', msg: `${newContent.length} itens · flashcards criados para o aluno` })
    } catch (e) {
      toast({ type: 'error', title: 'Erro ao processar', msg: e.message })
    }
    setProcessing(null)
  }

  const save = async () => {
    if (!form.topic.trim() || !form.studentId) { toast({ type: 'error', title: 'Tópico e aluno são obrigatórios' }); return }
    const { data: nl } = await supabase.from('lessons').insert({
      teacher_id: profile.id, student_id: form.studentId, date: form.date,
      topic: form.topic, duration: Number(form.duration), transcript: form.transcript, processed: false
    }).select().single()
    setModal(false)
    if (nl && form.transcript.trim().length > 30) await doProcess(nl.id, form.transcript, form.studentId, form.topic)
    else { await reload(); toast({ type: 'success', title: 'Aula salva!' }) }
  }

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <span style={{ color: C.muted, fontSize: 13 }}>{lessons.length} aula(s)</span>
      <button onClick={() => { setForm({ studentId: students[0]?.id || '', date: today(), topic: '', duration: 60, transcript: '' }); setModal(true) }} style={bp()}>+ Nova Aula</button>
    </div>
    {lessons.length === 0 ? <Empty icon="📖" msg="Nenhuma aula" sub="Crie manualmente ou use o Sync Zoom" /> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lessons.map(l => {
          const st = students.find(s => s.id === l.student_id)
          const cnt = content.filter(c => c.lesson_id === l.id).length
          const isP = processing === l.id
          // Aluno selecionado para aulas sem student_id
          const selectedStudentId = l.student_id || lessonStudentMap[l.id] || ''
          const hasStudent = !!selectedStudentId

          return <div key={l.id} style={crd}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.tx }}>{l.topic}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {st?.name || <span style={{ color: C.err }}>⚠️ Aluno não vinculado</span>} · {fmt(l.date)} · {l.duration}min
                </div>
              </div>
              <Tag col={l.processed ? C.sage : C.orange}>{l.processed ? '✅ Processada' : '⏳ Pendente'}</Tag>
            </div>

            {/* Seletor de aluno para aulas sem student_id */}
            {!l.student_id && (
              <div style={{ marginBottom: 10, padding: '8px 12px', background: C.err + '10', borderRadius: 10, border: `1px solid ${C.err}33` }}>
                <div style={{ fontSize: 11, color: C.err, fontWeight: 700, marginBottom: 6 }}>⚠️ Selecione o aluno desta aula para criar os flashcards:</div>
                <select
                  value={lessonStudentMap[l.id] || ''}
                  onChange={e => setLessonStudentMap(prev => ({ ...prev, [l.id]: e.target.value }))}
                  style={{ ...inp, fontSize: 12, padding: '7px 10px' }}
                >
                  <option value="">Selecionar aluno...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {l.summary && <p style={{ fontSize: 13, color: C.muted, margin: '6px 0', lineHeight: 1.5 }}>{l.summary}</p>}
            {l.processed && cnt > 0 && <Tag col={C.sage}>📚 {cnt} itens gerados</Tag>}

            {!l.processed && (
              <div style={{ marginTop: 10 }}>
                {hasStudent ? (
                  <button
                    onClick={() => doProcess(l.id, l.transcript || l.summary, selectedStudentId, l.topic)}
                    disabled={!!processing}
                    style={{ ...bp(C.green), padding: '7px 14px', fontSize: 12, opacity: isP ? .7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {isP ? <Spin /> : '🧠'}{isP ? 'Processando...' : 'Processar com IA'}
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: C.muted }}>Selecione um aluno acima para processar</div>
                )}
              </div>
            )}
          </div>
        })}
      </div>
    }
    <Modal open={modal} onClose={() => setModal(false)} title="📖 Nova Aula">
      <div style={{ marginBottom: 14 }}><Lbl>ALUNO</Lbl>
        <select value={form.studentId} onChange={set('studentId')} style={inp}>
          <option value="">Selecione...</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10, marginBottom: 14 }}>
        <div><Lbl>TÓPICO</Lbl><input value={form.topic} onChange={set('topic')} style={inp} placeholder="Ex: Present Perfect" /></div>
        <div><Lbl>DATA</Lbl><input type="date" value={form.date} onChange={set('date')} style={inp} /></div>
      </div>
      <div style={{ marginBottom: 14 }}><Lbl>TRANSCRIÇÃO (Claude extrai conteúdo automaticamente)</Lbl>
        <textarea value={form.transcript} onChange={set('transcript')} style={{ ...inp, minHeight: 100, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} placeholder="Cole a transcrição ou resumo da aula aqui..." />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setModal(false)} style={bs}>Cancelar</button>
        <button onClick={save} style={bp()}>💾 Salvar</button>
      </div>
    </Modal>
  </div>
}

function TContent({ content, students, onAdd, onDelete, toast }) {
  const [tab, setTab] = useState('vocabulary')
  const [studentFilter, setStudentFilter] = useState('all')
  const [addModal, setAddModal] = useState(false)
  const [form, setForm] = useState({ student_id: students[0]?.id || '', type: 'vocabulary', word: '', translation: '', definition: '', example: '', error_text: '', correction: '', explanation: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const types = { vocabulary: { label: 'Vocabulary', col: C.green }, idiom: { label: 'Idioms', col: C.orange }, phrasal_verb: { label: 'Phrasal Verbs', col: C.sage }, grammar: { label: 'Grammar', col: C.green }, correction: { label: 'Corrections', col: C.err } }

  const filtered = content.filter(c => c.type === tab && (studentFilter === 'all' || c.student_id === studentFilter))
  const isCorrection = form.type === 'correction'

  const handleAdd = async () => {
    if (!form.student_id) { toast({ type: 'error', title: 'Selecione um aluno' }); return }
    if (!form.word.trim() && !form.error_text.trim()) { toast({ type: 'error', title: 'Preencha o campo principal' }); return }
    setSaving(true)
    await onAdd(form)
    setAddModal(false)
    setForm(p => ({ ...p, word: '', translation: '', definition: '', example: '', error_text: '', correction: '', explanation: '' }))
    setSaving(false)
  }

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
      <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
        <option value="all">Todos os alunos</option>
        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button onClick={() => setAddModal(true)} style={bp()}>+ Adicionar conteúdo</button>
    </div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      {Object.entries(types).map(([k, v]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${tab === k ? v.col : C.bor}`, background: tab === k ? v.col + '18' : 'transparent', color: tab === k ? v.col : C.muted, fontSize: 12, fontWeight: tab === k ? 700 : 400, cursor: 'pointer' }}>
        {v.label} ({content.filter(c => c.type === k && (studentFilter === 'all' || c.student_id === studentFilter)).length})
      </button>)}
    </div>
    {filtered.length === 0 ? <Empty icon="📚" msg="Nenhum item" sub="Processe uma aula ou adicione manualmente" /> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(item => {
          const st = students.find(s => s.id === item.student_id)
          return <div key={item.id} style={{ ...crd, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: types[tab]?.col || C.green, marginTop: 7, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.tx, marginBottom: 4 }}>
                  {tab === 'correction' ? <><span style={{ color: C.err }}>✗ {item.error_text}</span><span style={{ color: C.muted }}> → </span><span style={{ color: C.sage }}>✓ {item.correction}</span></> : item.word}
                </div>
                {st && <Tag col={C.sage} sm>{st.name}</Tag>}
              </div>
              {tab !== 'correction' && item.translation && <div style={{ fontSize: 12, color: types[tab]?.col, marginBottom: 2, fontWeight: 600 }}>{item.translation}</div>}
              {(tab === 'correction' ? item.explanation : item.definition) && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{tab === 'correction' ? item.explanation : item.definition}</div>}
              {item.example && tab !== 'correction' && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 3 }}>💬 "{item.example}"</div>}
            </div>
            <button onClick={() => onDelete(item.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }}>🗑</button>
          </div>
        })}
      </div>}

    <Modal open={addModal} onClose={() => setAddModal(false)} title="+ Adicionar Conteúdo">
      <div style={{ marginBottom: 14 }}><Lbl>ALUNO</Lbl>
        <select value={form.student_id} onChange={set('student_id')} style={inp}><option value="">Selecione...</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </div>
      <div style={{ marginBottom: 14 }}><Lbl>TIPO</Lbl>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CONTENT_TYPES.map(t => <button key={t.value} onClick={() => setForm(p => ({ ...p, type: t.value }))} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${form.type === t.value ? t.col : C.bor}`, background: form.type === t.value ? t.col + '18' : 'transparent', color: form.type === t.value ? t.col : C.muted, fontWeight: form.type === t.value ? 700 : 400, cursor: 'pointer', fontSize: 12 }}>{t.label}</button>)}
        </div>
      </div>
      {!isCorrection ? <>
        <div style={{ marginBottom: 12 }}><Lbl>PALAVRA / EXPRESSÃO</Lbl><input value={form.word} onChange={set('word')} style={inp} placeholder="Ex: commitment" /></div>
        <div style={{ marginBottom: 12 }}><Lbl>TRADUÇÃO (PT-BR)</Lbl><input value={form.translation} onChange={set('translation')} style={inp} placeholder="Ex: compromisso" /></div>
        <div style={{ marginBottom: 12 }}><Lbl>DEFINIÇÃO (EN)</Lbl><input value={form.definition} onChange={set('definition')} style={inp} placeholder="Ex: a promise to do something" /></div>
        <div style={{ marginBottom: 20 }}><Lbl>EXEMPLO (opcional)</Lbl><input value={form.example} onChange={set('example')} style={inp} placeholder="Ex: She made a commitment to study." /></div>
      </> : <>
        <div style={{ marginBottom: 12 }}><Lbl>ERRO DO ALUNO</Lbl><input value={form.error_text} onChange={set('error_text')} style={inp} placeholder="Ex: She bring up a good point." /></div>
        <div style={{ marginBottom: 12 }}><Lbl>CORREÇÃO</Lbl><input value={form.correction} onChange={set('correction')} style={inp} placeholder="Ex: She brought up a good point." /></div>
        <div style={{ marginBottom: 20 }}><Lbl>EXPLICAÇÃO</Lbl><input value={form.explanation} onChange={set('explanation')} style={inp} placeholder="Ex: Passado de 'bring up' + concordância verbal." /></div>
      </>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setAddModal(false)} style={bs}>Cancelar</button>
        <button onClick={handleAdd} disabled={saving} style={{ ...bp(), opacity: saving ? .7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>{saving ? <Spin /> : ''}💾 Salvar + Flashcard</button>
      </div>
    </Modal>
  </div>
}

function TSync({ profile, reload, toast }) {
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState([])
  const addLog = (msg, type = 'info') => setLog(p => [...p, { msg, type, t: new Date().toLocaleTimeString('pt-BR') }])

  const doSync = async () => {
    setLoading(true); setLog([])
    addLog('🔄 Conectando ao n8n...')
    try {
      const res = await fetch('https://n8n-production-7ed8.up.railway.app/webhook/sync-zoom-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual_app', timestamp: new Date().toISOString() })
      })
      if (!res.ok) throw new Error(`Erro ${res.status} — verifique se o workflow está ativo no n8n`)
      addLog('✅ Sync iniciado! Buscando gravações do Zoom...', 'success')
      addLog('🤖 Claude analisando conteúdo de cada aula...', 'info')
      addLog('📝 Salvando no Notion e no app...', 'info')
      addLog('⏱️ Pode levar 1-3 minutos...', 'warning')
      setTimeout(async () => {
        await reload()
        addLog('🎉 Concluído! Verifique as novas aulas.', 'success')
        toast({ type: 'success', title: 'Sync concluído!' })
        setLoading(false)
      }, 15000)
    } catch (e) {
      addLog('❌ Erro: ' + e.message, 'error')
      toast({ type: 'error', title: 'Erro no sync', msg: e.message })
      setLoading(false)
    }
  }

  const lc = { info: C.muted, success: C.sage, warning: C.orange, error: C.err }
  return <div>
    <div style={{ ...crd, marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: C.green, margin: '0 0 8px' }}>🔄 Sincronizar Gravações do Zoom</h3>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 12px', lineHeight: 1.6 }}>
        Busca as gravações recentes do Zoom, analisa com Claude e salva automaticamente no Notion e no banco de dados — vinculando ao aluno pelo ID da reunião.
      </p>
      <button onClick={doSync} disabled={loading} style={{ ...bp(C.green), opacity: loading ? .7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        {loading ? <Spin /> : '🔄'}{loading ? 'Sincronizando...' : 'Sincronizar Agora'}
      </button>
    </div>
    <div style={{ ...crd, marginBottom: 14, background: C.bg, fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
      <strong style={{ color: C.tx }}>📌 Vínculo automático de alunos:</strong> O ID da reunião Zoom (armazenado no perfil de cada aluno) é usado para identificar qual conteúdo pertence a qual aluno. Certifique-se de que cada aluno preencheu o ID correto ao se cadastrar.
    </div>
    {log.length > 0 && <div style={crd}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: C.green, margin: '0 0 10px' }}>📋 Log</h4>
      {log.map((l, i) => <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: i < log.length - 1 ? `1px solid ${C.bor}` : 'none' }}>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace', flexShrink: 0 }}>{l.t}</span>
        <span style={{ fontSize: 12, color: lc[l.type] || C.muted }}>{l.msg}</span>
      </div>)}
    </div>}
  </div>
}
