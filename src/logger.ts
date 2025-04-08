import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logFormat = process.env.LOG_FORMAT?.toLowerCase(); // Read and normalize

// Determine if and how pretty printing should be enabled
// Default: pretty in dev, json in prod
const usePrettyPrint = logFormat === "pretty" || (!logFormat && !isProduction);
const usePlainPrint = logFormat === "plain";
const enableTransport = usePrettyPrint || usePlainPrint;

const logger = pino({
	level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
	transport: enableTransport
		? {
				target: "pino-pretty",
				options: {
					colorize: usePrettyPrint, // Only colorize if format is 'pretty'
					translateTime: "SYS:standard",
					ignore: "pid,hostname",
				},
			}
		: undefined,
});

export default logger;
