import type { FastifyInstance } from "fastify";
import { STREAMING_SERVICES, SUPPORTED_REGIONS } from "@nothing2see/types";

export async function servicesRoutes(fastify: FastifyInstance) {
  // GET /api/v1/services
  fastify.get("/", async (_request, reply) => {
    const services = STREAMING_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      logo_url: null,
      supported_regions: [...SUPPORTED_REGIONS],
    }));

    return reply.send({
      success: true,
      data: services,
    });
  });
}
