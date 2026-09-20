const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const prompts = require('./prompts.json');

const app = express();
const port = process.env.PORT || 3000;

const POLLINATIONS_MODEL = 'flux';
const FCM_TOPIC = 'daily-image';

// Images are saved to Railway's own disk and served by this app, so no
// Firebase Storage bucket (which requires the Blaze/billing plan) is needed.
const IMAGES_DIR = process.env.IMAGES_DIR || path.join(__dirname, 'daily-images');
fs.mkdirSync(IMAGES_DIR, { recursive: true });
app.use('/images', express.static(IMAGES_DIR, { maxAge: '365d', immutable: true }));

function publicBaseUrl() {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${port}`;
}

// Initialize Firebase with service account (used for Firestore + FCM only)
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

function pickPromptForToday(date) {
  const epochDay = Math.floor(date.getTime() / 86400000);
  const index = ((epochDay % prompts.length) + prompts.length) % prompts.length;
  return prompts[index];
}

async function generateImage(prompt, apiKey) {
  const response = await fetch('https://gen.pollinations.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: POLLINATIONS_MODEL,
      prompt,
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pollinations generate error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error('Pollinations response did not include an image URL');
  }

  const imageResponse = await fetch(imageUrl);
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
      version: 'b3ef194191d13140337468c916c2c5b96dd0cb06dffc032a022a31807f6a5ea8',
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

    const pollinationsApiKey = process.env.POLLINATIONS_API_KEY;
    if (!pollinationsApiKey) {
      throw new Error('POLLINATIONS_API_KEY is not set');
    }

    let imageBuffer = await generateImage(entry.prompt, pollinationsApiKey);

    if (process.env.REPLICATE_API_KEY2) {
      console.log(`Upscaling image with Real-ESRGAN...`);
      imageBuffer = await upscaleImage(imageBuffer, process.env.REPLICATE_API_KEY2);
    }

    const fileName = `${dateKey}.png`;
    fs.writeFileSync(path.join(IMAGES_DIR, fileName), imageBuffer);
    const imageUrl = `${publicBaseUrl()}/images/${fileName}`;

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

    console.log(`Done: ${fileName}`);
    res.json({ success: true, date: dateKey, imageUrl });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Railway app listening on port ${port}`);
});
