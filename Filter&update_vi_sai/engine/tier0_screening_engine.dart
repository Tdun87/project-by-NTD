import 'dart:async';
import '../models/call_screening_result.dart';
import '../security/privacy_security_utils.dart';
import '../storage/scam_bloom_filter.dart';

/// Lõi xử lý Tầng 0: Điều phối bất đồng bộ (Async) đảm bảo độ trễ < 1 giây
class Tier0ScreeningEngine {
  final ScamBloomFilter bloomFilter = ScamBloomFilter();

  // Dữ liệu giả lập cho buổi thuyết trình (Thực tế đồng bộ từ OS & Server)
  final Set<String> _localContacts = {'+84901112222'}; // Danh bạ người thân
  final Map<String, Map<String, String>> _verifiedBrands = {
    '1900545413': {'name': 'Ngân hàng Vietcombank', 'category': 'Tài chính - Ngân hàng'},
    '1800588822': {'name': 'Ngân hàng Techcombank', 'category': 'Tài chính - Ngân hàng'},
    '1900545436': {'name': 'Ví điện tử MoMo', 'category': 'Trung gian thanh toán'},
  };

  Tier0ScreeningEngine() {
    // Nạp gói cập nhật vi sai mẫu (Version 102) chứa các đầu số lừa đảo phổ biến
    bloomFilter.applyDifferentialUpdate(102, [
      '+842477799999',
      '+842899988888',
      '+84561234567',
    ]);
  }

  /// Quy trình 3 bước xử lý cuộc gọi đến
  Future<CallScreeningResult> screenIncomingCall(String rawNumber) async {
    final stopwatch = Stopwatch()..start();
    final e164 = PrivacySecurityUtils.normalizeToE164(rawNumber);
    final hashedId = PrivacySecurityUtils.hashPhoneNumber(e164);

    // BƯỚC 1: Quét danh bạ cục bộ (Exact Match)
    if (_localContacts.contains(e164)) {
      stopwatch.stop();
      return CallScreeningResult(
        riskLevel: RiskLevel.trustedContact,
        title: 'Người quen trong danh bạ',
        subtitle: 'Cuộc gọi an toàn • Không cần can thiệp',
        normalizedNumber: e164,
        hashedPayload: 'NOT_TRANSMITTED (ZERO-PII)',
        latencyMs: stopwatch.elapsedMilliseconds,
        detectionSource: 'Local Indexed Contacts',
      );
    }

    // BƯỚC 2A: Kiểm tra danh sách đen nén bằng Bloom Filter
    if (bloomFilter.mightContain(e164)) {
      stopwatch.stop();
      return CallScreeningResult(
        riskLevel: RiskLevel.dangerScam,
        title: 'CẢNH BÁO LỪA ĐẢO CAO',
        subtitle: 'Trùng khớp dữ liệu đen cục bộ • Tuyệt đối không chuyển tiền!',
        normalizedNumber: e164,
        hashedPayload: hashedId,
        latencyMs: stopwatch.elapsedMilliseconds,
        detectionSource: 'On-Device Bloom Filter (v${bloomFilter.currentVersion})',
      );
    }

    // BƯỚC 2B: Kiểm tra Cache Brandname nội bộ
    if (_verifiedBrands.containsKey(e164)) {
      final brand = _verifiedBrands[e164]!;
      stopwatch.stop();
      return CallScreeningResult(
        riskLevel: RiskLevel.safeBusiness,
        title: brand['name']!,
        subtitle: 'Tổ chức xác thực (${brand['category']})',
        normalizedNumber: e164,
        hashedPayload: 'NOT_TRANSMITTED (VERIFIED)',
        latencyMs: stopwatch.elapsedMilliseconds,
        detectionSource: 'Local Verified Brand Cache',
      );
    }

    // BƯỚC 2C: Truy vấn Async API Định danh Doanh nghiệp với Hard Timeout 450ms
    final apiBrand = await _queryEnterpriseCallerIdApi(e164).timeout(
      const Duration(milliseconds: 450),
      onTimeout: () => null,
    );

    if (apiBrand != null) {
      stopwatch.stop();
      return CallScreeningResult(
        riskLevel: RiskLevel.safeBusiness,
        title: apiBrand['name']!,
        subtitle: 'Tổ chức xác thực qua API (${apiBrand['category']})',
        normalizedNumber: e164,
        hashedPayload: hashedId,
        latencyMs: stopwatch.elapsedMilliseconds,
        detectionSource: 'Enterprise CallerID API',
      );
    }

    // BƯỚC 3: Chưa rõ nguồn gốc -> Đóng gói Payload SHA-256 đẩy lên Backend (Zalo + Scam DB)
    _dispatchToBackendFireAndForget(e164, hashedId);

    stopwatch.stop();
    return CallScreeningResult(
      riskLevel: RiskLevel.warningUnknown,
      title: 'Chưa xác thực',
      subtitle: 'Số lạ ngoài danh bạ • Đang đối chiếu Zalo & CSDL lừa đảo...',
      normalizedNumber: e164,
      hashedPayload: hashedId,
      latencyMs: stopwatch.elapsedMilliseconds,
      detectionSource: 'Tier 0 Heuristic -> Dispatched to Backend',
    );
  }

  Future?> _queryEnterpriseCallerIdApi(String e164) async {
    // Giả lập độ trễ mạng 65ms khi gọi API doanh nghiệp
    await Future.delayed(const Duration(milliseconds: 65));
    return null;
  }

  void _dispatchToBackendFireAndForget(String e164, String hashedId) {
    // Gửi bất đồng bộ không chặn UI (gRPC / HTTP3)
    // Payload chỉ gồm: { phoneHash: hashedId, prefix: e164.substring(0, 5) }
  }
}