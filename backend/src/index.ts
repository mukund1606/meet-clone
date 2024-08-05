import cors from 'cors';
import express from 'express';
import http from 'http';
import * as mediasoup from 'mediasoup';
import { Worker } from 'mediasoup/node/lib/Worker';
import { config } from './config/server';
import { SocketServer } from './services/SocketServer';

const app = express();
app.use(cors());
app.use(express.json());

let workers: Worker[] = [];
export let nextMediasoupWorkerIdx = 0;

(async () => {
	await createWorkers();
})();

async function createWorkers() {
	let { numWorkers } = config.mediasoup;

	for (let i = 0; i < numWorkers; i++) {
		let worker = await mediasoup.createWorker({
			logLevel: config.mediasoup.worker.logLevel,
			logTags: config.mediasoup.worker.logTags,
			rtcMinPort: config.mediasoup.worker.rtcMinPort,
			rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
		});
		worker.on('died', () => {
			console.error(
				'mediasoup worker died, exiting in 2 seconds... [pid:%d]',
				worker.pid
			);
			setTimeout(() => process.exit(1), 2000);
		});
		workers.push(worker);
	}
	console.log('Total workers created', workers.length);
}

const port = process.env.PORT ?? 5000;
const server = http.createServer(app);
new SocketServer(server);

server.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});

export function getMediasoupWorker() {
	const worker = workers[nextMediasoupWorkerIdx];
	if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
	return worker;
}
