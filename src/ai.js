export async function callClaude(prompt, system = '', history = [], mcp = []) {
  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [...history, { role: 'user', content: prompt }],
  }
  if (system) body.system = system
  if (mcp.length) body.mcp_servers = mcp

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const d = await res.json()
  const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
  const tool = (d.content || []).filter(b => b.type === 'mcp_tool_result').map(b => b.content?.[0]?.text || '').join('\n')
  return { txt, tool }
}

export async function processLesson(transcript, topic) {
  // Chama via servidor Vercel para evitar bloqueio CORS
  const res = await fetch('/api/process-lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, topic })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Erro ${res.status}`)
  }
  return await res.json()
}

export async function fetchNotionLessons() {
  const sys = `Query the "All Lessons" database in Notion. Return ONLY a JSON array (no markdown):
[{"lesson_name":"","date":"YYYY-MM-DD","topic":"","grammar":"","vocabulary":"","homework":"","student_name":"","transcription":""}]
Use empty string for missing fields.`
  const { txt, tool } = await callClaude(
    'Query All Lessons database in Notion and return all records as a JSON array.',
    sys, [],
    [{ type: 'url', url: 'https://mcp.notion.com/mcp', name: 'notion' }]
  )
  const m = (txt + '\n' + tool).match(/\[[\s\S]*\]/)
  if (!m) throw new Error('No data from Notion')
  return JSON.parse(m[0])
}

export async function generateExercises(content) {
  if (!content.length) return []
  const vocab = content.filter(c => c.type === 'vocabulary').slice(-12)
  const pvs = content.filter(c => c.type === 'phrasal_verb').slice(-6)
  const cors = content.filter(c => c.type === 'correction').slice(-6)
  const idioms = content.filter(c => c.type === 'idiom').slice(-4)

  const contentStr = [
    ...vocab.map(c => `vocabulary: "${c.word}" = ${c.translation} | ${c.definition}`),
    ...pvs.map(c => `phrasal_verb: "${c.word}" = ${c.translation}`),
    ...cors.map(c => `correction: WRONG="${c.error_text}" → CORRECT="${c.correction}" | ${c.explanation}`),
    ...idioms.map(c => `idiom: "${c.word}" = ${c.translation}`),
  ].join('\n')

  const sys = `English teacher. Create 10 exercises. Return ONLY a JSON array (no markdown):
[
  {"type":"multiple_choice","question":"What does X mean?","options":["a","b","c","d"],"correct":0,"explanation":"..."},
  {"type":"error_correction","sentence":"She bring up a point.","correct":"She brings up a point.","explanation":"3rd person -s"},
  {"type":"fill_blank","sentence":"They ___ the project.","answer":"carried on","hint":"to continue","explanation":"carry on = continuar"},
  {"type":"true_false","statement":"Commitment means to give up.","correct":false,"explanation":"Commitment = compromisso"}
]
Mix all 4 types. Use ONLY the provided content.`

  const { txt } = await callClaude(`Student content:\n${contentStr}`, sys)
  const m = txt.replace(/```[\w]*\n?|```/g, '').match(/\[[\s\S]*\]/)
  if (!m) return []
  try { return JSON.parse(m[0]) } catch { return [] }
}

export function sm2(state, quality) {
  let { interval_days: i = 1, ease_factor: ef = 2.5, repetitions: r = 0 } = state || {}
  if (quality < 3) { i = 1; r = 0 }
  else {
    if (r === 0) i = 1
    else if (r === 1) i = 6
    else i = Math.round(i * ef)
    r++
    ef = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  }
  const next = new Date()
  next.setDate(next.getDate() + i)
  return {
    interval_days: i,
    ease_factor: ef,
    repetitions: r,
    next_review: next.toISOString().split('T')[0],
    last_review: new Date().toISOString().split('T')[0],
  }
}

export const today = () => new Date().toISOString().split('T')[0]
export const fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
export const uid = () => Math.random().toString(36).slice(2, 9)
