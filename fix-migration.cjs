// 用 prisma 執行原生 SQL 清理 failed migration
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.$executeRawUnsafe("DELETE FROM _prisma_migrations WHERE migration_name LIKE '%schedule_v2%'");
  const rows = await prisma.$queryRawUnsafe('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations');
  console.log('migrations:', JSON.stringify(rows));
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });