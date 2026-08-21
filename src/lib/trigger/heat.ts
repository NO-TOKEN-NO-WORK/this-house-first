import { AlertLevel } from "../domain";
import { HEAT_ALERT_THRESHOLD } from "../scoring/weights";

/**
 * 기상청 여름철 체감온도 산식.
 * Ta: 기온(℃), Tw: Stull 추정 습구온도(℃), RH: 상대습도(%).
 * 출처: 기상청 기후통계분석 > 응용기상분석 > 체감온도 (2022.6.2 산식).
 */
export function calculateSummerFeelsLikeTemperature(
  airTemperature: number,
  relativeHumidity: number,
): number {
  const humidity = Math.min(100, Math.max(0, relativeHumidity));
  const wetBulb =
    airTemperature *
      Math.atan(0.151977 * Math.sqrt(humidity + 8.313659)) +
    Math.atan(airTemperature + humidity) -
    Math.atan(humidity - 1.67633) +
    0.00391838 *
      Math.pow(humidity, 1.5) *
      Math.atan(0.023101 * humidity) -
    4.686035;

  const feelsLike =
    -0.2442 +
    0.55399 * wetBulb +
    0.45535 * airTemperature -
    0.0022 * wetBulb ** 2 +
    0.00278 * wetBulb * airTemperature +
    3.0;

  return Math.round(feelsLike * 10) / 10;
}

/**
 * 익일 운영 단계 판정 (PRD F1).
 * 실제 특보의 2일 지속 조건과 별개로, 이 앱은 익일 최고값으로 당일 대응 강도를 정한다.
 */
export function classifyHeatAlert(
  feelsLikeMax: number,
  airTemperatureMax?: number,
): AlertLevel | null {
  if (
    feelsLikeMax >= HEAT_ALERT_THRESHOLD.EMERGENCY_FEELS_LIKE ||
    (airTemperatureMax != null &&
      airTemperatureMax >= HEAT_ALERT_THRESHOLD.EMERGENCY_AIR_TEMPERATURE)
  ) {
    return AlertLevel.EMERGENCY;
  }
  if (feelsLikeMax >= HEAT_ALERT_THRESHOLD.WARNING_FEELS_LIKE) {
    return AlertLevel.WARNING;
  }
  if (feelsLikeMax >= HEAT_ALERT_THRESHOLD.ADVISORY_FEELS_LIKE) {
    return AlertLevel.ADVISORY;
  }
  return null;
}
