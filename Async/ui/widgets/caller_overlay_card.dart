import 'package:flutter/material.dart';
import '../../core/models/call_screening_result.dart';

/// Giao diện Thẻ Cảnh báo Nổi (Floating Overlay Card) hiển thị khi có cuộc gọi đến
class CallerOverlayCard extends StatelessWidget {
  final CallScreeningResult result;

  const CallerOverlayCard({super.key, required this.result});

  @override
  Widget build(BuildContext context) {
    final config = _getStyleByRisk(result.riskLevel);

    return Card(
      elevation: 6,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: config.borderColor, width: 2),
      ),
      color: config.bgColor,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(config.icon, color: config.accentColor, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        result.title,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: config.accentColor,
                        ),
                      ),
                      Text(
                        result.normalizedNumber,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: config.accentColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${result.latencyMs} ms',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            Text(
              result.subtitle,
              style: const TextStyle(fontSize: 14, color: Colors.black87),
            ),
            const SizedBox(height: 10),
            Text(
              'Nguồn nhận diện: ${result.detectionSource}',
              style: const TextStyle(fontSize: 12, color: Colors.black54),
            ),
            const SizedBox(height: 4),
            Text(
              'Zero-PII Payload: ${result.hashedPayload}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontFamily: 'monospace',
                color: Colors.black54,
              ),
            ),
          ],
        ),
      ),
    );
  }

  _OverlayStyle _getStyleByRisk(RiskLevel level) {
    switch (level) {
      case RiskLevel.safeBusiness:
        return _OverlayStyle(
          bgColor: const Color(0xFFE8F5E9),
          borderColor: Colors.green.shade600,
          accentColor: Colors.green.shade800,
          icon: Icons.verified_user,
        );
      case RiskLevel.dangerScam:
        return _OverlayStyle(
          bgColor: const Color(0xFFFFEBEE),
          borderColor: Colors.red.shade600,
          accentColor: Colors.red.shade800,
          icon: Icons.gpp_bad,
        );
      case RiskLevel.warningUnknown:
        return _OverlayStyle(
          bgColor: const Color(0xFFFFF8E1),
          borderColor: Colors.amber.shade700,
          accentColor: Colors.orange.shade900,
          icon: Icons.warning_amber_rounded,
        );
      case RiskLevel.trustedContact:
        return _OverlayStyle(
          bgColor: Colors.grey.shade100,
          borderColor: Colors.grey.shade400,
          accentColor: Colors.grey.shade800,
          icon: Icons.contact_phone,
        );
    }
  }
}

class _OverlayStyle {
  final Color bgColor;
  final Color borderColor;
  final Color accentColor;
  final IconData icon;
  _OverlayStyle({
    required this.bgColor,
    required this.borderColor,
    required this.accentColor,
    required this.icon,
  });
}