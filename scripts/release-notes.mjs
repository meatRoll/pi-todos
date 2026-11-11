#!/usr/bin/env node
/**
 * Print the CHANGELOG.md section for a release tag, so a GitHub release cannot
 * drift from the changelog. `v1.0.0` and `1.0.0` both map to `## v1.0.0`.
 *
 * Usage: node scripts/release-notes.mjs v1.0.0 > RELEASE_NOTES.md
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const tag = process.argv[2];
if (!tag) {
	console.error("usage: release-notes.mjs <tag>");
	process.exit(2);
}

const version = tag.replace(/^v/, "");
const changelogPath = join(import.meta.dirname, "..", "CHANGELOG.md");
const lines = readFileSync(changelogPath, "utf8").split("\n");

const heading = new RegExp(`^##\\s+v?${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
const start = lines.findIndex((line) => heading.test(line));
if (start === -1) {
	console.error(`no "## v${version}" section in CHANGELOG.md`);
	process.exit(1);
}

const body = [];
for (const line of lines.slice(start + 1)) {
	if (/^##\s+/.test(line)) break;
	body.push(line);
}

const text = body.join("\n").trim();
if (text.length === 0) {
	console.error(`"## v${version}" section in CHANGELOG.md is empty`);
	process.exit(1);
}

console.log(text);
