import { InfluxDBClient, Point } from "@influxdata/influxdb3-client";
import logger from "./logger";

interface InfluxDBConfig {
	host: string;
	token: string;
	database: string;
}

interface DataPoint {
	timestamp: Date | string;
	[key: string]: any;
}

class InfluxDB {
	private config: InfluxDBConfig;
	private client: InfluxDBClient;

	constructor(config: InfluxDBConfig) {
		this.config = {
			...config,
			// Remove trailing slash if present
			host: config.host.endsWith("/") ? config.host.slice(0, -1) : config.host,
		};

		// Create InfluxDB client
		this.client = new InfluxDBClient({
			host: this.config.host,
			token: this.config.token,
			database: this.config.database,
		});

		logger.info(
			{
				host: this.config.host,
				database: this.config.database,
				token: this.config.token ? "****" : this.config.token,
			},
			"InfluxDB initialized with config",
		);
	}

	async connect(): Promise<boolean> {
		try {
			logger.debug("Testing connection to InfluxDB...");

			// Simple health check
			const response = await fetch(`${this.config.host}/health`, {
				headers: {
					Authorization: `Bearer ${this.config.token}`,
				},
			});

			if (response.ok) {
				logger.debug("Successfully connected to InfluxDB");
				return true;
			}
			const errorText = await response.text();
			logger.error(
				{ errorText },
				`InfluxDB health check failed: ${response.status} ${response.statusText}`,
			);
			throw new Error(
				`InfluxDB health check failed with status ${response.status}`,
			);
		} catch (error) {
			logger.error(error, "Failed to connect to InfluxDB:");
			throw error;
		}
	}

	async writePoint(measurement: string, data: DataPoint): Promise<boolean> {
		try {
			// Create a point using the official client
			const point = Point.measurement(measurement);

			// Track processed keys and extract timestamp
			const timestamp = data.timestamp;

			// Add tags (strings shorter than 64 chars)
			for (const [key, value] of Object.entries(data)) {
				if (key === "timestamp") continue;

				if (typeof value === "string" && value.length < 64) {
					point.setTag(key, value);
				}
			}

			// Add fields (everything else)
			for (const [key, value] of Object.entries(data)) {
				if (key === "timestamp" || value === null || value === undefined) {
					continue;
				}

				if (typeof value === "number") {
					point.setFloatField(key, value);
				} else if (typeof value === "boolean") {
					point.setBooleanField(key, value);
				} else if (typeof value === "string" && value.length >= 64) {
					// Only add long strings as fields, short strings are tags
					point.setStringField(key, value);
				} else if (value instanceof Date) {
					point.setStringField(key, value.toISOString());
				}
			}

			// Set timestamp if available
			if (timestamp instanceof Date) {
				point.setTimestamp(timestamp);
			} else if (typeof timestamp === "string") {
				point.setTimestamp(new Date(timestamp));
			}

			// Write to InfluxDB (direct async write)
			await this.client.write(point, this.config.database);
			logger.debug({ measurement }, "Write successful");
			return true;
		} catch (error) {
			logger.error({ error, measurement }, "Failed to write data to InfluxDB");
			return false;
		}
	}

	async query(sql: string): Promise<Record<string, any>[]> {
		const rows: Record<string, any>[] = [];
		for await (const row of this.client.query(sql, this.config.database)) {
			rows.push(row);
		}
		return rows;
	}

	async close(): Promise<boolean> {
		try {
			// Close the client connection
			await this.client.close();

			logger.debug("InfluxDB connection closed");
			return true;
		} catch (error) {
			logger.error(error, "Error closing InfluxDB connection");
			return false;
		}
	}
}

export default InfluxDB;
