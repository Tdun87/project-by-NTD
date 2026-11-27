import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';

/// Cấu trúc dữ liệu xác suất Bloom Filter tối ưu RAM & hỗ trợ Cập nhật vi sai
class ScamBloomFilter {
  late final int _bitSetSize;
  late final int _numHashFunctions;
  late final Uint8List _bitArray;
  int currentVersion = 0;

  ScamBloomFilter({
    int expectedElements = 500000,
    double falsePositiveRate = 0.001,
  }) {
    // m = -(n * ln(p)) / (ln(2)^2) -> ~7.18 triệu bit (~898 KB RAM cho 500k số)
    _bitSetSize =
        (-(expectedElements * log(falsePositiveRate)) / (pow(ln2, 2))).ceil();

    // k = (m / n) * ln(2) -> ~10 hàm băm tối ưu
    _numHashFunctions = ((_bitSetSize / expectedElements) * ln2).ceil();

    // Cấp phát mảng byte nguyên thủy tiết kiệm bộ nhớ tối đa
    _bitArray = Uint8List((_bitSetSize / 8).ceil());
  }

  /// Kiểm tra số điện thoại có nằm trong danh sách đen không (Độ phức tạp O(k))
  bool mightContain(String e164Number) {
    final hashes = _getHashes(e164Number);
    for (final bitIndex in hashes) {
      final byteIndex = bitIndex >> 3;
      final bitOffset = bitIndex & 7;
      if ((_bitArray[byteIndex] & (1 << bitOffset)) == 0) {
        return false; // Chắc chắn 100% KHÔNG nằm trong danh sách đen
      }
    }
    return true; // Có khả năng nằm trong danh sách đen (độ chính xác 99.9%)
  }

  /// Cập nhật vi sai (Differential Update): Chỉ nạp danh sách số lừa đảo mới phát sinh
  void applyDifferentialUpdate(int newVersion, List<String> newScamNumbers) {
    if (newVersion <= currentVersion) return;

    for (final number in newScamNumbers) {
      final hashes = _getHashes(number);
      for (final bitIndex in hashes) {
        final byteIndex = bitIndex >> 3;
        final bitOffset = bitIndex & 7;
        _bitArray[byteIndex] |= (1 << bitOffset);
      }
    }
    currentVersion = newVersion;
  }

  /// Kỹ thuật Kirsch-Mitzenmacher: Sinh k chỉ số bit độc lập từ 1 lần băm SHA-256
  List<int> _getHashes(String input) {
    final digest = sha256.convert(utf8.encode(input)).bytes;
    final byteData = ByteData.sublistView(Uint8List.fromList(digest));
    final hash1 = byteData.getInt32(0, Endian.big);
    final hash2 = byteData.getInt32(4, Endian.big);

    return List<int>.generate(_numHashFunctions, (i) {
      final combined = (hash1 + i * hash2) & 0x7FFFFFFF;
      return combined % _bitSetSize;
    });
  }

  /// Tính dung lượng RAM đang chiếm dụng (KB)
  double get memoryUsageInKB => _bitArray.lengthInBytes / 1024;
}