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

  const system = `You are an English teacher AI assistant. Analyze the lesson transcript.
Return ONLY a valid JSON object. Follow these rules STRICTLY:
- No markdown, no backticks, no explanation outside the JSON
- All string values must be on a SINGLE LINE (no line breaks inside strings)
- Use only double quotes for strings
- Keep all text fields under 150 characters
- If a field has no content, use empty string ""

JSON format:
{
  "vocabulary": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "idioms": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "phrasal_verbs": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "grammar": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "corrections": [{"error_text": "", "correction": "", "word": "", "explanation": ""}],
  "summary": ""
}
Include only items actually mentioned in the lesson. Use empty arrays [] for unused categories.`

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
            content: `Topic: ${topic || 'English Lesson'}\n\nTranscript:\n${transcript.substring(0, 6000)}`,
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

    const parsed = robustJSONParse(rawText)

    if (!parsed) {
      return res.status(500).json({ error: 'Resposta da IA em formato inesperado. Tente novamente.' })
    }

    return res.status(200).json(parsed)
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno ao processar.' })
  }
}

/**
 * Robust JSON parser that handles common AI output issues:
 * - Markdown code blocks
 * - Trailing commas
 * - Unescaped newlines inside strings
 * - Extra content before/after JSON
 */
function robustJSONParse(text) {
  // Step 1: Remove markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim()

  // Step 2: Try direct parse first
  try { return JSON.parse(cleaned) } catch (e) {}

  // Step 3: Find the JSON block using brace counting (more reliable than regex)
  const jsonBlock = extractJSONBlock(cleaned)
  if (!jsonBlock) return null

  // Step 4: Try parsing the extracted block
  try { return JSON.parse(jsonBlock) } catch (e) {}

  // Step 5: Apply fixes and try again
  const fixed = applyJSONFixes(jsonBlock)
  try { return JSON.parse(fixed) } catch (e) {}

  // Step 6: More aggressive cleanup
  const aggressive = aggressiveClean(fixed)
  try { return JSON.parse(aggressive) } catch (e) {
    console.error('All JSON parse attempts failed:', e.message)
    return null
  }
}

function extractJSONBlock(text) {
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        return text.substring(start, i + 1)
      }
    }
  }
  return null
}

function applyJSONFixes(jsonStr) {
  return jsonStr
    // Remove trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1')
    // Fix unescaped newlines inside strings (replace with space)
    .replace(/"([^"\\]*)(?:\\.[^"\\]*)*"/g, match =>
      match.replace(/\n/g, ' ').replace(/\r/g, '')
    )
    // Remove control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

function aggressiveClean(jsonStr) {
  // Replace ALL literal newlines within string values with spaces
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i]
    if (escaped) { result += ch; escaped = false; continue }
    if (ch === '\\') { result += ch; escaped = true; continue }
    if (ch === '"') { inString = !inString; result += ch; continue }
    if (inString && (ch === '\n' || ch === '\r')) {
      result += ' '
    } else {
      result += ch
    }
  }
  return result
}
