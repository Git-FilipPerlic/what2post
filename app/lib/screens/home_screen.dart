import 'package:cached_network_image/cached_network_image.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/daily_image.dart';
import 'fullscreen_image_screen.dart';
import 'gallery_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('What2Post'),
        actions: [
          IconButton(
            icon: const Icon(Icons.collections),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const GalleryScreen()),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
          stream: FirebaseFirestore.instance
              .collection('dailyImages')
              .doc('latest')
              .snapshots(),
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error, size: 48, color: Colors.red),
                    const SizedBox(height: 16),
                    Text('Greška: ${snapshot.error}'),
                  ],
                ),
              );
            }
            if (!snapshot.hasData) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 16),
                    const Text('Učitavanje...'),
                  ],
                ),
              );
            }
            if (!snapshot.data!.exists) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.image_not_supported, size: 48),
                    const SizedBox(height: 16),
                    const Text('Nema dostupne slike'),
                    const SizedBox(height: 32),
                    ElevatedButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const GalleryScreen()),
                      ),
                      icon: const Icon(Icons.collections),
                      label: const Text('Prethodne slike'),
                    ),
                  ],
                ),
              );
            }

            final image = DailyImage.fromFirestore(snapshot.data!.data()!);

            return Column(
              children: [
                Expanded(
                  child: image.imageUrl.isEmpty
                      ? const Center(child: Text('Slika još nije spremna'))
                      : GestureDetector(
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => FullscreenImageScreen(
                                imageUrl: image.imageUrl,
                                description: image.description,
                                date: image.date,
                              ),
                            ),
                          ),
                          child: CachedNetworkImage(
                            imageUrl: image.imageUrl,
                            fit: BoxFit.contain,
                            width: double.infinity,
                            placeholder: (context, url) =>
                                const Center(child: CircularProgressIndicator()),
                            errorWidget: (context, url, error) =>
                                const Center(child: Icon(Icons.broken_image)),
                          ),
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
