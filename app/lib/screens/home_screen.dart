import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/daily_image.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection('dailyImages')
              .doc('latest')
              .snapshots(),
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(child: Text('Greška: ${snapshot.error}'));
            }
            if (!snapshot.hasData || !snapshot.data!.exists) {
              return const Center(child: CircularProgressIndicator());
            }

            final image = DailyImage.fromFirestore(snapshot.data!.data()!);

            return Column(
              children: [
                Expanded(
                  child: image.imageUrl.isEmpty
                      ? const Center(child: Text('Slika još nije spremna'))
                      : CachedNetworkImage(
                          imageUrl: image.imageUrl,
                          fit: BoxFit.contain,
                          width: double.infinity,
                          placeholder: (context, url) =>
                              const Center(child: CircularProgressIndicator()),
                          errorWidget: (context, url, error) =>
                              const Center(child: Icon(Icons.broken_image)),
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (image.createdAt != null)
                        Text(
                          DateFormat('d. MMMM y.').format(image.createdAt!),
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      const SizedBox(height: 6),
                      Text(
                        image.description,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
