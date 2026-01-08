import logger from "./logger";
import TibberDataFetcher from "./tibber-data-fetcher";

// Configuration from environment variables
interface Config {
	accessToken: string;
	homeId: string;
	queryUrl?: string;
	feedTimeout?: number;
	feedConnectionTimeout?: number;
	influxUrl: string;
	influxToken: string;
	influxBucket: string;
	influxMeasurement: string;
}

const config: Config = {
	accessToken: process.env.TIBBER_ACCESS_TOKEN || "",
	homeId: process.env.TIBBER_HOME_ID || "",
	queryUrl: process.env.TIBBER_QUERY_URL,
	feedTimeout: Number.parseInt(process.env.TIBBER_FEED_TIMEOUT || "60"),
	feedConnectionTimeout: Number.parseInt(
		process.env.TIBBER_CONNECTION_TIMEOUT || "30",
	),

	// InfluxDB configuration
	influxUrl: process.env.INFLUXDB_URL || "http://localhost:8086",
	influxToken: process.env.INFLUXDB_TOKEN || "",
	influxBucket: process.env.INFLUXDB_BUCKET || "tibber",
	influxMeasurement: process.env.INFLUXDB_MEASUREMENT || "live_data",
};

// Validate required configuration
if (!config.accessToken) {
	logger.error("Error: TIBBER_ACCESS_TOKEN environment variable must be set");
	process.exit(1);
}

if (!config.homeId) {
	logger.error("Error: TIBBER_HOME_ID environment variable must be set");
	process.exit(1);
}

// Validate InfluxDB configuration
if (!config.influxToken) {
	logger.error("Error: INFLUXDB_TOKEN environment variable must be set");
	process.exit(1);
}

// Clean URL (remove trailing slash if present)
if (config.influxUrl.endsWith("/")) {
	config.influxUrl = config.influxUrl.slice(0, -1);
	logger.info(
		`Warning: Removed trailing slash from InfluxDB URL: ${config.influxUrl}`,
	);
}

// Initialize and start the data fetcher
async function start(): Promise<void> {
	logger.info("Starting Tibber data fetcher...");

	try {
		const dataFetcher = await new TibberDataFetcher(config).init();

		// Set up event listeners
		dataFetcher.on("error", (error: Error) => {
			logger.error(error, "TibberDataFetcher error");
		});

		dataFetcher.on("status", (status: number) => {
			// Status is already logged inside the fetcher
		});

		dataFetcher.on("data-processed", (data: any) => {
			// This could be used for additional processing if needed
		});

		// Connect to Tibber
		await dataFetcher.connect();

		// Setup graceful shutdown
		process.on("SIGTERM", async () => {
			logger.info("SIGTERM received. Shutting down...");
			await dataFetcher.close();
			process.exit(0);
		});

		process.on("SIGINT", async () => {
			logger.info("SIGINT received. Shutting down...");
			await dataFetcher.close();
			process.exit(0);
		});

		logger.info("Tibber data fetcher started successfully");
	} catch (error) {
		logger.error(error, "Failed to start Tibber data fetcher");
		process.exit(1);
	}
}

// Start the application
start();
