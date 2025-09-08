import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

/** Custom metrics */
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

/** Test configuration */
export const options = {
	stages: [
		{ duration: '2m', target: 10 }, // Ramp up to 10 users
		{ duration: '5m', target: 10 }, // Stay at 10 users
		{ duration: '2m', target: 50 }, // Ramp up to 50 users
		{ duration: '5m', target: 50 }, // Stay at 50 users
		{ duration: '2m', target: 100 }, // Ramp up to 100 users
		{ duration: '5m', target: 100 }, // Stay at 100 users
		{ duration: '2m', target: 0 } // Ramp down to 0 users
	],
	thresholds: {
		errors: ['rate<0.1'], // Custom error rate below 10%
		http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
		http_req_failed: ['rate<0.1'] // Error rate must be below 10%
	}
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'demo-key-123';

export default function () {
	const params = {
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': API_KEY
		}
	};

	/** Test scenarios with different weights */
	const scenario = Math.random();

	if (scenario < 0.4) {
		/** 40% - Get races for current year */
		testGetRaces(params);
	} else if (scenario < 0.7) {
		/** 30% - Get specific race results */
		testGetRaceResults(params);
	} else if (scenario < 0.9) {
		/** 20% - Get driver standings */
		testGetStandings(params);
	} else {
		/** 10% - Get driver profile */
		testGetDriverProfile(params);
	}

	sleep(1); // Wait 1 second between requests
}

function testGetRaces(params) {
	const response = http.get(`${BASE_URL}/api/races/2024`, params);

	const success = check(response, {
		'races endpoint status is 200': (r) => r.status === 200,
		'races response has data': (r) => {
			try {
				const data = JSON.parse(r.body);
				return Array.isArray(data) && data.length > 0;
			} catch {
				return false;
			}
		},
		'races response time < 500ms': (r) => r.timings.duration < 500
	});

	errorRate.add(!success);
	responseTime.add(response.timings.duration);
}

function testGetRaceResults(params) {
	const raceNumber = Math.floor(Math.random() * 36) + 1;
	const response = http.get(`${BASE_URL}/api/races/2024/${raceNumber}`, params);

	const success = check(response, {
		'race results has drivers': (r) => {
			try {
				const data = JSON.parse(r.body);

				return Array.isArray(data) && data.length > 20; // Expect 30+ drivers
			} catch {
				return false;
			}
		},
		'race results response time < 1000ms': (r) => r.timings.duration < 1000,
		'race results status is 200': (r) => r.status === 200
	});

	errorRate.add(!success);
	responseTime.add(response.timings.duration);
}

function testGetStandings(params) {
	const response = http.get(`${BASE_URL}/api/standings/2024`, params);

	const success = check(response, {
		'standings has drivers': (r) => {
			try {
				const data = JSON.parse(r.body);

				return Array.isArray(data) && data.length > 0;
			} catch {
				return false;
			}
		},
		'standings response time < 300ms': (r) => r.timings.duration < 300,
		'standings status is 200': (r) => r.status === 200
	});

	errorRate.add(!success);
	responseTime.add(response.timings.duration);
}

function testGetDriverProfile(params) {
	const drivers = [
		'chase_elliott',
		'kyle_larson',
		'denny_hamlin',
		'joey_logano'
	];
	const driver = drivers[Math.floor(Math.random() * drivers.length)];

	const response = http.get(`${BASE_URL}/api/drivers/${driver}`, params);

	const success = check(response, {
		'driver profile response time < 200ms': (r) => r.timings.duration < 200,
		'driver profile status is 200 or 404': (r) =>
			r.status === 200 || r.status === 404
	});

	errorRate.add(!success);
	responseTime.add(response.timings.duration);
}

/** Setup function runs once before the test */
export function setup() {
	console.log('Starting NASCAR API load test');
	console.log(`Base URL: ${BASE_URL}`);
	console.log(`API Key: ${API_KEY.substring(0, 8)}...`);

	/** Verify API is accessible */
	const response = http.get(`${BASE_URL}/health`);
	if (response.status !== 200) {
		throw new Error(`API health check failed: ${response.status}`);
	}

	return { startTime: new Date() };
}

/** Teardown function runs once after the test */
export function teardown(data) {
	const duration = (new Date() - data.startTime) / 1000;

	console.log(`Load test completed in ${duration} seconds`);
}
