interface ValidationResult {
	isValid: boolean;
	errors: string[];
	sanitizedData?: any;
}

export class SchemaValidator {
	validateRaceData(data: any): ValidationResult {
		const errors: string[] = [];

		/** Required fields */
		if (!data.raceName || typeof data.raceName !== 'string') {
			errors.push('raceName is required and must be a string');
		}

		if (!data.eventDate || !this.isValidDate(data.eventDate)) {
			errors.push('eventDate is required and must be a valid date');
		}

		if (!data.trackName || typeof data.trackName !== 'string') {
			errors.push('trackName is required and must be a string');
		}

		if (!Array.isArray(data.results) || data.results.length === 0) {
			errors.push('results must be a non-empty array');
		}

		/** Validate race results */
		if (data.results) {
			data.results.forEach((result: any, index: number) => {
				const resultErrors = this.validateDriverResult(result, index);

				errors.push(...resultErrors);
			});
		}

		/** Data quality checks */
		if (data.results && data.results.length < 20) {
			errors.push(
				`Suspiciously few results: ${data.results.length} (expected 30+)`
			);
		}

		return {
			errors,
			isValid: errors.length === 0,
			sanitizedData:
				errors.length === 0 ? this.sanitizeRaceData(data) : undefined
		};
	}

	private validateDriverResult(result: any, index: number): string[] {
		const errors: string[] = [];
		const prefix = `Result[${index}]`;

		if (!result.driverName || typeof result.driverName !== 'string') {
			errors.push(`${prefix}: driverName is required`);
		}

		if (
			!result.finishPosition ||
			!Number.isInteger(result.finishPosition) ||
			result.finishPosition < 1
		) {
			errors.push(`${prefix}: finishPosition must be a positive integer`);
		}

		if (!result.carNumber || typeof result.carNumber !== 'string') {
			errors.push(`${prefix}: carNumber is required`);
		}

		if (
			result.lapsCompleted !== undefined &&
			(!Number.isInteger(result.lapsCompleted) || result.lapsCompleted < 0)
		) {
			errors.push(`${prefix}: lapsCompleted must be a non-negative integer`);
		}

		return errors;
	}

	private sanitizeRaceData(data: any): any {
		return {
			eventDate: data.eventDate,
			raceName: this.sanitizeString(data.raceName),
			results: data.results.map((result: any) => ({
				carNumber: this.sanitizeString(result.carNumber),
				driverName: this.sanitizeString(result.driverName),
				finishPosition: Number(result.finishPosition),
				lapsCompleted: result.lapsCompleted ? Number(result.lapsCompleted) : 0,
				lapsLed: result.lapsLed ? Number(result.lapsLed) : 0,
				startPosition: result.startPosition
					? Number(result.startPosition)
					: null,
				status: this.sanitizeString(result.status || 'Running'),
				teamName: this.sanitizeString(result.teamName || '')
			})),
			trackName: this.sanitizeString(data.trackName)
		};
	}

	private sanitizeString(str: string): string {
		return str
			.trim()
			.replace(/\s+/g, ' ')
			.replace(/[^\w\s\-.]/g, '');
	}

	private isValidDate(dateStr: string): boolean {
		const date = new Date(dateStr);

		return (
			Number.isFinite(date.getTime()) &&
			date.getFullYear() > 1900 &&
			date.getFullYear() < 2100
		);
	}
}
