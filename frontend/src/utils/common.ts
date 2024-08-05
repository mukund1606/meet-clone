import type {
  MediaKind,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/node/lib/RtpParameters";
import type {
  DtlsParameters,
  IceCandidate,
  IceParameters,
} from "mediasoup/node/lib/types";

export enum WebSocketEventType {
  // ROOM EVENTS
  CREATE_ROOM = "createRoom",
  JOIN_ROOM = "joinRoom",
  EXIT_ROOM = "exitRoom",
  USER_LEFT = "userLeft",
  USER_JOINED = "userJoined",

  // ADMIN EVENTS
  USER_JOINED_WAITING_ROOM = "userJoinedWaitingRoom",
  USER_LEFT_WAITING_ROOM = "userLeftWaitingRoom",
  ACCEPT_USER = "acceptUser",
  REJECT_USER = "rejectUser",
  GET_IN_ROOM_USERS = "getInRoomUsers",
  GET_IN_WAITING_ROOM_USERS = "getInWaitingRoomUsers",
  KICK_USER = "kickUser",
  USER_MOVE_FROM_WAITING_ROOM_TO_ROOM = "userMoveFromWaitingRoomToRoom",

  ERROR = "error",
  DISCONNECT = "disconnect",

  CLOSE_PRODUCER = "closeProducer",

  // SERVER SIDE EVENTS
  GET_PRODUCERS = "getProducers",
  GET_ROUTER_RTP_CAPABILITIES = "getRouterRtpCapabilities",
  CREATE_WEBRTC_TRANSPORT = "createWebRtcTransport",
  CONNECT_TRANSPORT = "connectTransport",
  PRODUCE = "produce",
  CONSUME = "consume",
  GET_MY_ROOM_INFO = "getMyRoomInfo",
  PRODUCER_CLOSED = "producerClosed",
  CONSUMER_CLOSED = "consumerClosed",

  // CLIENT SIDE EVENTS
  ROOM_CREATED_MESSAGE = "createdRoom",
  NEW_PRODUCERS = "newProducers",
  PRODUCED = "produced",
  ROUTER_RTP_CAPABILITIES = "routerRtpCapabilities",
  CREATED_WEBRTC_TRANSPORT = "createdWebRtcTransport",
  CONSUMED = "consumed",
  ROOM_INFO = "roomInfo",
  JOINED_ROOM_MESSAGE = "joinedRoom",
  USER_ACCEPTED = "userAccepted",
  USER_REJECTED = "userRejected",
  USER_KICKED = "userKicked",
}

// NOTE: Didn't understand this will come back to it later
export interface ServerSocketCallback {
  (
    data: { type: "success"; res: string } | { type: "error"; err: string },
  ): void;
}

export interface GetInWaitingRoomUsersCallback {
  (
    data:
      | { type: "success"; res: Array<Peer> }
      | { type: "error"; err: string },
  ): void;
}

export interface RouterRtpCapabilitiesCallback {
  (
    data:
      | { type: "success"; res: RtpCapabilities }
      | { type: "error"; err: string },
  ): void;
}

export interface WebRtcTransportCallback {
  (
    data:
      | { type: "success"; res: webRtcTransportParams }
      | { type: "error"; err: string },
  ): void;
}

export interface GetProducersCallback {
  (
    data:
      | { type: "success"; res: Array<ProducerContainer> }
      | { type: "error"; err: string },
  ): void;
}

export interface ProduceCallback {
  (
    data:
      | { type: "success"; res: ProducerContainer }
      | { type: "error"; err: string },
  ): void;
}

export interface ConsumeCallback {
  (
    data:
      | { type: "success"; res: ConsumerResult }
      | { type: "error"; err: string },
  ): void;
}
export interface CloseProducerCallback {
  (
    data:
      | { type: "success"; res: ConsumerResult }
      | { type: "error"; err: string },
  ): void;
}

export interface ServerToClientEvents {
  createRoom: (data: { roomId: string }, cb: ServerSocketCallback) => void;
  joinRoom: (data: { roomId: string }, cb: ServerSocketCallback) => void;
  userJoined: (data: { message: string; user?: Peer }) => void;
  userJoinedWaitingRoom: (data: { message: string; user?: Peer }) => void;

  userAccepted: (data: { message: string }) => void;
  userRejected: (data: { message: string }) => void;
  userKicked: (data: { message: string }) => void;
  userLeft: (data: { message: string; user?: Peer }) => void;
  userLeftWaitingRoom: (data: { message: string; user?: Peer }) => void;

  // Room Events
  consumerClosed: (data: { consumer_id: string }) => void;
  newProducers: (data: Array<ProducerContainer>) => void;
  producerClosed: (data: { producer_id: string; userId: string }) => void;
}

export interface ClientToServerEvents {
  createRoom: (data: { roomId: string }, cb: ServerSocketCallback) => void;
  joinRoom: (data: { roomId: string }, cb: ServerSocketCallback) => void;

  getInRoomUsers: (cb: GetInWaitingRoomUsersCallback) => void;
  getInWaitingRoomUsers: (cb: GetInWaitingRoomUsersCallback) => void;
  acceptUser: (data: { peerId: string }, cb: ServerSocketCallback) => void;
  rejectUser: (data: { peerId: string }, cb: ServerSocketCallback) => void;
  kickUser: (data: { peerId: string }, cb: ServerSocketCallback) => void;
  exitRoom: (cb: ServerSocketCallback) => void;

  getRouterRtpCapabilities: (cb: RouterRtpCapabilitiesCallback) => void;
  createWebRtcTransport: (
    data: { forceTcp: boolean; rtpCapabilities?: RtpCapabilities },
    cb: WebRtcTransportCallback,
  ) => void;
  connectTransport: (
    data: { transport_id: string; dtlsParameters: DtlsParameters },
    cb: ServerSocketCallback,
  ) => void;
  getProducers: (cb: GetProducersCallback) => void;
  produce: (
    data: {
      producerTransportId: string;
      kind: MediaKind;
      rtpParameters: RtpParameters;
      isScreenShare: boolean;
    },
    cb: ProduceCallback,
  ) => void;
  consume: (
    data: {
      rtpCapabilities: RtpCapabilities;
      consumerTransportId: string;
      producerId: string;
    },
    cb: ConsumeCallback,
  ) => void;
  closeProducer: (data: { producerId: string }) => void;
}

export interface SocketData {
  name: string;
  isAdmin: boolean;
  roomId?: string;
}

export interface Peer {
  id: string;
  name: string;
  isAdmin: boolean;
}

export interface webRtcTransportParams {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
}

export interface ProducerContainer {
  producer_id: string;
  userId: string;
  isScreenShare: boolean;
}

export interface ConsumerResult {
  producerId: string;
  id: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
  type: unknown;
  producerPaused: boolean;
}
