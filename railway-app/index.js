const express = require('express');
const admin = require('firebase-admin');
const prompts = require('./prompts.json');

const app = express();
const port = process.env.PORT || 3000;

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const FCM_TOPIC = 'daily-image';

// Initialize Firebase with service account
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: serviceAccount.project_id + '.appspot.com',
});

function pickPromptForToday(date) {
  const epochDay = Math.floor(date.getTime() / 86400000);
  const index = ((epochDay % prompts.length) + prompts.length) % prompts.length;
  return prompts[index];
}

async function generateImage(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p?.inlineData?.data);
  if (!imagePart) {
    throw new Error('Gemini response did not include an image part');
  }
  return Buffer.from(imagePart.inlineData.data, 'base64');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main endpoint — generates daily image
app.post('/generate', async (req, res) => {
  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const entry = pickPromptForToday(now);

    console.log(`Generating image for ${dateKey} using prompt #${entry.id}`);

    const imageBuffer = await generateImage(entry.prompt, process.env.GEMINI_API_KEY);

    const bucket = admin.storage().bucket();
    const filePath = `daily-images/${dateKey}.png`;
    const file = bucket.file(filePath);
    await file.save(imageBuffer, { contentType: 'image/png' });
    await file.makePublic();
    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    const doc = {
      date: dateKey,
      prompt: entry.prompt,
      description: entry.description,
      imageUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const firestore = admin.firestore();
    await firestore.collection('dailyImages').doc(dateKey).set(doc);
    await firestore.collection('dailyImages').doc('latest').set(doc);

    await admin.messaging().send({
      topic: FCM_TOPIC,
      notification: {
        title: 'Dagens slika je spremna',
        body: entry.description,
      },
      data: { imageUrl, date: dateKey },
    });

    console.log(`Done: ${filePath}`);
    res.json({ success: true, date: dateKey, imageUrl });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Railway app listening on port ${port}`);
});
