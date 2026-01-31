declare module "tibber-api" {
	interface TibberQueryConfig {
		apiEndpoint: {
			queryUrl?: string;
			apiKey: string;
			userAgent?: string;
		};
		homeId: string;
		active?: boolean;
		[key: string]: any;
	}

	interface TibberFeedOptions {
		[key: string]: any;
	}

	class TibberQuery {
		constructor(config: TibberQueryConfig);
		query(query: string, variables?: Record<string, any>): Promise<any>;
	}

	class TibberFeed extends NodeJS.EventEmitter {
		constructor(tibberQuery: TibberQuery, timeout?: number, active?: boolean);
		feedConnectionTimeout: number;
		connect(): void;
		close(): void;
		on(event: "data", listener: (data: any) => void): this;
		on(event: "connecting", listener: (data: any) => void): this;
		on(event: "connection_timeout", listener: (data: any) => void): this;
		on(event: "connected", listener: (data: any) => void): this;
		on(event: "connection_ack", listener: (data: any) => void): this;
		on(event: "heartbeat_timeout", listener: (data: any) => void): this;
		on(event: "heartbeat_reconnect", listener: (data: any) => void): this;
		on(event: "disconnected", listener: (data: any) => void): this;
		on(event: "error", listener: (error: Error) => void): this;
		on(event: string, listener: (...args: any[]) => void): this;
	}

	export { TibberQuery, TibberFeed };
}
