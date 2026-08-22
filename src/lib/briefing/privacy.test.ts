import { describe, expect, it } from "vitest";
import { maskBriefingMemo, toBriefingModelEvents } from "./privacy";

describe("맥락 브리핑 개인정보 마스킹", () => {
  it("이름·전화·주소·기관 고유명을 외부 입력에서 제거한다", () => {
    const memo =
      "김덕화님이 010-2345-1938로 연락했고 전북특별자치도 남원시 행복동 중앙로 12-3의 행복복지관에 가기로 했다.";

    const masked = maskBriefingMemo(memo, [
      "김덕화",
      "010-2345-1938",
      "전북특별자치도 남원시 행복동 중앙로 12-3",
      "행복복지관",
    ]);

    expect(masked).not.toContain("김덕화");
    expect(masked).not.toContain("010-2345-1938");
    expect(masked).not.toContain("중앙로 12-3");
    expect(masked).not.toContain("행복복지관");
  });

  it("기관은 고유명만 버리고 유형은 남긴다 — 어디에 다녀오셨는지가 생활 맥락이다", () => {
    expect(maskBriefingMemo("행복동주민센터 무더위쉼터를 안내했다.", [])).toBe(
      "주민센터 무더위쉼터를 안내했다.",
    );
    expect(maskBriefingMemo("동네병원에 다녀오셨다고 했다.", [])).toBe(
      "병원에 다녀오셨다고 했다.",
    );
  });

  it("실제 CheckEvent id 대신 호출별 임시 별칭을 만든다", () => {
    const { events, sourceIdByAlias } = toBriefingModelEvents(
      [{
        id: "database-check-event",
        subjectId: "database-subject",
        date: "2026-08-19",
        kind: "전화",
        result: "괜찮았어요",
        memo: "무릎이 불편하다고 했다.",
      }],
      [],
    );

    expect(events[0]?.sourceCheckEventId).toBe("event-1");
    expect(JSON.stringify(events)).not.toContain("database-check-event");
    expect(JSON.stringify(events)).not.toContain("database-subject");
    expect(sourceIdByAlias.get("event-1")).toBe("database-check-event");
  });
});
