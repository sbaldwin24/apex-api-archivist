import * as cheerio from 'cheerio';
import 'dotenv/config';
import { pool } from './src/database';
import { ProxyScraper } from './src/scrapers/proxy-scraper';

const proxyScraper = new ProxyScraper({
	enabled: process.env.PROXY_ENABLED === 'true',
	password: process.env.OXYLABS_PASSWORD || '',
	username: process.env.OXYLABS_USERNAME || ''
});

async function scrapePaintSchemesWithProxy() {
	console.log(
		'🔄 Starting paint scheme scraping with Oxylabs datacenter proxies...'
	);

	const years = [2025, 2024, 2023];
	const teams = [
		'hendrick-motorsports',
		'joe-gibbs-racing',
		'team-penske',
		'stewart-haas-racing',
		'richard-childress-racing',
		'23xi-racing',
		'trackhouse-racing',
		'roush-fenway-keselowski-racing'
	];

	let totalSchemes = 0;

	for (const year of years) {
		console.log(`\n📅 Scraping ${year} paint schemes...`);

		for (const team of teams) {
			const carNumbers = [
				'1',
				'2',
				'3',
				'4',
				'5',
				'6',
				'8',
				'9',
				'11',
				'12',
				'14',
				'17',
				'18',
				'19',
				'20',
				'22',
				'23',
				'24',
				'45',
				'48'
			];

			for (const carNum of carNumbers) {
				const url = `https://www.jayski.com/paint-schemes/cup-series-paint-schemes/${year}-nascar-cup-series-${carNum}-${team}-paint-schemes/`;

				try {
					console.log(`🎨 Checking #${carNum} ${team} for ${year}...`);

					const html = await proxyScraper.scrapeWithRetry(url);
					const schemes = extractPaintSchemes(html, carNum, year);

					if (schemes.length > 0) {
						await savePaintSchemes(schemes, year);
						totalSchemes += schemes.length;
						console.log(`  ✅ Found ${schemes.length} schemes for #${carNum}`);
					}

					// Delay between requests
					await new Promise((resolve) => setTimeout(resolve, 1500));
				} catch (error: any) {
					console.log(
						`  ⚠️ Failed to scrape #${carNum} ${team}: ${error?.message || 'Unknown error'}`
					);
				}
			}
		}
	}

	console.log(`\n🏁 Scraping complete! Total new schemes: ${totalSchemes}`);
	await showResults();
}

function extractPaintSchemes(
	html: string,
	carNumber: string,
	year: number
): any[] {
	const $ = cheerio.load(html);
	const schemes: any[] = [];

	$('img').each((_, img) => {
		const src = $(img).attr('src') || '';
		const alt = $(img).attr('alt') || '';

		if (
			src.includes('paint') ||
			src.includes('scheme') ||
			alt.includes(carNumber)
		) {
			const $context = $(img).closest('div, figure, p').parent();
			const text = $context.text() + ' ' + alt;

			// Extract sponsor
			const sponsorMatch = text.match(/(?:sponsored by|featuring)\s+([^.]+)/i);
			const sponsor = sponsorMatch?.[1]?.trim() || '';

			// Extract driver name
			const driverMatch = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
			const driverName = driverMatch?.[1] || '';

			// Scheme type
			let schemeType = 'regular';
			if (text.toLowerCase().includes('throwback')) schemeType = 'throwback';
			else if (text.toLowerCase().includes('special')) schemeType = 'special';

			schemes.push({
				carNumber,
				driverName,
				imageUrl: src.startsWith('http') ? src : `https://www.jayski.com${src}`,
				primarySponsor: sponsor,
				schemeType,
				year
			});
		}
	});

	return schemes;
}

async function savePaintSchemes(schemes: any[], year: number) {
	const client = await pool.connect();

	try {
		for (const scheme of schemes) {
			const driverId = scheme.driverName
				? scheme.driverName
						.toLowerCase()
						.replace(/\s+/g, '_')
						.replace(/[^a-z0-9_]/g, '')
				: `driver_${scheme.carNumber}`;

			await client.query(
				`
        INSERT INTO paint_schemes 
        (event_id, driver_id, car_number, primary_sponsor, scheme_type, scheme_image_url, year)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (event_id, driver_id) 
        DO UPDATE SET 
          primary_sponsor = COALESCE(NULLIF($4, ''), paint_schemes.primary_sponsor),
          scheme_image_url = $6
      `,
				[
					'season_2024',
					driverId,
					scheme.carNumber,
					scheme.primarySponsor,
					scheme.schemeType,
					scheme.imageUrl,
					year
				]
			);
		}
	} finally {
		client.release();
	}
}

async function showResults() {
	const client = await pool.connect();

	try {
		const result = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT car_number) as cars,
        COUNT(DISTINCT primary_sponsor) as sponsors
      FROM paint_schemes
    `);

		console.log('\n📊 FINAL RESULTS:');
		console.log(`Total schemes: ${result.rows[0].total}`);
		console.log(`Car numbers: ${result.rows[0].cars}`);
		console.log(`Sponsors: ${result.rows[0].sponsors}`);
	} finally {
		client.release();
		await pool.end();
	}
}

scrapePaintSchemesWithProxy();
