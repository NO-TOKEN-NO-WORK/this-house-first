/** 위험가중 미확인 노출 = Σ(위험점수 × 확인 순번). 낮을수록 먼저 보호한다. */
export function simulateWeightedExposure(scores: readonly number[]) {
  const randomExpected = scores.reduce((sum, score) => sum + score, 0) * ((scores.length + 1) / 2);
  const prioritized = [...scores]
    .sort((a, b) => b - a)
    .reduce((sum, score, index) => sum + score * (index + 1), 0);

  return {
    randomExpected,
    prioritized,
    reductionRate: randomExpected === 0 ? 0 : (randomExpected - prioritized) / randomExpected,
  };
}
