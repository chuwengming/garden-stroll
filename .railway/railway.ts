// .railway/railway.ts — 專案結構參考（目前僅供文件用途）
// 注意：Railway TypeScript SDK（railway/iac）尚未安裝，此檔不會被執行。
// 實際設定以 Railway 後台為準；勿執行 railway config apply 以免覆蓋現有設定。
//
// 實際專案結構（Line Reservation / production）：
//   - service: web-garden  → GitHub chuwengming/garden-stroll (main)
//       start: prisma migrate deploy && npm start（railway.toml）
//       網域: https://web-garden-production.up.railway.app
//   - service: cron-retention → GitHub chuwengming/garden-stroll (main)
//       startCommand: node scripts/retention-cron.mjs（cronSchedule: "0 0 * * *"，每天 00:00 UTC）
//       DATABASE_URL: 參照 MySQL-bGKw
//   - database: MySQL-bGKw（花園漫步專用，含 volume）
//   - database: MySQL（我的自然生活用）
//   - service: web  → GitHub chuwengming/mynaturelife (master)（我的自然生活）

export default {};
