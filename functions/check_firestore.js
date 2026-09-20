const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: 'what2post-21d07',
});

async function checkLatestImage() {
  try {
    const firestore = admin.firestore();
    const doc = await firestore.collection('dailyImages').doc('latest').get();
    
    if (!doc.exists) {
      console.log('ERROR: No "latest" document found in dailyImages collection');
      process.exit(1);
    }
    
    const data = doc.data();
    console.log('Latest Image Data:');
    console.log(JSON.stringify(data, null, 2));
    
    if (!data.imageUrl) {
      console.log('\n⚠️  WARNING: imageUrl is empty!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error querying Firestore:', error.message);
    process.exit(1);
  }
}

checkLatestImage();
