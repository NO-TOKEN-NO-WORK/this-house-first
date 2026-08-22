import { NotificationType } from "../domain";

export interface PushPayloadInput {
  eventKey: string;
  type: string;
  title: string;
  body: string;
  href: string;
}

/** Push 본문은 잠금 화면에 노출되므로 저장된 최소 문구와 딥링크만 전달한다. */
export function pushPayload(input: PushPayloadInput): string {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: input.eventKey,
    href: input.href,
    renotify: true,
    urgent: input.type === NotificationType.VISIT_PROMOTED,
  });
}
