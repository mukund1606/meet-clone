export * from './common';
import { RtpCodecCapability } from 'mediasoup/node/lib/RtpParameters';
import { WorkerLogLevel, WorkerLogTag } from 'mediasoup/node/lib/Worker';
import os from 'os';

const ifaces = os.networkInterfaces();

const getLocalIp = () => {
	let localIp = '127.0.0.1';
	Object.keys(ifaces).forEach((ifname) => {
		for (const iface of ifaces[ifname]!) {
			// Ignore IPv6 and 127.0.0.1
			if (iface.family !== 'IPv4' || iface.internal !== false) {
				continue;
			}
			// Set the local ip to the first IPv4 address found and exit the loop
			localIp = iface.address;
			return;
		}
	});
	return localIp;
};

const ANNOUNCED_IP = process.env.ANNOUNCED_IP
	? process.env.ANNOUNCED_IP !== ''
		? process.env.ANNOUNCED_IP
		: getLocalIp()
	: getLocalIp();
const MAX_PORT = process.env.MAX_PORT ? parseInt(process.env.MAX_PORT) : 10200;
const MIN_PORT = process.env.MIN_PORT ? parseInt(process.env.MIN_PORT) : 10000;

console.log('NUM_WORKERS', Object.keys(os.cpus()).length);
console.log('MIN_PORT', MIN_PORT);
console.log('MAX_PORT', MAX_PORT);
console.log('ANNOUNCED_IP', ANNOUNCED_IP);
export const config = {
	app: {
		port: 5000,
	},
	mediasoup: {
		// Worker settings
		numWorkers: Object.keys(os.cpus()).length,
		worker: {
			rtcMinPort: MIN_PORT,
			rtcMaxPort: MAX_PORT,
			logLevel: 'debug' as WorkerLogLevel,
			logTags: [
				'info',
				'ice',
				'dtls',
				'rtp',
				'srtp',
				'rtcp',
				// 'rtx',
				// 'bwe',
				// 'score',
				// 'simulcast',
				// 'svc'
			] as WorkerLogTag[],
		},
		// Router settings
		router: {
			mediaCodecs: [
				{
					kind: 'audio',
					mimeType: 'audio/opus',
					clockRate: 48000,
					channels: 2,
				},
				{
					kind: 'video',
					mimeType: 'video/VP8',
					clockRate: 90000,
					parameters: {
						'x-google-start-bitrate': 1000,
					},
				},
			] as RtpCodecCapability[],
		},
		// WebRtcTransport settings
		webRtcTransport: {
			listenIps: [
				{
					ip: '0.0.0.0',
					announcedIp: ANNOUNCED_IP, // replace by public IP address
				},
			],
			maxIncomingBitrate: 1500000,
			initialAvailableOutgoingBitrate: 1000000,
		},
	},
};
