import * as cheerio from 'cheerio';
import type {
	Caution,
	LapData,
	PitStop,
	PracticeResult,
	QualifyingResult,
	RaceDataDatabase,
	StageResult
} from './database-race-data';

export class RaceDataScraper {
	constructor(private db: RaceDataDatabase) {}

	/** Scrape qualifying results from NASCAR.com */
	async scrapeQualifying(
		eventId: string,
		raceId: string
	): Promise<QualifyingResult[]> {
		const url = `https://www.nascar.com/results/${raceId}/qualifying/`;
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		const results: QualifyingResult[] = [];

		$('.results-table tbody tr').each((_, row) => {
			const $row = $(row);
			const position = Number($row.find('.pos').text().trim());
			const carNumber = $row.find('.car-number').text().trim();
			const driverName = $row.find('.driver-name').text().trim();
			const speed = parseFloat($row.find('.speed').text().replace(' mph', ''));
			const time = $row.find('.time').text().trim();

			if (position && carNumber) {
				results.push({
					carNumber,
					driverId: this.normalizeDriverId(driverName),
					eventId,
					position,
					round: 1,
					speed: Number.isNaN(speed) ? undefined : speed,
					teamId: `team_${carNumber}`, // You'll need proper team mapping
					timeSeconds: this.parseTimeToSeconds(time)
				});
			}
		});

		return results;
	}

	/** Scrape practice session results */
	async scrapePractice(
		eventId: string,
		raceId: string,
		sessionName: string
	): Promise<PracticeResult[]> {
		const url = `https://www.nascar.com/results/${raceId}/practice-${sessionName.toLowerCase().replace(' ', '-')}/`;
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		const results: PracticeResult[] = [];

		$('.results-table tbody tr').each((_, row) => {
			const $row = $(row);
			const position = Number($row.find('.pos').text().trim());
			const carNumber = $row.find('.car-number').text().trim();
			const driverName = $row.find('.driver-name').text().trim();
			const bestSpeed = parseFloat(
				$row.find('.best-speed').text().replace(' mph', '')
			);
			const bestTime = $row.find('.best-time').text().trim();
			const laps = Number($row.find('.laps').text().trim());

			if (carNumber) {
				results.push({
					bestSpeed: Number(Number.isNaN(bestSpeed) ? undefined : bestSpeed),
					bestTimeSeconds: this.parseTimeToSeconds(bestTime),
					carNumber,
					driverId: this.normalizeDriverId(driverName),
					eventId,
					lapsCompleted: Number(Number.isNaN(laps) ? 0 : laps),
					position: Number.isNaN(position) ? undefined : position,
					sessionName,
					teamId: `team_${carNumber}`
				});
			}
		});

		return results;
	}

	/** Scrape caution periods from race recap or live timing */
	async scrapeCautions(eventId: string, raceId: string): Promise<Caution[]> {
		const url = `https://www.nascar.com/results/${raceId}/race-results/`;
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		const cautions: Caution[] = [];
		let cautionNumber = 1;

		// Look for caution information in race summary or lap chart
		$('.caution-info, .yellow-flag').each((_, element) => {
			const $el = $(element);
			const text = $el.text();
			const lapMatch = text.match(/Lap (\d+)(?:-(\d+))?/);
			const reasonMatch = text.match(/Reason: (.+)/);

			if (lapMatch) {
				cautions.push({
					cautionNumber: cautionNumber++,
					endLap:
						Number(lapMatch[2] ? Number(lapMatch[2]) : undefined) || undefined,
					eventId,
					flagState: 'YELLOW',
					reason: reasonMatch ? reasonMatch[1] : undefined,
					startLap: Number(lapMatch[1] || '0')
				});
			}
		});

		return cautions;
	}

	/** Scrape stage results */
	async scrapeStageResults(
		eventId: string,
		raceId: string
	): Promise<StageResult[]> {
		const results: StageResult[] = [];

		/** NASCAR typically has 3 stages for most races */
		for (let stage = 1; stage <= 3; stage++) {
			const url = `https://www.nascar.com/results/${raceId}/stage-${stage}/`;
			const response = await fetch(url);
			const html = await response.text();
			const $ = cheerio.load(html);

			$('.results-table tbody tr').each((_, row) => {
				const $row = $(row);
				const position = Number($row.find('.pos').text().trim());
				const carNumber = $row.find('.car-number').text().trim();
				const driverName = $row.find('.driver-name').text().trim();
				const points = Number($row.find('.points').text().trim());

				if (position && carNumber) {
					results.push({
						driverId: this.normalizeDriverId(driverName),
						eventId,
						finishPosition: position,
						pointsEarned: Number(Number.isNaN(points) ? 0 : points),
						stageNumber: stage
					});
				}
			});
		}

		return results;
	}

	/** Scrape pit stop data (often requires live timing API) */
	async scrapePitStops(eventId: string, raceId: string): Promise<PitStop[]> {
		// This typically requires NASCAR's live timing API or Racing Reference
		const url = `https://www.racing-reference.info/race-results/${raceId}/pit-stops/`;
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		const pitStops: PitStop[] = [];

		$('.pit-stop-data tr').each((_, row) => {
			const $row = $(row);
			const carNumber = $row.find('.car').text().trim();
			const driverName = $row.find('.driver').text().trim();
			const lap = Number($row.find('.lap').text().trim());
			const time = parseFloat($row.find('.time').text().trim());
			const reason = $row.find('.reason').text().trim();

			if (carNumber && !Number.isNaN(lap)) {
				pitStops.push({
					driverId: this.normalizeDriverId(driverName),
					eventId,
					lapNumber: lap,
					pitTimeSeconds: Number(Number.isNaN(time) ? undefined : time),
					reason: reason || 'Scheduled'
				});
			}
		});

		return pitStops;
	}

	/** Scrape lap-by-lap data (requires NASCAR's timing API) */
	async scrapeLapData(eventId: string, raceId: string): Promise<LapData[]> {
		// This typically requires NASCAR's live timing feed or Racing Reference
		const url = `https://www.racing-reference.info/race-results/${raceId}/lap-times/`;
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		const lapData: LapData[] = [];

		$('.lap-chart tbody tr').each((_, row) => {
			const $row = $(row);
			const lap = Number($row.find('.lap-number').text().trim());
			const carNumber = $row.find('.car').text().trim();
			const driverName = $row.find('.driver').text().trim();
			const position = Number($row.find('.position').text().trim());
			const lapTime = $row.find('.lap-time').text().trim();
			const gap = $row.find('.gap').text().trim();

			if (!Number.isNaN(lap) && carNumber && !Number.isNaN(position)) {
				lapData.push({
					driverId: this.normalizeDriverId(driverName),
					eventId,
					gapToLeaderSeconds: this.parseGapToSeconds(gap) || undefined,
					lapNumber: lap,
					lapTimeSeconds: this.parseTimeToSeconds(lapTime),
					position
				});
			}
		});

		return lapData;
	}

	/** Utility functions */
	private normalizeDriverId(name: string): string {
		return name
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '_')
			.replace(/_+/g, '_');
	}

	private parseTimeToSeconds(timeStr: string): number | undefined {
		if (!timeStr || timeStr === '--') return undefined;

		const parts = timeStr.split(':');

		if (parts.length === 2) {
			const minutes = Number(parts[0] || '0');
			const seconds = parseFloat(parts[1] || '0');

			return Number(minutes * 60 + seconds);
		}

		const seconds = parseFloat(timeStr);

		return Number(Number.isNaN(seconds)) ? undefined : seconds;
	}

	private parseGapToSeconds(gapStr: string): number | undefined {
		if (!gapStr || gapStr === '--' || gapStr === 'Leader') return undefined;

		if (gapStr.includes('L')) {
			/** Laps down -> convert to approximate seconds (assume 30 seconds per lap) */
			const laps = Number(gapStr.replace('L', ''));

			return Number.isNaN(laps) ? undefined : laps * 30;
		}

		return this.parseTimeToSeconds(gapStr);
	}

	/** Main scraping method for all race data */
	async scrapeAllRaceData(eventId: string, raceId: string): Promise<void> {
		try {
			console.log(`Scraping race data for event: ${eventId}`);

			const [
				qualifying,
				practice1,
				practice2,
				cautions,
				stages,
				pitStops,
				lapData
			] = await Promise.all([
				this.scrapeQualifying(eventId, raceId),
				this.scrapePractice(eventId, raceId, 'Practice 1'),
				this.scrapePractice(eventId, raceId, 'Practice 2'),
				this.scrapeCautions(eventId, raceId),
				this.scrapeStageResults(eventId, raceId),
				this.scrapePitStops(eventId, raceId),
				this.scrapeLapData(eventId, raceId)
			]);

			await Promise.all([
				this.db.insertQualifyingResults(qualifying),
				this.db.insertPracticeResults([...practice1, ...practice2]),
				this.db.insertCautions(cautions),
				this.db.insertStageResults(stages),
				this.db.insertPitStops(pitStops),
				this.db.insertLapData(lapData)
			]);

			console.log(`Completed scraping race data for ${eventId}`);
		} catch (error) {
			console.error(`Error scraping race data for ${eventId}:`, error);
		}
	}
}
