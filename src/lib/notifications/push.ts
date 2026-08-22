import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import webpush, { WebPushError } from "web-push";
import { NotificationType } from "../domain";
import { prisma } from "../db";
import { pushPayload } from "./payload";

const MAX_PUSH_ATTEMPTS = 5;
const CLAIM_TIMEOUT_MS = 5 * 60 * 1_000;

interface DispatchOptions {
  recipientId?: string;
  now?: Date;
  limit?: number;
}

export interface DispatchResult {
  configured: boolean;
  claimed: number;
  sent: number;
  failed: number;
}

function vapidDetails(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "알 수 없는 Push 오류";
  return message.slice(0, 500);
}

/** 만료·해지된 endpoint는 다시 성공하지 않으므로 즉시 구독에서 제거한다. */
function expiredSubscription(error: unknown): boolean {
  return (
    error instanceof WebPushError &&
    (error.statusCode === 404 || error.statusCode === 410)
  );
}

/**
 * availableAt이 지난 미발송 사건을 전달한다. claim은 외부 호출 전에 원자적으로 잡아
 * 수동 트리거와 폴링 발송기가 동시에 실행돼도 같은 Push가 두 번 가지 않게 한다.
 */
export async function dispatchDueNotifications(
  options: DispatchOptions = {},
  client: PrismaClient = prisma,
): Promise<DispatchResult> {
  const details = vapidDetails();
  if (!details) return { configured: false, claimed: 0, sent: 0, failed: 0 };

  const now = options.now ?? new Date();
  const claimExpiredBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const notifications = await client.notification.findMany({
    where: {
      availableAt: { lte: now },
      expiresAt: { gt: now },
      pushSentAt: null,
      pushAttempts: { lt: MAX_PUSH_ATTEMPTS },
      ...(options.recipientId ? { recipientId: options.recipientId } : {}),
      OR: [
        { pushClaimedAt: null },
        { pushClaimedAt: { lt: claimExpiredBefore } },
      ],
    },
    include: { recipient: { include: { pushSubscriptions: true } } },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: options.limit ?? 100,
  });

  let claimed = 0;
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const claim = await client.notification.updateMany({
      where: {
        id: notification.id,
        pushSentAt: null,
        OR: [
          { pushClaimedAt: null },
          { pushClaimedAt: { lt: claimExpiredBefore } },
        ],
      },
      data: { pushClaimedAt: now },
    });
    if (claim.count !== 1) continue;
    claimed += 1;

    const subscriptions = notification.recipient.pushSubscriptions;
    if (subscriptions.length === 0) {
      await client.notification.update({
        where: { id: notification.id },
        data: { pushClaimedAt: null },
      });
      continue;
    }

    const payload = pushPayload(notification);
    const maxTtlSeconds =
      notification.type === NotificationType.VISIT_PROMOTED
        ? 60 * 60
        : 12 * 60 * 60;
    const ttlSeconds = Math.max(
      0,
      Math.min(
        maxTtlSeconds,
        Math.floor((notification.expiresAt.getTime() - now.getTime()) / 1_000),
      ),
    );
    const results = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            {
              vapidDetails: details,
              TTL: ttlSeconds,
              urgency:
                notification.type === NotificationType.VISIT_PROMOTED
                  ? "high"
                  : "normal",
              timeout: 10_000,
            },
          );
          return { ok: true as const, subscriptionId: subscription.id };
        } catch (error) {
          return {
            ok: false as const,
            subscriptionId: subscription.id,
            expired: expiredSubscription(error),
            error,
          };
        }
      }),
    );

    const expiredIds = results
      .filter((result) => !result.ok && result.expired)
      .map(({ subscriptionId }) => subscriptionId);
    if (expiredIds.length > 0) {
      await client.pushSubscription.deleteMany({
        where: { id: { in: expiredIds } },
      });
    }

    if (results.some((result) => result.ok)) {
      await client.notification.update({
        where: { id: notification.id },
        data: {
          pushClaimedAt: null,
          pushSentAt: now,
          pushAttempts: { increment: 1 },
          lastPushError: null,
        },
      });
      sent += 1;
      continue;
    }

    const firstFailure = results.find((result) => !result.ok);
    await client.notification.update({
      where: { id: notification.id },
      data: {
        pushClaimedAt: null,
        pushAttempts: { increment: 1 },
        lastPushError: errorMessage(firstFailure?.error),
      },
    });
    failed += 1;
  }

  return { configured: true, claimed, sent, failed };
}
