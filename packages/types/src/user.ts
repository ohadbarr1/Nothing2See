import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  display_name: z.string().nullable().optional(),
  region: z.string().default("US"),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const UpdateUserSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  region: z.string().min(2).max(10).optional(),
});

export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const UserServicesSchema = z.object({
  service_slugs: z.array(z.string()).min(0),
});

export type UserServices = z.infer<typeof UserServicesSchema>;
