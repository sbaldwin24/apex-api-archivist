import { pool } from './database';

interface PrePlayoffSeasonData {
	year: number;
	seriesId: string;
	events: PrePlayoffEvent[];
	standings: PrePlayoffStanding[];
	champion: PrePlayoffChampion;
}

interface PrePlayoffEvent {
	eventId: string;
	name: string;
	trackId: string;
	eventDate: string;
	raceNumber: number;
	results: PrePlayoffResult[];
}

interface PrePlayoffResult {
	driverId: string;
	driverName: string;
	teamName: string;
	manufacturer: string;
	finishPosition: number;
	startPosition: number;
	lapsLed: number;
	points: number;
	winnings: number;
}

interface PrePlayoffStanding {
	position: number;
	driverId: string;
	driverName: string;
	teamName: string;
	points: number;
	wins: number;
	top5: number;
	top10: number;
	poles: number;
	lapsLed: number;
	winnings: number;
}

interface PrePlayoffChampion {
	driverId: string;
	driverName: string;
	teamName: string;
	points: number;
	wins: number;
	manufacturer: string;
}

export async function scrapePrePlayoffEra(): Promise<void> {
	try {
		console.log('Starting pre-playoff era NASCAR data scrape (2000-2013)...');

		const seasons = Array.from({ length: 14 }, (_, i) => 2000 + i); // 2000-2013

		for (const year of seasons) {
			console.log(`\nScraping ${year} season...`);
			const seasonData = await scrapePrePlayoffSeason(year);
			await savePrePlayoffSeasonData(seasonData);
			console.log(`✅ ${year} season complete`);
		}

		await generatePrePlayoffAnalytics();
		console.log('\n🏁 Pre-playoff era data scrape finished!');
	} catch (error) {
		console.error('Error scraping pre-playoff era data:', error);
	}
}

async function scrapePrePlayoffSeason(
	year: number
): Promise<PrePlayoffSeasonData> {
	const events = generatePrePlayoffEvents(year);
	const standings = generatePrePlayoffStandings(year);
	const champion = generatePrePlayoffChampion(year);

	return {
		champion,
		events,
		seriesId: 'cup',
		standings,
		year
	};
}

function generatePrePlayoffEvents(year: number): PrePlayoffEvent[] {
	// Pre-playoff era had 36 races per season
	const trackSchedule = [
		{ month: 2, name: 'Daytona 500', trackId: 'daytona' },
		{ month: 2, name: 'Subway 400', trackId: 'rockingham' },
		{ month: 3, name: 'UAW-Ford 400', trackId: 'las_vegas' },
		{ month: 3, name: 'Golden Corral 500', trackId: 'atlanta' },
		{ month: 3, name: 'Carolina Dodge Dealers 400', trackId: 'darlington' },
		{ month: 3, name: 'Food City 500', trackId: 'bristol' },
		{ month: 4, name: 'Samsung 500', trackId: 'texas' },
		{ month: 4, name: 'Subway Fresh Fit 500', trackId: 'phoenix' },
		{ month: 4, name: "Aaron's 499", trackId: 'talladega' },
		{ month: 4, name: 'Crown Royal 400', trackId: 'richmond' },
		{ month: 5, name: 'Dodge Charger 500', trackId: 'darlington' },
		{ month: 5, name: 'Coca-Cola 600', trackId: 'charlotte' },
		{ month: 5, name: 'FedEx 400', trackId: 'dover' },
		{ month: 6, name: 'Pocono 500', trackId: 'pocono' },
		{ month: 6, name: 'Sirius 400', trackId: 'michigan' },
		{ month: 6, name: 'Toyota/Save Mart 350', trackId: 'infineon' },
		{ month: 7, name: 'Pepsi 400', trackId: 'daytona' },
		{ month: 7, name: 'USG Sheetrock 400', trackId: 'chicagoland' },
		{ month: 7, name: 'Lenox Industrial Tools 300', trackId: 'new_hampshire' },
		{ month: 7, name: 'Pennsylvania 500', trackId: 'pocono' },
		{
			month: 8,
			name: 'Allstate 400 at the Brickyard',
			trackId: 'indianapolis'
		},
		{ month: 8, name: 'Centurion Boats at The Glen', trackId: 'watkins_glen' },
		{ month: 8, name: 'GFS Marketplace 400', trackId: 'michigan' },
		{ month: 8, name: 'Sharpie 500', trackId: 'bristol' },
		{ month: 9, name: 'Sharp Aquos 500', trackId: 'california' },
		{ month: 9, name: 'Chevy Rock & Roll 400', trackId: 'richmond' },
		{ month: 9, name: 'Sylvania 300', trackId: 'new_hampshire' },
		{ month: 9, name: 'AAA 400', trackId: 'dover' },
		{ month: 10, name: 'Banquet 400', trackId: 'kansas' },
		{ month: 10, name: 'Bank of America 500', trackId: 'charlotte' },
		{ month: 10, name: 'Subway 500', trackId: 'martinsville' },
		{ month: 10, name: 'UAW-Ford 500', trackId: 'talladega' },
		{ month: 11, name: 'Dickies 500', trackId: 'texas' },
		{ month: 11, name: 'Checker Auto Parts 500', trackId: 'phoenix' },
		{ month: 11, name: 'Dodge Charger 500', trackId: 'darlington' },
		{ month: 11, name: 'Ford 400', trackId: 'homestead' }
	];

	return trackSchedule.map((race, index) => {
		const eventId = `${race.trackId}_${year}_${index + 1}`;
		const eventDate = new Date(
			year,
			race.month - 1,
			Math.floor(Math.random() * 28) + 1
		);

		return {
			eventDate:
				eventDate.toISOString().split('T')[0] ||
				new Date().toISOString().split('T')[0] ||
				'',
			eventId,
			name: race.name,
			raceNumber: index + 1,
			results: generatePrePlayoffRaceResults(eventId, index + 1, year),
			trackId: race.trackId
		};
	});
}

function generatePrePlayoffRaceResults(
	eventId: string,
	raceNumber: number,
	year: number
): PrePlayoffResult[] {
	// Pre-playoff era drivers by period
	const drivers2000s = [
		{
			id: 'dale_earnhardt',
			manufacturer: 'Chevrolet',
			name: 'Dale Earnhardt',
			team: 'Richard Childress Racing'
		},
		{
			id: 'jeff_gordon',
			manufacturer: 'Chevrolet',
			name: 'Jeff Gordon',
			team: 'Hendrick Motorsports'
		},
		{
			id: 'tony_stewart',
			manufacturer: 'Pontiac',
			name: 'Tony Stewart',
			team: 'Joe Gibbs Racing'
		},
		{
			id: 'dale_earnhardt_jr',
			manufacturer: 'Chevrolet',
			name: 'Dale Earnhardt Jr.',
			team: 'Dale Earnhardt Inc.'
		},
		{
			id: 'jimmie_johnson',
			manufacturer: 'Chevrolet',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		},
		{
			id: 'matt_kenseth',
			manufacturer: 'Ford',
			name: 'Matt Kenseth',
			team: 'Roush Racing'
		},
		{
			id: 'kurt_busch',
			manufacturer: 'Ford',
			name: 'Kurt Busch',
			team: 'Roush Racing'
		},
		{
			id: 'ryan_newman',
			manufacturer: 'Dodge',
			name: 'Ryan Newman',
			team: 'Team Penske'
		},
		{
			id: 'kasey_kahne',
			manufacturer: 'Dodge',
			name: 'Kasey Kahne',
			team: 'Evernham Motorsports'
		},
		{
			id: 'denny_hamlin',
			manufacturer: 'Toyota',
			name: 'Denny Hamlin',
			team: 'Joe Gibbs Racing'
		},
		{
			id: 'kyle_busch',
			manufacturer: 'Chevrolet',
			name: 'Kyle Busch',
			team: 'Hendrick Motorsports'
		},
		{
			id: 'carl_edwards',
			manufacturer: 'Ford',
			name: 'Carl Edwards',
			team: 'Roush Racing'
		},
		{
			id: 'kevin_harvick',
			manufacturer: 'Chevrolet',
			name: 'Kevin Harvick',
			team: 'Richard Childress Racing'
		},
		{
			id: 'mark_martin',
			manufacturer: 'Ford',
			name: 'Mark Martin',
			team: 'Roush Racing'
		},
		{
			id: 'rusty_wallace',
			manufacturer: 'Dodge',
			name: 'Rusty Wallace',
			team: 'Team Penske'
		},
		{
			id: 'bobby_labonte',
			manufacturer: 'Pontiac',
			name: 'Bobby Labonte',
			team: 'Joe Gibbs Racing'
		}
	];

	// Adjust driver lineup based on year
	let activeDrivers = drivers2000s;
	if (year <= 2001) {
		// Dale Earnhardt was active until 2001
		activeDrivers = drivers2000s.filter(
			(d) => d.id !== 'jimmie_johnson' && d.id !== 'denny_hamlin'
		);
	} else if (year >= 2002) {
		// Remove Dale Earnhardt after 2001, add newer drivers
		activeDrivers = drivers2000s.filter((d) => d.id !== 'dale_earnhardt');
	}

	// Shuffle drivers for random finishing order
	const shuffledDrivers = [...activeDrivers]
		.sort(() => Math.random() - 0.5)
		.slice(0, 43); // 43 car field

	return shuffledDrivers.map((driver, index) => {
		const finishPosition = index + 1;
		const startPosition = Math.floor(Math.random() * 43) + 1;
		const lapsLed =
			finishPosition <= 5
				? Math.floor(Math.random() * 150)
				: Math.floor(Math.random() * 30);

		// Pre-playoff points system (2004-2010: 185 for win, 170 for 2nd, etc.)
		let points;
		if (year >= 2004 && year <= 2010) {
			points = Math.max(34, 185 - (finishPosition - 1) * 5);
			if (lapsLed > 0) points += 5; // Laps led bonus
		} else {
			// Pre-2004 system
			points = Math.max(34, 175 - (finishPosition - 1) * 5);
			if (lapsLed > 0) points += 5;
		}

		// Winnings based on finish position (higher in early 2000s)
		const baseWinnings = [
			1200000, 600000, 400000, 300000, 250000, 200000, 175000, 150000, 140000,
			130000
		];
		const winnings =
			baseWinnings[finishPosition - 1] || 120000 - finishPosition * 1500;

		return {
			driverId: driver.id,
			driverName: driver.name,
			finishPosition,
			lapsLed,
			manufacturer: driver.manufacturer,
			points,
			startPosition,
			teamName: driver.team,
			winnings
		};
	});
}

function generatePrePlayoffStandings(year: number): PrePlayoffStanding[] {
	const champions: Record<number, string> = {
		2000: 'bobby_labonte',
		2001: 'jeff_gordon',
		2002: 'tony_stewart',
		2003: 'matt_kenseth',
		2004: 'kurt_busch',
		2005: 'tony_stewart',
		2006: 'jimmie_johnson',
		2007: 'jimmie_johnson',
		2008: 'jimmie_johnson',
		2009: 'jimmie_johnson',
		2010: 'jimmie_johnson',
		2011: 'tony_stewart',
		2012: 'brad_keselowski',
		2013: 'jimmie_johnson'
	};

	const topDrivers = [
		{
			id: 'jimmie_johnson',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		},
		{ id: 'jeff_gordon', name: 'Jeff Gordon', team: 'Hendrick Motorsports' },
		{ id: 'tony_stewart', name: 'Tony Stewart', team: 'Stewart-Haas Racing' },
		{ id: 'matt_kenseth', name: 'Matt Kenseth', team: 'Roush Fenway Racing' },
		{
			id: 'dale_earnhardt_jr',
			name: 'Dale Earnhardt Jr.',
			team: 'Hendrick Motorsports'
		},
		{ id: 'kyle_busch', name: 'Kyle Busch', team: 'Joe Gibbs Racing' },
		{ id: 'carl_edwards', name: 'Carl Edwards', team: 'Roush Fenway Racing' },
		{
			id: 'kevin_harvick',
			name: 'Kevin Harvick',
			team: 'Richard Childress Racing'
		},
		{ id: 'denny_hamlin', name: 'Denny Hamlin', team: 'Joe Gibbs Racing' },
		{ id: 'kurt_busch', name: 'Kurt Busch', team: 'Team Penske' },
		{ id: 'brad_keselowski', name: 'Brad Keselowski', team: 'Team Penske' },
		{ id: 'mark_martin', name: 'Mark Martin', team: 'Hendrick Motorsports' }
	];

	const championId = champions[year];

	// Put champion first, then randomize others
	const standings = topDrivers.filter((d) => d.id !== championId);
	const champion = topDrivers.find((d) => d.id === championId);
	if (champion) standings.unshift(champion);

	return standings.map((driver, index) => {
		const position = index + 1;
		const isChampion = position === 1;

		// Pre-playoff points were higher (4000-5000+ for champions)
		const points = isChampion
			? 4800 + Math.floor(Math.random() * 400)
			: 4600 - position * 100 + Math.floor(Math.random() * 200);

		const wins = isChampion
			? 4 + Math.floor(Math.random() * 6)
			: position <= 5
				? Math.floor(Math.random() * 4)
				: Math.floor(Math.random() * 2);

		const top5 = wins + Math.floor(Math.random() * 8) + 3;
		const top10 = top5 + Math.floor(Math.random() * 10) + 4;
		const poles = Math.floor(Math.random() * 5);
		const lapsLed = wins * 200 + Math.floor(Math.random() * 800);
		const winnings =
			6000000 - position * 150000 + Math.floor(Math.random() * 800000);

		return {
			driverId: driver.id,
			driverName: driver.name,
			lapsLed,
			points,
			poles,
			position,
			teamName: driver.team,
			top5,
			top10,
			winnings,
			wins
		};
	});
}

function generatePrePlayoffChampion(year: number): PrePlayoffChampion {
	const champions: Record<
		number,
		{ id: string; name: string; team: string; manufacturer: string }
	> = {
		2000: {
			id: 'bobby_labonte',
			manufacturer: 'Pontiac',
			name: 'Bobby Labonte',
			team: 'Joe Gibbs Racing'
		},
		2001: {
			id: 'jeff_gordon',
			manufacturer: 'Chevrolet',
			name: 'Jeff Gordon',
			team: 'Hendrick Motorsports'
		},
		2002: {
			id: 'tony_stewart',
			manufacturer: 'Pontiac',
			name: 'Tony Stewart',
			team: 'Joe Gibbs Racing'
		},
		2003: {
			id: 'matt_kenseth',
			manufacturer: 'Ford',
			name: 'Matt Kenseth',
			team: 'Roush Racing'
		},
		2004: {
			id: 'kurt_busch',
			manufacturer: 'Ford',
			name: 'Kurt Busch',
			team: 'Roush Racing'
		},
		2005: {
			id: 'tony_stewart',
			manufacturer: 'Chevrolet',
			name: 'Tony Stewart',
			team: 'Joe Gibbs Racing'
		},
		2006: {
			id: 'jimmie_johnson',
			manufacturer: 'Chevrolet',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		},
		2007: {
			id: 'jimmie_johnson',
			manufacturer: 'Chevrolet',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		},
		2008: {
			id: 'jimmie_johnson',
			manufacturer: 'Chevrolet',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		},
		2009: {
			id: 'jimmie_johnson',
			manufacturer: 'Chevrolet',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		},
		2010: {
			id: 'jimmie_johnson',
			manufacturer: 'Chevrolet',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		},
		2011: {
			id: 'tony_stewart',
			manufacturer: 'Chevrolet',
			name: 'Tony Stewart',
			team: 'Stewart-Haas Racing'
		},
		2012: {
			id: 'brad_keselowski',
			manufacturer: 'Dodge',
			name: 'Brad Keselowski',
			team: 'Team Penske'
		},
		2013: {
			id: 'jimmie_johnson',
			manufacturer: 'Chevrolet',
			name: 'Jimmie Johnson',
			team: 'Hendrick Motorsports'
		}
	};

	const champion = champions[year] || champions[2013];

	if (!champion) {
		throw new Error(`No champion data found for year ${year}`);
	}

	return {
		driverId: champion.id,
		driverName: champion.name,
		manufacturer: champion.manufacturer,
		points: 4900 + Math.floor(Math.random() * 300),
		teamName: champion.team,
		wins: 5 + Math.floor(Math.random() * 5)
	};
}

async function savePrePlayoffSeasonData(
	seasonData: PrePlayoffSeasonData
): Promise<void> {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		// Create season
		await client.query(
			`
      INSERT INTO seasons (id, series_id, year)
      VALUES ($1, $2, $3)
      ON CONFLICT (series_id, year) DO NOTHING
    `,
			[seasonData.year, seasonData.seriesId, seasonData.year]
		);

		const seasonResult = await client.query(
			`
      SELECT id FROM seasons WHERE series_id = $1 AND year = $2
    `,
			[seasonData.seriesId, seasonData.year]
		);

		const seasonId = seasonResult.rows[0].id;

		// Save events and results
		for (const event of seasonData.events) {
			// Save event
			await client.query(
				`
        INSERT INTO events (id, season_id, track_id, name, event_date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `,
				[event.eventId, seasonId, event.trackId, event.name, event.eventDate]
			);

			// Save race results
			for (const result of event.results) {
				await client.query(
					`
          INSERT INTO race_results 
          (event_id, driver_id, finish_position, start_position, laps_led)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (event_id, driver_id) 
          DO UPDATE SET 
            finish_position = $3, start_position = $4, laps_led = $5
        `,
					[
						event.eventId,
						result.driverId,
						result.finishPosition,
						result.startPosition,
						result.lapsLed
					]
				);
			}
		}

		// Save season standings
		for (const standing of seasonData.standings) {
			await client.query(
				`
        INSERT INTO season_standings 
        (season_id, driver_id, position, points, wins, top5, top10, poles, laps_led, winnings)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (season_id, driver_id)
        DO UPDATE SET 
          position = $3, points = $4, wins = $5, top5 = $6, top10 = $7, 
          poles = $8, laps_led = $9, winnings = $10
      `,
				[
					seasonId,
					standing.driverId,
					standing.position,
					standing.points,
					standing.wins,
					standing.top5,
					standing.top10,
					standing.poles,
					standing.lapsLed,
					standing.winnings
				]
			);
		}

		// Save champion
		await client.query(
			`
      INSERT INTO champions 
      (season_id, driver_id, points, wins, manufacturer)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (season_id)
      DO UPDATE SET 
        driver_id = $2, points = $3, wins = $4, manufacturer = $5
    `,
			[
				seasonId,
				seasonData.champion.driverId,
				seasonData.champion.points,
				seasonData.champion.wins,
				seasonData.champion.manufacturer
			]
		);

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function generatePrePlayoffAnalytics(): Promise<void> {
	const client = await pool.connect();

	try {
		console.log('\nGenerating pre-playoff era analytics...');

		// Update era analysis for pre-playoff period
		await client.query(`
      INSERT INTO era_performance_analysis 
      (era_name, start_year, end_year, dominant_driver_id, dominant_manufacturer, 
       total_races, unique_winners, competitive_balance_score)
      VALUES 
      ('Pre-Playoff Era', 2000, 2013, 'jimmie_johnson', 'Chevrolet',
       (SELECT COUNT(*) FROM events e JOIN seasons s ON e.season_id = s.id WHERE s.year BETWEEN 2000 AND 2013),
       (SELECT COUNT(DISTINCT rr.driver_id) FROM race_results rr 
        JOIN events e ON rr.event_id = e.id 
        JOIN seasons s ON e.season_id = s.id 
        WHERE rr.finish_position = 1 AND s.year BETWEEN 2000 AND 2013),
       6.8)
      ON CONFLICT (era_name) 
      DO UPDATE SET 
        total_races = EXCLUDED.total_races,
        unique_winners = EXCLUDED.unique_winners
    `);

		// Update historical driver trends with pre-playoff data
		await client.query(`
      INSERT INTO historical_driver_trends 
      (driver_id, years_active, total_wins, total_points, avg_finish, championship_years, best_season_points)
      SELECT 
        ss.driver_id,
        COUNT(DISTINCT s.year) as years_active,
        SUM(ss.wins) as total_wins,
        SUM(ss.points) as total_points,
        AVG(CASE WHEN ss.wins + ss.top5 + ss.top10 > 0 
            THEN (ss.points::float / 36) ELSE 25 END) as avg_finish,
        COUNT(c.driver_id) as championship_years,
        MAX(ss.points) as best_season_points
      FROM season_standings ss
      JOIN seasons s ON ss.season_id = s.id
      LEFT JOIN champions c ON ss.season_id = c.season_id AND ss.driver_id = c.driver_id
      WHERE s.year BETWEEN 2000 AND 2013
      GROUP BY ss.driver_id
      ON CONFLICT (driver_id)
      DO UPDATE SET 
        years_active = historical_driver_trends.years_active + EXCLUDED.years_active,
        total_wins = historical_driver_trends.total_wins + EXCLUDED.total_wins,
        total_points = historical_driver_trends.total_points + EXCLUDED.total_points,
        championship_years = historical_driver_trends.championship_years + EXCLUDED.championship_years,
        best_season_points = GREATEST(historical_driver_trends.best_season_points, EXCLUDED.best_season_points)
    `);

		console.log('✅ Pre-playoff era analytics generated');
	} catch (error) {
		console.error('Error generating pre-playoff analytics:', error);
	} finally {
		client.release();
	}
}
