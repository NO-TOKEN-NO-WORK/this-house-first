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

  it("시·군·구가 앞에 없는 도로명·지번·동호수도 지운다 — 메모에는 이쪽이 더 흔하다", () => {
    for (const memo of [
      "행복동 중앙로 12-3에서 만났다.",
      "비산동 1번지 옆집이라고 했다.",
      "3동 402호에 사신다.",
    ]) {
      expect(maskBriefingMemo(memo, [])).toContain("[주소 가림]");
    }
  });

  it("전화번호를 지운다 — 119는 남긴다(응급 연계 사실이 뜻을 가진다)", () => {
    expect(maskBriefingMemo("연락은 010-0000-0115로 하면 된다고 했다.", [])).toBe(
      "연락은 [전화 가림]로 하면 된다고 했다.",
    );
    expect(maskBriefingMemo("119를 불러 이송했다.", [])).toBe(
      "119를 불러 이송했다.",
    );
  });

  it("호칭이 붙은 이름은 띄어써도 지우고 호칭은 남긴다 — 사람 이야기임은 남아야 한다", () => {
    expect(maskBriefingMemo("박영희 님이 직접 받으셨다.", [])).toBe(
      "[이름 가림] 님이 직접 받으셨다.",
    );
    expect(maskBriefingMemo("박영희님이 받으셨다.", [])).toBe(
      "[이름 가림]님이 받으셨다.",
    );
    expect(maskBriefingMemo("김씨 아저씨가 도왔다.", [])).toBe(
      "[이름 가림]씨 아저씨가 도왔다.",
    );
  });

  it("가족 관계어는 지우지 않는다 — 누가 들르는가가 브리핑이 뽑아야 할 맥락이다", () => {
    for (const memo of [
      "부산 사는 따님 이야기를 오래 하셨다.",
      "며느님이 낮에 들른다고 했다.",
      "이 어르신은 귀가 어둡다.",
    ]) {
      expect(maskBriefingMemo(memo, [])).toBe(memo);
    }
  });

  it("맥락에 필요한 말은 남긴다 — 지우는 것은 식별자뿐이다", () => {
    const context = "새벽 5시에 밭에 나갔다 오신다고 했다.";
    expect(maskBriefingMemo(context, [])).toBe(context);
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
