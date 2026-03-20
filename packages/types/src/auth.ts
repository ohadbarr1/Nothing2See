import { z } from "zod";

export const AuthTokensSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number(), // seconds
});

export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const JwtPayloadSchema = z.object({
  sub: z.string(), // user id
  email: z.string().email(),
  display_name: z.string().nullable().optional(),
  iat: z.number(),
  exp: z.number(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const RefreshRequestSchema = z.object({
  // refresh token is sent via httpOnly cookie — no body field needed
});

export const LogoutRequestSchema = z.object({
  // refresh token is sent via httpOnly cookie — no body field needed
});
