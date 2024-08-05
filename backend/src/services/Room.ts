// import { DtlsParameters } from 'mediasoup/node/lib/fbs/web-rtc-transport';
import {
	DtlsParameters,
	MediaKind,
	Router,
	RtpCapabilities,
	RtpParameters,
	Worker,
} from 'mediasoup/node/lib/types';
import {
	ClientToServerEvents,
	config,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
	WebSocketEventType,
} from 'shared/lib/server';
import * as io from 'socket.io';
import { logger } from '../logger';
import Peer from './Peer';

export default class Room {
	id: string;
	io: io.Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>;
	_peers: Map<string, Peer>;
	private _router: Router | null = null;

	constructor(id: string, io: io.Server, worker: Worker) {
		this.id = id;
		this.io = io;
		this._peers = new Map();
		const mediaCodecs = config.mediasoup.router.mediaCodecs;
		worker.createRouter({ mediaCodecs }).then((router) => {
			this._router = router;
		});
	}

	public createPeer(name: string, isAdmin: boolean, socketId: string) {
		if (this._peers.has(socketId)) {
			return;
		}
		this._peers.set(socketId, new Peer(socketId, name, isAdmin));
		return this._peers.get(socketId)!;
	}

	public removePeer(socketId: string) {
		const peer = this._peers.get(socketId);
		if (!peer) {
			logger('ERROR', 'No peer found with the given socket id');
			return;
		}
		this._peers.delete(socketId);
		return peer;
	}

	public addPeer(peer: Peer) {
		const peerExists = this._peers.has(peer.id);
		if (peerExists) {
			logger('ERROR', 'Peer already exists');
			return;
		}
		this._peers.set(peer.id, peer);
	}

	public getCurrentPeers(socketId: string) {
		const peers: { id: string; name: string }[] = [];
		Array.from(this._peers.keys())
			.filter((key) => key !== socketId)
			.forEach((peerId) => {
				if (this._peers.has(peerId)) {
					const { id, name } = this._peers.get(peerId)!;
					peers.push({ id, name });
				}
			});

		return peers;
	}

	public async createWebRtcTransport(socketId: string) {
		const { maxIncomingBitrate, initialAvailableOutgoingBitrate } =
			config.mediasoup.webRtcTransport;

		const transport = await this._router?.createWebRtcTransport({
			listenIps: config.mediasoup.webRtcTransport.listenIps,
			enableUdp: true,
			enableTcp: true,
			preferUdp: true,
			initialAvailableOutgoingBitrate,
		})!;

		if (maxIncomingBitrate) {
			try {
				await transport.setMaxIncomingBitrate(maxIncomingBitrate);
			} catch (error) {}
		}

		transport.on('dtlsstatechange', (dtlsState) => {
			if (dtlsState === 'closed') {
				console.log('Transport close', {
					name: this._peers.get(socketId)?.name,
				});
				transport.close();
			}
		});

		transport.on('@close', () => {
			console.log('Transport close', { name: this._peers.get(socketId)?.name });
		});

		console.log('Adding transport', { transportId: transport.id });
		this._peers.get(socketId)?.addTransport(transport);

		return {
			params: {
				id: transport.id,
				iceParameters: transport.iceParameters,
				iceCandidates: transport.iceCandidates,
				dtlsParameters: transport.dtlsParameters,
			},
		};
	}

	public async connectPeerTransport(
		socketId: string,
		transportId: string,
		dtlsParameters: DtlsParameters
	) {
		const peer = this._peers.get(socketId);
		if (!peer) {
			logger('ERROR', 'NO PEER FOUND WITH SOCKET ID');
			return;
		}
		await peer.connectTransport(transportId, dtlsParameters);
	}

	public getRouterRtpCapabilties() {
		return this._router?.rtpCapabilities;
	}
	getProducerListForPeer() {
		let producerList: {
			userId: string;
			producer_id: string;
			isScreenShare: boolean;
		}[] = [];
		this._peers.forEach((peer) => {
			peer.producers_.forEach((producer) => {
				console.log('PRODUCER_CHECK', peer.name, producer.appData);
				producerList.push({
					userId: peer.id,
					producer_id: producer.id,
					isScreenShare: producer.isScreenShare ? true : false,
				});
			});
		});
		return producerList;
	}

	public produce(
		socketId: string,
		producerTransportId: string,
		rtpParameters: RtpParameters,
		kind: MediaKind,
		isScreenShare: boolean
	) {
		return new Promise(async (resolve, reject) => {
			let producer = await this._peers
				.get(socketId)!
				.createProducer(
					producerTransportId,
					rtpParameters,
					kind,
					isScreenShare
				);
			resolve(producer.id);
			const peer = this._peers.get(socketId);
			if (!peer) {
				return;
			}
			if (peer.isPeerAdmin()) {
				const others = Array.from(this._peers.keys()).filter(
					(id) => id !== socketId
				);
				console.log(others);
				for (let otherID of others) {
					this.io.to(otherID).emit(WebSocketEventType.NEW_PRODUCERS, [
						{
							producer_id: producer.id,
							userId: socketId,
							isScreenShare,
						},
					]);
				}
			} else {
				const others = Array.from(this._peers.values())
					.filter((p) => p.id !== socketId && p.isPeerAdmin())
					.map((p) => p.id);
				console.log(others);
				for (let otherID of others) {
					this.io.to(otherID).emit(WebSocketEventType.NEW_PRODUCERS, [
						{
							producer_id: producer.id,
							userId: socketId,
							isScreenShare,
						},
					]);
				}
			}
		});
	}

	async consume(
		socket_id: string,
		consumer_transport_id: string,
		producer_id: string,
		rtpCapabilities: RtpCapabilities
	) {
		const routerCanConsume = this._router?.canConsume({
			producerId: producer_id,
			rtpCapabilities,
		});
		if (!routerCanConsume) {
			console.warn('Router cannot consume the given producer');
			return;
		}

		const peer = this._peers.get(socket_id);

		if (!peer) {
			console.warn('No Peer found with the given Id');
			return;
		}

		const consumer_created = await peer.createConsumer(
			consumer_transport_id,
			producer_id,
			rtpCapabilities
		);

		if (!consumer_created) {
			console.log("Couldn't create consumer");
			return;
		}

		const { consumer, params } = consumer_created;

		consumer.on('producerclose', () => {
			console.log('Consumer closed due to close event in producer id', {
				name: peer.name,
				consumer_id: consumer.id,
			});

			peer.removeConsumer(consumer.id);

			this.io.to(socket_id).emit(WebSocketEventType.CONSUMER_CLOSED, {
				consumer_id: consumer.id,
			});
		});

		return params;
	}

	closeProducer(producer_id: string, socketId: string) {
		const peer = this._peers.get(socketId);
		if (!peer) {
			console.log('No peeer found with the  socket id');
			return;
		}
		peer.closeProducer(producer_id);
		if (peer.isPeerAdmin()) {
			const others = Array.from(this._peers.keys()).filter(
				(id) => id !== socketId
			);
			console.log(others);
			for (let otherID of others) {
				this.io.to(otherID).emit(WebSocketEventType.PRODUCER_CLOSED, {
					producer_id,
					userId: peer.id,
				});
			}
		} else {
			const others = Array.from(this._peers.values())
				.filter((p) => p.id !== socketId && p.isPeerAdmin())
				.map((p) => p.id);
			console.log(others);
			for (let otherID of others) {
				this.io.to(otherID).emit(WebSocketEventType.PRODUCER_CLOSED, {
					producer_id,
					userId: peer.id,
				});
			}
		}
		return;
	}
}
