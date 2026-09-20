// PLACEHOLDER — replace this whole file by running `flutterfire configure`
// from the `app/` folder once your Firebase project exists. That command
// logs into your Firebase account and writes the real platform config
// (API keys, app IDs, project ID) here. See ../README.md.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyB4S67A63rTgoWUbu25IVVXdEWFJm2h37I',
    appId: '1:1065325057080:android:72b4c1d663f3db8e62c2cd',
    messagingSenderId: '1065325057080',
    projectId: 'what2post-21d07',
    storageBucket: 'what2post-21d07.firebasestorage.app',
  );
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyC_HB9xUFr0CuVcsKOF44kCAjhh_kEHf6Q',
    appId: '1:1065325057080:ios:1a1b1c4bdd4a82ef62c2cd',
    messagingSenderId: '1065325057080',
    projectId: 'what2post-21d07',
    storageBucket: 'what2post-21d07.firebasestorage.app',
    iosBundleId: 'com.what2post.dailyImageApp',
  );
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDM7WWEJE61QgBE-RMNToNTfkVBhDP6gCA',
    appId: '1:1065325057080:web:1ce91f848360492062c2cd',
    messagingSenderId: '1065325057080',
    projectId: 'what2post-21d07',
    authDomain: 'what2post-21d07.firebaseapp.com',
    storageBucket: 'what2post-21d07.firebasestorage.app',
    measurementId: 'G-C4TD9CKGDV',
  );
}
