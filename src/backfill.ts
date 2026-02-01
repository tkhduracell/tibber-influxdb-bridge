import type { TibberQuery } from "tibber-api";
import type InfluxDB from "./influxdb";
import logger from "./logger";

interface BackfillConfig {
	homeId: string;
	measurement: string;
	fromDate: string;
	pageSize: number;
	delayMs: number;
}

interface ConsumptionNode {
	from: string;
	to: string;
	consumption: number | null;
	cost: number | null;
	currency: string;
	unitPrice: number | null;
	unitPriceVAT: number | null;
	totalCost: number | null;
	unitCost: number | null;
	consumptionUnit: string;
}

interface ConsumptionPage {
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
	nodes: ConsumptionNode[];
}

function buildQuery(homeId: string, first: number, after: string): string {
	return `{
		viewer {
			home(id: "${homeId}") {
				consumption(resolution: HOURLY, first: ${first}, after: "${after}") {
					pageInfo {
						hasNextPage
						endCursor
					}
					nodes {
						from
						to
						consumption
						cost
						currency
						unitPrice
						unitPriceVAT
						totalCost
						unitCost
						consumptionUnit
					}
				}
			}
		}
	}`;
}

function toCursor(isoDate: string): string {
	return Buffer.from(isoDate).toString("base64");
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(signal.reason);
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(signal.reason);
			},
			{ once: true },
		);
	});
}

async function getDayCount(
	influxDb: InfluxDB,
	measurement: string,
	dayStart: string,
	dayEnd: string,
): Promise<number> {
	try {
		const rows = await influxDb.query(
			`SELECT COUNT("accumulatedConsumptionLastHour") as cnt FROM "${measurement}" WHERE time >= '${dayStart}' AND time < '${dayEnd}' AND "source" = 'backfill'`,
		);
		if (rows.length > 0 && rows[0].cnt != null) {
			return Number(rows[0].cnt);
		}
	} catch (error) {
		logger.warn({ err: error, dayStart }, "Could not query day count");
	}
	return 0;
}

export async function startBackfill(
	tibberQuery: TibberQuery,
	influxDb: InfluxDB,
	config: BackfillConfig,
	signal: AbortSignal,
): Promise<void> {
	const log = logger.child({ module: "backfill" });

	const fromDate = new Date(config.fromDate);
	fromDate.setUTCHours(0, 0, 0, 0);

	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	log.info(
		{
			fromDate: config.fromDate,
			toDate: today.toISOString().slice(0, 10),
			delayMs: config.delayMs,
		},
		"Starting backfill: scanning days newest-first",
	);

	let totalWritten = 0;
	let daysChecked = 0;
	let daysFilled = 0;

	const current = new Date(today);

	while (current >= fromDate && !signal.aborted) {
		const dayStr = current.toISOString().slice(0, 10);
		const dayStart = `${dayStr}T00:00:00.000Z`;
		const nextDay = new Date(current);
		nextDay.setUTCDate(nextDay.getUTCDate() + 1);
		const dayEnd = nextDay.toISOString();

		daysChecked++;

		const count = await getDayCount(
			influxDb,
			config.measurement,
			dayStart,
			dayEnd,
		);

		if (count >= 24) {
			log.debug({ day: dayStr, count }, "Day complete, skipping");
			current.setUTCDate(current.getUTCDate() - 1);
			continue;
		}

		log.info({ day: dayStr, existing: count }, "Backfilling day");

		const cursor = toCursor(dayStart);
		const query = buildQuery(config.homeId, 24, cursor);

		let result: any;
		try {
			result = await tibberQuery.query(query);
		} catch (error) {
			log.error(
				{ err: error, day: dayStr },
				"API request failed, skipping day",
			);
			current.setUTCDate(current.getUTCDate() - 1);
			try {
				await sleep(config.delayMs, signal);
			} catch {
				break;
			}
			continue;
		}

		const consumption: ConsumptionPage | undefined =
			result?.viewer?.home?.consumption;

		if (!consumption?.nodes?.length) {
			log.debug({ day: dayStr }, "No data available for day");
			current.setUTCDate(current.getUTCDate() - 1);
			continue;
		}

		let accumulatedConsumption = 0;
		let accumulatedCost = 0;

		for (const node of consumption.nodes) {
			if (signal.aborted) break;
			if (node.consumption === null) continue;
			if (!node.from.startsWith(dayStr)) continue;

			accumulatedConsumption += node.consumption ?? 0;
			accumulatedCost += node.cost ?? 0;

			const point: { timestamp: string; [key: string]: any } = {
				timestamp: node.from,
				source: "backfill",
				accumulatedConsumptionLastHour: node.consumption,
				accumulatedConsumption,
				accumulatedCost,
				currency: node.currency,
			};

			if (node.cost !== null) point.cost = node.cost;
			if (node.unitPrice !== null) point.unitPrice = node.unitPrice;
			if (node.unitPriceVAT !== null) point.unitPriceVAT = node.unitPriceVAT;
			if (node.totalCost !== null) point.totalCost = node.totalCost;
			if (node.unitCost !== null) point.unitCost = node.unitCost;
			if (node.consumptionUnit) point.consumptionUnit = node.consumptionUnit;

			await influxDb.writePoint(config.measurement, point);
			totalWritten++;
		}

		daysFilled++;
		log.info({ day: dayStr, totalWritten, daysFilled }, "Day backfilled");

		current.setUTCDate(current.getUTCDate() - 1);

		try {
			await sleep(config.delayMs, signal);
		} catch {
			break;
		}
	}

	if (signal.aborted) {
		log.info({ totalWritten, daysChecked, daysFilled }, "Backfill aborted");
	} else {
		log.info({ totalWritten, daysChecked, daysFilled }, "Backfill complete");
	}
}
