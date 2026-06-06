import { useState } from 'react'
import { supabase } from '../supabase'

const C = { bg: '#f3e6d2', bg3: '#fff', green: '#2f4f3a', orange: '#e07a3a', sage: '#9baf8b', tx: '#333', muted: '#7a7a7a', bor: 'rgba(47,79,58,0.15)', err: '#c0392b' }
const inp = { width: '100%', background: C.bg3, border: `1.5px solid ${C.bor}`, borderRadius: 10, padding: '11px 14px', color: C.tx, fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const btn = (bg = C.orange) => ({ width: '100%', background: bg, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' })
const card = { background: C.bg3, borderRadius: 16, border: `1px solid ${C.bor}`, padding: 28, boxShadow: '0 4px 20px rgba(47,79,58,0.08)' }
const Lbl = ({ children }) => <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: .5, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>{children}</label>

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', zoomMeetingId: '' })

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleLogin = async () => {
    if (!form.email.trim() || !form.password) { setError('Preencha e-mail e senha.'); return }
    setLoading(true); setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password
      })
      if (error) {
        const msg = error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message === 'Email not confirmed'
          ? 'E-mail não confirmado. Desative "Confirm email" no Supabase → Authentication → Providers → Email.'
          : 'Erro: ' + error.message
        setError(msg)
      } else if (!data?.session) {
        setError('Sessão não criada. Verifique as configurações do Supabase.')
      }
    } catch (e) {
      setError('Erro de conexão com Supabase: ' + e.message)
    }
    setLoading(false)
  }

  const handleSignup = async () => {
    if (!form.name.trim()) { setError('Informe seu nome.'); return }
    if (!form.email.trim()) { setError('Informe seu e-mail.'); return }
    if (form.password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres.'); return }
    if (form.role === 'student' && !form.zoomMeetingId.trim()) {
      setError('Informe o ID da sua reunião Zoom (número de 9-11 dígitos).'); return
    }
    setLoading(true); setError('')

    // Normaliza o ID: remove espaços e hifens
    const cleanZoomId = form.zoomMeetingId.replace(/[\s\-\.]/g, '')

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          role: form.role,
          zoom_meeting_id: form.role === 'student' ? cleanZoomId : ''
        }
      }
    })
    if (error) setError(error.message)
    else setError('✅ Conta criada! Faça login agora.')
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 70, height: 70, borderRadius: 20, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 14px' }}>🧠</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: C.green, letterSpacing: -1 }}>LinguaFlow</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 5 }}>
            {mode === 'login' ? 'Bem-vinda de volta!' : 'Crie sua conta'}
          </div>
        </div>

        <div style={card}>
          {mode === 'login' ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <Lbl>E-MAIL</Lbl>
                <input value={form.email} onChange={set('email')} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inp} type="email" placeholder="seu@email.com" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <Lbl>SENHA</Lbl>
                <input value={form.password} onChange={set('password')} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={inp} type="password" placeholder="••••••••" />
              </div>
              {error && <div style={{ color: error.startsWith('✅') ? C.green : C.err, fontSize: 13, marginBottom: 12, padding: '8px 12px', background: (error.startsWith('✅') ? C.green : C.err) + '12', borderRadius: 8 }}>{error}</div>}
              <button onClick={handleLogin} disabled={loading} style={{ ...btn(), opacity: loading ? .7 : 1 }}>
                {loading ? 'Entrando...' : 'Entrar →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 16 }}>
                Não tem conta?{' '}
                <button onClick={() => { setMode('signup'); setError('') }} style={{ background: 'none', border: 'none', color: C.orange, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  Cadastre-se
                </button>
              </p>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <Lbl>NOME COMPLETO</Lbl>
                <input value={form.name} onChange={set('name')} style={inp} placeholder="Seu nome" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Lbl>E-MAIL</Lbl>
                <input value={form.email} onChange={set('email')} style={inp} type="email" placeholder="seu@email.com" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Lbl>SENHA</Lbl>
                <input value={form.password} onChange={set('password')} style={inp} type="password" placeholder="Mínimo 6 caracteres" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Lbl>VOCÊ É</Lbl>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[['teacher', '👩‍🏫 Professora'], ['student', '📚 Aluno(a)']].map(([val, label]) => (
                    <button key={val} onClick={() => setForm(p => ({ ...p, role: val }))} style={{ padding: '11px', borderRadius: 10, border: `1.5px solid ${form.role === val ? C.orange : C.bor}`, background: form.role === val ? C.orange + '18' : 'transparent', color: form.role === val ? C.orange : C.tx, fontWeight: form.role === val ? 700 : 400, cursor: 'pointer', fontSize: 14 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.role === 'student' && (
                <div style={{ marginBottom: 14 }}>
                  <Lbl>ID DA SUA REUNIÃO ZOOM</Lbl>
                  <input
                    value={form.zoomMeetingId}
                    onChange={set('zoomMeetingId')}
                    style={inp}
                    placeholder="Ex: 876 1260 0565"
                    inputMode="numeric"
                  />
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                    📌 É o número fixo das suas aulas com a professora.<br />
                    Encontre no link da reunião: zoom.us/j/<strong>876 1260 0565</strong>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }} />
              {error && <div style={{ color: error.startsWith('✅') ? C.green : C.err, fontSize: 13, marginBottom: 12, padding: '8px 12px', background: (error.startsWith('✅') ? C.green : C.err) + '12', borderRadius: 8 }}>{error}</div>}
              <button onClick={handleSignup} disabled={loading} style={{ ...btn(), opacity: loading ? .7 : 1 }}>
                {loading ? 'Criando conta...' : 'Criar conta'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 16 }}>
                Já tem conta?{' '}
                <button onClick={() => { setMode('login'); setError('') }} style={{ background: 'none', border: 'none', color: C.orange, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  Entrar
                </button>
              </p>
            </>
          )}
        </div>

        {mode === 'signup' && form.role === 'student' && (
          <div style={{ marginTop: 14, padding: '12px 16px', background: C.sage + '22', borderRadius: 12, border: `1px solid ${C.sage}44` }}>
            <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginBottom: 4 }}>Como encontrar o ID da reunião?</div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              Abra o convite da sua aula no Zoom. O link será algo como:<br />
              <span style={{ fontFamily: 'monospace', color: C.tx }}>zoom.us/j/<strong style={{ color: C.orange }}>876 1260 0565</strong></span><br />
              O número em destaque é o seu ID.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
