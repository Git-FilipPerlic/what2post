import 'package:cloud_firestore/cloud_firestore.dart';

class DailyImage {
  final String date;
  final String prompt;
  final String description;
  final String imageUrl;
  final DateTime? createdAt;

  const DailyImage({
    required this.date,
    required this.prompt,
    required this.description,
    required this.imageUrl,
    required this.createdAt,
  });

  factory DailyImage.fromFirestore(Map<String, dynamic> data) {
    final timestamp = data['createdAt'];
    return DailyImage(
      date: data['date'] as String? ?? '',
      prompt: data['prompt'] as String? ?? '',
      description: data['description'] as String? ?? '',
      imageUrl: data['imageUrl'] as String? ?? '',
      createdAt: timestamp is Timestamp ? timestamp.toDate() : null,
    );
  }
}
