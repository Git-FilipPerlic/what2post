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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId);
  }
}

async function upscaleImage(imageBase64, apiKey) {
  if (!apiKey) {
    console.log('Replicate API key not set, skipping upscaling');
    return imageBase64;
  }

  const imageDataUrl = `data:image/png;base64,${imageBase64.toString('base64')}`;

  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'a45f82a1d6fab3e8622e8b207f47d81fc3ffe3fd3d3e37c5b5fcf3bed7b9ea92',
      input: { image: imageDataUrl },
    }),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text();
    console.error(`Replicate API error ${createResponse.status}: ${text}`);
    return imageBase64;
  }

  const prediction = await createResponse.json();
  let predictionId = prediction.id;

  for (let i = 0; i < 60; i++) {
    const checkResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!checkResponse.ok) break;

    const checkPrediction = await checkResponse.json();
    if (checkPrediction.status === 'succeeded') {
      const upscaledUrl = checkPrediction.output?.[0];
      if (upscaledUrl) {
        const upscaledResponse = await fetch(upscaledUrl);
        return await upscaledResponse.buffer();
      }
      break;
    } else if (checkPrediction.status === 'failed') {
      console.error('Replicate upscaling failed');
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return imageBase64;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main endpoint — generates daily image
app.get('/generate', async (req, res) => {
  try {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10);
    const entry = pickPromptForToday(now);

    console.log(`Generating image for ${dateKey} using prompt #${entry.id}`);

    let imageBuffer = await generateImage(entry.prompt, process.env.GEMINI_API_KEY);

    if (process.env.REPLICATE_API_KEY2) {
      console.log(`Upscaling image with Real-ESRGAN...`);
      imageBuffer = await upscaleImage(imageBuffer, process.env.REPLICATE_API_KEY2);
    }

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
