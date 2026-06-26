export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { content } = req.body
  if (!content?.length) return res.status(400).json({ error: 'Sem conteúdo para gerar exercícios' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key não configurada' })

  const vocab   = content.filter(c => c.type === 'vocabulary').slice(-10)
  const pvs     = content.filter(c => c.type === 'phrasal_verb').slice(-5)
  const cors    = content.filter(c => c.type === 'correction').slice(-5)
  const idioms  = content.filter(c => c.type === 'idiom').slice(-4)
  const grammar = content.filter(c => c.type === 'grammar').slice(-4)

  const contentStr = [
    ...vocab.map(c   => `vocabulary: "${c.word}" = ${c.translation} | ${c.definition}`),
    ...pvs.map(c     => `phrasal_verb: "${c.word}" = ${c.translation}`),
    ...cors.map(c    => `correction: WRONG="${c.error_text}" CORRECT="${c.correction}" | ${c.explanation}`),
    ...idioms.map(c  => `idiom: "${c.word}" = ${c.translation}`),
    ...grammar.map(c => `grammar: "${c.word}" | ${c.definition}`),
  ].join('\n')

  const system = `You are an English teacher creating exercises for Brazilian adult students.
Create exactly 10 exercises using ONLY the provided vocabulary and grammar content.
Distribution: 3 MULTIPLE_CHOICE, 2 ERROR_CORRECTION, 2 FILL_BLANK, 1 TRUE_FALSE, 2 LISTENING.

Return ONLY structured text below. No JSON. No markdown. No extra text.
Each exercise block separated by blank line. Use pipe | as field separator.
Keep ALL field values on a SINGLE LINE with no line breaks.

[MULTIPLE_CHOICE]
question: What does X mean? | options: a|b|c|d | correct: 0 | explanation: X means...

[ERROR_CORRECTION]
sentence: Wrong sentence | correct: Fixed sentence | explanation: Grammar rule

[FILL_BLANK]
sentence: She decided to ___ the meeting | answer: attend | hint: to be present | explanation: attend = participar

[TRUE_FALSE]
statement: X means Y | correct: false | explanation: reason

[LISTENING]
audio: singleword | question: What word did you hear? | options: word1|word2|word3|word4 | correct: 0 | explanation: meaning

Important rules:
- Use ONLY words and grammar from the provided content
- For LISTENING: audio must be one word from content, options are 4 similar English words
- correct field: number 0-3 for multiple_choice and listening, true or false for true_false
- Never put quotes or pipes inside field values`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, system, messages: [{ role: 'user', content: `Student content:\n${contentStr}` }] }),
    })
    if (!response.ok) return res.status(response.status).json({ error: await response.text() })
    const data = await response.json()
    if (data.error) return res.status(400).json({ error: data.error.message })

    const rawText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const exercises = parseExercises(rawText)
    if (!exercises.length) return res.status(500).json({ error: 'Nenhum exercício gerado. Tente novamente.' })
    return res.status(200).json(exercises)
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno' })
  }
}

function parseFields(line) {
  const fields = {}
  const parts = line.split('|')
  for (const part of parts) {
    const ci = part.indexOf(':')
    if (ci === -1) continue
    const key = part.substring(0, ci).trim().toLowerCase().replace(/\s+/g, '_')
    const val = part.substring(ci + 1).trim()
    if (key && val) fields[key] = val
  }
  return fields
}

function parseExercises(text) {
  const exercises = []
  const types = ['MULTIPLE_CHOICE','ERROR_CORRECTION','FILL_BLANK','TRUE_FALSE','LISTENING']
  for (const sectionKey of types) {
    const pattern = new RegExp(`\\[${sectionKey}\\]([\\s\\S]*?)(?=\\[|$)`, 'gi')
    let match
    while ((match = pattern.exec(text)) !== null) {
      const lines = match[1].split('\n').map(l => l.trim()).filter(l => l.length > 5 && (l.includes('|') || l.includes(':')))
      for (const line of lines) {
        const f = parseFields(line)
        const type = sectionKey.toLowerCase()
        if ((type === 'multiple_choice' || type === 'listening') && (f.question || f.audio)) {
          const opts = (f.options || '').split('|').map(s => s.trim()).filter(Boolean)
          if (!opts.length) continue
          exercises.push({ type, question: f.question || 'What word did you hear?', audio_text: f.audio || '', options: opts, correct: parseInt(f.correct) || 0, explanation: f.explanation || '' })
        } else if (type === 'error_correction' && f.sentence) {
          exercises.push({ type, sentence: f.sentence, correct: f.correct || '', answer: f.correct || '', explanation: f.explanation || '' })
        } else if (type === 'fill_blank' && f.sentence) {
          exercises.push({ type, sentence: f.sentence, answer: f.answer || '', hint: f.hint || '', explanation: f.explanation || '' })
        } else if (type === 'true_false' && f.statement) {
          exercises.push({ type, statement: f.statement, correct: f.correct === 'true', explanation: f.explanation || '' })
        }
      }
    }
  }
  return exercises.slice(0, 12)
}
