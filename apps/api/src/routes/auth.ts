import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getDb } from "../db";
import { usersTable, sessionsTable } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const REFRESH_COOKIE_NAME = "n2s_refresh";
const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_STATE_MAX_AGE = 10 * 60; // 10 minutes in seconds

function getJwtSecret(): string {
  const s = process.env["JWT_SECRET"];
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

function getJwtRefreshSecret(): string {
  const s = process.env["JWT_REFRESH_SECRET"];
  if (!s) throw new Error("JWT_REFRESH_SECRET is not set");
  return s;
}

function getGoogleClientId(): string {
  const v = process.env["GOOGLE_CLIENT_ID"];
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set");
  return v;
}

function getGoogleClientSecret(): string {
  const v = process.env["GOOGLE_CLIENT_SECRET"];
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return v;
}

function getCallbackUrl(): string {
  return (
    process.env["GOOGLE_CALLBACK_URL"] ??
    "http://localhost:3001/api/v1/auth/google/callback"
  );
}

function getFrontendUrl(): string {
  return process.env["FRONTEND_URL"] ?? "http://localhost:5173";
}

function issueAccessToken(payload: {
  sub: string;
  email: string;
  display_name?: string | null;
}): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, display_name: payload.display_name ?? null },
    getJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

// SHA-256 is deterministic — allows O(1) indexed lookup on sessions.token_hash
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function authRoutes(fastify: FastifyInstance) {
  // GET /api/v1/auth/google — redirect to Google OAuth consent screen
  // FIX-4: generate random state param and store in httpOnly cookie (CSRF protection)
  fastify.get("/google", async (_request, reply) => {
    const state = crypto.randomUUID();

    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: OAUTH_STATE_MAX_AGE,
      path: "/",
    });

    const params = new URLSearchParams({
      client_id: getGoogleClientId(),
      redirect_uri: getCallbackUrl(),
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return reply.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  });

  // GET /api/v1/auth/google/callback — handle OAuth callback
  fastify.get("/google/callback", async (request, reply) => {
    const { code, error: oauthError, state } = request.query as {
      code?: string;
      error?: string;
      state?: string;
    };

    // FIX-4: validate state param against cookie
    const storedState = (request.cookies as Record<string, string | undefined>)[OAUTH_STATE_COOKIE];
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    if (!storedState || !state || state !== storedState) {
      return reply.status(400).send({
        success: false,
        error: { code: "INVALID_STATE", message: "Invalid state parameter" },
      });
    }

    if (oauthError || !code) {
      return reply.redirect(
        `${getFrontendUrl()}/login?error=oauth_denied`
      );
    }

    // Exchange code for tokens
    let googleTokens: {
      access_token: string;
      id_token: string;
    };

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: getGoogleClientId(),
          client_secret: getGoogleClientSecret(),
          redirect_uri: getCallbackUrl(),
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        throw new Error(`Google token exchange failed: ${tokenRes.status}`);
      }

      googleTokens = (await tokenRes.json()) as {
        access_token: string;
        id_token: string;
      };
    } catch (err) {
      fastify.log.error({ err }, "Google token exchange failed");
      return reply.redirect(`${getFrontendUrl()}/login?error=token_exchange`);
    }

    // Fetch user info from Google
    let googleUser: { sub: string; email: string; name?: string };
    try {
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${googleTokens.access_token}` },
        }
      );
      if (!userInfoRes.ok) {
        throw new Error(`Google userinfo failed: ${userInfoRes.status}`);
      }
      googleUser = (await userInfoRes.json()) as {
        sub: string;
        email: string;
        name?: string;
      };
    } catch (err) {
      fastify.log.error({ err }, "Google userinfo fetch failed");
      return reply.redirect(`${getFrontendUrl()}/login?error=userinfo`);
    }

    const db = getDb();

    // Upsert user
    const now = new Date();
    const [user] = await db
      .insert(usersTable)
      .values({
        id: googleUser.sub,
        email: googleUser.email,
        display_name: googleUser.name ?? null,
        region: "US",
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email: googleUser.email,
          display_name: googleUser.name ?? null,
          updated_at: now,
        },
      })
      .returning();

    if (!user) {
      return reply.redirect(`${getFrontendUrl()}/login?error=db_error`);
    }

    // FIX-6: issue refresh token and insert into sessions table (O(1) lookup)
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await db.insert(sessionsTable).values({
      user_id: user.id,
      token_hash: refreshTokenHash,
      expires_at: expiresAt,
    });

    // Set refresh token as httpOnly cookie
    reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000,
      path: "/",
    });

    // FIX-3: do NOT pass access token in the redirect URL.
    // The frontend's AuthCallbackPage will call GET /api/v1/auth/refresh to get the access token.
    // Pass only the user info (non-secret) so the UI can display the name immediately.
    return reply.redirect(
      `${getFrontendUrl()}/auth/callback?user=${encodeURIComponent(JSON.stringify({ id: user.id, email: user.email, display_name: user.display_name ?? null }))}`
    );
  });

  // POST /api/v1/auth/refresh — exchange httpOnly refresh cookie for new access token
  // FIX-5: rotate the refresh token on every use (single-use tokens)
  // FIX-6: O(1) lookup via sessions table
  fastify.post("/refresh", async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "No refresh token" },
      });
    }

    const db = getDb();
    const now = new Date();

    // SHA-256 hash is deterministic — direct O(1) index lookup on token_hash
    const tokenHash = hashToken(refreshToken);
    const [matchedSession] = await db
      .select()
      .from(sessionsTable)
      .where(and(eq(sessionsTable.token_hash, tokenHash), gt(sessionsTable.expires_at, now)));

    if (!matchedSession) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" },
      });
    }

    // Fetch the user
    const [matchedUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, matchedSession.user_id));

    if (!matchedUser) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "User not found" },
      });
    }

    // FIX-5: rotate — delete old session and create a new one
    await db
      .delete(sessionsTable)
      .where(eq(sessionsTable.id, matchedSession.id));

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await db.insert(sessionsTable).values({
      user_id: matchedUser.id,
      token_hash: newRefreshTokenHash,
      expires_at: newExpiresAt,
    });

    reply.setCookie(REFRESH_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      maxAge: REFRESH_TOKEN_EXPIRY_MS / 1000,
      path: "/",
    });

    // Issue new access token
    const accessToken = issueAccessToken({
      sub: matchedUser.id,
      email: matchedUser.email,
      display_name: matchedUser.display_name,
    });

    return reply.send({
      success: true,
      data: {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_EXPIRY,
        user: {
          id: matchedUser.id,
          email: matchedUser.email,
          display_name: matchedUser.display_name ?? null,
        },
      },
    });
  });

  // POST /api/v1/auth/logout — invalidate refresh token
  // FIX-6: delete session row directly (O(1) by hash)
  fastify.post("/logout", async (request, reply) => {
    const refreshToken = (request.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      const db = getDb();
      const tokenHash = hashToken(refreshToken);
      await db.delete(sessionsTable).where(eq(sessionsTable.token_hash, tokenHash));
    }

    reply.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
    return reply.send({ success: true, data: { message: "Logged out" } });
  });
}

