import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { usersTable, userServicesTable } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { UpdateUserSchema, UserServicesSchema } from "@nothing2see/types";

export async function usersRoutes(fastify: FastifyInstance) {
  // GET /api/v1/users/me
  fastify.get("/me", { preHandler: requireAuth }, async (request, reply) => {
    const db = getDb();
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, request.user!.id));

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        region: user.region,
        created_at: user.created_at.toISOString(),
        updated_at: user.updated_at.toISOString(),
      },
    });
  });

  // PATCH /api/v1/users/me
  fastify.patch("/me", { preHandler: requireAuth }, async (request, reply) => {
    const parseResult = UpdateUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request body",
          details: parseResult.error.flatten(),
        },
      });
    }

    const { display_name, region } = parseResult.data;
    const updates: Partial<{ display_name: string; region: string; updated_at: Date }> = {
      updated_at: new Date(),
    };
    if (display_name !== undefined) updates.display_name = display_name;
    if (region !== undefined) updates.region = region;

    const db = getDb();
    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, request.user!.id))
      .returning();

    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "User not found" },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        display_name: updated.display_name,
        region: updated.region,
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      },
    });
  });

  // GET /api/v1/users/me/services
  fastify.get(
    "/me/services",
    { preHandler: requireAuth },
    async (request, reply) => {
      const db = getDb();
      const rows = await db
        .select({ service_id: userServicesTable.service_id })
        .from(userServicesTable)
        .where(eq(userServicesTable.user_id, request.user!.id));

      return reply.send({
        success: true,
        data: rows.map((r) => r.service_id),
      });
    }
  );

  // PUT /api/v1/users/me/services
  fastify.put(
    "/me/services",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parseResult = UserServicesSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: parseResult.error.flatten(),
          },
        });
      }

      const { service_slugs } = parseResult.data;
      const userId = request.user!.id;
      const db = getDb();

      // Replace all services: delete existing then insert new
      await db
        .delete(userServicesTable)
        .where(eq(userServicesTable.user_id, userId));

      if (service_slugs.length > 0) {
        await db.insert(userServicesTable).values(
          service_slugs.map((slug) => ({ user_id: userId, service_id: slug }))
        );
      }

      return reply.send({
        success: true,
        data: service_slugs,
      });
    }
  );
}
