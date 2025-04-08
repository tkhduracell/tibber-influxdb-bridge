import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logFormat = process.env.LOG_FORMAT?.toLowerCase(); // Read and normalize

// Determine if pretty printing should be enabled
// Default: pretty in dev, json in prod
const enablePrettyPrint =
	logFormat === "pretty" || (!logFormat && !isProduction);

const logger = pino({
	level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
	transport: enablePrettyPrint
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "SYS:standard",
					ignore: "pid,hostname",
				},
			}
		: undefined,
});

export default logger;
