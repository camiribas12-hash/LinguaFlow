export default async function handler(req, res) {
  // Allow only POST
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

  const system = `You are an English teacher AI assistant. Analyze the lesson transcript provided.
Return ONLY valid JSON with no markdown, no backticks, no explanation:
{
  "vocabulary": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "idioms": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "phrasal_verbs": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "grammar": [{"word": "", "definition": "", "translation": "", "example": ""}],
  "corrections": [{"error_text": "", "correction": "", "word": "", "explanation": ""}],
  "summary": ""
}
Include only items actually mentioned in the lesson. Use empty arrays if a category had no items.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system,
        messages: [
          {
            role: 'user',
            content: `Topic: ${topic || 'English Lesson'}\n\nTranscript:\n${transcript}`,
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

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')

    const cleaned = text.replace(/```[\w]*\n?|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)

    if (!match) {
      return res.status(500).json({ error: 'Resposta da IA em formato inesperado.' })
    }

    const parsed = JSON.parse(match[0])
    return res.status(200).json(parsed)
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno ao processar.' })
  }
}
