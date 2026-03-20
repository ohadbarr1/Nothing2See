import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({ err: error, url: request.url }, "Request error");

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: error.flatten(),
      },
    });
  }

  // Fastify validation errors (schema validation)
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
        details: error.validation,
      },
    });
  }

  // Not found
  if (error.statusCode === 404) {
    return reply.status(404).send({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: error.message || "Resource not found",
      },
    });
  }

  // Generic server error
  const statusCode = error.statusCode ?? 500;
  return reply.status(statusCode).send({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message:
        process.env["NODE_ENV"] === "production"
          ? "An unexpected error occurred"
          : error.message,
    },
  });
}
