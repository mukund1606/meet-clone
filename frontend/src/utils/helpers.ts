import type { RtpCapabilities } from "mediasoup-client/lib/RtpParameters";
import {
  type CustomSocket,
  type Peer,
  type ProducerContainer,
  WebSocketEventType,
} from "./client";

export async function createRoom(
  socket: CustomSocket,
  roomId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.emit(WebSocketEventType.CREATE_ROOM, { roomId: roomId }, (data) => {
      if (data.type === "success") {
        resolve(data.res);
      } else {
        if (data.err === "Room already exists") {
          resolve(data.err);
        } else {
          reject(data.err);
        }
      }
    });
  });
}

export async function joinRoom(
  socket: CustomSocket,
  roomId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    socket.emit(WebSocketEventType.JOIN_ROOM, { roomId: roomId }, (data) => {
      if (data.type === "success") {
        resolve(data.res);
      } else {
        reject(data.err);
      }
    });
  });
}

export async function getInWaitingRoomUsers(
  socket: CustomSocket,
): Promise<Array<Peer>> {
  return new Promise((resolve, reject) => {
    socket.emit(WebSocketEventType.GET_IN_WAITING_ROOM_USERS, (data) => {
      if (data.type === "success") {
        resolve(data.res);
      } else {
        reject(data.err);
      }
    });
  });
}

export async function getInRoomUsers(
  socket: CustomSocket,
): Promise<Array<Peer>> {
  return new Promise((resolve, reject) => {
    socket.emit(WebSocketEventType.GET_IN_ROOM_USERS, (data) => {
      if (data.type === "success") {
        resolve(data.res);
      } else {
        reject(data.err);
      }
    });
  });
}

export async function getRouterRTPCapabilties(
  socket: CustomSocket,
): Promise<RtpCapabilities> {
  return new Promise((resolve, reject) => {
    socket.emit(
      WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
      async (data) => {
        if (data.type === "success") {
          resolve(data.res);
        } else {
          // console.error(data.err);
          reject(data.err);
        }
      },
    );
  });
}

export async function getProducers(
  socket: CustomSocket,
): Promise<ProducerContainer[]> {
  return new Promise((resolve, reject) => {
    socket.emit(WebSocketEventType.GET_PRODUCERS, (data) => {
      if (data.type === "success") {
        resolve(data.res);
      } else {
        reject(data.err);
      }
    });
  });
}

export function closeProducer(socket: CustomSocket, producerId: string): void {
  socket.emit(WebSocketEventType.CLOSE_PRODUCER, {
    producerId,
  });
}

export async function requestMicAndCamAccess() {
  try {
    let stream: MediaStream;
    if (navigator.userAgent.includes("Firefox")) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const device = devices[0];
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { deviceId: device?.deviceId },
      });
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
    }
    stream?.getTracks?.().forEach((track) => track?.stop?.());
    return stream;
  } catch (error) {
    console.log("Error in requesting access", error);
    return null;
  }
}
