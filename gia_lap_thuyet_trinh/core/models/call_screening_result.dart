enum RiskLevel {
  trustedContact, // Người quen trong danh bạ (Không hiện popup)
  safeBusiness,   // Tổ chức / Ngân hàng đã xác thực (Thẻ Xanh)
  warningUnknown, // Số lạ chưa xác thực - Tránh báo động giả (Thẻ Vàng)
  dangerScam,     // Cảnh báo lừa đảo mức độ cao (Thẻ Đỏ)
}

class CallScreeningResult {
  final RiskLevel riskLevel;
  final String title;
  final String subtitle;
  final String normalizedNumber;
  final String hashedPayload;
  final int latencyMs; // Đo lường độ trễ thực tế (ms)
  final String detectionSource;

  const CallScreeningResult({
    required this.riskLevel,
    required this.title,
    required this.subtitle,
    required this.normalizedNumber,
    required this.hashedPayload,
    required this.latencyMs,
    required this.detectionSource,
  });
}