import { prisma } from "@/lib/db";
import {
  badRequest,
  notFound,
  readJsonObject,
  requiredId,
  toErrorResponse,
} from "@/lib/http";
import { dispatchDueNotifications } from "@/lib/notifications/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw badRequest(`${name} 값이 올바르지 않습니다.`);
  }
  return value;
}

function endpointOf(value: unknown): string {
  const endpoint = requiredString(value, "endpoint", 4_096);
  try {
    if (new URL(endpoint).protocol !== "https:") throw new Error();
  } catch {
    throw badRequest("endpoint는 HTTPS Push 주소여야 합니다.");
  }
  return endpoint;
}

function keyOf(value: unknown, name: string): string {
  const key = requiredString(value, name, 512);
  if (!/^[A-Za-z0-9_-]+=*$/.test(key)) {
    throw badRequest(`${name}는 base64url 형식이어야 합니다.`);
  }
  return key;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).searchParams;
    const workerId = requiredId(query.get("workerId"), "workerId");
    const endpoint = endpointOf(query.get("endpoint"));
    const count = await prisma.pushSubscription.count({
      where: { workerId, endpoint },
    });
    return Response.json({ data: { subscribed: count > 0 } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const workerId = requiredId(body.workerId, "workerId");
    const endpoint = endpointOf(body.endpoint);
    const keys =
      typeof body.keys === "object" && body.keys !== null
        ? (body.keys as Record<string, unknown>)
        : {};
    const p256dh = keyOf(keys.p256dh, "p256dh");
    const auth = keyOf(keys.auth, "auth");
    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true },
    });
    if (!worker) throw notFound("알림을 받을 계정을 찾지 못했습니다.");

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        workerId,
        endpoint,
        p256dh,
        auth,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
      update: {
        workerId,
        p256dh,
        auth,
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
    });

    await dispatchDueNotifications({ recipientId: workerId }).catch(
      (error: unknown) => {
        console.error("[notifications] 구독 직후 Push 전달 실패", error);
      },
    );
    return Response.json({ data: { subscribed: true } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const workerId = requiredId(body.workerId, "workerId");
    const endpoint = endpointOf(body.endpoint);
    await prisma.pushSubscription.deleteMany({ where: { workerId, endpoint } });
    return Response.json({ data: { subscribed: false } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
