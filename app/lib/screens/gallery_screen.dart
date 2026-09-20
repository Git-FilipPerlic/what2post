import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:gal/gal.dart';
import 'package:http/http.dart' as http;

import 'fullscreen_image_screen.dart';

class GalleryScreen extends StatefulWidget {
  const GalleryScreen({super.key});

  @override
  State<GalleryScreen> createState() => _GalleryScreenState();
}

class _GalleryScreenState extends State<GalleryScreen> {
  late FirebaseFirestore _firestore;
  List<Map<String, dynamic>> _images = [];
  bool _isLoading = true;
  String? _savingId;

  @override
  void initState() {
    super.initState();
    _firestore = FirebaseFirestore.instance;
    _loadImages();
  }

  Future<void> _loadImages() async {
    try {
      final snapshot = await _firestore
          .collection('dailyImages')
          .orderBy('date', descending: true)
          .get();

      setState(() {
        _images = snapshot.docs
            .where((doc) => doc.id != 'latest')
            .map((doc) => {
                  'id': doc.id,
                  'date': doc['date'] ?? 'Unknown',
                  'description': doc['description'] ?? '',
                  'imageUrl': doc['imageUrl'] ?? '',
                  'prompt': doc['prompt'] ?? ''
                })
            .toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading images: $e')),
        );
      }
    }
  }

  Future<void> _downloadImage(String url, String date) async {
    setState(() => _savingId = date);
    try {
      final response = await http.get(Uri.parse(url));
      await Gal.putImageBytes(
        response.bodyBytes,
        name: 'koka-decore-$date',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Sačuvano u galeriju')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Greška pri čuvanju: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _savingId = null);
    }
  }

  Future<void> _copyCaption(String caption) async {
    final data = ClipboardData(text: caption);
    await Clipboard.setData(data);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('✓ Caption copied')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🖼️ KOKA DECORE Gallery'),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _images.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.image_not_supported,
                          size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text('No images yet',
                          style: TextStyle(fontSize: 18, color: Colors.grey)),
                      Text('Images will appear here once generated',
                          style: TextStyle(color: Colors.grey)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadImages,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _images.length,
                    itemBuilder: (context, index) {
                      final image = _images[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: _buildImageCard(image),
                      );
                    },
                  ),
                ),
    );
  }

  Widget _buildImageCard(Map<String, dynamic> image) {
    final isSaving = _savingId == image['date'];
    return Card(
      elevation: 4,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => FullscreenImageScreen(
                  imageUrl: image['imageUrl'] ?? '',
                  description: image['description'] ?? '',
                  date: image['date'] ?? '',
                ),
              ),
            ),
            child: AspectRatio(
              aspectRatio: 1,
              child: CachedNetworkImage(
                imageUrl: image['imageUrl'] ?? '',
                fit: BoxFit.cover,
                placeholder: (context, url) =>
                    const Center(child: CircularProgressIndicator()),
                errorWidget: (context, url, error) =>
                    const Center(child: Icon(Icons.image_not_supported, size: 48)),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatDate(image['date']),
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0066CC)),
                ),
                const SizedBox(height: 8),
                Text(
                  image['description'],
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    height: 1.4,
                    color: Color(0xFF212529),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: isSaving
                            ? null
                            : () => _downloadImage(
                                image['imageUrl'], image['date']),
                        icon: isSaving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.download, size: 18),
                        label: const Text('Save',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            )),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0066CC),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () =>
                            _copyCaption(image['description']),
                        icon: const Icon(Icons.copy, size: 18),
                        label: const Text('Copy',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            )),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFF6B35),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ),
                  ],
                )
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String dateString) {
    try {
      final date = DateTime.parse(dateString);
      return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    } catch (e) {
      return dateString;
    }
  }
}
