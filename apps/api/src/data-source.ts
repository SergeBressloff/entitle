import { join } from "node:path";
import { DataSource } from "typeorm";

process.loadEnvFile();
const databaseUrl = process.env.DATABASE_URL;

// Fail at startup, not on the first request.
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Add it to apps/api/.env");
}

export default new DataSource({
  type: "postgres",
  url: databaseUrl,
  entities: [join(__dirname, "**/*.entity.{ts,js}")],
  migrations: [join(__dirname, "migrations/*.{ts,js}")],
  synchronize: false,
});
