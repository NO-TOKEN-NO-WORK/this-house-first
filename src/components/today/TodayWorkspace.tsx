"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SubjectDetailView } from "@/components/today/SubjectDetailView";
import {
  applyCheckOutcome,
  detailFromBoard,
  findBoardSubject,
  type CheckOutcome,
} from "@/lib/board/detail";
import type { SubjectDetail } from "@/lib/board/subject";
import type { Board } from "@/lib/board/today";
import type { RiskGrade } from "@/lib/domain";

/**
 * 보드→상세를 같은 문서 안에서 전환한다.
 * Next Link로 상세 URL을 치면 Vercel 왕복을 기다리므로, 보드가 이미 가진 데이터로 화면만 바꾼다.
 * 주소는 pushState로 `/today/[id]`를 맞춰 새로고침·공유가 기존 라우트를 타게 한다.
 */

interface WorkspaceValue {
  openDetail: (subjectId: string) => void;
}

const TodayWorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useTodayWorkspace(): WorkspaceValue | null {
  return useContext(TodayWorkspaceContext);
}

function boardHref(opts: {
  date: string;
  workerId?: string;
  returnGrade?: RiskGrade | null;
}): string {
  const query = new URLSearchParams({ date: opts.date });
  if (opts.workerId) query.set("workerId", opts.workerId);
  if (opts.returnGrade) query.set("grade", String(opts.returnGrade));
  return `/today?${query.toString()}`;
}

function detailHref(
  subjectId: string,
  opts: { date: string; workerId?: string; returnGrade?: RiskGrade | null },
): string {
  const query = new URLSearchParams({ date: opts.date });
  if (opts.workerId) query.set("workerId", opts.workerId);
  if (opts.returnGrade) query.set("grade", String(opts.returnGrade));
  return `/today/${subjectId}?${query.toString()}`;
}

function subjectIdFromPath(pathname: string): string | null {
  const match = /^\/today\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

export function TodayWorkspace({
  board,
  workerId,
  returnGrade,
  children,
}: {
  board: Board;
  workerId?: string;
  returnGrade?: RiskGrade | null;
  children: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [override, setOverride] = useState<SubjectDetail | null>(null);

  const nav = useMemo(
    () => ({ date: board.date, workerId, returnGrade }),
    [board.date, workerId, returnGrade],
  );

  const openDetail = useCallback(
    (subjectId: string) => {
      if (!board.alerted) return;
      if (!findBoardSubject(board, subjectId)) return;
      window.history.pushState(
        { ...(window.history.state ?? {}), todayDetail: true, subjectId },
        "",
        detailHref(subjectId, nav),
      );
      setSelectedId(subjectId);
      setOverride(null);
    },
    [board, nav],
  );

  const closeDetail = useCallback(() => {
    const state = window.history.state as { todayDetail?: boolean } | null;
    if (state?.todayDetail) {
      window.history.back();
      return;
    }
    setSelectedId(null);
    setOverride(null);
    window.history.pushState(window.history.state, "", boardHref(nav));
  }, [nav]);

  useEffect(() => {
    function onPopState() {
      const id = subjectIdFromPath(window.location.pathname);
      setSelectedId(id);
      setOverride(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selected =
    selectedId && board.alerted ? findBoardSubject(board, selectedId) : null;
  const detail =
    override ?? (selected && board.alerted ? detailFromBoard(selected, board) : null);

  function handleRecorded(outcome: CheckOutcome) {
    setOverride((current) => {
      const base =
        current ??
        (selected && board.alerted ? detailFromBoard(selected, board) : null);
      return base ? applyCheckOutcome(base, outcome) : null;
    });
  }

  if (detail) {
    return (
      <SubjectDetailView
        detail={detail}
        backHref={boardHref(nav)}
        onBack={closeDetail}
        onRecorded={handleRecorded}
      />
    );
  }

  return (
    <TodayWorkspaceContext.Provider value={{ openDetail }}>
      {children}
    </TodayWorkspaceContext.Provider>
  );
}
