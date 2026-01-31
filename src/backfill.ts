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

async function getResumeTimestamp(
	influxDb: InfluxDB,
	measurement: string,
): Promise<string | null> {
	try {
		const rows = await influxDb.query(
			`SELECT MAX(time) as last_time FROM "${measurement}" WHERE "accumulatedConsumptionLastHour" IS NOT NULL`,
		);
		if (rows.length > 0 && rows[0].last_time) {
			const raw = rows[0].last_time;
			let ts: string;
			if (raw instanceof Date) {
				ts = raw.toISOString();
			} else if (
				typeof raw === "number" ||
				(typeof raw === "string" && /^\d+$/.test(raw))
			) {
				ts = new Date(Number(raw)).toISOString();
			} else {
				ts = String(raw);
			}
			logger.info({ resumeFrom: ts }, "Backfill resuming from last checkpoint");
			return ts;
		}
	} catch (error) {
		logger.warn(
			{ err: error },
			"Could not query resume timestamp, starting fresh",
		);
	}
	return null;
}

export async function startBackfill(
	tibberQuery: TibberQuery,
	influxDb: InfluxDB,
	config: BackfillConfig,
	signal: AbortSignal,
): Promise<void> {
	const log = logger.child({ module: "backfill" });

	const resumeTs = await getResumeTimestamp(influxDb, config.measurement);
	let cursor = toCursor(resumeTs ?? config.fromDate);

	log.info(
		{
			fromDate: config.fromDate,
			resumeFrom: resumeTs,
			pageSize: config.pageSize,
			delayMs: config.delayMs,
		},
		"Starting historical backfill",
	);

	let totalWritten = 0;

	while (!signal.aborted) {
		const query = buildQuery(config.homeId, config.pageSize, cursor);

		let result: any;
		try {
			result = await tibberQuery.execute(query);
		} catch (error) {
			log.error({ err: error }, "Backfill API request failed");
			await sleep(config.delayMs, signal);
			continue;
		}

		const consumption: ConsumptionPage | undefined =
			result?.viewer?.home?.consumption;

		if (!consumption || !consumption.nodes || consumption.nodes.length === 0) {
			log.info("Backfill complete: no more data");
			break;
		}

		// Track running totals for accumulated fields
		let currentDay: string | null = null;
		let accumulatedConsumption = 0;
		let accumulatedCost = 0;

		for (const node of consumption.nodes) {
			if (signal.aborted) break;
			if (node.consumption === null) continue;

			const nodeDay = node.from.slice(0, 10);

			// Reset accumulators at midnight boundary
			if (nodeDay !== currentDay) {
				currentDay = nodeDay;
				accumulatedConsumption = 0;
				accumulatedCost = 0;
			}

			accumulatedConsumption += node.consumption ?? 0;
			accumulatedCost += node.cost ?? 0;

			const point: { timestamp: string; [key: string]: any } = {
				timestamp: node.from,
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

		log.info(
			{
				pageNodes: consumption.nodes.length,
				totalWritten,
				hasNextPage: consumption.pageInfo.hasNextPage,
			},
			"Backfill page processed",
		);

		if (!consumption.pageInfo.hasNextPage) {
			log.info({ totalWritten }, "Backfill complete: all pages fetched");
			break;
		}

		cursor = consumption.pageInfo.endCursor ?? cursor;

		try {
			await sleep(config.delayMs, signal);
		} catch {
			break;
		}
	}

	if (signal.aborted) {
		log.info({ totalWritten }, "Backfill aborted");
	}
}
