"use client";

import { useEffect, useState } from "react";
import type { SubjectBriefingView } from "@/lib/briefing/types";

interface BriefingState {
  subjectId: string;
  data: SubjectBriefingView | null;
  loaded: boolean;
}

/** API 실패도 빈 브리핑으로 다뤄 대상자 원문 기록 흐름을 막지 않는다 (ADR-0024). */
export function useSubjectBriefing(subjectId: string, enabled = true): {
  briefing: SubjectBriefingView | null;
  loading: boolean;
} {
  const [state, setState] = useState<BriefingState>({
    subjectId: "",
    data: null,
    loaded: false,
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void fetch(`/api/subjects/${encodeURIComponent(subjectId)}/briefing`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          data?: SubjectBriefingView | null;
        };
        return payload.data ?? null;
      })
      .catch(() => null)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ subjectId, data, loaded: true });
        }
      });
    return () => controller.abort();
  }, [enabled, subjectId]);

  const current = state.subjectId === subjectId;
  return {
    briefing: current ? state.data : null,
    loading: enabled && (!current || !state.loaded),
  };
}
