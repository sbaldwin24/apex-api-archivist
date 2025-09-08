import { Pool } from 'pg';

export interface QualifyingResult {
  eventId: string;
  driverId: string;
  teamId: string;
  carNumber: string;
  position: number;
  speed?: number;
  timeSeconds?: number;
  round?: number;
}

export interface PracticeResult {
  eventId: string;
  driverId: string;
  teamId: string;
  carNumber: string;
  sessionName: string;
  position?: number;
  bestSpeed?: number;
  bestTimeSeconds?: number;
  lapsCompleted?: number;
}

export interface Caution {
  eventId: string;
  cautionNumber: number;
  startLap: number;
  endLap?: number;
  reason?: string;
  flagState?: string;
}

export interface StageResult {
  eventId: string;
  driverId: string;
  stageNumber: number;
  finishPosition: number;
  pointsEarned?: number;
}

export interface PitStop {
  eventId: string;
  driverId: string;
  lapNumber: number;
  pitTimeSeconds?: number;
  reason?: string;
  positionBefore?: number;
  positionAfter?: number;
}

export interface LapData {
  eventId: string;
  driverId: string;
  lapNumber: number;
  position: number;
  lapTimeSeconds?: number;
  gapToLeaderSeconds?: number;
}

export class RaceDataDatabase {
  constructor(private pool: Pool) {}

  async insertQualifyingResults(results: QualifyingResult[]): Promise<void> {
    const query = `
      INSERT INTO qualifying_results (event_id, driver_id, team_id, car_number, position, speed, time_seconds, round)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (event_id, driver_id, round) DO UPDATE SET
        position = EXCLUDED.position,
        speed = EXCLUDED.speed,
        time_seconds = EXCLUDED.time_seconds
    `;
    
    for (const result of results) {
      await this.pool.query(query, [
        result.eventId, result.driverId, result.teamId, result.carNumber,
        result.position, result.speed, result.timeSeconds, result.round || 1
      ]);
    }
  }

  async insertPracticeResults(results: PracticeResult[]): Promise<void> {
    const query = `
      INSERT INTO practice_results (event_id, driver_id, team_id, car_number, session_name, position, best_speed, best_time_seconds, laps_completed)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    for (const result of results) {
      await this.pool.query(query, [
        result.eventId, result.driverId, result.teamId, result.carNumber,
        result.sessionName, result.position, result.bestSpeed, result.bestTimeSeconds, result.lapsCompleted || 0
      ]);
    }
  }

  async insertCautions(cautions: Caution[]): Promise<void> {
    const query = `
      INSERT INTO cautions (event_id, caution_number, start_lap, end_lap, reason, flag_state)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    for (const caution of cautions) {
      await this.pool.query(query, [
        caution.eventId, caution.cautionNumber, caution.startLap,
        caution.endLap, caution.reason, caution.flagState || 'YELLOW'
      ]);
    }
  }

  async insertStageResults(results: StageResult[]): Promise<void> {
    const query = `
      INSERT INTO stage_results (event_id, driver_id, stage_number, finish_position, points_earned)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (event_id, driver_id, stage_number) DO UPDATE SET
        finish_position = EXCLUDED.finish_position,
        points_earned = EXCLUDED.points_earned
    `;
    
    for (const result of results) {
      await this.pool.query(query, [
        result.eventId, result.driverId, result.stageNumber,
        result.finishPosition, result.pointsEarned || 0
      ]);
    }
  }

  async insertPitStops(pitStops: PitStop[]): Promise<void> {
    const query = `
      INSERT INTO pit_stops (event_id, driver_id, lap_number, pit_time_seconds, reason, position_before, position_after)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    for (const pitStop of pitStops) {
      await this.pool.query(query, [
        pitStop.eventId, pitStop.driverId, pitStop.lapNumber,
        pitStop.pitTimeSeconds, pitStop.reason, pitStop.positionBefore, pitStop.positionAfter
      ]);
    }
  }

  async insertLapData(lapData: LapData[]): Promise<void> {
    const query = `
      INSERT INTO lap_data (event_id, driver_id, lap_number, position, lap_time_seconds, gap_to_leader_seconds)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (event_id, driver_id, lap_number) DO UPDATE SET
        position = EXCLUDED.position,
        lap_time_seconds = EXCLUDED.lap_time_seconds,
        gap_to_leader_seconds = EXCLUDED.gap_to_leader_seconds
    `;
    
    for (const lap of lapData) {
      await this.pool.query(query, [
        lap.eventId, lap.driverId, lap.lapNumber,
        lap.position, lap.lapTimeSeconds, lap.gapToLeaderSeconds
      ]);
    }
  }
}
