"use client";

import { useEffect, useRef, useState } from "react";
import {
  PaperclipIcon,
  PhotoIcon,
  XIcon,
} from "@/components/today/icons";
import { VISIT_ATTACHMENT_LABELS, VISIT_PHOTO_MAX } from "@/lib/domain";

/**
 * 방문 기록의 `기록 추가 (선택)` — 사진 최대 5장 + 음성 1개
 * (Figma 164:8300 · 붙인 상태 164:8691).
 *
 * ⚠️ 화면만 있고 저장은 없다. 전화 시트의 음성 첨부(`CallResultSheet`)와 같다 — 고른 파일은
 * 이 화면 안에만 남고 `저장하기`로 서버에 올라가지 않는다. 실제로 저장하려면 저장소·보존
 * 기간·열람 권한을 정하는 ADR이 먼저다 (ADR-0024가 그은 경계는 텍스트 메모까지).
 * 그 사실을 화면에 적지는 않는다 — 디자인에 없는 문구다 (ADR-0014 결과 9).
 *
 * 파일을 서버로 보내지 않으므로 미리보기는 `URL.createObjectURL`로 만든다. 만드는 자리는
 * 렌더가 아니라 change 핸들러다 — 렌더에서 만들면 리렌더마다 새 URL이 새고, 서버 렌더에서는
 * `URL.createObjectURL` 자체가 없다.
 */

interface Photo {
  /** 같은 파일을 두 번 골라도 목록에서 구분되는 키 */
  id: string;
  name: string;
  url: string;
}

/** 상자 하나 — Figma 164:8305는 사진·음성 모두 높이 80px에 같은 테두리다 */
const BOX =
  "flex h-20 w-full items-center justify-center rounded-lg border border-border-soft bg-surface-default px-3";

const EMPTY_LABEL =
  "flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 py-5 text-label-16 text-text-secondary";

export function VisitAttachments({ disabled = false }: { disabled?: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  /*
    화면을 떠날 때 미리보기 URL을 되돌린다. 최신 목록을 ref로 들고 있어야 정리 이펙트가
    `photos`를 의존성으로 잡지 않는다 — 잡으면 사진을 추가할 때마다 살아 있는 URL을 되돌린다.
  */
  const liveUrls = useRef<string[]>([]);
  useEffect(() => {
    liveUrls.current = photos.map((photo) => photo.url);
  }, [photos]);
  useEffect(
    () => () => {
      for (const url of liveUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotos((current) => {
      const room = VISIT_PHOTO_MAX - current.length;
      if (room <= 0) return current;
      const added = Array.from(files)
        .slice(0, room)
        .map((file, index) => ({
          id: `${file.name}-${file.lastModified}-${current.length + index}`,
          name: file.name,
          url: URL.createObjectURL(file),
        }));
      return [...current, ...added];
    });
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((photo) => photo.id !== id);
    });
  }

  const full = photos.length >= VISIT_PHOTO_MAX;

  return (
    <section className="flex flex-col gap-5 pt-3">
      <h2 className="text-heading-18 text-text-subtle">
        {VISIT_ATTACHMENT_LABELS.SECTION}
      </h2>

      <div className="flex flex-col gap-3">
        <div className={BOX}>
          {photos.length === 0 ? (
            <label className={EMPTY_LABEL}>
              <PhotoIcon className="size-4 shrink-0" />
              {VISIT_ATTACHMENT_LABELS.PHOTO_EMPTY}
              <PhotoInput disabled={disabled} onPick={addPhotos} />
            </label>
          ) : (
            <ul className="flex flex-1 items-center justify-center gap-2">
              {photos.map((photo) => (
                <li key={photo.id} className="relative size-[58px] shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기라 next/image의 최적화 파이프라인을 태울 수 없다 */}
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="size-full rounded-[4px] object-cover"
                  />
                  {/*
                    누르는 자리는 44px이되 썸네일(58px) 안에 갇힌다 — 밖으로 넓히면 옆 사진의
                    지우기와 겹쳐 엉뚱한 장이 지워진다 (ADR-0014 접근성).
                  */}
                  <button
                    type="button"
                    aria-label={`${VISIT_ATTACHMENT_LABELS.PHOTO_REMOVE} · ${photo.name}`}
                    disabled={disabled}
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-0 top-0 flex size-11 items-start justify-end p-1"
                  >
                    <span className="flex size-4 items-center justify-center rounded-full bg-surface-default text-icon-secondary">
                      <XIcon className="size-4" />
                    </span>
                  </button>
                </li>
              ))}
              {/* 다섯 장을 채우면 더 고를 자리를 내밀지 않는다 — 문구가 약속한 상한이다 */}
              {!full && (
                <li className="shrink-0">
                  <label className="flex size-11 cursor-pointer items-center justify-center rounded-[4px] border border-border-soft text-icon-secondary">
                    <PhotoIcon className="size-5" />
                    <span className="sr-only">
                      {VISIT_ATTACHMENT_LABELS.PHOTO_EMPTY}
                    </span>
                    <PhotoInput disabled={disabled} onPick={addPhotos} />
                  </label>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className={BOX}>
          {/* 누르는 자리를 상자 폭 전체로 넓힌다 — 아이콘+글자만큼이면 60대 기준에서 좁다 */}
          <label className={EMPTY_LABEL}>
            <PaperclipIcon className="size-4 shrink-0" />
            <span className="min-w-0 break-all">
              {recording ?? VISIT_ATTACHMENT_LABELS.AUDIO_EMPTY}
            </span>
            {/*
              `key`가 파일 이름을 따라간다 — 첨부를 지우면 입력이 새로 붙어 값이 비워진다.
              같은 파일을 다시 골라도 change가 오게 하려면 값이 남아 있으면 안 된다.
            */}
            <input
              key={recording ?? ""}
              type="file"
              accept="audio/*"
              disabled={disabled}
              onChange={(event) =>
                setRecording(event.target.files?.[0]?.name ?? null)
              }
              className="sr-only"
            />
          </label>
          {recording !== null && (
            <button
              type="button"
              aria-label={VISIT_ATTACHMENT_LABELS.AUDIO_REMOVE}
              disabled={disabled}
              onClick={() => setRecording(null)}
              /* 글리프는 Figma대로 작지만 누르는 자리는 44px다 (ADR-0014 접근성) */
              className="flex size-11 shrink-0 items-center justify-center text-icon-secondary"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** 사진 고르기 입력 — 빈 상자와 `+` 칸이 같은 입력을 쓴다 */
function PhotoInput({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (files: FileList | null) => void;
}) {
  return (
    <input
      type="file"
      accept="image/*"
      multiple
      disabled={disabled}
      onChange={(event) => {
        onPick(event.target.files);
        // 같은 사진을 지웠다가 다시 고를 수 있게 값을 비운다 (change는 값이 바뀔 때만 온다)
        event.target.value = "";
      }}
      className="sr-only"
    />
  );
}
