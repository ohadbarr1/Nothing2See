import { z } from "zod";

export const MetaSchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  total: z.number().optional(),
  total_pages: z.number().optional(),
});

export type Meta = z.infer<typeof MetaSchema>;

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: MetaSchema.optional(),
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Meta;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
