const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.generate = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).send('');
    }

    const prompt = req.query.prompt || req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }

    // Generate description using Gemini
    const descriptionResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create a short, engaging social media caption for KOKA DECORE (home decor brand) based on this creative direction: "${prompt}". Keep it under 280 characters, professional and marketing-focused. Respond with only the caption.`
            }]
          }]
        })
      }
    );

    if (!descriptionResponse.ok) {
      throw new Error(`Gemini API error: ${descriptionResponse.status}`);
    }

    const descriptionData = await descriptionResponse.json();
    const description = descriptionData.candidates?.[0]?.content?.parts?.[0]?.text || 'KOKA DECORE - Premium Home Design';

    // Generate image using Replicate
    const imageResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'ac732df83cea7fff18b51f2e87ee1171c5d373f6a0ee3a82d89d5265306fa7b7',
        input: { prompt: prompt }
      })
    });

    if (!imageResponse.ok) {
      throw new Error(`Replicate API error: ${imageResponse.status}`);
    }

    const prediction = await imageResponse.json();
    const imageUrl = prediction.output?.[0] || null;

    // Save to Firestore
    await db.collection('dailyImages').doc('latest').set({
      prompt: prompt,
      description: description,
      imageUrl: imageUrl || '',
      date: new Date().toISOString().split('T')[0],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: imageUrl ? 'completed' : 'pending'
    });

    res.json({
      success: true,
      imageUrl: imageUrl || '',
      description: description,
      date: new Date().toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

exports.modifyImage = functions.https.onRequest(async (req, res) => {
  try {
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'GET, POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).send('');
    }

    const { imageUrl, modification } = req.method === 'GET' ? req.query : req.body;

    if (!imageUrl || !modification) {
      return res.status(400).json({ error: 'Missing imageUrl or modification parameter' });
    }

    // Use Replicate to modify the image
    const modificationResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'ac732df83cea7fff18b51f2e87ee1171c5d373f6a0ee3a82d89d5265306fa7b7',
        input: {
          prompt: modification,
          image: imageUrl
        }
      })
    });

    if (!modificationResponse.ok) {
      throw new Error(`Replicate API error: ${modificationResponse.status}`);
    }

    const prediction = await modificationResponse.json();
    const modifiedImageUrl = prediction.output?.[0] || null;

    res.json({
      success: true,
      modifiedImageUrl: modifiedImageUrl || '',
      originalImageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
