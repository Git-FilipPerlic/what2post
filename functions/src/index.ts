import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import promptsJson from './prompts.json';

admin.initializeApp();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Check https://ai.google.dev/gemini-api/docs/image-generation for the
// current image-capable model name if this one is retired.
const GEMINI_MODEL = 'gemini-2.5-flash-image';
const FCM_TOPIC = 'daily-image';

interface PromptEntry {
  id: number;
  prompt: string;
  description: string;
}

const prompts = promptsJson as PromptEntry[];

function pickPromptForToday(date: Date): PromptEntry {
  const epochDay = Math.floor(date.getTime() / 86400000);
  const index = ((epochDay % prompts.length) + prompts.length) % prompts.length;
  return prompts[index];
}

async function generateImage(prompt: string, apiKey: string): Promise<Buffer> {
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

  const data = (await response.json()) as any;
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p?.inlineData?.data);
  if (!imagePart) {
    throw new Error('Gemini response did not include an image part');
  }
  return Buffer.from(imagePart.inlineData.data, 'base64');
}

export const generateDailyImage = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'Europe/Belgrade',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async () => {
    const now = new Date();
    const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const entry = pickPromptForToday(now);

    logger.info(`Generating image for ${dateKey} using prompt #${entry.id}`);

    const imageBuffer = await generateImage(entry.prompt, GEMINI_API_KEY.value());

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
        title: 'Današnja slika je spremna',
        body: entry.description,
      },
      data: { imageUrl, date: dateKey },
    });

    logger.info(`Done: ${filePath}`);
  },
);
