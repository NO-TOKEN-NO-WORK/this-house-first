"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CALL_RESULT_LABEL,
  CheckKind,
  VISIT_RESULT_LABEL,
} from "@/lib/domain";

/**
 * 원터치 기록 (PRD F4·§9)
 *
 * 탭 1: [기록하기] → 결과 시트가 열린다
 * 탭 2: 결과 버튼 → 저장. **어떤 기록도 탭 2회 이내**라는 제약이 이 구조의 이유다.
 * 시트에는 한 번에 한 가지 결정(무슨 일이 있었나)만 놓는다.
 */
interface Props {
  subjectId: string;
  name: string;
  kind: CheckKind;
  /** 기록 대상 경보일 "YYYY-MM-DD" */
  date: string;
}

export function RecordButton({ subjectId, name, kind, date }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCall = kind === CheckKind.CALL;
  const options = Object.entries(
    isCall ? CALL_RESULT_LABEL : VISIT_RESULT_LABEL,
  );

  async function record(result: string) {
    setPending(result);
    setError(null);
    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, kind, result, date }),
      });
      const json: { error?: { message?: string } } = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "기록하지 못했습니다.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("연결이 끊겨 기록하지 못했습니다. 다시 눌러 주세요.");
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-14 w-full rounded-2xl bg-zinc-900 px-6 text-xl font-bold text-white active:bg-zinc-700"
      >
        {isCall ? "전화 결과 기록" : "방문 결과 기록"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} ${isCall ? "전화" : "방문"} 결과 기록`}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-6 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-2xl font-bold">{name}</p>
            <p className="mt-1 mb-6 text-center text-lg text-zinc-500">
              {isCall ? "전화 결과를 눌러 주세요" : "방문 결과를 눌러 주세요"}
            </p>

            {error && (
              <p className="mb-4 rounded-xl bg-red-50 p-4 text-lg text-red-700">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {options.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => record(value)}
                  className="min-h-16 rounded-2xl border-2 border-zinc-300 text-2xl font-bold active:bg-zinc-100 disabled:opacity-50"
                >
                  {pending === value ? "기록 중…" : label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 min-h-14 w-full text-xl text-zinc-500"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
