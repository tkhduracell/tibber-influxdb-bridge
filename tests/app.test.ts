import assert from "node:assert";
import { describe, it } from "node:test";
import { name, version } from "../src/version";

describe("App", () => {
	it("should have version and name from package.json", () => {
		assert.ok(version, "Version should be defined");
		assert.ok(name, "Name should be defined");
		assert.strictEqual(name, "tibber-influxdb-bridge");
	});
});
