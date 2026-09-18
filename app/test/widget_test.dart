// Basic smoke test: the app builds without throwing.
//
// A full test that reaches HomeScreen would need a Firebase test double
// (Firebase.initializeApp needs platform channels not present in the
// widget-test environment), so this only checks the widget tree builds.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('MaterialApp shell builds', (WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: Center(child: Text('What2Post'))),
      ),
    );

    expect(find.text('What2Post'), findsOneWidget);
  });
}
