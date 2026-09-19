import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';
import 'screens/home_screen.dart';
import 'services/notification_service.dart';

const pastelRoza = Color(0xFFE8B4C8);
const grimizna = Color(0xFFDC143C);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await NotificationService().init();
  runApp(const What2PostApp());
}

class What2PostApp extends StatelessWidget {
  const What2PostApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'What2Post',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: pastelRoza,
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: grimizna,
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      home: const HomeScreen(),
    );
  }
}
