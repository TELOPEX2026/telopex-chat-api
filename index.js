require('dotenv').config()
const express = require('express')
const app = express()
app.use(express.json())
const { SYSTEM_PROMPT } = require('./prompt')

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + GEMINI_KEY
const N8N_URL = process.env.N8N_WEBHOOK_URL || 'https://primary-production-47e9.up.railway.app/webhook/ac479c0e-361a-40b7-ab04-e71769c07ffc'
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'telopex2026'
const MESSENGER_TOKEN = process.env.MESSENGER_PAGE_TOKEN
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN

async function askGemini(userText) {
  const contents = [
    { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: 'Compris ! Je suis pret a representer Telopex.' }] },
    { role: 'user', parts: [{ text: userText }] }
  ]
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
    })
  })
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desole, je nai pas pu repondre.'
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Telopex API actif' })
})

app.post('/chat', async (req, res) => {
  const { messages } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ reply: 'Messages invalides.' })
  }
  try {
    const lastMessage = messages[messages.length - 1]
    const userText = lastMessage.parts?.[0]?.text || lastMessage.content || ''
    const reply = await askGemini(userText)
    res.json({ reply })
  } catch (err) {
    console.error('Erreur chat:', err)
    res.json({ reply: 'Une erreur est survenue.' })
  }
})

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook WhatsApp verifie')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

app.post('/webhook', async (req, res) => {
  console.log('Message WhatsApp recu:', JSON.stringify(req.body))
  try {
    await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    console.log('Forwarded vers n8n')
  } catch (err) {
    console.error('Erreur forward n8n:', err)
  }
  res.sendStatus(200)
})

app.get('/messenger', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Messenger verifie')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

app.post('/messenger', async (req, res) => {
  console.log('Message Messenger recu:', JSON.stringify(req.body))
  try {
    const entry = req.body.entry?.[0]
    const messaging = entry?.messaging?.[0]
    const senderId = messaging?.sender?.id
    const text = messaging?.message?.text
    if (senderId && text) {
      console.log('Messenger [' + senderId + ']: ' + text)
      const reply = await askGemini(text)
      await fetch('https://graph.facebook.com/v19.0/me/messages?access_token=' + MESSENGER_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: reply }
        })
      })
      console.log('Reponse Messenger envoyee: ' + reply)
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

app.get('/instagram', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook Instagram verifie')
    res.status(200).send(challenge)
  } else {
    res.sendStatus(403)
  }
})

app.post('/instagram', async (req, res) => {
  console.log('Message Instagram recu:', JSON.stringify(req.body))
  try {
    const entry = req.body.entry?.[0]
    const messaging = entry?.messaging?.[0]
    const senderId = messaging?.sender?.id
    const text = messaging?.message?.text
    if (senderId && text) {
      console.log('Instagram [' + senderId + ']: ' + text)
      const reply = await askGemini(text)
      await fetch('https://graph.facebook.com/v19.0/me/messages?access_token=' + INSTAGRAM_TOKEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: reply }
        })
      })
      console.log('Reponse Instagram envoyee: ' + reply)
      await fetch(N8N_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'instagram', senderId, text, reply })
      })
    }
  } catch (err) {
    console.error('Erreur Instagram:', err)
  }
  res.sendStatus(200)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, function() {
  console.log('Telopex API actif sur le port ' + PORT)
})
