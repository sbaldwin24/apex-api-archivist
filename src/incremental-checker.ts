import { pool } from './database';

export class IncrementalChecker {
	async raceExists(raceUrl: string): Promise<boolean> {
		try {
			const eventId = this.extractEventId(raceUrl);
			const result = await pool.query('SELECT 1 FROM events WHERE id = $1', [
				eventId
			]);

			return result.rows.length > 0;
		} catch (error) {
			return false;
		}
	}

	async driverStatsExist(driverUrl: string): Promise<boolean> {
		try {
			const driverId = this.extractDriverId(driverUrl);
			const result = await pool.query('SELECT 1 FROM drivers WHERE id = $1', [
				driverId
			]);

			return result.rows.length > 0;
		} catch (error) {
			return false;
		}
	}

	async getLastScrapedRace(year: number): Promise<number> {
		try {
			const result = await pool.query(
				`
				SELECT MAX(CAST(SUBSTRING(e.id FROM '_(\\d{4})$') AS INTEGER)) as last_race
				FROM events e 
				JOIN seasons s ON e.season_id = s.id 
				WHERE s.year = $1
			`,
				[year]
			);

			return result.rows[0]?.last_race || 0;
		} catch (error) {
			return 0;
		}
	}

	async isRaceDataComplete(raceUrl: string): Promise<boolean> {
		try {
			const eventId = this.extractEventId(raceUrl);
			const result = await pool.query(
				`
				SELECT COUNT(*) as result_count 
				FROM race_results 
				WHERE event_id = $1
			`,
				[eventId]
			);

			/** Assume complete if has more than 30 results (typical NASCAR field) */
			return (result.rows[0]?.result_count || 0) > 30;
		} catch (error) {
			return false;
		}
	}

	private extractEventId(raceUrl: string): string {
		const match = raceUrl.match(/race-results\/(\d{4})-(\d{2})\/W\//);

		if (match) {
			const year = match[1];
			const raceNum = match[2];
			return `race_${year}_${raceNum}`;
		}

		return '';
	}

	private extractDriverId(driverUrl: string): string {
		const match = driverUrl.match(/\/driver\/([^/]+)/);

		return match?.[1] || '';
	}
}
