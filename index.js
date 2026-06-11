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

// — Status —
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Telopex API actif 🚀' })
})

const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`
const N8N_URL    = process.env.N8N_WEBHOOK_URL || 'https://primary-production-47e9.up.railway.app/webhook/ac479c0e-361a-40b7-ab04-e71769c07ffc'
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'telopex2026'

// Page Access Token Messenger
const MESSENGER_TOKEN = process.env.MESSENGER_PAGE_TOKEN

// — Chatbot site web —
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
    if (!reply) return res.json({ reply: 'Désolé, je n\'ai pas pu répondre.' })
    res.json({ reply })
  } catch (err) {
    console.error('Erreur chat:', err)
    res.json({ reply: 'Une erreur est survenue. Contactez contact@telopex.online' })
  }
})

// — WhatsApp Webhook GET (vérification Meta) —
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook WhatsApp vérifié ✅')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// — WhatsApp Webhook POST (messages entrants) —
app.post('/webhook', async (req, res) => {
  console.log('Message WhatsApp reçu:', JSON.stringify(req.body))
  try {
    await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    console.log('Forwarded vers n8n ✅')
  } catch (err) {
    console.error('Erreur forward n8n:', err)
  }
  res.sendStatus(200)
})

// — Messenger Webhook GET (vérification Meta) —
app.get('/messenger', (req, res) => {
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Messenger vérifié ✅')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

// — Messenger Webhook POST (messages entrants) —
app.post('/messenger', async (req, res) => {
  console.log('Message Messenger reçu:', JSON.stringify(req.body))
  try {
    const entry     = req.body.entry?.[0]
    const messaging = entry?.messaging?.[0]
    const senderId  = messaging?.sender?.id
    const text      = messaging?.message?.text

    if (senderId && text) {
      console.log(`📩 Messenger [${senderId}]: ${text}`)

      // Réponse via Gemini
      const geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
        })
      })
      const geminiData = await geminiRes.json()
      const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
        || 'Désolé, je n\'ai pas pu répondre.'

      // Envoyer la réponse sur Messenger
      await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${MESSENGER_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: reply }
        })
      })

      console.log(`✅ Réponse Messenger envoyée: ${reply}`)

      // Forward vers n8n aussi
      await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'messenger', senderId, text, reply })
      })
    }
  } catch (err) {
    console.error('Erreur Messenger:', err)
  }
  res.sendStatus(200)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Telopex API actif sur le port ${PORT} 🚀`)
})
