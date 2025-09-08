import * as cheerio from 'cheerio';
import { pool } from './database';

interface ScheduleEvent {
	eventId: string;
	eventName: string;
	trackName: string;
	trackId: string;
	eventDate: string;
	raceNumber: number;
	trackType: string;
	trackLength: number;
	location: string;
}

const headers = {
	'User-Agent':
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

export async function scrapeNASCARSchedule(): Promise<void> {
	try {
		console.log('Scraping NASCAR Cup Series schedule...');

		const scheduleData = await Promise.race([
			scrapeNASCARSchedulePage(),
			generateFullSchedule()
		]);

		if (scheduleData.length > 0) {
			await saveScheduleData(scheduleData);

			console.log(`Saved ${scheduleData.length} schedule events`);
		}
	} catch (error) {
		console.error('Error scraping schedule:', error);
	}
}

async function scrapeNASCARSchedulePage(): Promise<ScheduleEvent[]> {
	try {
		const url = 'https://www.nascar.com/cup-series/schedule/';
		const response = await fetch(url, { headers });
		const html = await response.text();
		const $ = cheerio.load(html);

		const events: ScheduleEvent[] = [];

		$('.schedule-table tbody tr, .race-card').each((i, row) => {
			const $row = $(row);

			const eventName = $row.find('.event-name, .race-name').text().trim();
			const trackName = $row.find('.track-name, .venue').text().trim();
			const dateText = $row.find('.date, .race-date').text().trim();

			if (eventName && trackName && dateText) {
				const eventId =
					eventName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_2024';
				const trackId = trackName.toLowerCase().replace(/[^a-z0-9]/g, '_');

				events.push({
					eventDate: parseEventDate(dateText),
					eventId,
					eventName,
					location: getTrackLocation(trackName),
					raceNumber: i + 1,
					trackId,
					trackLength: getTrackLength(trackName),
					trackName,
					trackType: determineTrackType(trackName)
				});
			}
		});

		return events;
	} catch (error) {
		console.error(`Error scraping NASCAR schedule page: ${error}`);

		return [];
	}
}

function generateFullSchedule(): ScheduleEvent[] {
	const schedule: ScheduleEvent[] = [
		{
			eventDate: '2024-02-18',
			eventId: 'daytona_500_2024',
			eventName: 'Daytona 500',
			location: 'Daytona Beach, FL',
			raceNumber: 1,
			trackId: 'daytona',
			trackLength: 2.5,
			trackName: 'Daytona International Speedway',
			trackType: 'superspeedway'
		},
		{
			eventDate: '2024-02-25',
			eventId: 'atlanta_400_2024',
			eventName: 'Ambetter Health 400',
			location: 'Hampton, GA',
			raceNumber: 2,
			trackId: 'atlanta',
			trackLength: 1.54,
			trackName: 'Atlanta Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-03-03',
			eventId: 'las_vegas_400_2024',
			eventName: 'Pennzoil 400',
			location: 'Las Vegas, NV',
			raceNumber: 3,
			trackId: 'las_vegas',
			trackLength: 1.5,
			trackName: 'Las Vegas Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-03-10',
			eventId: 'phoenix_500_2024',
			eventName: 'United Rentals Work United 500',
			location: 'Avondale, AZ',
			raceNumber: 4,
			trackId: 'phoenix',
			trackLength: 1.0,
			trackName: 'Phoenix Raceway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-03-17',
			eventId: 'bristol_500_2024',
			eventName: 'Food City 500',
			location: 'Bristol, TN',
			raceNumber: 5,
			trackId: 'bristol',
			trackLength: 0.533,
			trackName: 'Bristol Motor Speedway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-03-24',
			eventId: 'cota_400_2024',
			eventName: 'EchoPark Texas Grand Prix',
			location: 'Austin, TX',
			raceNumber: 6,
			trackId: 'cota',
			trackLength: 3.41,
			trackName: 'Circuit of the Americas',
			trackType: 'road_course'
		},
		{
			eventDate: '2024-03-31',
			eventId: 'richmond_400_2024',
			eventName: 'Toyota Spring Race Weekend 400',
			location: 'Richmond, VA',
			raceNumber: 7,
			trackId: 'richmond',
			trackLength: 0.75,
			trackName: 'Richmond Raceway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-04-07',
			eventId: 'martinsville_500_2024',
			eventName: 'Blue-Emu Maximum Pain Relief 400',
			location: 'Ridgeway, VA',
			raceNumber: 8,
			trackId: 'martinsville',
			trackLength: 0.526,
			trackName: 'Martinsville Speedway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-04-14',
			eventId: 'texas_500_2024',
			eventName: 'AutoTrader EchoPark Automotive 500',
			location: 'Fort Worth, TX',
			raceNumber: 9,
			trackId: 'texas',
			trackLength: 1.5,
			trackName: 'Texas Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-04-21',
			eventId: 'talladega_500_2024',
			eventName: 'GEICO 500',
			location: 'Lincoln, AL',
			raceNumber: 10,
			trackId: 'talladega',
			trackLength: 2.66,
			trackName: 'Talladega Superspeedway',
			trackType: 'superspeedway'
		},
		{
			eventDate: '2024-04-28',
			eventId: 'dover_400_2024',
			eventName: 'Würth 400',
			location: 'Dover, DE',
			raceNumber: 11,
			trackId: 'dover',
			trackLength: 1.0,
			trackName: 'Dover Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-05-05',
			eventId: 'kansas_400_2024',
			eventName: 'AdventHealth 400',
			location: 'Kansas City, KS',
			raceNumber: 12,
			trackId: 'kansas',
			trackLength: 1.5,
			trackName: 'Kansas Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-05-12',
			eventId: 'darlington_400_2024',
			eventName: 'Goodyear 400',
			location: 'Darlington, SC',
			raceNumber: 13,
			trackId: 'darlington',
			trackLength: 1.366,
			trackName: 'Darlington Raceway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-05-26',
			eventId: 'charlotte_600_2024',
			eventName: 'Coca-Cola 600',
			location: 'Concord, NC',
			raceNumber: 14,
			trackId: 'charlotte',
			trackLength: 1.5,
			trackName: 'Charlotte Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-06-02',
			eventId: 'gateway_400_2024',
			eventName: 'Enjoy Illinois 300',
			location: 'Madison, IL',
			raceNumber: 15,
			trackId: 'gateway',
			trackLength: 1.25,
			trackName: 'World Wide Technology Raceway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-06-09',
			eventId: 'sonoma_400_2024',
			eventName: 'Toyota/Save Mart 350',
			location: 'Sonoma, CA',
			raceNumber: 16,
			trackId: 'sonoma',
			trackLength: 1.99,
			trackName: 'Sonoma Raceway',
			trackType: 'road_course'
		},
		{
			eventDate: '2024-06-16',
			eventId: 'iowa_400_2024',
			eventName: 'Iowa Corn 350',
			location: 'Newton, IA',
			raceNumber: 17,
			trackId: 'iowa',
			trackLength: 0.875,
			trackName: 'Iowa Speedway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-06-23',
			eventId: 'new_hampshire_400_2024',
			eventName: 'USA Today 301',
			location: 'Loudon, NH',
			raceNumber: 18,
			trackId: 'new_hampshire',
			trackLength: 1.058,
			trackName: 'New Hampshire Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-06-30',
			eventId: 'nashville_400_2024',
			eventName: 'Ally 400',
			location: 'Gladeville, TN',
			raceNumber: 19,
			trackId: 'nashville',
			trackLength: 1.33,
			trackName: 'Nashville Superspeedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-07-07',
			eventId: 'chicago_400_2024',
			eventName: 'Grant Park 165',
			location: 'Chicago, IL',
			raceNumber: 20,
			trackId: 'chicago',
			trackLength: 2.2,
			trackName: 'Chicago Street Course',
			trackType: 'road_course'
		},
		{
			eventDate: '2024-07-14',
			eventId: 'pocono_400_2024',
			eventName: 'Great American Getaway 400',
			location: 'Long Pond, PA',
			raceNumber: 21,
			trackId: 'pocono',
			trackLength: 2.5,
			trackName: 'Pocono Raceway',
			trackType: 'superspeedway'
		},
		{
			eventDate: '2024-07-21',
			eventId: 'indianapolis_400_2024',
			eventName: 'Brickyard 400',
			location: 'Speedway, IN',
			raceNumber: 22,
			trackId: 'indianapolis',
			trackLength: 2.5,
			trackName: 'Indianapolis Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-08-11',
			eventId: 'richmond_400_fall_2024',
			eventName: 'Cook Out 400',
			location: 'Richmond, VA',
			raceNumber: 23,
			trackId: 'richmond',
			trackLength: 0.75,
			trackName: 'Richmond Raceway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-08-18',
			eventId: 'michigan_400_2024',
			eventName: 'FireKeepers Casino 400',
			location: 'Brooklyn, MI',
			raceNumber: 24,
			trackId: 'michigan',
			trackLength: 2.0,
			trackName: 'Michigan International Speedway',
			trackType: 'superspeedway'
		},
		{
			eventDate: '2024-08-24',
			eventId: 'daytona_400_2024',
			eventName: 'Coke Zero Sugar 400',
			location: 'Daytona Beach, FL',
			raceNumber: 25,
			trackId: 'daytona',
			trackLength: 2.5,
			trackName: 'Daytona International Speedway',
			trackType: 'superspeedway'
		},
		{
			eventDate: '2024-09-01',
			eventId: 'darlington_500_2024',
			eventName: 'Cook Out Southern 500',
			location: 'Darlington, SC',
			raceNumber: 26,
			trackId: 'darlington',
			trackLength: 1.366,
			trackName: 'Darlington Raceway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-09-08',
			eventId: 'atlanta_400_fall_2024',
			eventName: 'Quaker State 400',
			location: 'Hampton, GA',
			raceNumber: 27,
			trackId: 'atlanta',
			trackLength: 1.54,
			trackName: 'Atlanta Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-09-15',
			eventId: 'watkins_glen_400_2024',
			eventName: 'Go Bowling at The Glen',
			location: 'Watkins Glen, NY',
			raceNumber: 28,
			trackId: 'watkins_glen',
			trackLength: 2.45,
			trackName: 'Watkins Glen International',
			trackType: 'road_course'
		},
		{
			eventDate: '2024-09-21',
			eventId: 'bristol_500_fall_2024',
			eventName: 'Bass Pro Shops Night Race',
			location: 'Bristol, TN',
			raceNumber: 29,
			trackId: 'bristol',
			trackLength: 0.533,
			trackName: 'Bristol Motor Speedway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-09-29',
			eventId: 'kansas_400_fall_2024',
			eventName: 'Hollywood Casino 400',
			location: 'Kansas City, KS',
			raceNumber: 30,
			trackId: 'kansas',
			trackLength: 1.5,
			trackName: 'Kansas Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-10-06',
			eventId: 'talladega_500_fall_2024',
			eventName: 'YellaWood 500',
			location: 'Lincoln, AL',
			raceNumber: 31,
			trackId: 'talladega',
			trackLength: 2.66,
			trackName: 'Talladega Superspeedway',
			trackType: 'superspeedway'
		},
		{
			eventDate: '2024-10-13',
			eventId: 'charlotte_roval_400_2024',
			eventName: 'Bank of America ROVAL 400',
			location: 'Concord, NC',
			raceNumber: 32,
			trackId: 'charlotte_roval',
			trackLength: 2.28,
			trackName: 'Charlotte Motor Speedway ROVAL',
			trackType: 'road_course'
		},
		{
			eventDate: '2024-10-20',
			eventId: 'las_vegas_400_fall_2024',
			eventName: 'South Point 400',
			location: 'Las Vegas, NV',
			raceNumber: 33,
			trackId: 'las_vegas',
			trackLength: 1.5,
			trackName: 'Las Vegas Motor Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-10-27',
			eventId: 'homestead_400_2024',
			eventName: 'Straight Talk Wireless 400',
			location: 'Homestead, FL',
			raceNumber: 34,
			trackId: 'homestead',
			trackLength: 1.5,
			trackName: 'Homestead-Miami Speedway',
			trackType: 'intermediate'
		},
		{
			eventDate: '2024-11-03',
			eventId: 'martinsville_500_fall_2024',
			eventName: 'XFINITY 500',
			location: 'Ridgeway, VA',
			raceNumber: 35,
			trackId: 'martinsville',
			trackLength: 0.526,
			trackName: 'Martinsville Speedway',
			trackType: 'short_track'
		},
		{
			eventDate: '2024-11-10',
			eventId: 'phoenix_championship_2024',
			eventName: 'NASCAR Cup Series Championship',
			location: 'Avondale, AZ',
			raceNumber: 36,
			trackId: 'phoenix',
			trackLength: 1.0,
			trackName: 'Phoenix Raceway',
			trackType: 'short_track'
		}
	];

	return schedule;
}

function parseEventDate(dateText: string): string {
	// Parse various date formats and return YYYY-MM-DD
	const date = new Date(dateText);
	if (!isNaN(date.getTime())) {
		return date.toISOString().split('T')[0] || '2024-01-01';
	}
	return '2024-01-01'; // Fallback
}

function determineTrackType(trackName: string): string {
	const name = trackName.toLowerCase();
	if (
		name.includes('daytona') ||
		name.includes('talladega') ||
		name.includes('michigan') ||
		name.includes('pocono')
	) {
		return 'superspeedway';
	}
	if (
		name.includes('bristol') ||
		name.includes('martinsville') ||
		name.includes('richmond') ||
		name.includes('phoenix') ||
		name.includes('iowa')
	) {
		return 'short_track';
	}
	if (
		name.includes('sonoma') ||
		name.includes('watkins') ||
		name.includes('cota') ||
		name.includes('chicago') ||
		name.includes('roval')
	) {
		return 'road_course';
	}
	return 'intermediate';
}

function getTrackLength(trackName: string): number {
	const lengths: { [key: string]: number } = {
		atlanta: 1.54,
		bristol: 0.533,
		charlotte: 1.5,
		chicago: 2.2,
		cota: 3.41,
		darlington: 1.366,
		daytona: 2.5,
		dover: 1.0,
		gateway: 1.25,
		homestead: 1.5,
		indianapolis: 2.5,
		iowa: 0.875,
		kansas: 1.5,
		'las vegas': 1.5,
		martinsville: 0.526,
		michigan: 2.0,
		nashville: 1.33,
		'new hampshire': 1.058,
		phoenix: 1.0,
		pocono: 2.5,
		richmond: 0.75,
		roval: 2.28,
		sonoma: 1.99,
		talladega: 2.66,
		texas: 1.5,
		'watkins glen': 2.45
	};

	for (const [track, length] of Object.entries(lengths)) {
		if (trackName.toLowerCase().includes(track)) {
			return length;
		}
	}
	return 1.5; // Default intermediate length
}

function getTrackLocation(trackName: string): string {
	const locations: { [key: string]: string } = {
		atlanta: 'Hampton, GA',
		bristol: 'Bristol, TN',
		charlotte: 'Concord, NC',
		chicago: 'Chicago, IL',
		cota: 'Austin, TX',
		darlington: 'Darlington, SC',
		daytona: 'Daytona Beach, FL',
		dover: 'Dover, DE',
		gateway: 'Madison, IL',
		homestead: 'Homestead, FL',
		indianapolis: 'Speedway, IN',
		iowa: 'Newton, IA',
		kansas: 'Kansas City, KS',
		'las vegas': 'Las Vegas, NV',
		martinsville: 'Ridgeway, VA',
		michigan: 'Brooklyn, MI',
		nashville: 'Gladeville, TN',
		'new hampshire': 'Loudon, NH',
		phoenix: 'Avondale, AZ',
		pocono: 'Long Pond, PA',
		richmond: 'Richmond, VA',
		sonoma: 'Sonoma, CA',
		talladega: 'Lincoln, AL',
		texas: 'Fort Worth, TX',
		'watkins glen': 'Watkins Glen, NY'
	};

	for (const [track, location] of Object.entries(locations)) {
		if (trackName.toLowerCase().includes(track)) {
			return location;
		}
	}

	return 'Unknown';
}

async function saveScheduleData(schedule: ScheduleEvent[]): Promise<void> {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		/** Create Cup series if it doesn't exist */
		await client.query(`
      INSERT INTO series (id, name)
      VALUES ('cup', 'NASCAR Cup Series')
      ON CONFLICT (id) DO NOTHING
    `);

		/** Create 2024 season if it doesn't exist */
		const seasonResult = await client.query(`
      INSERT INTO seasons (series_id, year)
      VALUES ('cup', 2024)
      ON CONFLICT (series_id, year) DO NOTHING
      RETURNING id
    `);

		let seasonId: string;
		if (seasonResult.rows.length > 0) {
			seasonId = seasonResult.rows[0].id;
		} else {
			const existingSeason = await client.query(`
        SELECT id FROM seasons WHERE series_id = 'cup' AND year = 2024
      `);
			seasonId = existingSeason.rows[0].id;
		}

		for (const event of schedule) {
			/** Parse location into city and state */
			const [city, state] = event.location.split(', ');

			/** Save track info */
			await client.query(
				`
        INSERT INTO tracks (id, name, city, state, length_miles, type)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = $2, city = $3, state = $4, length_miles = $5, type = $6
      `,
				[
					event.trackId,
					event.trackName,
					city,
					state,
					event.trackLength,
					event.trackType
				]
			);

			/** Save event info */
			await client.query(
				`
        INSERT INTO events (id, season_id, track_id, name, event_date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          season_id = $2, track_id = $3, name = $4, event_date = $5
      `,
				[
					event.eventId,
					seasonId,
					event.trackId,
					event.eventName,
					event.eventDate
				]
			);
		}

		await client.query('COMMIT');

		console.log('Schedule data saved successfully');
	} catch (error) {
		await client.query('ROLLBACK');

		throw error;
	} finally {
		client.release();
	}
}
