import { dispatchDueNotifications } from "@/lib/notifications/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function dispatch(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "발송 권한이 없습니다." } },
      { status: 401 },
    );
  }
  const result = await dispatchDueNotifications();
  return Response.json({ data: result });
}

/** 오전 8시 스케줄러는 GET, 운영자 수동 재시도는 POST로 같은 발송기를 호출한다. */
export const GET = dispatch;
export const POST = dispatch;
