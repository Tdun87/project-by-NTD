import 'dart:convert';
import 'package:crypto/crypto.dart';

/// Module bảo mật Zero-PII: Chuẩn hóa E.164 và băm một chiều SHA-256
class PrivacySecurityUtils {
  static const String _appPepperSalt = 'VN_ANTISCAM_2026_ZERO_PII_SALT';

  /// Chuẩn hóa mọi định dạng số điện thoại về chuẩn quốc tế E.164 (+84...)
  static String normalizeToE164(String rawNumber) {
    if (rawNumber.trim().isEmpty) return '';

    // Loại bỏ khoảng trắng, dấu gạch ngang, dấu chấm, ngoặc đơn
    final cleaned = rawNumber.replaceAll(RegExp(r'[\s\-\.\(\)]'), '');

    if (cleaned.startsWith('+84')) return cleaned;
    if (cleaned.startsWith('84') && cleaned.length >= 11) return '+$cleaned';
    if (cleaned.startsWith('0') && cleaned.length >= 9) {
      return '+84${cleaned.substring(1)}';
    }
    return cleaned; // Giữ nguyên đầu số ngắn (1900, 1800, 113)
  }

  /// Băm SHA-256 kết hợp Pepper Salt trước khi gửi payload lên Backend
  static String hashPhoneNumber(String e164Number) {
    final bytes = utf8.encode('$e164Number:$_appPepperSalt');
    final digest = sha256.convert(bytes);
    return digest.toString();
  }
}