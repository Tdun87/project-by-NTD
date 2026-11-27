const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const database = new DatabaseSync(path.join(__dirname, "antiscam.db"));

database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS scam_numbers (
    e164 TEXT PRIMARY KEY,
    tag TEXT NOT NULL DEFAULT 'Cảnh báo lừa đảo',
    source TEXT NOT NULL DEFAULT 'community',
    report_count INTEGER NOT NULL DEFAULT 0 CHECK(report_count >= 0),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verified_brands (
    number TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verified_brand_numbers (
    number TEXT PRIMARY KEY,
    brand_number TEXT NOT NULL REFERENCES verified_brands(number) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS community_reports (
    e164 TEXT NOT NULL,
    tag TEXT NOT NULL,
    reporter_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(e164, reporter_token)
  );

  CREATE INDEX IF NOT EXISTS idx_community_reports_number
    ON community_reports(e164, created_at);

  CREATE TABLE IF NOT EXISTS scan_logs (
    e164_hash TEXT NOT NULL,
    device_token_hash TEXT NOT NULL DEFAULT '',
    masked_number TEXT NOT NULL DEFAULT '',
    carrier TEXT NOT NULL DEFAULT 'Chưa xác định',
    risk_score INTEGER NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
    risk_level TEXT NOT NULL DEFAULT 'Chưa ghi nhận nhiều dấu hiệu',
    scanned_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_scan_logs_hash_time
    ON scan_logs(e164_hash, scanned_at);
  CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at
    ON scan_logs(scanned_at);
`);

const scanLogColumns = new Set(
  database.prepare("PRAGMA table_info(scan_logs)").all().map((column) => column.name),
);
const scanLogMigrations = [
  ["device_token_hash", "TEXT NOT NULL DEFAULT ''"],
  ["masked_number", "TEXT NOT NULL DEFAULT ''"],
  ["carrier", "TEXT NOT NULL DEFAULT 'Chưa xác định'"],
  ["risk_level", "TEXT NOT NULL DEFAULT 'Chưa ghi nhận nhiều dấu hiệu'"],
];
for (const [column, definition] of scanLogMigrations) {
  if (!scanLogColumns.has(column)) {
    database.exec(`ALTER TABLE scan_logs ADD COLUMN ${column} ${definition}`);
  }
}

const seedBrands = database.prepare(`
  INSERT OR IGNORE INTO verified_brands (number, name, category)
  VALUES (?, ?, ?)
`);
const brands = [
  ["1900545413", "Vietcombank", "Ngân hàng"],
  ["1800588822", "Techcombank", "Ngân hàng"],
  ["1900545436", "MoMo", "Ví điện tử"],
  ["19006036", "GHN", "Vận chuyển"],
];
for (const brand of brands) seedBrands.run(...brand);

const seedBrandNumberAlias = database.prepare(`
  INSERT OR IGNORE INTO verified_brand_numbers (number, brand_number)
  VALUES (?, ?)
`);
const existingBrands = database.prepare("SELECT number FROM verified_brands").all();
for (const { number } of existingBrands) {
  const national = number.startsWith("+84")
    ? number.slice(3)
    : number.startsWith("84") && !number.startsWith("1800") && !number.startsWith("1900")
      ? number.slice(2)
      : number.startsWith("0") && !number.startsWith("1800") && !number.startsWith("1900")
        ? number.slice(1)
        : number;
  const aliases = new Set([number, national, `+84${national}`]);
  if (!national.startsWith("1800") && !national.startsWith("1900")) {
    aliases.add(`0${national}`);
  }
  for (const alias of aliases) seedBrandNumberAlias.run(alias, number);
}

const seedScamNumber = database.prepare(`
  INSERT OR IGNORE INTO scam_numbers (e164, tag, source, report_count, updated_at)
  VALUES (?, ?, 'seed', 0, ?)
`);
const seededAt = new Date().toISOString();
for (const number of ["+842477799999", "+842899988888"]) {
  seedScamNumber.run(number, "Tổng đài ảo / VoIP đã biết", seededAt);
}

module.exports = database;
