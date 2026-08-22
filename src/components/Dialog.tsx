"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { XIcon } from "@/components/today/icons";

/**
 * 공용 다이얼로그 — 스크림 + 카드 + 닫기.
 * 가운데 카드(Figma ④ 7:2577)와 바텀 시트(⑤ 7:2488)가 같은 컴포넌트다. `placement`만 다르다.
 *
 * 내용은 넣는 쪽이 정한다. 이 컴포넌트가 책임지는 것은 껍데기와 접근성뿐이다:
 * Esc·바깥 클릭으로 닫기, 포커스 가두기·복원, 뒤 배경 스크롤 잠금, `role="dialog"`.
 *
 * 라이브러리를 새로 들이지 않는다 (AGENTS.md 금지 사항 — ADR 없는 라이브러리 도입 금지).
 * `react-dom`의 포털만 쓴다 — `transform`이 걸린 조상 안에 놓여도 스크림이 화면 전체를 덮게 한다.
 */

/** 서버 렌더에서는 구독할 것이 없다 — 아래 `useSyncExternalStore`의 형식상 인자 */
const NO_SUBSCRIBE = () => () => {};

/** 포커스를 받을 수 있는 것들 — Tab 순환을 다이얼로그 안에 가둘 때 쓴다 */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * `center` — 가운데 카드. 오른쪽 위 X로 닫는다 (④)
   * `bottom` — 화면 아래에 붙는 시트. 위쪽 손잡이로 닫는다 (⑤)
   */
  placement?: "center" | "bottom";
  /** 다이얼로그 이름이 될 요소의 id. 없으면 `label`을 쓴다 */
  labelledBy?: string;
  /** `labelledBy`를 줄 수 없을 때의 이름 */
  label?: string;
  /** 닫기 버튼의 스크린리더 이름 */
  closeLabel?: string;
  children: ReactNode;
}

export function Dialog({
  open,
  onClose,
  placement = "center",
  labelledBy,
  label,
  closeLabel = "닫기",
  children,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  /*
   * 포털은 document가 있어야 하므로 서버 렌더에서는 아무것도 내보내지 않는다.
   * 서버 스냅샷 false / 클라이언트 스냅샷 true — 하이드레이션 후 한 번만 켜진다.
   * (effect에서 setState하면 연쇄 렌더가 되어 react-hooks/set-state-in-effect가 막는다)
   */
  const hydrated = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cardRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const card = cardRef.current;
      if (!card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus();
    };
  }, [open, onClose]);

  if (!open || !hydrated) return null;

  const bottom = placement === "bottom";

  return createPortal(
    // 스크림을 누르면 닫는다. 카드 안에서 시작한 드래그가 밖에서 끝나도 닫히지 않게 target을 본다
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-overlay-scrim ${
        bottom ? "items-end" : "items-center px-6"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (label ? titleId : undefined)}
        tabIndex={-1}
        className={`relative w-full overflow-y-auto bg-surface-default outline-none ${
          bottom
            ? "max-h-[85dvh] max-w-[520px] rounded-t-[20px]"
            : "max-h-[calc(100dvh-48px)] max-w-[366px] rounded-[20px]"
        }`}
      >
        {label && !labelledBy && (
          <span id={titleId} className="sr-only">
            {label}
          </span>
        )}
        {bottom ? (
          /*
            Figma(7:2531)의 손잡이는 그림이지만 버튼으로 만든다. 끌어서 닫기를 구현하지 않는 한
            그림만 두면 시트에 보이는 닫기 수단이 없다. 누르는 자리는 44px 높이다(PRD §9).
          */
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="mx-auto flex h-11 w-20 shrink-0 items-start justify-center pt-2.5"
          >
            <span className="h-[3px] w-20 rounded-[10px] bg-surface-placeholder" />
          </button>
        ) : (
          /*
            닫기 글리프는 Figma대로 24px이지만 누르는 자리는 44px로 넓힌다.
            60대 사용자 기준 터치 타깃(PRD §9) — 24px은 오탭이 난다.
          */
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="absolute top-2.5 right-3 flex size-11 items-center justify-center text-icon-default"
          >
            <XIcon className="size-6" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
