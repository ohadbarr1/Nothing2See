import nodemailer from "nodemailer";
import pino from "pino";
import { getDb } from "../db";
import { watchlistNotificationsTable } from "../db/schema";
import { and, eq } from "drizzle-orm";

const logger = pino({ name: "emailService" });

function createTransporter() {
  const host = process.env["SMTP_HOST"];
  const port = parseInt(process.env["SMTP_PORT"] ?? "587", 10);
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !user || !pass) {
    logger.warn("SMTP not configured — email sending disabled");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendWatchlistAvailabilityNotification({
  to,
  userId,
  titleId,
  serviceId,
  titleName,
  serviceName,
  region,
  link,
}: {
  to: string;
  userId: string;
  titleId: number;
  serviceId: string;
  titleName: string;
  serviceName: string;
  region: string;
  link?: string | null;
}): Promise<void> {
  // FIX-2: deduplication — check whether we have already notified this user
  // for this (title, service) combination. If so, skip sending.
  let db;
  try {
    db = getDb();
  } catch {
    logger.warn("DB not available — skipping notification dedup check");
  }

  if (db) {
    const [existing] = await db
      .select({ id: watchlistNotificationsTable.id })
      .from(watchlistNotificationsTable)
      .where(
        and(
          eq(watchlistNotificationsTable.user_id, userId),
          eq(watchlistNotificationsTable.title_id, titleId),
          eq(watchlistNotificationsTable.service_id, serviceId)
        )
      );

    if (existing) {
      logger.info(
        { userId, titleId, serviceId },
        "Skipping duplicate watchlist notification (already sent)"
      );
      return;
    }
  }

  const transporter = createTransporter();
  if (!transporter) return;

  const from = process.env["EMAIL_FROM"] ?? "no-reply@nothing2see.app";

  const linkHtml = link
    ? `<p><a href="${link}" style="color:#6366f1">Watch now on ${serviceName}</a></p>`
    : `<p>Check ${serviceName} in your region (${region}).</p>`;

  // P2: plain-text fallback
  const linkText = link
    ? `Watch now on ${serviceName}: ${link}`
    : `Check ${serviceName} in your region (${region}).`;

  try {
    await transporter.sendMail({
      from,
      to,
      subject: `"${titleName}" is now available on ${serviceName}!`,
      text: [
        "Nothing2See",
        "",
        "Good news! A title on your watchlist just became available:",
        "",
        titleName,
        `Now streaming on ${serviceName} in ${region}.`,
        "",
        linkText,
        "",
        "---",
        "You're receiving this because you added this title to your Nothing2See watchlist.",
      ].join("\n"),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#6366f1">Nothing2See</h2>
          <p>Good news! A title on your watchlist just became available:</p>
          <h3 style="margin:0">${titleName}</h3>
          <p>Now streaming on <strong>${serviceName}</strong> in ${region}.</p>
          ${linkHtml}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="font-size:12px;color:#94a3b8">
            You're receiving this because you added this title to your Nothing2See watchlist.
          </p>
        </div>
      `,
    });

    logger.info({ to, titleName, serviceName }, "Watchlist availability email sent");

    // FIX-2: record that the notification was sent so we don't duplicate
    if (db) {
      try {
        await db.insert(watchlistNotificationsTable).values({
          user_id: userId,
          title_id: titleId,
          service_id: serviceId,
        });
      } catch (insertErr) {
        // The unique constraint protects against races; log but don't throw.
        logger.warn({ insertErr }, "Failed to record notification (possible race)");
      }
    }
  } catch (err) {
    logger.error({ err, to, titleName }, "Failed to send watchlist notification email");
  }
}
