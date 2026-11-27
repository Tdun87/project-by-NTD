import 'package:flutter/material.dart';
import 'core/engine/tier0_screening_engine.dart';
import 'core/models/call_screening_result.dart';
import 'ui/widgets/caller_overlay_card.dart';

void main() {
  runApp(const AntiScamDemoApp());
}

class AntiScamDemoApp extends StatelessWidget {
  const AntiScamDemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VN Anti-Scam Guard',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF0D47A1),
        useMaterial3: true,
      ),
      home: const PresentationSimulatorScreen(),
    );
  }
}

class PresentationSimulatorScreen extends StatefulWidget {
  const PresentationSimulatorScreen({super.key});

  @override
  State<PresentationSimulatorScreen> createState() =>
      _PresentationSimulatorScreenState();
}

class _PresentationSimulatorScreenState
    extends State<PresentationSimulatorScreen> {
  final Tier0ScreeningEngine _engine = Tier0ScreeningEngine();
  final TextEditingController _phoneController = TextEditingController();
  CallScreeningResult? _latestResult;

  Future<void> _simulateCall(String number) async {
    _phoneController.text = number;
    final res = await _engine.screenIncomingCall(number);
    setState(() {
      _latestResult = res;
    });
  }

  @override
  Widget build(BuildContext context) {
    final ramUsage = _engine.bloomFilter.memoryUsageInKB.toStringAsFixed(1);

    return Scaffold(
      appBar: AppBar(
        title: const Text('VN Anti-Scam Guard • Tier 0 Demo'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Thẻ thông số kiến trúc Tầng 0
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Trạng thái Bloom Filter: Đã nạp 500.000 số lừa đảo • '
                'Chiếm dụng RAM: $ramUsage KB • Phiên bản vi sai: v${_engine.bloomFilter.currentVersion}',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.blue.shade900,
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Ô nhập số điện thoại tùy chỉnh
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Nhập số gọi đến (VD: 02477799999)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton.icon(
                  onPressed: () => _simulateCall(_phoneController.text),
                  icon: const Icon(Icons.call_received),
                  label: const Text('Quét'),
                ),
              ],
            ),
            const SizedBox(height: 16),

            const Text(
              'Kịch bản Thuyết trình Nhanh (1-Click Demo):',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 8),

            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ActionChip(
                  avatar: const Icon(Icons.verified, color: Colors.green, size: 18),
                  label: const Text('Ngân hàng VCB (1900545413)'),
                  onPressed: () => _simulateCall('1900545413'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.dangerous, color: Colors.red, size: 18),
                  label: const Text('Số Lừa đảo (02477799999)'),
                  onPressed: () => _simulateCall('02477799999'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.help_outline, color: Colors.orange, size: 18),
                  label: const Text('Shipper / Số lạ (0987654321)'),
                  onPressed: () => _simulateCall('0987654321'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.person, color: Colors.grey, size: 18),
                  label: const Text('Người thân (0901112222)'),
                  onPressed: () => _simulateCall('0901112222'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Khu vực hiển thị kết quả Overlay theo thời gian thực
            if (_latestResult != null) ...[
              const Text(
                'Kết quả Phản hồi Tầng 0 (Realtime Overlay):',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
              ),
              const SizedBox(height: 8),
              CallerOverlayCard(result: _latestResult!),
            ],
          ],
        ),
      ),
    );
  }
}