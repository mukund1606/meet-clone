import * as http from 'http';
import * as io from 'socket.io';
import { getMediasoupWorker } from '..';
import {
	ClientToServerEvents,
	InterServerEvents,
	ServerToClientEvents,
	SocketData,
	WebSocketEventType,
} from '../config/server';
import { logger } from '../logger';
import Room from './Room';

export class SocketServer {
	private _io: io.Server<
		ClientToServerEvents,
		ServerToClientEvents,
		InterServerEvents,
		SocketData
	>;
	private _roomList: Map<string, Room>;
	private _waitingRoomList: Map<string, Room>;

	constructor(server: http.Server) {
		console.log('Initializing socket server');
		this._io = new io.Server(server, {
			cors: {
				origin: '*',
			},
		});
		this._roomList = new Map();
		this._waitingRoomList = new Map();
		try {
			this.listenToWebSockets(this._io);
		} catch (error) {
			console.log('ERROR in socket', error);
		}
	}

	getRoomAdminIds(roomId: string): string[] {
		const room = this._roomList.get(roomId);
		if (!room) {
			return [];
		}
		const peers = Array.from(room._peers.values());
		const admins = peers
			.filter((peer) => peer.isPeerAdmin())
			.map((peer) => peer.id);
		return admins;
	}

	getRoomUserIds(roomId: string): string[] {
		const room = this._roomList.get(roomId);
		if (!room) {
			return [];
		}
		return Array.from(room._peers.keys());
	}

	getWaitingRoomUserIds(roomId: string): string[] {
		const waitingRoom = this._waitingRoomList.get(`waitingRoom-${roomId}`);
		if (!waitingRoom) {
			return [];
		}
		return Array.from(waitingRoom._peers.keys());
	}

	listenToWebSockets(
		io: io.Server<
			ClientToServerEvents,
			ServerToClientEvents,
			InterServerEvents,
			SocketData
		>
	) {
		io.on('connection', (socket) => {
			const name = (socket.handshake.headers['data-name'] ?? 'User') as string;
			const isAdmin = socket.handshake.headers['data-admin'] === 'true';
			console.log(`${name} Connected`);
			socket.data.isAdmin = isAdmin;
			socket.data.name = name;

			// DONE: CREATE ROOM EVENT(ADMIN ONLY)
			socket.on(WebSocketEventType.CREATE_ROOM, ({ roomId }, cb) => {
				if (!isAdmin) {
					cb({ type: 'error', err: 'You are not authorized to create a room' });
					return;
				}
				if (!roomId) {
					console.error(
						'No Room Id provided to create room',
						socket.id,
						socket.data.name
					);
					cb({ type: 'error', err: 'No Room Id provided to create room' });
					return;
				}
				const roomExists = this._roomList.has(roomId);
				const waitingRoomExists = this._waitingRoomList.has(roomId);
				if (roomExists || waitingRoomExists) {
					console.error('Room already exists', socket.id, socket.data.name);
					cb({ type: 'error', err: 'Room already exists' });
					return;
				}
				// TODO: To be implemented
				const worker = getMediasoupWorker();
				this._roomList.set(roomId, new Room(roomId, io, worker));
				this._waitingRoomList.set(
					`waitingRoom-${roomId}`,
					new Room(`waitingRoom-${roomId}`, io, worker)
				);
				console.log('Created room', roomId);
				cb({ type: 'success', res: 'Room Created Successfully' });
			});

			// DONE: DISCONNECT EVENT
			socket.on(WebSocketEventType.DISCONNECT, () => {
				socket.leave(socket.data.roomId ?? '');
				console.log(`${name} disconnected`);
			});

			// DONE: JOIN ROOM EVENT
			socket.on(WebSocketEventType.JOIN_ROOM, ({ roomId }, cb) => {
				if (isAdmin) {
					const room = this._roomList.get(roomId);
					if (!room) {
						cb({ type: 'error', err: 'Room not found' });
						return;
					}
					const peer = room.createPeer(name, isAdmin, socket.id);
					socket.data.roomId = roomId;
					const peersInRoom = Array.from(room._peers.values()).filter(
						(p) => p.id !== socket.id
					);
					if (peersInRoom.length <= 0) {
						console.log('No peers in room');
					} else {
						io.to(peersInRoom.map((p) => p.id)).emit(
							WebSocketEventType.USER_JOINED,
							{
								message: `${name} joined the room`,
								user: peer
									? {
											id: peer.id,
											name: peer.name,
											isAdmin: peer.isPeerAdmin(),
									  }
									: undefined,
							}
						);
					}
					socket.join(roomId);
					console.log('User Joined Room', { name, roomId });
					cb({ type: 'success', res: 'Room Joined Successfully' });
				} else {
					const waitingRoom = this._waitingRoomList.get(
						`waitingRoom-${roomId}`
					);
					if (!waitingRoom) {
						cb({ type: 'error', err: 'Waiting Room not found' });
						return;
					}
					const peer = waitingRoom.createPeer(name, isAdmin, socket.id);
					socket.data.roomId = roomId;
					io.to(this.getRoomAdminIds(roomId)).emit(
						WebSocketEventType.USER_JOINED_WAITING_ROOM,
						{
							message: `${name} is in waiting room`,
							user: peer
								? {
										id: peer.id,
										name: peer.name,
										isAdmin: peer.isPeerAdmin(),
								  }
								: undefined,
						}
					);
					socket.join(roomId);
					console.log('User Joined Waiting Room', { name, roomId });
					cb({ type: 'success', res: 'Waiting Room Joined Successfully' });
				}
			});

			// DONE: GET ROOM USERS
			socket.on(WebSocketEventType.GET_IN_ROOM_USERS, (cb) => {
				const room = this._roomList.get(`${socket.data.roomId}`);
				if (!room) {
					cb({ type: 'error', err: 'Room not found' });
					return;
				}
				if (!socket.data.isAdmin) {
					const roomAdmins = Array.from(room._peers.values()).filter((peer) =>
						peer.isPeerAdmin()
					);
					cb({
						type: 'success',
						res: roomAdmins.map((peer) => ({
							id: peer.id,
							name: peer.name,
							isAdmin: peer.isPeerAdmin(),
						})),
					});
					return;
				}
				const peers = Array.from(room._peers.keys())
					.map((id) => ({
						id,
						name: room._peers.get(id)!.name,
						isAdmin: room._peers.get(id)!.isPeerAdmin(),
					}))
					.filter((peer) => peer.id !== socket.id);
				cb({ type: 'success', res: peers });
			});

			// DONE: GET WAITING ROOM USERS
			socket.on(WebSocketEventType.GET_IN_WAITING_ROOM_USERS, (cb) => {
				if (!socket.data.isAdmin) {
					cb({
						type: 'error',
						err: 'You are not authorized to get waiting room users',
					});
					return;
				}
				const waitingRoom = this._waitingRoomList.get(
					`waitingRoom-${socket.data.roomId}`
				);
				if (!waitingRoom) {
					cb({ type: 'error', err: 'Waiting Room not found' });
					return;
				}
				const peers = Array.from(waitingRoom._peers.keys()).map((id) => ({
					id,
					name: waitingRoom._peers.get(id)!.name,
					isAdmin: waitingRoom._peers.get(id)!.isPeerAdmin(),
				}));
				cb({ type: 'success', res: peers });
			});

			// DONE: Accept Waiting Room User
			socket.on(WebSocketEventType.ACCEPT_USER, ({ peerId }, cb) => {
				if (!socket.data.isAdmin) {
					cb({ type: 'error', err: 'You are not authorized to accept a user' });
					return;
				}
				const room = this._roomList.get(socket.data.roomId ?? '');
				const waitingRoom = this._waitingRoomList.get(
					`waitingRoom-${socket.data.roomId}`
				);
				if (!waitingRoom || !room) {
					cb({ type: 'error', err: 'Room not found' });
					return;
				}
				const peer = waitingRoom.removePeer(peerId);
				if (!peer) {
					cb({ type: 'error', err: 'User not found' });
					return;
				}
				room.addPeer(peer);
				io.to(peer.id).emit(WebSocketEventType.USER_ACCEPTED, {
					message: 'User accepted successfully',
				});
				const adminsIds = this.getRoomAdminIds(socket.data.roomId ?? '');
				io.to(adminsIds).emit(WebSocketEventType.USER_ACCEPTED, {
					message: `${peer.name} joined the room`,
				});
				cb({ type: 'success', res: 'User accepted successfully' });
			});

			// DONE: Reject Waiting Room User
			socket.on(WebSocketEventType.REJECT_USER, ({ peerId }, cb) => {
				if (!socket.data.isAdmin) {
					cb({ type: 'error', err: 'You are not authorized to accept a user' });
					return;
				}
				const waitingRoom = this._waitingRoomList.get(
					`waitingRoom-${socket.data.roomId}`
				);
				if (!waitingRoom) {
					cb({ type: 'error', err: 'Room not found' });
					return;
				}
				io.to(peerId).emit(WebSocketEventType.USER_REJECTED, {
					message: 'User rejected successfully',
				});
				cb({ type: 'success', res: 'User rejected successfully' });
			});

			// DONE: Remove Room User
			socket.on(WebSocketEventType.KICK_USER, ({ peerId }, cb) => {
				if (!socket.data.isAdmin) {
					cb({ type: 'error', err: 'You are not authorized to accept a user' });
					return;
				}
				const room = this._roomList.get(`${socket.data.roomId}`);
				if (!room) {
					cb({ type: 'error', err: 'Room not found' });
					return;
				}
				io.to(peerId).emit(WebSocketEventType.USER_KICKED, {
					message: 'User removed from room',
				});
				const peer = room.removePeer(peerId);
				if (peer?.isPeerAdmin) {
					cb({ type: 'error', err: 'You cannot kick an admin' });
					return;
				}
				io.to(this.getRoomAdminIds(socket.data.roomId ?? '')).emit(
					WebSocketEventType.USER_LEFT,
					{
						message: `${socket.data.name} left the room`,
						user: {
							id: peer?.id ?? '',
							name: peer?.name ?? '',
							isAdmin: peer?.isPeerAdmin() ?? false,
						},
					}
				);
				cb({ type: 'success', res: 'User removed from room' });
			});

			// DONE: EXIT ROOM EVENT
			socket.on(WebSocketEventType.EXIT_ROOM, (cb) => {
				console.log(`${name} exiting room`);
				if (!socket.data.roomId) {
					cb({ type: 'error', err: 'No Room Id provided to exit room' });
					return;
				}
				const room = this._roomList.get(socket.data.roomId);
				const waitingRoom = this._waitingRoomList.get(
					`waitingRoom-${socket.data.roomId}`
				);
				if (!room || !waitingRoom) {
					cb({ type: 'error', err: 'Room not found' });
					return;
				}
				const peer = room.removePeer(socket.id);
				const waitingPeer = waitingRoom.removePeer(socket.id);
				if (peer) {
					if (socket.data.isAdmin) {
						const peersInRoom = Array.from(room._peers.values()).filter(
							(p) => p.id !== socket.id
						);
						if (peersInRoom.length <= 0) {
							console.log('No peers in room');
							return;
						}
						io.to(peersInRoom.map((p) => p.id)).emit(
							WebSocketEventType.USER_LEFT,
							{
								message: `${socket.data.name} left the room`,
								user: {
									id: peer.id,
									name: peer.name,
									isAdmin: peer.isPeerAdmin(),
								},
							}
						);
					} else {
						io.to(this.getRoomAdminIds(socket.data.roomId)).emit(
							WebSocketEventType.USER_LEFT,
							{
								message: `${socket.data.name} left the room`,
								user: {
									id: peer.id,
									name: peer.name,
									isAdmin: peer.isPeerAdmin(),
								},
							}
						);
					}
				} else if (waitingPeer) {
					io.to(this.getRoomAdminIds(socket.data.roomId)).emit(
						WebSocketEventType.USER_LEFT_WAITING_ROOM,
						{
							message: `${socket.data.name} left the waiting room`,
							user: {
								id: waitingPeer.id,
								name: waitingPeer.name,
								isAdmin: false,
							},
						}
					);
				} else {
					cb({ type: 'error', err: 'User not found' });
				}
				socket.leave(room.id);
				socket.disconnect();
			});

			// NOTE: Modify Later
			// DONE: Get Router RTP Capabilities
			socket.on(WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES, (cb) => {
				const room = this._roomList.get(socket.data.roomId ?? '');
				// logger(
				// 	WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
				// 	room?._peers.get(socket.id)
				// );
				if (!room) {
					logger('ERROR', "Couldn't find room");
					cb({ type: 'error', err: 'Room not found' });
					return;
				}
				const rtp = room?.getRouterRtpCapabilties();
				if (!rtp) {
					logger('ERROR', "Couldn't find RTP capabilities");
					cb({ type: 'error', err: 'No RTP capabilities found' });
					return;
				}
				cb({ type: 'success', res: rtp });
				return;
			});

			// DONE: Get Producers
			socket.on(WebSocketEventType.GET_PRODUCERS, (cb) => {
				const room = this._roomList.get(socket.data.roomId ?? '');
				if (!room) {
					logger('ERROR', "Couldn't find room");
					cb({ type: 'error', err: 'Room not found' });
					return;
				}
				logger(WebSocketEventType.GET_PRODUCERS, room._peers.get(socket.id));
				let producerList = room.getProducerListForPeer();
				cb({ type: 'success', res: producerList });
				return;
			});

			// DONE: Create WebRTC Transport
			socket.on(WebSocketEventType.CREATE_WEBRTC_TRANSPORT, async (_, cb) => {
				const room = this._roomList.get(socket.data.roomId ?? '');
				if (!room) {
					logger(WebSocketEventType.ERROR, "Couldn't find room");
					cb({ type: 'error', err: "Couldn't find room" });
					return;
				}
				logger(WebSocketEventType.CREATED_WEBRTC_TRANSPORT, {
					name: room._peers.get(socket.id)?.name,
				});
				const params = await room.createWebRtcTransport(socket.id);
				cb({ type: 'success', res: params.params });
				return;
			});

			// DONE: Connect Transport
			socket.on(
				WebSocketEventType.CONNECT_TRANSPORT,
				async ({ transport_id, dtlsParameters }, cb) => {
					const room = this._roomList.get(socket.data.roomId ?? '');

					if (!room) {
						logger(WebSocketEventType.ERROR, "Couldn't find room");
						return;
					}
					logger(WebSocketEventType.CONNECT_TRANSPORT, {
						name: room._peers.get(socket.id),
					});
					await room.connectPeerTransport(
						socket.id,
						transport_id,
						dtlsParameters
					);

					cb({ type: 'success', res: 'Successfully connected' });
				}
			);

			// DONE: Produce
			socket.on(
				WebSocketEventType.PRODUCE,
				async (
					{ kind, rtpParameters, producerTransportId, isScreenShare },
					cb
				) => {
					console.log('IN PRODUCE EVENT');

					const room = this._roomList.get(socket.data.roomId ?? '');

					if (!room) {
						return cb({ err: 'Room not found', type: 'error' });
					}

					let producer_id = (await room.produce(
						socket.id,
						producerTransportId,
						rtpParameters,
						kind,
						isScreenShare
					)) as string;

					logger(WebSocketEventType.PRODUCE, {
						type: `${kind}`,
						name: `${room._peers.get(socket.id)!.name}`,
						id: `${producer_id}`,
					});

					cb({
						type: 'success',
						res: { producer_id, userId: '', isScreenShare },
					});
				}
			);

			// DONE: Close Producer
			socket.on(WebSocketEventType.CLOSE_PRODUCER, ({ producerId }) => {
				const room = this._roomList.get(socket.data.roomId ?? '');
				if (!room) {
					return;
				}
				console.log(WebSocketEventType.CLOSE_PRODUCER, producerId);
				room.closeProducer(producerId, socket.id);
			});

			// DONE: Consume
			socket.on(
				WebSocketEventType.CONSUME,
				async ({ consumerTransportId, producerId, rtpCapabilities }, cb) => {
					const room = this._roomList.get(socket.data.roomId ?? '');
					if (!room) {
						console.warn('No room associated with the id ');
						return;
					}
					const params = await room.consume(
						socket.id,
						consumerTransportId,
						producerId,
						rtpCapabilities
					);
					if (!params) {
						console.log("Consumer params couldn't be passed");
						return;
					}
					cb({
						type: 'success',
						res: params,
					});
				}
			);
		});
	}
}
