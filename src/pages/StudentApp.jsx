import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { generateExercises, sm2, today, fmt } from '../ai'

const C = { bg: '#f3e6d2', bg2: '#fdf8f1', bg3: '#fff', bor: 'rgba(47,79,58,0.12)', bor2: 'rgba(47,79,58,0.25)', orange: '#e07a3a', green: '#2f4f3a', sage: '#9baf8b', tx: '#333', muted: '#7a7a7a', w: '#fff', err: '#c0392b' }
const crd = { background: C.bg3, borderRadius: 14, border: `1px solid ${C.bor}`, padding: 16, boxShadow: '0 2px 12px rgba(47,79,58,0.06)' }
const bp = (bg = C.orange) => ({ background: bg, color: C.w, border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' })
const inp = { width: '100%', background: C.bg3, border: `1.5px solid ${C.bor}`, borderRadius: 10, padding: '11px 14px', color: C.tx, fontSize: 14, outline: 'none', boxSizing: 'border-box' }

const Tag = ({ col, children, sm }) => <span style={{ fontSize: sm ? 10 : 11, background: col + '20', color: col, padding: sm ? '2px 7px' : '3px 10px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
const Stat = ({ icon, val, label, col }) => <div style={{ ...crd, textAlign: 'center', padding: 14 }}><div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div><div style={{ fontSize: 22, fontWeight: 800, color: col || C.tx }}>{val}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div></div>
const Empty = ({ icon = '📭', msg, sub }) => <div style={{ textAlign: 'center', padding: '40px 16px', color: C.muted }}><div style={{ fontSize: 48, marginBottom: 8 }}>{icon}</div><div style={{ fontSize: 14, fontWeight: 600, color: C.tx, marginBottom: 4 }}>{msg}</div>{sub && <div style={{ fontSize: 12 }}>{sub}</div>}</div>
const Spin = () => <div style={{ width: 16, height: 16, border: `2px solid ${C.bor2}`, borderTopColor: C.orange, borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />

function Toast({ t }) {
  if (!t) return null
  const co = { success: C.sage, error: C.err, info: C.orange }
  return <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: C.bg3, border: `1.5px solid ${co[t.type] || C.sage}`, borderRadius: 12, padding: '12px 18px', maxWidth: 320, boxShadow: '0 8px 30px rgba(47,79,58,0.15)' }}>
    <div style={{ fontWeight: 700, color: co[t.type], fontSize: 13 }}>{t.title}</div>
    {t.msg && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{t.msg}</div>}
  </div>
}

const NAV = [{ id: 'home', icon: '🏠', label: 'Home' }, { id: 'review', icon: '🃏', label: 'Revisar' }, { id: 'exercises', icon: '✏️', label: 'Exercícios' }, { id: 'progress', icon: '📊', label: 'Progresso' }]

export default function StudentApp({ user, profile: initProfile, onLogout }) {
  const [page, setPage] = useState('home')
  const [profile, setProfile] = useState(initProfile)
  const [flashcards, setFlashcards] = useState([])
  const [reviews, setReviews] = useState({})
  const [content, setContent] = useState([])
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  const showToast = useCallback(t => { setToast(t); setTimeout(() => setToast(null), 3500) }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: cards }, { data: revs }, { data: con }] = await Promise.all([
      supabase.from('flashcards').select('*').eq('student_id', user.id),
      supabase.from('reviews').select('*').eq('student_id', user.id),
      supabase.from('content').select('*').eq('student_id', user.id),
    ])
    setFlashcards(cards || [])
    const revMap = {}
    for (const r of (revs || [])) revMap[r.flashcard_id] = r
    setReviews(revMap)
    setContent(con || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadAll() }, [loadAll])

  const saveReview = useCallback(async (cardId, btnQuality) => {
    // Map botões (0-3) para escala SM-2 (0-5):
    // Esqueci→0, Difícil→3, Bom→4, Fácil→5
    const sm2Quality = [0, 3, 4, 5][btnQuality] ?? 0
    const current = reviews[cardId]
    const next = sm2(current, sm2Quality)
    const payload = { flashcard_id: cardId, student_id: user.id, ...next }
    if (current?.id) {
      await supabase.from('reviews').update(next).eq('id', current.id)
    } else {
      const { data } = await supabase.from('reviews').insert(payload).select().single()
      if (data) payload.id = data.id
    }
    setReviews(prev => ({ ...prev, [cardId]: { ...payload } }))
    const newXp = (profile.xp || 0) + (btnQuality >= 2 ? 15 : btnQuality === 1 ? 8 : 3)
    await supabase.from('profiles').update({ xp: newXp }).eq('id', user.id)
    setProfile(p => ({ ...p, xp: newXp }))
    return next // retorna estado para mostrar feedback
  }, [reviews, user.id, profile.xp])

  const due = flashcards.filter(f => !(reviews[f.id]?.next_review > today()))

  const pages = {
    home: <SHome profile={profile} due={due} content={content} setPage={setPage} />,
    review: <SReview due={due} reviews={reviews} onReview={saveReview} toast={showToast} profile={profile} />,
    exercises: <SExercises user={user} content={content} toast={showToast} />,
    progress: <SProgress profile={profile} flashcards={flashcards} reviews={reviews} content={content} />,
  }

  return (
    <div style={{ background: C.bg, height: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Toast t={toast} />
      <div style={{ background: C.green, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: C.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧠</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f3e6d2' }}>LinguaFlow</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: 'rgba(243,230,210,.2)', color: '#f3e6d2', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>🔥 {profile.streak || 0}</span>
          <span style={{ background: C.orange, color: C.w, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>⚡ {profile.xp || 0} XP</span>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(243,230,210,.6)', cursor: 'pointer', fontSize: 18 }}>🚪</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : pages[page]}
      </div>
      <div style={{ background: C.bg3, borderTop: `1px solid ${C.bor}`, display: 'flex', flexShrink: 0 }}>
        {NAV.map(it => <button key={it.id} onClick={() => setPage(it.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 4px', border: 'none', background: 'transparent', color: page === it.id ? C.green : C.muted, fontSize: 10, fontWeight: page === it.id ? 700 : 400, cursor: 'pointer', borderTop: `2.5px solid ${page === it.id ? C.orange : 'transparent'}`, position: 'relative' }}>
          <span style={{ fontSize: 20 }}>{it.icon}</span>{it.label}
          {it.id === 'review' && due.length > 0 && <span style={{ position: 'absolute', top: 6, right: 'calc(50% - 18px)', background: C.err, color: C.w, fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center' }}>{due.length}</span>}
        </button>)}
      </div>
    </div>
  )
}

function SHome({ profile, due, content, setPage }) {
  return <div style={{ padding: 16 }}>
    <div style={{ background: C.green, borderRadius: 16, padding: 20, marginBottom: 14, color: '#f3e6d2' }}>
      <div style={{ fontSize: 13, opacity: .7 }}>Olá, {profile.name.split(' ')[0]}! 👋</div>
      <div style={{ fontWeight: 900, fontSize: 22, marginTop: 2, marginBottom: 12 }}>Pronto para estudar?</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <span style={{ background: 'rgba(243,230,210,.2)', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>🔥 {profile.streak || 0} dias</span>
        <span style={{ background: C.orange, borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700, color: C.w }}>⚡ {profile.xp || 0} XP</span>
      </div>
    </div>
    {due.length > 0 && <button onClick={() => setPage('review')} style={{ width: '100%', background: C.orange, border: 'none', borderRadius: 14, padding: 16, textAlign: 'center', cursor: 'pointer', marginBottom: 14, color: C.w }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>🃏 Revisar Agora</div>
      <div style={{ fontSize: 13, opacity: .85, marginTop: 2 }}>{due.length} card{due.length !== 1 ? 's' : ''} pendente{due.length !== 1 ? 's' : ''} hoje</div>
    </button>}
    {content.length > 0 && <button onClick={() => setPage('exercises')} style={{ width: '100%', background: C.bg3, border: `1.5px solid ${C.bor}`, borderRadius: 14, padding: 14, textAlign: 'center', cursor: 'pointer', marginBottom: 14, color: C.tx }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>✏️ Exercícios Interativos</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Exercícios gerados pela IA com seu vocabulário</div>
    </button>}
    {content.length === 0 && <div style={{ ...crd, textAlign: 'center', padding: 24, color: C.muted }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.tx }}>Aguardando conteúdo</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Sua professora irá liberar o conteúdo após processar as aulas</div>
    </div>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Stat icon="📚" val={content.length} label="Itens Aprendidos" col={C.green} />
      <Stat icon="🃏" val={due.length} label="Pendentes Hoje" col={C.orange} />
      <Stat icon="✅" val={content.filter(c => c.type !== 'correction').length} label="Vocabulário" col={C.sage} />
      <Stat icon="🔧" val={content.filter(c => c.type === 'correction').length} label="Correções" col={C.err} />
    </div>
  </div>
}

function SReview({ due, reviews, onReview, toast, profile }) {
  // Inicializa a fila UMA VEZ ao montar o componente — não reseta quando due muda
  const [queue, setQueue] = useState(() => [...due.slice(0, 20)])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)
  const [feedback, setFeedback] = useState(null) // { correct, interval, label }
  const [stats, setStats] = useState({ reviewed: 0, correct: 0, xp: 0 })

  const intervalLabel = days => {
    if (days <= 1) return 'amanhã'
    if (days < 7) return `em ${days} dias`
    if (days < 30) return `em ${Math.round(days / 7)} semana(s)`
    return `em ${Math.round(days / 30)} mês(es)`
  }

  if (queue.length === 0 || done) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 12 }}>{done ? '🎉' : '🌱'}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.green, marginBottom: 8 }}>
        {done ? 'Sessão concluída!' : 'Nenhum card pendente!'}
      </div>
      {done ? (
        <div style={{ ...crd, display: 'inline-block', padding: '16px 28px', marginTop: 8 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: C.orange }}>+{stats.xp} XP</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            ✅ {stats.correct} de {stats.reviewed} corretos
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: C.muted }}>Volte amanhã para continuar sua revisão.</div>
      )}
    </div>
  )

  const card = queue[idx]
  if (!card) { setDone(true); return null }

  const tcol = { vocabulary: C.green, idiom: C.orange, phrasal_verb: C.sage, grammar: C.green, correction: C.err }
  const tlbl = { vocabulary: 'VOCABULARY', idiom: 'IDIOM', phrasal_verb: 'PHRASAL VERB', grammar: 'GRAMMAR', correction: 'CORRECTION' }
  const col = tcol[card.type] || C.green

  const answer = async (btnQuality) => {
    const isCorrect = btnQuality > 0
    const nextState = await onReview(card.id, btnQuality)
    const xpGain = btnQuality >= 2 ? 15 : btnQuality === 1 ? 8 : 3

    // Monta feedback visual
    setFeedback({
      correct: isCorrect,
      label: isCorrect ? `Próxima revisão: ${intervalLabel(nextState.interval_days)}` : 'Voltando para a fila… 🔄',
      color: isCorrect ? C.sage : C.err,
      xp: xpGain
    })

    setStats(p => ({ reviewed: p.reviewed + 1, correct: isCorrect ? p.correct + 1 : p.correct, xp: p.xp + xpGain }))

    setTimeout(() => {
      setFeedback(null)
      setFlipped(false)

      // Se esqueceu E ainda não repetiu nesta sessão: coloca de volta na fila (3 posições à frente)
      let newQueue = [...queue]
      if (!isCorrect && !card._retried) {
        const insertAt = Math.min(idx + 4, newQueue.length)
        newQueue.splice(insertAt, 0, { ...card, _retried: true })
      }

      if (idx + 1 >= newQueue.length) {
        setDone(true)
      } else {
        setQueue(newQueue)
        setIdx(i => i + 1)
      }
    }, 1400)
  }

  const total = queue.filter(c => !c._retried).length

  return <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 6 }}>
        <span>Card {Math.min(idx + 1, total)} / {total}</span>
        <span>✅ {stats.correct} · ⚡ +{stats.xp} XP</span>
      </div>
      <div style={{ height: 5, background: C.bor, borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${(Math.min(idx, total) / total) * 100}%`, background: C.orange, borderRadius: 4, transition: 'width .3s' }} />
      </div>
      {card._retried && <div style={{ fontSize: 10, color: C.orange, marginTop: 4, textAlign: 'right' }}>🔄 Revisando novamente</div>}
    </div>

    {/* Card */}
    <div onClick={() => !feedback && setFlipped(!flipped)}
      style={{ background: C.green, borderRadius: 18, padding: 28, textAlign: 'center', cursor: feedback ? 'default' : 'pointer', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, position: 'relative', overflow: 'hidden' }}>

      {/* Feedback overlay */}
      {feedback && (
        <div style={{ position: 'absolute', inset: 0, background: feedback.color + 'ee', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, gap: 10, animation: 'fadeIn .2s' }}>
          <div style={{ fontSize: 48 }}>{feedback.correct ? '✅' : '😅'}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{feedback.label}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>+{feedback.xp} XP</div>
        </div>
      )}

      <div style={{ fontSize: 10, fontWeight: 700, color: C.sage, letterSpacing: 2 }}>{flipped ? 'RESPOSTA' : tlbl[card.type]}</div>
      {!flipped
        ? <div style={{ fontSize: 24, fontWeight: 800, color: '#f3e6d2', lineHeight: 1.3 }}>{card.front}</div>
        : <div style={{ fontSize: 13, color: 'rgba(243,230,210,.9)', lineHeight: 1.9, whiteSpace: 'pre-wrap', textAlign: 'left', width: '100%' }}>{card.back}</div>
      }
      {!flipped && !feedback && <div style={{ fontSize: 12, color: 'rgba(243,230,210,.5)' }}>👆 Toque para revelar</div>}
    </div>

    {/* Botões de resposta — só aparecem quando o card está virado e sem feedback */}
    {flipped && !feedback && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
        {[
          ['😵 Esqueci', C.err, 0, 'Volta hoje'],
          ['😅 Difícil', C.orange, 1, '+3 dias'],
          ['🙂 Bom', C.sage, 2, '+6 dias'],
          ['😄 Fácil', C.green, 3, 'Longo prazo'],
        ].map(([l, co, q, hint]) => (
          <button key={l} onClick={() => answer(q)}
            style={{ background: co + '18', border: `1.5px solid ${co}55`, color: co, borderRadius: 12, padding: '10px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1.4 }}>
            <div>{l.split(' ')[0]}</div>
            <div style={{ fontSize: 10, fontWeight: 600 }}>{l.split(' ').slice(1).join(' ')}</div>
            <div style={{ fontSize: 9, color: co + 'aa', marginTop: 2 }}>{hint}</div>
          </button>
        ))}
      </div>
    )}
  </div>
}

function SExercises({ user, content, toast }) {
  const [exs, setExs] = useState(null)
  const [loading, setLoading] = useState(false)
  const [idx, setIdx] = useState(0)
  const [sel, setSel] = useState(null)
  const [ans, setAns] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState({ ok: 0, total: 0 })
  const [done, setDone] = useState(false)

  const generate = async () => {
    if (!content.length) { toast({ type: 'error', title: 'Sem conteúdo ainda', msg: 'Aguarde sua professora processar uma aula.' }); return }
    setLoading(true)
    try {
      const generated = await generateExercises(content)
      if (!generated.length) throw new Error('Nenhum exercício gerado')
      setExs(generated); setIdx(0); setSel(null); setAns(''); setSubmitted(false); setScore({ ok: 0, total: 0 }); setDone(false)
      toast({ type: 'success', title: `✅ ${generated.length} exercícios gerados!` })
    } catch (e) { toast({ type: 'error', title: 'Erro', msg: e.message }) }
    setLoading(false)
  }

  if (!exs || exs.length === 0) return <div style={{ padding: 20, textAlign: 'center' }}>
    <div style={{ fontSize: 56, marginBottom: 12 }}>✏️</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginBottom: 6 }}>Exercícios Interativos</div>
    <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>A IA cria exercícios personalizados<br />com o vocabulário das suas aulas</div>
    <button onClick={generate} disabled={loading || !content.length} style={{ ...bp(), opacity: loading || !content.length ? .5 : 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {loading ? <Spin /> : '🧠'}{loading ? 'Gerando...' : 'Gerar Exercícios com IA'}
    </button>
    {!content.length && <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Aguarde sua professora processar uma aula.</p>}
  </div>

  if (done) {
    const pct = Math.round(score.ok / score.total * 100)
    return <div style={{ padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>{pct >= 80 ? '🏆' : pct >= 60 ? '🌟' : '📚'}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.green, marginBottom: 8 }}>Exercícios concluídos!</div>
      <div style={{ ...crd, display: 'inline-block', padding: '12px 24px', marginBottom: 20 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: C.orange }}>{score.ok}/{score.total}</span><span style={{ fontSize: 14, color: C.muted, marginLeft: 8 }}>{pct}% acertos</span>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => { setDone(false); setIdx(0); setSel(null); setAns(''); setSubmitted(false); setScore({ ok: 0, total: 0 }) }} style={{ background: 'transparent', color: C.green, border: `1.5px solid ${C.bor2}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 14 }}>Tentar Novamente</button>
        <button onClick={generate} disabled={loading} style={bp()}>Novos Exercícios</button>
      </div>
    </div>
  }

  const ex = exs[idx]; if (!ex) return null
  const typeColor = { multiple_choice: C.green, error_correction: C.err, fill_blank: C.orange, true_false: C.sage }
  const typeName = { multiple_choice: 'Múltipla Escolha', error_correction: 'Correção de Erros', fill_blank: 'Preencha o Espaço', true_false: 'Verdadeiro ou Falso' }
  const col = typeColor[ex.type] || C.green

  const check = () => {
    let ok = false
    if (ex.type === 'multiple_choice') ok = sel === ex.correct
    else if (ex.type === 'true_false') ok = sel === (ex.correct ? 'true' : 'false')
    else if (ex.type === 'fill_blank') ok = ans.toLowerCase().trim() === (ex.answer || '').toLowerCase().trim()
    else if (ex.type === 'error_correction') {
      const corr = (ex.correct || '').toLowerCase().replace(/[.,!?]/g, '').trim()
      ok = ans.toLowerCase().replace(/[.,!?]/g, '').trim().includes(corr) || corr.includes(ans.toLowerCase().replace(/[.,!?]/g, '').trim())
    }
    setSubmitted(true); setScore(p => ({ ok: ok ? p.ok + 1 : p.ok, total: p.total + 1 }))
    if (ok) toast({ type: 'success', title: '✅ Correto! +10 XP' })
    else toast({ type: 'error', title: '❌ Incorreto', msg: `Resposta: ${ex.answer || ex.correct}` })
  }

  const next = () => {
    if (idx + 1 >= exs.length) setDone(true)
    else { setIdx(i => i + 1); setSel(null); setAns(''); setSubmitted(false) }
  }

  const canSubmit = (ex.type === 'multiple_choice' || ex.type === 'true_false') ? sel !== null : ans.trim().length > 0

  return <div style={{ padding: 16 }}>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 6 }}><span>Exercício {idx + 1}/{exs.length}</span><span style={{ color: C.orange, fontWeight: 600 }}>✅ {score.ok} correto(s)</span></div>
      <div style={{ height: 5, background: C.bor, borderRadius: 4 }}><div style={{ height: '100%', width: `${(idx / exs.length) * 100}%`, background: C.orange, borderRadius: 4, transition: 'width .3s' }} /></div>
    </div>
    <div style={{ ...crd, marginTop: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, background: col + '20', color: col, padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>{typeName[ex.type]}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.tx, lineHeight: 1.6 }}>{ex.question || ex.sentence || ex.statement}</div>
      {ex.hint && <div style={{ fontSize: 12, color: C.sage, marginTop: 6, fontStyle: 'italic' }}>💡 Dica: {ex.hint}</div>}
    </div>
    {ex.type === 'multiple_choice' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
      {(ex.options || []).map((opt, i) => {
        let bg = 'transparent', bdr = C.bor, tc = C.tx
        if (submitted) { if (i === ex.correct) { bg = C.sage + '25'; bdr = C.sage; tc = C.green } else if (i === sel && i !== ex.correct) { bg = C.err + '15'; bdr = C.err; tc = C.err } }
        else if (sel === i) { bg = C.orange + '18'; bdr = C.orange; tc = C.orange }
        return <button key={i} onClick={() => !submitted && setSel(i)} style={{ padding: '13px 16px', borderRadius: 10, border: `1.5px solid ${bdr}`, background: bg, color: tc, textAlign: 'left', fontSize: 14, cursor: submitted ? 'default' : 'pointer', fontWeight: sel === i ? 600 : 400 }}>{opt}</button>
      })}
    </div>}
    {ex.type === 'true_false' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
      {['Verdadeiro', 'Falso'].map((label, i) => {
        const val = i === 0 ? 'true' : 'false'; const isCorr = (i === 0) === ex.correct
        let bg = 'transparent', bdr = C.bor, tc = C.tx
        if (submitted) { if (isCorr) { bg = C.sage + '25'; bdr = C.sage; tc = C.green } else if (sel === val && !isCorr) { bg = C.err + '15'; bdr = C.err; tc = C.err } }
        else if (sel === val) { bg = C.orange + '18'; bdr = C.orange; tc = C.orange }
        return <button key={i} onClick={() => !submitted && setSel(val)} style={{ padding: '14px', borderRadius: 10, border: `1.5px solid ${bdr}`, background: bg, color: tc, fontSize: 14, fontWeight: 700, cursor: submitted ? 'default' : 'pointer' }}>{label}</button>
      })}
    </div>}
    {(ex.type === 'fill_blank' || ex.type === 'error_correction') && <div style={{ marginBottom: 12 }}>
      <input value={ans} onChange={e => !submitted && setAns(e.target.value)} onKeyDown={e => e.key === 'Enter' && !submitted && canSubmit && check()} disabled={submitted} placeholder={ex.type === 'fill_blank' ? 'Digite a palavra ou expressão...' : 'Escreva a frase corrigida...'} style={inp} />
    </div>}
    {submitted && <div style={{ padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.bor}`, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4 }}>💡 Explicação:</div>
      <div style={{ fontSize: 13, color: C.tx, lineHeight: 1.5 }}>{ex.explanation}</div>
    </div>}
    <div>{!submitted ? <button onClick={check} disabled={!canSubmit} style={{ ...bp(), width: '100%', opacity: !canSubmit ? .5 : 1 }}>Confirmar</button> : <button onClick={next} style={{ ...bp(), width: '100%' }}>Próximo →</button>}</div>
  </div>
}

function SProgress({ profile, flashcards, reviews, content }) {
  const mastered = flashcards.filter(f => (reviews[f.id]?.repetitions || 0) >= 3).length
  const due = flashcards.filter(f => !(reviews[f.id]?.next_review > today())).length
  const types = [['vocabulary', 'Vocabulário', C.green], ['idiom', 'Idioms', C.orange], ['phrasal_verb', 'Phrasal Verbs', C.sage], ['grammar', 'Gramática', C.green], ['correction', 'Correções', C.err]]
  return <div style={{ padding: 16 }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
      <Stat icon="📚" val={content.length} label="Itens Aprendidos" col={C.green} />
      <Stat icon="🏆" val={mastered} label="Dominados" col={C.sage} />
      <Stat icon="🃏" val={due} label="Pendentes Hoje" col={C.orange} />
      <Stat icon="📖" val={flashcards.length} label="Total de Cards" col={C.green} />
    </div>
    <div style={{ ...crd, marginBottom: 12 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: '0 0 12px' }}>📊 Por Categoria</h3>
      {types.map(([type, label, col]) => { const cnt = content.filter(c => c.type === type).length; if (!cnt) return null; return (
        <div key={type} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, color: C.muted }}>{label}</span><span style={{ fontSize: 12, fontWeight: 700, color: col }}>{cnt}</span></div>
          <div style={{ height: 6, background: C.bor, borderRadius: 4 }}><div style={{ height: '100%', width: `${Math.min((cnt / Math.max(content.length, 1)) * 100, 100)}%`, background: col, borderRadius: 4 }} /></div>
        </div>
      )})}
    </div>

  </div>
}
