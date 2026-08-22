import type { Board, BoardSubject, RosterSubject } from "../board/today";
import type { HouseholdStatus, RiskGrade } from "../domain";

export interface MapHousehold {
  subjectId: string;
  name: string;
  age: number;
  grade: RiskGrade | null;
  score: number | null;
  status: HouseholdStatus | null;
  statusLabel: string | null;
  open: boolean;
  reasons: string[];
}

export interface MapBuilding {
  buildingId: string;
  address: string;
  roadAddress: string | null;
  lat: number;
  lng: number;
  grade: RiskGrade | null;
  score: number | null;
  households: MapHousehold[];
}

function isBoardSubject(subject: RosterSubject | BoardSubject): subject is BoardSubject {
  return "grade" in subject;
}

export function toMapBuildings(board: Board): MapBuilding[] {
  const subjects: Array<RosterSubject | BoardSubject> = board.alerted
    ? board.groups.flatMap((group) => group.subjects)
    : board.subjects;
  const byBuilding = new Map<string, MapBuilding>();

  for (const subject of subjects) {
    const alerted = isBoardSubject(subject);
    const building = byBuilding.get(subject.buildingId) ?? {
      buildingId: subject.buildingId,
      address: subject.address,
      roadAddress: subject.roadAddress,
      lat: subject.lat,
      lng: subject.lng,
      grade: null,
      score: null,
      households: [],
    };

    building.households.push({
      subjectId: subject.subjectId,
      name: subject.name,
      age: subject.age,
      grade: alerted ? subject.grade : null,
      score: alerted ? subject.score : null,
      status: alerted ? subject.status : null,
      statusLabel: alerted ? subject.statusLabel : null,
      open: alerted ? subject.open : false,
      reasons: alerted ? subject.reasons : [],
    });

    if (alerted) {
      building.grade =
        building.grade === null || subject.grade < building.grade
          ? subject.grade
          : building.grade;
      building.score = Math.max(building.score ?? Number.NEGATIVE_INFINITY, subject.score);
    }
    byBuilding.set(subject.buildingId, building);
  }

  return [...byBuilding.values()];
}
