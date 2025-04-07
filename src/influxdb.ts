import { InfluxDB as InfluxDBClient, Point } from "@influxdata/influxdb-client";

interface InfluxDBConfig {
	url: string;
	token: string;
	org: string;
	bucket: string;
}

interface DataPoint {
	timestamp: Date | string;
	[key: string]: any;
}

class InfluxDB {
	private config: InfluxDBConfig;
	private client: InfluxDBClient;
	private writeApi: any;

	constructor(config: InfluxDBConfig) {
		this.config = {
			...config,
			// Remove trailing slash if present
			url: config.url.endsWith("/") ? config.url.slice(0, -1) : config.url,
		};

		// Create InfluxDB client
		this.client = new InfluxDBClient({
			url: this.config.url,
			token: this.config.token,
		});

		// Create write API
		this.writeApi = this.client.getWriteApi(
			this.config.org,
			this.config.bucket,
			"ms", // millisecond precision
			{
				maxRetries: 3,
				minRetryDelay: 1000,
				flushInterval: 10000,
				writeSuccess(lines) {
					console.log("Write successful!", { lines });
				},
				writeFailed(error, lines, attempt, expires) {
					console.error("Write failed:", error, { lines, attempt, expires });
				},
			},
		);

		console.log("InfluxDB initialized with config:", {
			...this.config,
			token: this.config.token ? "****" : this.config.token,
		});
	}

	async connect(): Promise<boolean> {
		try {
			console.log("Testing connection to InfluxDB...");

			// Simple health check
			const response = await fetch(`${this.config.url}/health`);

			if (response.ok) {
				console.log("Successfully connected to InfluxDB");
				return true;
			}
			const errorText = await response.text();
			console.error(
				`InfluxDB health check failed: ${response.status} ${response.statusText}`,
			);
			console.error(errorText);
			throw new Error(
				`InfluxDB health check failed with status ${response.status}`,
			);
		} catch (error) {
			console.error("Failed to connect to InfluxDB:", error);
			throw error;
		}
	}

	async writePoint(measurement: string, data: DataPoint): Promise<boolean> {
		try {
			// Create a point using the official client
			const point = new Point(measurement);

			// Track processed keys and extract timestamp
			const timestamp = data.timestamp;

			// Add tags (strings shorter than 64 chars)
			for (const [key, value] of Object.entries(data)) {
				if (key === "timestamp") continue;

				if (typeof value === "string" && value.length < 64) {
					point.tag(key, value);
				}
			}

			// Add fields (everything else)
			for (const [key, value] of Object.entries(data)) {
				if (key === "timestamp" || value === null || value === undefined) {
					continue;
				}

				if (typeof value === "number") {
					point.floatField(key, value);
				} else if (typeof value === "boolean") {
					point.booleanField(key, value);
				} else if (typeof value === "string" && value.length >= 64) {
					// Only add long strings as fields, short strings are tags
					point.stringField(key, value);
				} else if (value instanceof Date) {
					point.stringField(key, value.toISOString());
				}
			}

			// Set timestamp if available
			if (timestamp instanceof Date) {
				point.timestamp(timestamp);
			} else if (typeof timestamp === "string") {
				point.timestamp(new Date(timestamp));
			}

			// Write to InfluxDB
			this.writeApi.writePoint(point);
			return true;
		} catch (error) {
			console.error("Failed to write data to InfluxDB:", error);
			return false;
		}
	}

	async close(): Promise<boolean> {
		try {
			// Close the write API only (client doesn't have a close method)
			await this.writeApi.close();

			console.log("InfluxDB connection resources released");
			return true;
		} catch (error) {
			console.error("Error closing InfluxDB connection:", error);
			return false;
		}
	}
}

export default InfluxDB;
