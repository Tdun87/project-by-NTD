const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const cors = require("cors");
const database = require("./db");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const COMMUNITY_SYNC_SECRET = process.env.COMMUNITY_SYNC_SECRET || "";
const OPEN_FEED_IMPORT_TOKEN = process.env.OPEN_FEED_IMPORT_TOKEN || "";
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const SCAN_WINDOW_MS = 10 * 60 * 1000;
const COMMUNITY_WARNING_THRESHOLD = 3;
const COMMUNITY_CONFIRMED_THRESHOLD = 10;

const virtualPrefixes = [
  "024710", "024730", "024777", "024838", "024888", "024999",
  "028710", "028730", "028777", "028838", "028888", "028999",
  "024555", "028555", "024666", "028666",
];
const carrierPrefixes = [
  { prefixes: ["032", "033", "034", "035", "036", "037", "038", "039", "086", "096", "097", "098"], carrier: "Viettel" },
  { prefixes: ["081", "082", "083", "084", "085", "088", "091", "094"], carrier: "VinaPhone" },
  { prefixes: ["070", "076", "077", "078", "079", "089", "090", "093"], carrier: "MobiFone" },
  { prefixes: ["052", "056", "058", "092"], carrier: "Vietnamobile" },
  { prefixes: ["059", "099"], carrier: "Gmobile" },
];
const areaCodes = [
  ["024", "Hà Nội"], ["028", "TP. Hồ Chí Minh"], ["0204", "Bắc Giang"],
  ["0205", "Lạng Sơn"], ["0206", "Cao Bằng"], ["0207", "Tuyên Quang"],
  ["0208", "Thái Nguyên"], ["0209", "Bắc Kạn"], ["0210", "Phú Thọ"],
  ["0211", "Vĩnh Phúc"], ["0212", "Sơn La"], ["0213", "Lai Châu"],
  ["0214", "Lào Cai"], ["0215", "Điện Biên"], ["0216", "Yên Bái"],
  ["0218", "Hòa Bình"], ["0219", "Hà Giang"], ["0220", "Hải Dương"],
  ["0221", "Hưng Yên"], ["0222", "Bắc Ninh"], ["0225", "Hải Phòng"],
  ["0226", "Hà Nam"], ["0227", "Thái Bình"], ["0228", "Nam Định"],
  ["0229", "Ninh Bình"], ["0232", "Quảng Bình"], ["0233", "Quảng Trị"],
  ["0234", "Thừa Thiên Huế"], ["0235", "Quảng Nam"], ["0236", "Đà Nẵng"],
  ["0237", "Thanh Hóa"], ["0238", "Nghệ An"], ["0239", "Hà Tĩnh"],
  ["0251", "Đồng Nai"], ["0252", "Bình Thuận"], ["0254", "Bà Rịa - Vũng Tàu"],
  ["0255", "Quảng Ngãi"], ["0256", "Bình Định"], ["0257", "Phú Yên"],
  ["0258", "Khánh Hòa"], ["0259", "Ninh Thuận"], ["0260", "Kon Tum"],
  ["0261", "Đắk Nông"], ["0262", "Đắk Lắk"], ["0263", "Lâm Đồng"],
  ["0269", "Gia Lai"], ["0270", "Vĩnh Long"], ["0271", "Bình Phước"],
  ["0272", "Long An"], ["0273", "Tiền Giang"], ["0274", "Bình Dương"],
  ["0275", "Bến Tre"], ["0276", "Tây Ninh"], ["0277", "Đồng Tháp"],
  ["0278", "Sóc Trăng"], ["0290", "Cà Mau"], ["0291", "Bạc Liêu"],
  ["0292", "Cần Thơ"], ["0293", "Hậu Giang"], ["0294", "Trà Vinh"],
  ["0296", "An Giang"], ["0297", "Kiên Giang"], ["0299", "Sóc Trăng"],
].sort((a, b) => b[0].length - a[0].length);

app.use(cors({
  origin: true,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Device-Token", "X-Open-Feed-Token"],
  maxAge: 600,
}));
app.use(express.json({ limit: "2mb" }));

app.get(["/", "/index.html", "/index.html"], (_req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, "index.html"));
});
app.get("/styles.css", (_req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, "styles.css"));
});
app.get("/app.js", (_req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, "app.js"));
});
app.get("/logo.jpg", (_req, res) => {
  res.sendFile(path.join(FRONTEND_ROOT, "logo.jpg"));
});

function normalizeVietnameseNumber(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const cleaned = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;

  let national;
  if (cleaned.startsWith("+84")) national = cleaned.slice(3);
  else if (cleaned.startsWith("+")) {
    return /^\+(?!84)[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  } else if (cleaned.startsWith("84")) national = cleaned.slice(2);
  else if (/^(1800|1900)\d{4,8}$/.test(cleaned)) return cleaned;
  else if (cleaned.startsWith("0")) national = cleaned.slice(1);
  else return null;

  const validMobileOrLandline = /^[1-9]\d{8,9}$/.test(national);
  const validHotline = /^(1800|1900)\d{4,8}$/.test(national);
  if (validHotline) return national;
  return validMobileOrLandline ? `+84${national}` : null;
}

function isValidE164(number) {
  return typeof number === "string" &&
    /^(?:\+84[1-9]\d{8,9}|\+84(?:1800|1900)\d{4,8}|(?:1800|1900)\d{4,8}|\+(?!84)[1-9]\d{7,14})$/.test(number);
}

function getNationalDigits(number) {
  if (/^(?:1800|1900)/.test(number)) return number;
  if (number.startsWith("+84")) return number.slice(3);
  return number;
}

function findVerifiedBrand(number) {
  const national = getNationalDigits(number);
  const isInternational = number.startsWith("+") && !number.startsWith("+84");
  const candidates = isInternational
    ? [number]
    : [
      number,
      national,
      `+84${national}`,
      ...(national.startsWith("1800") || national.startsWith("1900") ? [] : [`0${national}`]),
    ];
  return database.prepare(`
    SELECT b.number, b.name, b.category
    FROM verified_brand_numbers AS a
    JOIN verified_brands AS b ON b.number = a.brand_number
    WHERE a.number IN (?, ?, ?, ?)
    LIMIT 1
  `).get(...[...new Set(candidates), "", "", ""].slice(0, 4)) ||
    database.prepare(`
      SELECT number, name, category
      FROM verified_brands
      WHERE number IN (?, ?, ?, ?)
      LIMIT 1
    `).get(...[...new Set(candidates), "", "", ""].slice(0, 4)) ||
    null;
}

function getNumberStorageCandidates(number) {
  if (number.startsWith("+") && !number.startsWith("+84")) return [number, number];
  const national = getNationalDigits(number);
  if (national.startsWith("1800") || national.startsWith("1900")) {
    return [national, `+84${national}`];
  }
  return [number, `0${national}`];
}

function hashDeviceToken(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9._-]{16,128}$/.test(value)) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signCommunityFeed(feed) {
  const signedData = JSON.stringify({
    schemaVersion: feed.schemaVersion,
    generatedAt: feed.generatedAt,
    publisher: feed.publisher,
    entries: feed.entries,
  });
  return crypto.createHmac("sha256", COMMUNITY_SYNC_SECRET).update(signedData).digest("hex");
}

function canImportOpenFeed(request) {
  const isLoopback = ["127.0.0.1", "::1", "localhost"].includes(HOST);
  if (isLoopback && !OPEN_FEED_IMPORT_TOKEN) return true;
  const provided = request.get("x-open-feed-token") || "";
  if (!/^[a-zA-Z0-9._-]{32,128}$/.test(OPEN_FEED_IMPORT_TOKEN) ||
    !/^[a-zA-Z0-9._-]{32,128}$/.test(provided) ||
    provided.length !== OPEN_FEED_IMPORT_TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(OPEN_FEED_IMPORT_TOKEN));
}

function analyzeTelecom(e164Number) {
  if (e164Number.startsWith("+") && !e164Number.startsWith("+84")) {
    return {
      carrier: "Quốc tế / Chưa xác định",
      lineType: "Chưa xác định",
      isVoip: false,
      prefix: e164Number.slice(0, 4),
      area: null,
      mvnoSignal: false,
    };
  }
  const national = getNationalDigits(e164Number);
  const domestic = national.startsWith("1800") || national.startsWith("1900")
    ? national
    : `0${national}`;
  const virtualPrefix = virtualPrefixes.find((prefix) => domestic.startsWith(prefix));
  if (virtualPrefix) {
    return {
      carrier: "Tổng đài ảo / SIP Trunk (VoIP)",
      lineType: "Điện thoại cố định ảo",
      isVoip: true,
      prefix: virtualPrefix,
      area: domestic.startsWith("024") ? "Hà Nội" : "TP. Hồ Chí Minh",
      mvnoSignal: false,
      virtualLineNote: "Đầu số cố định ảo thường được dùng cho cuộc gọi tự động, tiếp thị hoặc lừa đảo; hãy xác minh danh tính người gọi.",
    };
  }

  if (national.startsWith("1800") || national.startsWith("1900")) {
    return {
      carrier: national.startsWith("1800") ? "Đường dây miễn phí 1800" : "Tổng đài doanh nghiệp 1900",
      lineType: "Đường dây doanh nghiệp",
      isVoip: false,
      prefix: national.slice(0, 4),
      area: null,
      mvnoSignal: false,
    };
  }

  const domesticPrefix = domestic.slice(0, 3);
  if (["087", "055", "099", "052", "056", "058"].includes(domesticPrefix)) {
    const mvnoName = {
      "087": "iTel",
      "055": "Reddi",
      "099": "Gmobile",
      "052": "Vietnamobile",
      "056": "Vietnamobile",
      "058": "Vietnamobile",
    }[domesticPrefix];
    return {
      carrier: `${mvnoName} (đầu số ${domesticPrefix})`,
      lineType: "Di động",
      isVoip: false,
      prefix: domesticPrefix,
      area: null,
      mvnoSignal: true,
      portabilityNote: "Nhà mạng hiện tại có thể khác do chuyển mạng giữ số.",
    };
  }

  const mobile = carrierPrefixes.map(({ prefixes, carrier }) => ({
    prefix: prefixes.find((prefix) => domestic.startsWith(prefix)),
    carrier,
  })).find(({ prefix }) => prefix);
  if (mobile) {
    return {
      carrier: `${mobile.carrier} (theo đầu số gốc)`,
      lineType: "Di động",
      isVoip: false,
      prefix: mobile.prefix,
      area: null,
      mvnoSignal: false,
      portabilityNote: "Nhà mạng hiện tại có thể khác do chuyển mạng giữ số.",
    };
  }

  const matchedArea = areaCodes.find(([prefix]) => domestic.startsWith(prefix));
  if (matchedArea) {
    return {
      carrier: "Mạng cố định",
      lineType: "Điện thoại cố định",
      isVoip: false,
      prefix: matchedArea[0],
      area: matchedArea[1],
      mvnoSignal: false,
    };
  }

  return {
    carrier: "Chưa xác định",
    lineType: "Chưa xác định",
    isVoip: false,
    prefix: domestic.slice(0, 3),
    area: null,
    mvnoSignal: false,
  };
}

function getIdentityStatus(brand, telecom, scamRecord) {
  if (brand) {
    return {
      type: "verified_brand",
      label: `Đã xác minh: ${brand.name}`,
      detail: `${brand.category} · khớp danh sách thương hiệu cục bộ`,
    };
  }
  if (telecom.isVoip) {
    return {
      type: "voip",
      label: "Tổng đài ảo / SIP Trunk (VoIP)",
      detail: `Đầu số ${telecom.prefix} thường được dùng cho cuộc gọi tự động; cần xác minh người gọi.`,
    };
  }
  if (scamRecord) {
    return {
      type: "community",
      label: "Có dấu vết trong cơ sở dữ liệu cảnh báo",
      detail: `${scamRecord.tag} · nguồn: ${getSourceLabel(scamRecord.source, scamRecord.tag)}`,
    };
  }
  return {
    type: "unknown",
    label: "Chưa có định danh xác minh",
    detail: "Không tìm thấy thương hiệu hoặc báo cáo trong cơ sở dữ liệu cục bộ.",
  };
}

function calculateRiskScore({
  telecom,
  scamRecord,
  reportCount,
  localReportsCount,
  verifiedBrand,
  recentScans,
}) {
  if (verifiedBrand) return { riskScore: 0, velocityPoints: 0, velocitySpike: false, velocityLabel: null };

  const baseScore = telecom.isVoip
    ? 55
    : telecom.mvnoSignal
      ? 25
      : telecom.lineType === "Di động"
        ? 15
        : telecom.area
          ? 30
          : 55;
  const isImportedBlacklist = scamRecord?.source === "open-feed" || scamRecord?.source === "seed";
  const isCommunityConfirmed = reportCount >= COMMUNITY_WARNING_THRESHOLD;
  const hasPendingCommunityReports = reportCount > 0 && reportCount < COMMUNITY_WARNING_THRESHOLD;
  const reportPoints = localReportsCount > 0 || hasPendingCommunityReports ? 45 : 0;
  const velocityPoints = recentScans >= 3 ? 15 : 0;
  const velocitySpike = velocityPoints > 0;
  let riskScore = baseScore + reportPoints + velocityPoints;
  const confirmedWarning = isImportedBlacklist || isCommunityConfirmed;
  if (confirmedWarning) riskScore = Math.max(riskScore, 85);
  return {
    riskScore: Math.min(riskScore, 100),
    confirmedWarning,
    velocityPoints,
    velocitySpike,
    velocityLabel: recentScans >= 3
      ? "Phát hiện tần suất tra cứu dồn dập (từ 3 lượt/10 phút)."
      : null,
  };
}

function getRiskLevel(score, verifiedBrand, telecom, confirmedWarning) {
  if (verifiedBrand) return "Đã xác minh";
  if (confirmedWarning) return "Nguy hiểm";
  if (score >= 70) return "Nguy hiểm";
  if (telecom.isVoip && score < 70) return "Cần thận trọng";
  if (!telecom.area && telecom.lineType === "Chưa xác định" && score >= 40) {
    return "Cần thận trọng (Đầu số lạ/Quốc tế)";
  }
  if (score >= 40) return "Cần thận trọng";
  if (telecom.area) return "Chưa xác thực (Số cố định)";
  return "Chưa xác thực (Số lạ)";
}

function maskPhoneNumber(e164Number) {
  if (e164Number.startsWith("+") && !e164Number.startsWith("+84")) {
    return `${e164Number.slice(0, 4)}***${e164Number.slice(-3)}`;
  }
  const national = getNationalDigits(e164Number);
  if (national.startsWith("1800") || national.startsWith("1900")) {
    return `${national.slice(0, 4)}***${national.slice(-3)}`;
  }
  return `+84${national.slice(0, 3)}***${national.slice(-3)}`;
}

function getSourceLabel(source, tag) {
  const sourceLabels = {
    seed: "Dữ liệu ban đầu",
    "open-feed": "Dữ liệu mở",
    community: "Cộng đồng",
    "community-sync": "Cộng đồng đã đồng bộ",
  };
  return sourceLabels[source] || tag || "Nguồn chưa xác định";
}

function getCommunityConsensus({ brand, scamRecord, reportCount }) {
  if (brand) {
    return {
      tier: "whitelist",
      status: "Được bảo vệ bởi danh bạ thương hiệu xác minh",
      reportCount,
      requiredReports: COMMUNITY_WARNING_THRESHOLD,
      highConfidence: false,
    };
  }
  if (scamRecord?.source === "open-feed") {
    return {
      tier: "verified",
      status: "Lừa đảo đã xác thực toàn hệ thống",
      reportCount,
      requiredReports: COMMUNITY_CONFIRMED_THRESHOLD,
      highConfidence: true,
    };
  }
  if (reportCount >= COMMUNITY_CONFIRMED_THRESHOLD) {
    return {
      tier: "verified",
      status: "Lừa đảo đã xác thực toàn hệ thống",
      reportCount,
      requiredReports: COMMUNITY_CONFIRMED_THRESHOLD,
      highConfidence: true,
    };
  }
  if (reportCount >= COMMUNITY_WARNING_THRESHOLD) {
    return {
      tier: "community",
      status: "Cảnh báo cộng đồng",
      reportCount,
      requiredReports: COMMUNITY_WARNING_THRESHOLD,
      highConfidence: false,
    };
  }
  if (reportCount > 0) {
    return {
      tier: "pending",
      status: `Chờ xác minh cộng đồng (${reportCount}/${COMMUNITY_WARNING_THRESHOLD} báo cáo)`,
      reportCount,
      requiredReports: COMMUNITY_WARNING_THRESHOLD,
      highConfidence: false,
    };
  }
  if (scamRecord?.source === "seed") {
    return {
      tier: "seed",
      status: "Cảnh báo có sẵn trong dữ liệu ban đầu",
      reportCount,
      requiredReports: COMMUNITY_WARNING_THRESHOLD,
      highConfidence: false,
    };
  }
  return {
    tier: "none",
    status: "Chưa có báo cáo cộng đồng độc lập",
    reportCount: 0,
    requiredReports: COMMUNITY_WARNING_THRESHOLD,
    highConfidence: false,
  };
}

function scanNumber(e164Number, localReportsCount = 0, deviceTokenHash = "") {
  const startedAt = performance.now();
  const [storedNumber, alternateStoredNumber] = getNumberStorageCandidates(e164Number);
  const telecomTask = Promise.resolve().then(() => analyzeTelecom(e164Number));
  const identityTask = Promise.resolve().then(() => {
    const brand = findVerifiedBrand(e164Number);
    const scamRecord = database.prepare(
      "SELECT e164, tag, source, report_count, updated_at FROM scam_numbers WHERE e164 IN (?, ?) ORDER BY CASE source WHEN 'open-feed' THEN 0 WHEN 'seed' THEN 1 ELSE 2 END LIMIT 1",
    ).get(storedNumber, alternateStoredNumber);
    const recordedCount = database.prepare(
      "SELECT COUNT(*) AS count FROM community_reports WHERE e164 = ?",
    ).get(e164Number).count;
    const communityReportCount = Math.max(
      recordedCount,
      scamRecord?.source === "community-sync" ? scamRecord.report_count : 0,
    );
    return { brand: brand || null, scamRecord: scamRecord || null, communityReportCount };
  });
  const riskTask = Promise.resolve().then(() => {
    const e164Hash = crypto.createHash("sha256").update(e164Number).digest("hex");
    const windowStart = new Date(Date.now() - SCAN_WINDOW_MS).toISOString();
    const recent = database.prepare(
      "SELECT COUNT(*) AS count FROM scan_logs WHERE e164_hash = ? AND scanned_at >= ?",
    ).get(e164Hash, windowStart).count;
    const recordedCount = database.prepare(
      "SELECT COUNT(*) AS count FROM community_reports WHERE e164 = ?",
    ).get(e164Number).count;
    const cachedReport = database.prepare(
      "SELECT source, report_count FROM scam_numbers WHERE e164 IN (?, ?) ORDER BY CASE source WHEN 'open-feed' THEN 0 WHEN 'seed' THEN 1 ELSE 2 END LIMIT 1",
    ).get(storedNumber, alternateStoredNumber);
    const communityReportCount = Math.max(
      recordedCount,
      cachedReport?.source === "community-sync" ? cachedReport.report_count : 0,
    );
    return { e164Hash, recentScans: recent + 1, communityReportCount };
  });

  return Promise.all([telecomTask, identityTask, riskTask]).then(([telecom, identity, risk]) => {
    const communityReportCount = Math.max(identity.communityReportCount, risk.communityReportCount);
    const isOpenFeed = identity.scamRecord?.source === "open-feed";
    const effectiveScamRecord = identity.brand
      ? null
      : isOpenFeed || identity.scamRecord?.source === "seed" ||
          (["community", "community-sync"].includes(identity.scamRecord?.source) &&
            communityReportCount >= COMMUNITY_WARNING_THRESHOLD)
        ? identity.scamRecord
        : null;
    const consensusReportCount = identity.brand
      ? communityReportCount
      : isOpenFeed
        ? Math.max(communityReportCount, COMMUNITY_CONFIRMED_THRESHOLD)
        : communityReportCount;
    const communityConsensus = getCommunityConsensus({
      brand: identity.brand,
      scamRecord: effectiveScamRecord,
      reportCount: consensusReportCount,
    });
    const scoredRisk = calculateRiskScore({
      telecom,
      scamRecord: effectiveScamRecord,
      reportCount: consensusReportCount,
      localReportsCount,
      verifiedBrand: identity.brand,
      recentScans: risk.recentScans,
    });
    const { riskScore, velocityPoints, velocitySpike, velocityLabel, confirmedWarning } = scoredRisk;
    const riskLevel = getRiskLevel(riskScore, identity.brand, telecom, confirmedWarning);
    const scannedAt = new Date().toISOString();
    database.prepare(
      `INSERT INTO scan_logs
        (e164_hash, device_token_hash, masked_number, carrier, risk_score, risk_level, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      risk.e164Hash,
      deviceTokenHash,
      maskPhoneNumber(e164Number),
      telecom.carrier,
      riskScore,
      riskLevel,
      scannedAt,
    );

    const riskReasons = [
      ...(effectiveScamRecord
        ? [`Có trong cơ sở dữ liệu cảnh báo (${getSourceLabel(effectiveScamRecord.source, effectiveScamRecord.tag)}).`]
        : []),
      ...(telecom.isVoip ? ["Đầu số thuộc nhóm tổng đài ảo / SIP Trunk; cần xác minh người gọi."] : []),
      ...(telecom.virtualLineNote ? [telecom.virtualLineNote] : []),
      ...(communityReportCount ? [`Có ${communityReportCount} báo cáo từ thiết bị độc lập trong mạng cộng đồng.`] : []),
      ...(localReportsCount ? [`Có ${localReportsCount} ghi nhận trên thiết bị này.`] : []),
      ...(velocityLabel ? [`${velocityLabel} ${risk.recentScans} lượt quét số này trong 10 phút; đây không phải dữ liệu cuộc gọi thực tế.`] : []),
    ];

    return {
      e164Number,
      carrier: telecom.carrier,
      lineType: telecom.lineType,
      isVoip: telecom.isVoip,
      prefix: telecom.prefix,
      area: telecom.area,
      mvnoSignal: telecom.mvnoSignal,
      portabilityNote: telecom.portabilityNote || null,
      virtualLineNote: telecom.virtualLineNote || null,
      verifiedBrand: identity.brand,
      communityMatch: effectiveScamRecord
        ? { tag: effectiveScamRecord.tag, source: effectiveScamRecord.source, reportCount: consensusReportCount }
        : null,
      identityStatus: getIdentityStatus(identity.brand, telecom, effectiveScamRecord),
      communityConsensus,
      localReportsCount,
      reportCount: consensusReportCount,
      isLocallyReported: localReportsCount > 0,
      isBlacklisted: Boolean(effectiveScamRecord),
      recentScans: risk.recentScans,
      velocitySpike,
      velocityPoints,
      recentScansIn10Min: risk.recentScans,
      riskScore,
      riskLevel,
      riskReasons,
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    };
  });
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if ((character === "," || character === ";") && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.trim());
  return fields;
}

function parseFeed(body) {
  const content = typeof body.content === "string" ? body.content : null;
  const rawEntries = Array.isArray(body.numbers) ? body.numbers : null;
  if (!content && !rawEntries) {
    throw Object.assign(new Error("Gửi danh sách trong trường content hoặc numbers."), { status: 400 });
  }

  let entries = rawEntries;
  if (content) {
    if (content.length > 1_000_000) {
      throw Object.assign(new Error("Tệp dữ liệu tối đa 1 MB."), { status: 413 });
    }
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) entries = parsed;
      else if (parsed && Array.isArray(parsed.numbers)) entries = parsed.numbers;
      else throw new Error("JSON phải là danh sách hoặc đối tượng có thuộc tính numbers.");
    } catch (error) {
      if (error instanceof SyntaxError) {
        entries = content.split(/\r?\n/).filter(Boolean).map((line, index) => {
          const [number, tag] = parseCsvLine(line);
          if (index === 0 && /^(number|phone|e164|số điện thoại)$/i.test(number)) return null;
          return { number, tag };
        }).filter(Boolean);
      } else {
        throw Object.assign(error, { status: 400 });
      }
    }
  }

  if (!entries || entries.length > 10_000) {
    throw Object.assign(new Error("Danh sách tối đa 10.000 số."), { status: 400 });
  }

  const uniqueEntries = new Map();
  const invalidRows = [];
  entries.forEach((entry, index) => {
    const value = typeof entry === "string" ? { number: entry } : entry;
    const number = normalizeVietnameseNumber(value?.e164 || value?.e164Number || value?.number || value?.phone);
    if (!number || !isValidE164(number)) {
      invalidRows.push(index + 1);
      return;
    }
    const tag = typeof value?.tag === "string" && value.tag.trim()
      ? value.tag.trim().slice(0, 120)
      : "Cảnh báo từ dữ liệu mở";
    uniqueEntries.set(number, tag);
  });

  if (invalidRows.length) {
    throw Object.assign(
      new Error(`Có số không hợp lệ tại dòng: ${invalidRows.slice(0, 20).join(", ")}${invalidRows.length > 20 ? ", ..." : ""}.`),
      { status: 400 },
    );
  }
  return [...uniqueEntries].map(([e164, tag]) => ({ e164, tag }));
}

app.post("/api/v1/scan-number", async (req, res, next) => {
  const { e164Number, localReportsCount = 0 } = req.body || {};
  const normalizedNumber = normalizeVietnameseNumber(e164Number);
  const rawDeviceToken = req.body?.device_token || req.body?.deviceToken;
  const deviceTokenHash = rawDeviceToken === undefined ? "" : hashDeviceToken(rawDeviceToken);
  if (!normalizedNumber || !isValidE164(normalizedNumber)) {
    res.status(400).json({ error: "Số điện thoại phải ở định dạng E.164 Việt Nam hợp lệ.", code: "INVALID_NUMBER" });
    return;
  }
  if (!Number.isSafeInteger(localReportsCount) || localReportsCount < 0 || localReportsCount > 10_000) {
    res.status(400).json({ error: "Số lượng báo cáo trên thiết bị không hợp lệ.", code: "INVALID_REPORT_COUNT" });
    return;
  }
  if (rawDeviceToken !== undefined && !deviceTokenHash) {
    res.status(400).json({ error: "Mã thiết bị ẩn danh không hợp lệ.", code: "INVALID_DEVICE_TOKEN" });
    return;
  }
  try {
    res.json(await scanNumber(normalizedNumber, localReportsCount, deviceTokenHash));
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/report", (req, res) => {
  const { e164Number, tag } = req.body || {};
  const normalizedNumber = normalizeVietnameseNumber(e164Number);
  const deviceToken = req.body?.deviceToken || req.body?.device_token;
  if (!normalizedNumber || !isValidE164(normalizedNumber)) {
    res.status(400).json({ error: "Số điện thoại phải ở định dạng E.164 Việt Nam hợp lệ.", code: "INVALID_NUMBER" });
    return;
  }
  if (typeof tag !== "string" || !tag.trim() || tag.trim().length > 120) {
    res.status(400).json({ error: "Nội dung báo cáo không hợp lệ.", code: "INVALID_REPORT_TAG" });
    return;
  }
  if (typeof deviceToken !== "string" || !/^[a-zA-Z0-9._-]{16,128}$/.test(deviceToken)) {
    res.status(400).json({ error: "Mã thiết bị ẩn danh không hợp lệ.", code: "INVALID_DEVICE_TOKEN" });
    return;
  }

  const brand = findVerifiedBrand(normalizedNumber);
  if (brand) {
    res.status(409).json({
      error: `Số này thuộc danh bạ xác minh ${brand.name}; báo cáo cộng đồng không thể đưa vào danh sách cảnh báo.`,
      code: "VERIFIED_BRAND_SHIELD",
    });
    return;
  }

  const reporterToken = crypto.createHash("sha256").update(deviceToken).digest("hex");
  const createdAt = new Date().toISOString();
  database.exec("BEGIN");
  try {
    const inserted = database.prepare(`
      INSERT INTO community_reports (e164, tag, reporter_token, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(e164, reporter_token) DO NOTHING
    `).run(normalizedNumber, tag.trim(), reporterToken, createdAt).changes > 0;
    const uniqueReportCount = database.prepare(
      "SELECT COUNT(*) AS count FROM community_reports WHERE e164 = ?",
    ).get(normalizedNumber).count;
    const existing = database.prepare(
      "SELECT source, report_count FROM scam_numbers WHERE e164 = ?",
    ).get(normalizedNumber);

    if (uniqueReportCount >= COMMUNITY_WARNING_THRESHOLD) {
      database.prepare(`
        INSERT INTO scam_numbers (e164, tag, source, report_count, updated_at)
        VALUES (?, ?, 'community', ?, ?)
        ON CONFLICT(e164) DO UPDATE SET
          tag = CASE WHEN scam_numbers.source IN ('open-feed', 'community-sync') THEN scam_numbers.tag ELSE excluded.tag END,
          source = CASE
            WHEN scam_numbers.source IN ('open-feed', 'community-sync') THEN scam_numbers.source
            ELSE 'community'
          END,
          report_count = MAX(scam_numbers.report_count, excluded.report_count),
          updated_at = excluded.updated_at
      `).run(normalizedNumber, tag.trim(), uniqueReportCount, createdAt);
    }

    database.exec("COMMIT");
    const consensusReportCount = Math.max(
      uniqueReportCount,
      existing?.source === "community-sync" ? existing.report_count : 0,
    );
    const isHighConfidence = existing?.source === "open-feed" ||
      consensusReportCount >= COMMUNITY_CONFIRMED_THRESHOLD;
    const status = isHighConfidence
      ? "Lừa đảo đã xác thực toàn hệ thống"
      : consensusReportCount >= COMMUNITY_WARNING_THRESHOLD
        ? "Cảnh báo cộng đồng"
        : `Chờ xác minh cộng đồng (${consensusReportCount}/${COMMUNITY_WARNING_THRESHOLD} báo cáo)`;
    res.status(inserted ? 201 : 200).json({
      saved: inserted,
      alreadyReported: !inserted,
      report: {
        e164: normalizedNumber,
        tag: tag.trim(),
        source: uniqueReportCount >= COMMUNITY_WARNING_THRESHOLD ? "community" : null,
        report_count: consensusReportCount,
        updated_at: createdAt,
      },
      communityConsensus: {
        status,
        reportCount: consensusReportCount,
        requiredReports: COMMUNITY_WARNING_THRESHOLD,
        highConfidence: isHighConfidence,
      },
    });
  } catch (error) {
    database.exec("ROLLBACK");
    console.error("Community report error:", error.message);
    res.status(500).json({ error: "Không thể ghi nhận báo cáo cộng đồng.", code: "REPORT_SAVE_FAILED" });
  }
});

app.get("/api/v1/community/feed", (_req, res) => {
  const entries = database.prepare(`
    SELECT s.e164, s.tag, s.source, s.report_count, s.updated_at,
      (SELECT COUNT(*) FROM community_reports AS r WHERE r.e164 = s.e164) AS independent_report_count
    FROM scam_numbers AS s
    WHERE (s.source = 'open-feed' OR
      (s.source = 'community' AND
        (SELECT COUNT(*) FROM community_reports AS r WHERE r.e164 = s.e164) >= ?) OR
      (s.source = 'community-sync' AND s.report_count >= ?))
      AND NOT EXISTS (
          SELECT 1 FROM verified_brand_numbers AS b
          WHERE b.number = CASE
            WHEN substr(s.e164, 1, 3) = '+84' THEN substr(s.e164, 4)
            WHEN substr(s.e164, 1, 1) = '0' THEN substr(s.e164, 2)
            ELSE s.e164
          END
        )
    ORDER BY s.updated_at DESC, s.e164 ASC
  `).all(COMMUNITY_WARNING_THRESHOLD, COMMUNITY_WARNING_THRESHOLD).map((entry) => ({
    e164: entry.e164,
    tag: entry.tag,
    source: entry.source === "community-sync" ? "community" : entry.source,
    reportCount: entry.source === "community" ? entry.independent_report_count : entry.report_count,
    confidence: entry.source === "open-feed" ||
      (entry.source === "community" ? entry.independent_report_count : entry.report_count) >= COMMUNITY_CONFIRMED_THRESHOLD
      ? "high"
      : "community",
    updatedAt: entry.updated_at,
  }));
  const feed = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    publisher: "VN Anti-Scam Guard",
    entries,
  };
  res.json({
    ...feed,
    syncAvailable: COMMUNITY_SYNC_SECRET.length >= 32,
    ...(COMMUNITY_SYNC_SECRET.length >= 32 ? { signature: signCommunityFeed(feed) } : {}),
  });
});

app.post("/api/v1/community/sync", (req, res) => {
  const feed = req.body?.feed || req.body;
  if (COMMUNITY_SYNC_SECRET.length < 32) {
    res.status(503).json({ error: "Máy chủ chưa cấu hình khóa đồng bộ cộng đồng.", code: "SYNC_NOT_CONFIGURED" });
    return;
  }
  if (typeof feed?.signature !== "string" || !/^[a-f0-9]{64}$/i.test(feed.signature)) {
    res.status(401).json({ error: "Dữ liệu đồng bộ thiếu chữ ký xác thực.", code: "INVALID_COMMUNITY_SIGNATURE" });
    return;
  }
  const expectedSignature = Buffer.from(signCommunityFeed(feed), "hex");
  const receivedSignature = Buffer.from(feed.signature, "hex");
  if (expectedSignature.length !== receivedSignature.length ||
    !crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
    res.status(401).json({ error: "Chữ ký dữ liệu cộng đồng không hợp lệ.", code: "INVALID_COMMUNITY_SIGNATURE" });
    return;
  }
  if (!feed || feed.schemaVersion !== 1 || !Array.isArray(feed.entries) || feed.entries.length > 10_000) {
    res.status(400).json({ error: "Tệp đồng bộ không đúng định dạng dữ liệu cộng đồng phiên bản 1.", code: "INVALID_COMMUNITY_FEED" });
    return;
  }

  const entries = [];
  for (const [index, entry] of feed.entries.entries()) {
    const e164 = normalizeVietnameseNumber(entry?.e164);
    const reportCount = entry?.reportCount;
    const source = entry?.source;
    if (!isValidE164(e164) ||
      typeof entry?.tag !== "string" || !entry.tag.trim() || entry.tag.length > 120 ||
      !Number.isSafeInteger(reportCount) || reportCount < 0 ||
      !["community", "open-feed"].includes(source) ||
      (source === "community" && reportCount < COMMUNITY_WARNING_THRESHOLD)) {
      res.status(400).json({ error: `Bản ghi thứ ${index + 1} trong dữ liệu đồng bộ không hợp lệ.`, code: "INVALID_COMMUNITY_ENTRY" });
      return;
    }
    if (!findVerifiedBrand(e164)) {
      entries.push({
        e164,
        tag: entry.tag.trim(),
        source: source === "community" ? "community-sync" : source,
        reportCount: source === "open-feed"
          ? Math.max(reportCount, COMMUNITY_CONFIRMED_THRESHOLD)
          : reportCount,
      });
    }
  }

  const upsert = database.prepare(`
    INSERT INTO scam_numbers (e164, tag, source, report_count, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(e164) DO UPDATE SET
      tag = CASE WHEN scam_numbers.source = 'open-feed' THEN scam_numbers.tag ELSE excluded.tag END,
      source = CASE WHEN scam_numbers.source = 'open-feed' THEN scam_numbers.source ELSE excluded.source END,
      report_count = MAX(scam_numbers.report_count, excluded.report_count),
      updated_at = excluded.updated_at
  `);
  const timestamp = new Date().toISOString();
  database.exec("BEGIN");
  try {
    for (const entry of entries) {
      upsert.run(entry.e164, entry.tag, entry.source, entry.reportCount, timestamp);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    console.error("Community sync error:", error.message);
    res.status(500).json({ error: "Không thể đồng bộ dữ liệu cộng đồng.", code: "COMMUNITY_SYNC_FAILED" });
    return;
  }
  res.json({ synced: entries.length, stats: getStats() });
});

app.post("/api/v1/bulk-scan", async (req, res, next) => {
  const numbers = req.body?.numbers;
  const rawDeviceToken = req.body?.device_token || req.body?.deviceToken;
  const deviceTokenHash = rawDeviceToken === undefined ? "" : hashDeviceToken(rawDeviceToken);
  if (!Array.isArray(numbers) || numbers.length === 0 || numbers.length > 200) {
    res.status(400).json({ error: "Gửi từ 1 đến 200 số điện thoại mỗi lần quét.", code: "INVALID_BATCH" });
    return;
  }
  if (rawDeviceToken !== undefined && !deviceTokenHash) {
    res.status(400).json({ error: "Mã thiết bị ẩn danh không hợp lệ.", code: "INVALID_DEVICE_TOKEN" });
    return;
  }
  const normalized = numbers.map((entry) => {
    const value = typeof entry === "string" ? entry : entry?.e164Number || entry?.number;
    const number = normalizeVietnameseNumber(value);
    if (!number || !isValidE164(number)) return null;
    return {
      e164Number: number,
      localReportsCount: Number.isSafeInteger(entry?.localReportsCount) && entry.localReportsCount >= 0
        ? Math.min(entry.localReportsCount, 10_000)
        : 0,
    };
  });
  const invalid = normalized.findIndex((entry) => !entry);
  if (invalid !== -1) {
    res.status(400).json({ error: `Số thứ ${invalid + 1} không hợp lệ.`, code: "INVALID_NUMBER" });
    return;
  }
  try {
    res.json({ results: await Promise.all(normalized.map((entry) =>
      scanNumber(entry.e164Number, entry.localReportsCount, deviceTokenHash))) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/v1/import-feed", (req, res) => {
  if (!canImportOpenFeed(req)) {
    res.status(401).json({ error: "Cần mã quản trị hợp lệ để nạp nguồn dữ liệu mở.", code: "IMPORT_NOT_AUTHORIZED" });
    return;
  }
  let entries;
  try {
    entries = parseFeed(req.body || {});
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message, code: "INVALID_FEED" });
    return;
  }
  if (entries.length === 0) {
    res.status(400).json({ error: "Danh sách không có số điện thoại hợp lệ.", code: "EMPTY_FEED" });
    return;
  }

  const acceptedEntries = entries.filter((entry) => !findVerifiedBrand(entry.e164));
  const upsert = database.prepare(`
    INSERT INTO scam_numbers (e164, tag, source, report_count, updated_at)
    VALUES (?, ?, 'open-feed', 0, ?)
    ON CONFLICT(e164) DO UPDATE SET
      tag = excluded.tag,
      source = 'open-feed',
      updated_at = excluded.updated_at
  `);
  const timestamp = new Date().toISOString();
  database.exec("BEGIN");
  try {
    for (const entry of acceptedEntries) upsert.run(entry.e164, entry.tag, timestamp);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    res.status(500).json({ error: "Không thể lưu dữ liệu nhập vào cơ sở dữ liệu.", code: "FEED_IMPORT_FAILED" });
    return;
  }
  res.json({
    imported: acceptedEntries.length,
    skippedVerifiedBrands: entries.length - acceptedEntries.length,
    stats: getStats(),
  });
});

function getStats() {
  const brands = database.prepare("SELECT COUNT(*) AS count FROM verified_brands").get().count;
  const blacklisted = database.prepare(`
    SELECT COUNT(*) AS count
    FROM scam_numbers AS s
    WHERE s.source IN ('seed', 'open-feed', 'community-sync') OR
      (s.source = 'community' AND
        (SELECT COUNT(*) FROM community_reports AS r WHERE r.e164 = s.e164) >= ?)
  `).get(COMMUNITY_WARNING_THRESHOLD).count;
  const scans = database.prepare("SELECT COUNT(*) AS count FROM scan_logs").get().count;
  return { verifiedBrands: brands, blacklistedNumbers: blacklisted, totalScans: scans };
}

app.get("/api/v1/stats", (_req, res) => {
  res.json(getStats());
});

app.get(["/api/scan-history", "/api/v1/scan-history"], (req, res) => {
  const deviceTokenHash = hashDeviceToken(req.get("x-device-token"));
  if (!deviceTokenHash) {
    res.status(400).json({ error: "Cần mã thiết bị hợp lệ để xem lịch sử riêng.", code: "INVALID_DEVICE_TOKEN" });
    return;
  }
  const history = database.prepare(`
    SELECT e164_hash, masked_number, carrier, risk_score, risk_level, scanned_at
    FROM scan_logs
    WHERE device_token_hash = ?
    ORDER BY scanned_at DESC, rowid DESC
    LIMIT 15
  `).all(deviceTokenHash).map((entry) => ({
    maskedNumber: entry.masked_number || "Số cũ đã ẩn",
    hashBadge: entry.e164_hash.slice(0, 10),
    carrier: entry.carrier,
    riskScore: entry.risk_score,
    riskLevel: entry.risk_level,
    scannedAt: entry.scanned_at,
  }));
  res.json({ history });
});

app.delete(["/api/scan-history", "/api/v1/scan-history"], (req, res) => {
  const deviceTokenHash = hashDeviceToken(req.get("x-device-token"));
  if (!deviceTokenHash) {
    res.status(400).json({ error: "Cần mã thiết bị hợp lệ để xóa lịch sử riêng.", code: "INVALID_DEVICE_TOKEN" });
    return;
  }
  const result = database.prepare("DELETE FROM scan_logs WHERE device_token_hash = ?").run(deviceTokenHash);
  res.json({ cleared: true, deleted: result.changes });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "VN Anti-Scam Guard", database: "SQLite" });
});

app.use((error, _req, res, _next) => {
  if (error.type === "entity.too.large") {
    res.status(413).json({ error: "Dữ liệu gửi lên vượt quá giới hạn 2 MB.", code: "PAYLOAD_TOO_LARGE" });
    return;
  }
  console.error("API error:", error.message);
  res.status(500).json({ error: "Không thể hoàn tất yêu cầu.", code: "INTERNAL_ERROR" });
});

app.listen(PORT, HOST, () => {
  console.log(`VN Anti-Scam Guard API đang chạy tại http://${HOST}:${PORT}`);
});
