import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logFormat = process.env.LOG_FORMAT?.toLowerCase(); // Read and normalize

// Determine if and how pretty printing should be enabled
// Default: pretty in dev, json in prod
const usePrettyPrint = logFormat === "pretty" || (!logFormat && !isProduction);
const usePlainPrint = logFormat === "plain";

const transport = (() => {
	if (usePrettyPrint || usePlainPrint) {
		return {
			target: "pino-pretty",
			options: {
				colorize: usePrettyPrint,
				ignore: "pid,hostname,node",
			},
		};
	}
	return undefined;
})();

const logger = pino({
	level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
	transport,
	timestamp: pino.stdTimeFunctions.isoTime,
	formatters: {
		bindings: (bindings) => {
			return {
				node: process.version,
			};
		},
		level: (label) => {
			return { level: label.toUpperCase() };
		},
	},
});

export default logger;
