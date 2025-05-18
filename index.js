import { Elysia, t } from "elysia";
import { rateLimit } from 'elysia-rate-limit'
import { readdir } from "node:fs/promises";
import data from "./config.toml";
import { exit } from "node:process";

// Get a random int inbetween two numbers
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min) + min);
}

// Get the time in fancy format for console logging
function getTime() {
	return `[${new Date().toISOString().replace("Z", "").replace("T", " ")}]`;
}

// Sanitize IP for logging to prevent log injection
function sanitizeIP(ip) {
	return ip ? ip.replace(/[\n\r\t]/g, "") : "unknown";
}

// Validate level data
function validateLevelData(json) {
	if (!json || typeof json !== "object") return false;

	const requiredFields = ["name", "author", "difficulty", "data"];
	for (const field of requiredFields) {
		if (json[field].toString().trim() === "") return false;
		if (typeof json[field] !== "string") return false;
	}

	const size = new TextEncoder().encode(JSON.stringify(json)).length;
	if (size > data.uploading.maxSizeBytes || size === 0) return false;

	return true;
}

// Check that the levels folder exists, and if it doesn't, shutdown the server gracefully
async function checkLevelsFolder() {
	try {
		const levelsFolder = readdir("./levels")
		if (levelsFolder.length > 0) return true;
		return false;
	} catch (err) {
		console.error("The levels folder is not found. Please create the levels folder and populate it.");
		exit(1);
	}
}

// Verify levels folder exists
await checkLevelsFolder();

// Actual server
const app = new Elysia()
	.get("/3Dash/download/:id", async ({ server, request, params }) => {
		try {
			const { id } = params;
			// Validate id is numeric
			if (!/^\d+$/.test(id)) {
				return new Response("Invalid level ID", { status: 400 });
			}

			const file = Bun.file(`./levels/${id}.json`);
			if (!(await file.exists())) {
				return new Response("Level not found", { status: 400 });
			}

			// Log IP and request information
			if (data.server.logging) {
				const clientIP = sanitizeIP(server.requestIP(request).address);
				console.log(`${getTime()} - ${clientIP} downloaded level ${id}.`);
			}

			return new Response(file, { status: 200 });
		} catch (err) {
			return new Response("An error occurred", { status: 500 });
		}
	},
		{
			params: t.Object({ id: t.Number() })
		})
	.get("3Dash/recent", async ({ server, request }) => {
		try {
			const files = await readdir("./levels/");

			const levelIds = files
				.filter(file => file.endsWith('.json'))
				.map(file => parseInt(file.replace(".json", "")))
				.filter(id => !isNaN(id))
				.sort((a, b) => b - a); // Sort in descending order

			const responseArray = [];
			const maxLevels = Math.min(data.recent.levels, levelIds.length);

			const selectedLevels =
				data.recent.order === "RANDOM"
					? Array.from({ length: maxLevels }, () => levelIds.splice(getRandomInt(0, levelIds.length), 1)[0])
					: levelIds.slice(0, maxLevels);

			for (const levelId of selectedLevels) {
				const file = Bun.file(`./levels/${levelId}.json`);
				if (await file.exists()) {
					const json = await file.json();
					responseArray.push(
						levelId.toString(),
						json.name || "Untitled Level",
						json.author || "Unknown",
						json.difficulty || "0"
					);
				}
			}

			// Log IP and request information
			if (data.server.logging) {
				const clientIP = sanitizeIP(server.requestIP(request).address);
				console.log(`${getTime()} - ${clientIP} requested recent levels.`);
			}

			return new Response(responseArray.join("\n"));
		} catch (err) {
			console.error(err);
			return new Response("An error occurred", { status: 500 });
		}
	})
	.post("3Dash/upload", async ({ server, request }) => {
		if (!data.uploading.allowed) return new Response("Uploading is not allowed on this server.", { status: 403 });
		
		try {
			const json = await request.json();

			if (!validateLevelData(json)) return new Response("Invalid level data", { status: 400 });
			const files = await readdir("./levels/");

			let highestId = 0;
			for (const file of files) {
				if (file.endsWith('.json')) {
					const id = parseInt(file.replace(".json", ""));
					if (!isNaN(id) && id > highestId) {
						highestId = id;
					}
				}
			}

			const id = highestId + 1;

			// Log IP and request information
			if (data.server.logging) {
				const clientIP = sanitizeIP(server.requestIP(request).address);
				console.log(`${getTime()} - ${clientIP} uploaded level ${id}.`);
			}

			const filename = `./levels/${id}.json`;
			await Bun.write(filename, JSON.stringify(json));
			return new Response(id.toString(), { status: 200 });
		} catch (err) {
			return new Response("An error occurred processing your request", { status: 400 });
		}
	})
	.use(rateLimit())
	.onRequest(({ server, request }) => {
		const ip = server.requestIP(request).address;

		if (data.server.ip_blacklist.includes(ip)) {
			console.log(`Blocked request from blacklisted IP: ${ip}`);
			return new Response(data.server.blacklisted_message, { status: 403 }); 
		}
	})
	.listen(data.server.port, ({ hostname, port }) => {
		// Initial logging
		console.log(`Server running at http://${hostname}:${port}/`);
		console.log(`\nConfiguration report:`);
		console.log(`Server logging is ${data.server.logging ? "ENABLED" : "DISABLED"}`);
		console.log(`Uploading is ${data.uploading.allowed ? "ENABLED" : "DISABLED"}.`);
		console.log(`Recent levels order method is ${data.recent.order === "LAST" ? "LAST" : "RANDOM"}.`);
		console.log(`Server will serve the last ${data.recent.levels} recent levels.\n`);
	})