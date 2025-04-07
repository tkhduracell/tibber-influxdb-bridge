import { EventEmitter } from "node:events";
import { TibberFeed, TibberQuery } from "tibber-api";
import InfluxDB from "./influxdb";
import { name, version } from "./version";

interface TibberConfig {
	accessToken: string;
	homeId: string;
	queryUrl?: string;
	feedTimeout?: number;
	feedConnectionTimeout?: number;
	influxUrl: string;
	influxToken: string;
	influxOrg: string;
	influxBucket: string;
	influxMeasurement: string;
}

interface TibberData {
	timestamp: string | Date;
	[key: string]: any;
}

enum StatusEnum {
	unknown = -1,
	disconnected = 0,
	waiting = 1,
	connecting = 2,
	connected = 100,
}

class TibberDataFetcher extends EventEmitter {
	private config: TibberConfig;
	private connected: boolean;
	private tibberFeed: TibberFeed | null;
	private influxDb: InfluxDB | null;
	private statusEnum: typeof StatusEnum;
	private lastStatus: StatusEnum;
	private measurement: string;

	constructor(config: TibberConfig) {
		super();
		this.config = config;
		this.connected = false;
		this.tibberFeed = null;
		this.influxDb = null;
		this.statusEnum = StatusEnum;
		this.lastStatus = this.statusEnum.unknown;
		this.measurement = this.config.influxMeasurement;
	}

	async init(): Promise<TibberDataFetcher> {
		// Initialize InfluxDB
		this.influxDb = new InfluxDB({
			url: this.config.influxUrl,
			token: this.config.influxToken,
			org: this.config.influxOrg,
			bucket: this.config.influxBucket,
		});

		await this.influxDb.connect();

		// Initialize Tibber connection
		const tibberConfig = {
			apiEndpoint: {
				queryUrl: this.config.queryUrl || "https://api.tibber.com/v1-beta/gql",
				apiKey: this.config.accessToken,
				userAgent: `${name}/${version}`,
			},
			homeId: this.config.homeId,
			active: true,
		};

		// Setup feed configuration including timeout values
		const feedTimeout = (this.config.feedTimeout || 60) * 1000;
		const feedConnectionTimeout =
			(this.config.feedConnectionTimeout || 30) * 1000;

		// Create Tibber query and feed objects
		const query = new TibberQuery(tibberConfig);
		this.tibberFeed = new TibberFeed(query, feedTimeout, true);
		this.tibberFeed.feedConnectionTimeout = feedConnectionTimeout;

		// Setup event listeners
		this.setupEventListeners();

		console.log("TibberDataFetcher initialized");
		return this;
	}

	private setupEventListeners(): void {
		if (!this.tibberFeed) return;

		// Real-time data listener
		this.tibberFeed.on("data", (data: any) => {
			this.setStatus(this.statusEnum.connected);
			this.handleData(data);
		});

		// Connection status listeners
		this.tibberFeed.on("connecting", (data: any) => {
			this.setStatus(this.statusEnum.connecting);
			console.log("Connecting", data);
		});

		this.tibberFeed.on("connection_timeout", (data: any) => {
			this.setStatus(this.statusEnum.waiting);
			console.log("Connection Timeout", data);
		});

		this.tibberFeed.on("connected", (data: any) => {
			this.setStatus(this.statusEnum.connected);
			console.log("Connected", data);
		});

		this.tibberFeed.on("connection_ack", (data: any) => {
			this.setStatus(this.statusEnum.connected);
			console.log("Connection acknowledged", data);
		});

		this.tibberFeed.on("heartbeat_timeout", (data: any) => {
			this.setStatus(this.statusEnum.waiting);
			console.log("Heartbeat Timeout", data);
		});

		this.tibberFeed.on("heartbeat_reconnect", (data: any) => {
			this.setStatus(this.statusEnum.connecting);
			console.log("Heartbeat Reconnect", data);
		});

		this.tibberFeed.on("disconnected", (data: any) => {
			if (
				this.lastStatus !== this.statusEnum.waiting &&
				this.lastStatus !== this.statusEnum.connecting
			) {
				this.setStatus(this.statusEnum.disconnected);
			}
			console.log("Disconnected", data);
		});

		// Error handling
		this.tibberFeed.on("error", (error: any) => {
			console.error("Tibber Feed Error:", error);
			this.emit("error", error);
		});
	}

	private setStatus(status: StatusEnum): void {
		if (status !== this.lastStatus) {
			switch (status) {
				case this.statusEnum.unknown:
					console.log("Status: unknown");
					break;
				case this.statusEnum.disconnected:
					console.log("Status: disconnected");
					break;
				case this.statusEnum.waiting:
					console.log("Status: waiting");
					break;
				case this.statusEnum.connecting:
					console.log("Status: connecting");
					break;
				case this.statusEnum.connected:
					console.log("Status: connected");
					break;
				default:
					break;
			}
			this.lastStatus = status;
			this.emit("status", status);
		}
	}

	private async handleData(data: TibberData): Promise<void> {
		try {
			// Process the data
			console.log("Received data from Tibber", { ts: data.timestamp });

			// Write to InfluxDB
			// biome-ignore lint/complexity/noForEach: Legacy code
			Object.entries(data)
				.filter(([k]) => k.match(/^currentL\d+$/i))
				.forEach(([key]) => {
					const digit = key.replace(/^currentL(\d+)$/i, "$1");
					const N = Number.parseInt(digit);

					if (Number.isNaN(N)) return;
					if (!(`currentL${N}` in data)) return;
					if (!(`voltagePhase${N}` in data)) return;

					data[`powerL${N}`] = data[`currentL${N}`] * data[`voltagePhase${N}`];
					data[`voltageL${N}`] = data[`voltagePhase${N}`];

					delete data[`voltagePhase${N}`];
				});

			if (this.influxDb) {
				await this.influxDb.writePoint(this.measurement, data);
			}

			this.emit("data-processed", data);
		} catch (error) {
			console.error("Error handling data:", error);
			this.emit("error", error);
		}
	}

	async connect(): Promise<void> {
		this.setStatus(this.statusEnum.connecting);
		console.log("Connecting to Tibber...");
		if (this.tibberFeed) {
			this.tibberFeed.connect();
		}
	}

	async close(): Promise<void> {
		console.log("Closing Tibber Feed...");
		if (this.tibberFeed) {
			this.tibberFeed.close();
		}

		if (this.influxDb) {
			await this.influxDb.close();
		}

		this.setStatus(this.statusEnum.disconnected);
		console.log("TibberDataFetcher closed");
	}
}

export default TibberDataFetcher;
