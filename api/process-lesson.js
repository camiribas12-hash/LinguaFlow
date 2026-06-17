export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { transcript, topic } = req.body

  if (!transcript || transcript.trim().length < 10) {
    return res.status(400).json({ error: 'Transcrição muito curta ou vazia.' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave da API não configurada no servidor.' })
  }

  // Use pipe-delimited format instead of JSON — avoids all JSON parsing issues
  const system = `You are an English teacher AI assistant. Analyze the lesson transcript.
Return ONLY the structured text below. No JSON. No markdown. No extra explanation.
Each item on its own line using pipe | as separator. Keep each field under 120 characters. No line breaks within fields.

[VOCABULARY]
word: X | translation: X | definition: X | example: X

[IDIOMS]
word: X | translation: X | definition: X | example: X

[PHRASAL_VERBS]
word: X | translation: X | definition: X | example: X

[GRAMMAR]
point: X | explanation: X | example: X

[CORRECTIONS]
error: X | correction: X | explanation: X

[SUMMARY]
One paragraph summary of the lesson here.

Rules:
- Only include sections that have real content from the lesson
- If a section is empty, write the header and leave it blank
- Never use quotes or special characters that could break formatting
- Keep it simple and direct`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system,
        messages: [
          {
            role: 'user',
            content: `Topic: ${(topic || 'English Lesson').substring(0, 200)}\n\nTranscript:\n${transcript.substring(0, 5000)}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: `Claude API error: ${err}` })
    }

    const data = await response.json()
    if (data.error) {
      return res.status(400).json({ error: data.error.message })
    }

    const rawText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    const parsed = parsePipeFormat(rawText)
    return res.status(200).json(parsed)

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno ao processar.' })
  }
}

function parsePipeFormat(text) {
  const result = {
    vocabulary: [],
    idioms: [],
    phrasal_verbs: [],
    grammar: [],
    corrections: [],
    summary: ''
  }

  // Extract each section
  const sections = {
    VOCABULARY: 'vocabulary',
    IDIOMS: 'idioms',
    PHRASAL_VERBS: 'phrasal_verbs',
    GRAMMAR: 'grammar',
    CORRECTIONS: 'corrections',
    SUMMARY: 'summary'
  }

  for (const [sectionKey, resultKey] of Object.entries(sections)) {
    const pattern = new RegExp(`\\[${sectionKey}\\]([\\s\\S]*?)(?=\\[|$)`, 'i')
    const match = text.match(pattern)
    if (!match) continue

    const block = match[1].trim()

    if (resultKey === 'summary') {
      result.summary = block.replace(/\n/g, ' ').trim()
      continue
    }

    const lines = block.split('\n').map(l => l.trim()).filter(l => l.includes(':') && l.includes('|'))

    for (const line of lines) {
      const fields = parsePipeLine(line)
      if (!fields) continue

      if (resultKey === 'vocabulary' || resultKey === 'idioms' || resultKey === 'phrasal_verbs') {
        const word = fields.word || fields.point || ''
        if (word) {
          result[resultKey].push({
            word,
            definition: fields.definition || '',
            translation: fields.translation || '',
            example: fields.example || ''
          })
        }
      } else if (resultKey === 'grammar') {
        const word = fields.point || fields.word || fields.grammar || ''
        if (word) {
          result.grammar.push({
            word,
            definition: fields.explanation || fields.definition || '',
            translation: '',
            example: fields.example || ''
          })
        }
      } else if (resultKey === 'corrections') {
        const errorText = fields.error || fields.error_text || ''
        if (errorText) {
          result.corrections.push({
            word: fields.correction || errorText,
            error_text: errorText,
            correction: fields.correction || '',
            explanation: fields.explanation || ''
          })
        }
      }
    }
  }

  return result
}

function parsePipeLine(line) {
  const parts = line.split('|')
  const obj = {}
  for (const part of parts) {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) continue
    const key = part.substring(0, colonIdx).trim().toLowerCase().replace(/[\s-]+/g, '_')
    const value = part.substring(colonIdx + 1).trim()
    if (key && value) obj[key] = value
  }
  return Object.keys(obj).length > 0 ? obj : null
}
