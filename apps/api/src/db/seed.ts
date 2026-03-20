import "dotenv/config";
import { getDb, schema } from "./index";
import { STREAMING_SERVICES, SUPPORTED_REGIONS } from "@nothing2see/types";
import pino from "pino";

const logger = pino({ name: "seed" });

const REGIONS = [...SUPPORTED_REGIONS];

async function seed() {
  logger.info("Starting database seed...");

  const db = getDb();

  // Upsert streaming services
  for (const service of STREAMING_SERVICES) {
    await db
      .insert(schema.streamingServicesTable)
      .values({
        id: service.id,
        name: service.name,
        logo_url: null,
        supported_regions: REGIONS,
      })
      .onConflictDoUpdate({
        target: schema.streamingServicesTable.id,
        set: {
          name: service.name,
          supported_regions: REGIONS,
          updated_at: new Date(),
        },
      });
    logger.info(`Upserted service: ${service.id}`);
  }

  logger.info("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
