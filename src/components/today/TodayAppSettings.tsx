import { InstallPwaBanner } from "@/components/InstallPwaBanner";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { ChevronDownIcon } from "@/components/today/icons";

/**
 * 오늘의 대응이 끝난 뒤 필요할 때만 여는 앱 설정.
 * 설치·알림 요청이 대상자 판단보다 먼저 보이지 않도록 목록의 마지막에 둔다(PRD §9).
 */
export function TodayAppSettings({
  workerId,
  publicKey,
}: {
  workerId?: string;
  publicKey: string;
}) {
  return (
    <details className="group border-t border-border-subtle pt-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-text-primary [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-label-15">앱 설정</span>
          <span className="block text-body-15 text-text-secondary">
            홈 화면 설치 · 푸시 알림
          </span>
        </span>
        <ChevronDownIcon className="size-6 shrink-0 text-icon-secondary group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-3 pt-3">
        <InstallPwaBanner />
        {workerId ? (
          <PushNotificationManager workerId={workerId} publicKey={publicKey} />
        ) : null}
      </div>
    </details>
  );
}
