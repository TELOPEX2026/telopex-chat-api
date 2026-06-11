require('dotenv').config()
const express = require('express')
const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Telopex Chat API actif 🚀' })
})

const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`

app.post('/chat', async (req, res) => {
  const { messages } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ reply: 'Messages invalides.' })
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
      })
    })

    const data = await response.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Désolé, je n\'ai pas pu répondre.'

    res.json({ reply })

  } catch (err) {
    console.error('Erreur chat:', err)
    res.json({ reply: 'Une erreur est survenue. Contactez contact@telopex.online' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Telopex Chat API actif sur le port ${PORT} 🚀`)
})
