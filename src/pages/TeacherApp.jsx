import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { processLesson, fetchNotionLessons, fmt, today } from '../ai'

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

const NAV = [{ id: 'dash', icon: '📊', label: 'Dashboard' }, { id: 'students', icon: '👥', label: 'Alunos' }, { id: 'lessons', icon: '📖', label: 'Aulas' }, { id: 'content', icon: '📚', label: 'Conteúdos' }, { id: 'sync', icon: '🔄', label: 'Notion Sync' }]

export default function TeacherApp({ user, profile, onLogout }) {
  const [page, setPage] = useState('dash')
  const [nav, setNav] = useState(true)
  const [toast, setToast] = useState(null)
  const [students, setStudents] = useState([])
  const [lessons, setLessons] = useState([])
  const [content, setContent] = useState([])
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(true)

  const showToast = useCallback((t) => { setToast(t); setTimeout(() => setToast(null), 3500) }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: stu }, { data: les }, { data: con }, { data: fla }] = await Promise.all([
      supabase.from('profiles').select('*').eq('teacher_id', profile.id).eq('role', 'student').order('created_at', { ascending: false }),
      supabase.from('lessons').select('*').eq('teacher_id', profile.id).order('date', { ascending: false }),
      supabase.from('content').select('*').eq('teacher_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('flashcards').select('*, content!inner(teacher_id)').eq('content.teacher_id', profile.id),
    ])
    setStudents(stu || [])
    setLessons(les || [])
    setContent(con || [])
    setFlashcards(fla || [])
    setLoading(false)
  }, [profile.id])

  useEffect(() => { loadAll() }, [loadAll])

  const pages = {
    dash: <TDash profile={profile} students={students} lessons={lessons} content={content} flashcards={flashcards} />,
    students: <TStudents profile={profile} students={students} reload={loadAll} toast={showToast} />,
    lessons: <TLessons profile={profile} students={students} lessons={lessons} content={content} reload={loadAll} toast={showToast} />,
    content: <TContent content={content} />,
    sync: <TSync profile={profile} students={students} reload={loadAll} toast={showToast} />,
  }

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Toast t={toast} />
      {/* Sidebar */}
      <div style={{ width: nav ? 210 : 56, background: C.sidebar, display: 'flex', flexDirection: 'column', transition: 'width .2s', flexShrink: 0 }}>
        <div style={{ padding: '14px 10px', borderBottom: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧠</div>
          {nav && <div><div style={{ fontWeight: 800, fontSize: 14, color: '#f3e6d2' }}>LinguaFlow</div><div style={{ fontSize: 10, color: C.sage }}>Teacher</div></div>}
        </div>
        <nav style={{ flex: 1, padding: '10px 6px', overflowY: 'auto' }}>
          {NAV.map(it => <button key={it.id} onClick={() => setPage(it.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 8, border: 'none', background: page === it.id ? C.sidebarAct : 'transparent', color: page === it.id ? C.orange : 'rgba(243,230,210,.7)', fontSize: 13, fontWeight: page === it.id ? 700 : 400, cursor: 'pointer', marginBottom: 2, textAlign: 'left' }}>
            <span style={{ fontSize: 17, flexShrink: 0 }}>{it.icon}</span>{nav && <span>{it.label}</span>}
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
      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
        <div style={{ background: C.bg3, borderBottom: `1px solid ${C.bor}`, padding: '13px 22px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.green, flex: 1 }}>{NAV.find(n => n.id === page)?.label}</div>
          <Tag col={C.sage}>● Online</Tag>
        </div>
        <div style={{ padding: 24 }}>
          {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : pages[page]}
        </div>
      </div>
    </div>
  )
}

function TDash({ profile, students, lessons, content, flashcards }) {
  return <div>
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: C.green, margin: 0 }}>Olá, {profile.name.split(' ')[0]}! 👋</h2>
      <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Resumo das atividades dos seus alunos</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 22 }}>
      <Stat icon="👥" val={students.length} label="Alunos Ativos" col={C.green} />
      <Stat icon="📖" val={lessons.filter(l => l.processed).length} label="Aulas Processadas" col={C.orange} />
      <Stat icon="📚" val={content.length} label="Itens de Conteúdo" col={C.sage} />
      <Stat icon="🃏" val={flashcards.length} label="Flashcards Criados" col={C.green} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={crd}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: '0 0 14px' }}>👥 Seus Alunos</h3>
        {students.length === 0 ? <Empty icon="👥" msg="Nenhum aluno ainda" sub="Alunos se cadastram com seu e-mail" /> : students.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.bor}` }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: C.sage + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: C.green, fontSize: 15, flexShrink: 0 }}>{s.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.tx }}>{s.name}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 3 }}><Tag col={C.green} sm>{s.level}</Tag><span style={{ fontSize: 10, color: C.muted }}>⚡{s.xp} XP</span></div>
            </div>
          </div>
        ))}
      </div>
      <div style={crd}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: '0 0 14px' }}>📖 Últimas Aulas</h3>
        {lessons.length === 0 ? <Empty icon="📖" msg="Nenhuma aula" sub="Sync do Notion ou adicione manualmente" /> : lessons.slice(0, 6).map(l => (
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

function TStudents({ profile, students, reload, toast }) {
  const [modal, setModal] = useState(false)
  const [info, setInfo] = useState('')

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
      <span style={{ color: C.muted, fontSize: 13 }}>{students.length} aluno(s) vinculado(s)</span>
      <button onClick={() => setModal(true)} style={bp()}>+ Como adicionar alunos?</button>
    </div>
    {students.length === 0
      ? <Empty icon="👥" msg="Nenhum aluno ainda" sub="Compartilhe o link do app e peça que se cadastrem com seu e-mail como professora" />
      : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {students.map(s => {
          const sCards = 0 // could load per student
          return <div key={s.id} style={{ ...crd, display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: C.sage + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: C.green, fontSize: 20, flexShrink: 0 }}>{s.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.tx }}>{s.name}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Cadastrado em {fmt(s.created_at?.split('T')[0])}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><Tag col={C.green}>{s.level}</Tag><Tag col={C.orange}>⚡{s.xp} XP</Tag><Tag col={C.orange}>🔥{s.streak}d</Tag></div>
            </div>
          </div>
        })}
      </div>
    }
    <Modal open={modal} onClose={() => setModal(false)} title="Como adicionar alunos">
      <div style={{ fontSize: 14, color: C.tx, lineHeight: 1.8 }}>
        <p style={{ marginBottom: 12 }}>Os alunos criam a própria conta no app. Você só precisa compartilhar o link e o seu e-mail:</p>
        <div style={{ background: C.bg, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>O que dizer ao aluno:</p>
          <p style={{ fontSize: 13, color: C.tx, lineHeight: 1.7 }}>
            "Acesse o link do LinguaFlow, clique em <strong>Cadastre-se</strong>, escolha <strong>Aluno(a)</strong> e coloque meu e-mail no campo <strong>E-mail da sua professora</strong>."
          </p>
        </div>
        <div style={{ background: C.sage + '20', borderRadius: 10, padding: 12 }}>
          <p style={{ fontSize: 12, color: C.green }}>📌 Seu e-mail de professora: <strong>{profile?.id}</strong></p>
        </div>
      </div>
    </Modal>
  </div>
}

function TLessons({ profile, students, lessons, content, reload, toast }) {
  const [modal, setModal] = useState(false)
  const [processing, setProcessing] = useState(null)
  const [form, setForm] = useState({ studentId: '', date: today(), topic: '', duration: 60, transcript: '' })
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const doProcess = async (lessonId, transcript, studentId, topic) => {
    setProcessing(lessonId)
    try {
      const parsed = await processLesson(transcript, topic)
      const typeMap = { vocabulary: 'vocabulary', idioms: 'idiom', phrasal_verbs: 'phrasal_verb', grammar: 'grammar', corrections: 'correction' }
      const newContent = []
      for (const [k, type] of Object.entries(typeMap)) {
        for (const item of (parsed[k] || [])) {
          newContent.push({ lesson_id: lessonId, student_id: studentId, teacher_id: profile.id, type, word: item.word || item.correction || '', definition: item.definition || '', translation: item.translation || '', example: item.example || '', error_text: item.error_text || item.errorText || '', correction: item.correction || '', explanation: item.explanation || '' })
        }
      }
      if (newContent.length) {
        const { data: savedContent } = await supabase.from('content').insert(newContent).select()
        if (savedContent?.length) {
          const cards = savedContent.map(item => ({
            content_id: item.id, student_id: studentId, type: item.type,
            front: item.type === 'correction' ? `Corrija: "${item.error_text}"` : item.word,
            back: item.type === 'correction' ? `✅ ${item.correction}\n\n📖 ${item.explanation}` : `${item.translation}\n\n📖 ${item.definition}\n\n💬 ${item.example}`,
          }))
          await supabase.from('flashcards').insert(cards)
        }
      }
      await supabase.from('lessons').update({ processed: true, summary: parsed.summary || '' }).eq('id', lessonId)
      await reload()
      toast({ type: 'success', title: '✅ Aula processada!', msg: `${newContent.length} itens · ${newContent.length} flashcards criados` })
    } catch (e) { toast({ type: 'error', title: 'Erro ao processar', msg: e.message }) }
    setProcessing(null)
  }

  const save = async () => {
    if (!form.topic.trim() || !form.studentId) { toast({ type: 'error', title: 'Tópico e aluno são obrigatórios' }); return }
    const { data: nl } = await supabase.from('lessons').insert({ teacher_id: profile.id, student_id: form.studentId, date: form.date, topic: form.topic, duration: Number(form.duration), transcript: form.transcript, processed: false }).select().single()
    setModal(false)
    if (nl && form.transcript.trim().length > 30) await doProcess(nl.id, form.transcript, form.studentId, form.topic)
    else { await reload(); toast({ type: 'success', title: 'Aula salva!' }) }
  }

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <span style={{ color: C.muted, fontSize: 13 }}>{lessons.length} aula(s)</span>
      <button onClick={() => { setForm({ studentId: students[0]?.id || '', date: today(), topic: '', duration: 60, transcript: '' }); setModal(true) }} style={bp()}>+ Nova Aula</button>
    </div>
    {lessons.length === 0 ? <Empty icon="📖" msg="Nenhuma aula" sub="Crie manualmente ou use Notion Sync" /> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lessons.map(l => {
          const st = students.find(s => s.id === l.student_id)
          const cnt = content.filter(c => c.lesson_id === l.id).length
          const isP = processing === l.id
          return <div key={l.id} style={crd}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <div><div style={{ fontWeight: 700, fontSize: 16, color: C.tx }}>{l.topic}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{st?.name} · {fmt(l.date)} · {l.duration}min</div></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Tag col={l.processed ? C.sage : C.orange}>{l.processed ? '✅ Processada' : '⏳ Pendente'}</Tag>
                {!l.processed && l.transcript && <button onClick={() => doProcess(l.id, l.transcript, l.student_id, l.topic)} disabled={!!processing} style={{ ...bp(C.green), padding: '6px 12px', fontSize: 12, opacity: isP ? .7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>{isP ? <Spin /> : '🧠'}{isP ? 'Processando...' : 'Processar'}</button>}
              </div>
            </div>
            {l.summary && <p style={{ fontSize: 13, color: C.muted, margin: '6px 0', lineHeight: 1.5 }}>{l.summary}</p>}
            {l.processed && <Tag col={C.sage}>📚 {cnt} itens gerados</Tag>}
          </div>
        })}
      </div>
    }
    <Modal open={modal} onClose={() => setModal(false)} title="📖 Nova Aula">
      <div style={{ marginBottom: 14 }}><Lbl>ALUNO</Lbl>
        <select value={form.studentId} onChange={set('studentId')} style={inp}><option value="">Selecione...</option>{students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.level})</option>)}</select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 10, marginBottom: 14 }}>
        <div><Lbl>TÓPICO</Lbl><input value={form.topic} onChange={set('topic')} style={inp} placeholder="Ex: Present Perfect" /></div>
        <div><Lbl>DATA</Lbl><input type="date" value={form.date} onChange={set('date')} style={inp} /></div>
      </div>
      <div style={{ marginBottom: 14 }}><Lbl>TRANSCRIÇÃO (Claude extrai o conteúdo automaticamente)</Lbl>
        <textarea value={form.transcript} onChange={set('transcript')} style={{ ...inp, minHeight: 110, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} placeholder="Cole a transcrição da aula aqui..." />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button onClick={() => setModal(false)} style={bs}>Cancelar</button><button onClick={save} style={bp()}>💾 Salvar</button></div>
    </Modal>
  </div>
}

function TContent({ content }) {
  const [tab, setTab] = useState('vocabulary')
  const types = { vocabulary: { label: 'Vocabulary', col: C.green }, idiom: { label: 'Idioms', col: C.orange }, phrasal_verb: { label: 'Phrasal Verbs', col: C.sage }, grammar: { label: 'Grammar', col: C.green }, correction: { label: 'Corrections', col: C.err } }
  const filtered = content.filter(c => c.type === tab)
  return <div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
      {Object.entries(types).map(([k, v]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${tab === k ? v.col : C.bor}`, background: tab === k ? v.col + '18' : 'transparent', color: tab === k ? v.col : C.muted, fontSize: 13, fontWeight: tab === k ? 700 : 400, cursor: 'pointer' }}>
        {v.label} ({content.filter(c => c.type === k).length})
      </button>)}
    </div>
    {filtered.length === 0 ? <Empty icon="📚" msg="Nenhum item" sub="Processe uma aula para gerar conteúdo" /> :
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(item => <div key={item.id} style={{ ...crd, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: types[tab]?.col || C.green, marginTop: 7, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.tx, marginBottom: 4 }}>
              {tab === 'correction' ? <><span style={{ color: C.err }}>✗ {item.error_text}</span><span style={{ color: C.muted }}> → </span><span style={{ color: C.sage }}>✓ {item.correction}</span></> : item.word}
            </div>
            {tab !== 'correction' && <div style={{ fontSize: 12, color: types[tab]?.col, marginBottom: 3, fontWeight: 600 }}>{item.translation}</div>}
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{tab === 'correction' ? item.explanation : item.definition}</div>
            {item.example && tab !== 'correction' && <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>💬 "{item.example}"</div>}
          </div>
        </div>)}
      </div>
    }
  </div>
}

function TSync({ profile, students, reload, toast }) {
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState([])
  const addLog = (msg, type = 'info') => setLog(p => [...p, { msg, type, t: new Date().toLocaleTimeString('pt-BR') }])

  const doSync = async () => {
    setLoading(true); setLog([])
    addLog('🔄 Conectando ao n8n...')
    try {
      const res = await fetch('https://camiteaching.app.n8n.cloud/webhook/sync-zoom-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual_app', timestamp: new Date().toISOString() })
      })
      if (!res.ok) throw new Error(`Erro ${res.status} — verifique se o workflow está ativo no n8n`)
      addLog('✅ Sync iniciado! O n8n está buscando gravações do Zoom...', 'success')
      addLog('🤖 Claude está analisando o conteúdo de cada aula...', 'info')
      addLog('📝 Salvando no Notion e no banco de dados do app...', 'info')
      addLog('⏱️ Pode levar 1-3 minutos. Esta janela pode ficar aberta.', 'warning')
      setTimeout(async () => {
        await reload()
        addLog('🎉 Concluído! Verifique as novas aulas na aba Aulas.', 'success')
        toast({ type: 'success', title: 'Sync concluído!', msg: 'Novas aulas adicionadas automaticamente' })
        setLoading(false)
      }, 15000)
    } catch (e) {
      addLog('❌ Erro: ' + e.message, 'error')
      addLog('💡 Dica: abra o n8n e confirme que o workflow está ativo', 'info')
      toast({ type: 'error', title: 'Erro no sync', msg: e.message })
      setLoading(false)
    }
  }

  const lc = { info: C.muted, success: C.sage, warning: C.orange, error: C.err }
  return <div>
    <div style={{ ...crd, marginBottom: 18 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: C.green, margin: '0 0 8px' }}>🔄 Sincronizar Gravações do Zoom</h3>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 10px', lineHeight: 1.6 }}>
        Busca as gravações recentes do Zoom, analisa com IA e salva automaticamente em:
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tag col={C.green}>📒 Notion (All Lessons + coluna Alunos)</Tag>
        <Tag col={C.orange}>🗄️ Banco do app</Tag>
        <Tag col={C.sage}>👤 Aluno vinculado pelo ID da reunião</Tag>
      </div>
      <button onClick={doSync} disabled={loading} style={{ ...bp(C.green), opacity: loading ? .7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        {loading ? <Spin /> : '🔄'}{loading ? 'Sincronizando...' : 'Sincronizar Agora'}
      </button>
    </div>
    <div style={{ ...crd, marginBottom: 14, background: C.bg }}>
      <div style={{ fontSize: 12, color: C.tx, marginBottom: 4, fontWeight: 600 }}>📌 Vínculo automático de alunos</div>
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        O n8n compara o ID da reunião Zoom com o campo <strong>"ID Reunião Zoom Fixo"</strong> na tabela Alunos do Notion.
        Certifique-se de que cada aluno tem esse campo preenchido.
      </div>
    </div>
    {log.length > 0 && <div style={crd}>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: C.green, margin: '0 0 10px' }}>📋 Log do Sync</h4>
      {log.map((l, i) => <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: i < log.length - 1 ? `1px solid ${C.bor}` : 'none' }}>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace', flexShrink: 0 }}>{l.t}</span>
        <span style={{ fontSize: 12, color: lc[l.type] || C.muted }}>{l.msg}</span>
      </div>)}
    </div>}
  </div>
}
