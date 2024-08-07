import { cn } from "@/lib/utils";
import type { CustomWindow } from "@/types/customWindow";
import { type RemoteStream } from "@/utils";
import {
  type ConsumerResult,
  type CustomSocket,
  type Peer,
  type ProducerContainer,
  type webRtcTransportParams,
  WebSocketEventType,
} from "@/utils/client";
import {
  closeProducer,
  getInRoomUsers,
  getProducers,
  getRouterRTPCapabilties,
  joinRoom,
  requestMicAndCamAccess,
} from "@/utils/helpers";
import { Device } from "mediasoup-client";
import type {
  Consumer,
  Producer,
  RtpCapabilities,
  Transport,
} from "mediasoup-client/lib/types";
import React, { useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { AudioControl, EndControl, VideoControl } from "./Controls";
import Loading from "./Loading";
import { MemoizedLocalPannel, ScreenCarousel, UserCarousel } from "./NewPannel";
import { TooltipProvider } from "./ui/tooltip";

declare let window: CustomWindow;

export default function RoomComponent({
  roomId,
  name,
}: {
  roomId: string;
  name: string;
}) {
  // NOTE: Refs
  const socketRef = React.useRef<CustomSocket | null>(null);
  const DeviceRef = React.useRef<Device | null>(null);
  const ProducerRef = React.useRef<Transport | null>(null);
  const ConsumerRef = React.useRef<Transport | null>(null);
  const consumers = React.useRef<Map<string, Consumer>>(new Map());
  const videoProducer = React.useRef<Producer | null>(null);
  const audioProducer = React.useRef<Producer | null>(null);

  // NOTE: States
  const [isDisconnected, setIsDisconnected] = React.useState(false);
  const [isWaitingRoom, setIsWaitingRoom] = React.useState(true);
  const [roomUsers, setRoomUsers] = React.useState<Array<Peer>>([]);
  const [remoteStreams, setRemoteStreams] = React.useState<RemoteStream[]>([]);
  const [screenStreams, setScreenStreams] = React.useState<RemoteStream[]>([]);
  const [producers, setProducers] = React.useState<ProducerContainer[]>([]);
  const [screenProducers, setScreenProducers] = React.useState<
    ProducerContainer[]
  >([]);
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] =
    React.useState<MediaDeviceInfo>();
  const [selectedVideoDevice, setSelectedVideoDevice] =
    React.useState<MediaDeviceInfo>();
  const [isAudioEnabled, setIsAudioEnabled] = React.useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = React.useState(false);
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(
    null,
  );

  // NOTE: To Check and Modify Later
  const loadDevice = React.useCallback(async (rtp: RtpCapabilities) => {
    if (socketRef.current && !DeviceRef.current) {
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtp });
      DeviceRef.current = device;
      // console.log("--- Device Loaded successfully with RTP capabilities ---");
      return;
    } else {
      // console.error(
      //   "Couldn't load device. check socket or theres current active device",
      // );
      return;
    }
  }, []);

  // NOTE: To Check and Modify Later
  const createConsumerTransport = React.useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) {
      // console.error("Socket not connected");
      return;
    }
    if (ConsumerRef.current) {
      // console.log("Already initialized a consumer transport");
      return;
    }
    try {
      const data: { params: webRtcTransportParams } | null = await new Promise(
        (resolve, reject) => {
          socket.emit(
            WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
            { forceTcp: false },
            (response) => {
              if (response.type === "success") {
                resolve({ params: response.res });
              } else {
                // console.error(response.err);
                reject(response);
              }
            },
          );
        },
      );

      if (!data) {
        throw new Error("No Transport created");
      }
      // console.log("Consumer Transport :: ", data);
      if (!DeviceRef.current || !socketRef.current) {
        // console.error("No device or socket found");
        return;
      }
      ConsumerRef.current = DeviceRef.current.createRecvTransport(data.params);

      ConsumerRef.current.on("connect", ({ dtlsParameters }, cb, eb) => {
        socket.emit(
          WebSocketEventType.CONNECT_TRANSPORT,
          {
            transport_id: ConsumerRef.current!.id,
            dtlsParameters,
          },
          (response) => {
            if (response.type === "success") {
              cb();
            } else {
              eb(new Error(response.err));
            }
          },
        );
      });

      ConsumerRef.current.on("connectionstatechange", (state) => {
        // console.log("Consumer state", state);
        if (state === "connected") {
          // console.log("--- Connected Consumer Transport ---");
        }
        if (state === "disconnected") {
          ConsumerRef.current?.close();
        }
      });

      // TODO: Should I call getProducers here?
      const producers = await getProducers(socket);
      setProducers(producers.filter((p) => !p.isScreenShare));
      setScreenProducers(producers.filter((p) => p.isScreenShare));
    } catch (error) {
      console.log("error creating consumer transport", error);
    }
  }, []);

  // NOTE: To Check and Modify Later
  const createProducerTransport = React.useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) {
      // console.error("Socket not connected");
      return;
    }
    if (DeviceRef.current && socketRef.current) {
      // console.log("resp");
      const resp: { params: webRtcTransportParams } = await new Promise(
        (resolve, reject) => {
          socket.emit(
            WebSocketEventType.CREATE_WEBRTC_TRANSPORT,
            {
              forceTcp: false,
              rtpCapabilities: DeviceRef.current!.rtpCapabilities,
            },
            (data) => {
              if (data.type === "success") {
                resolve({ params: data.res });
              } else {
                reject(data.err);
              }
            },
          );
        },
      );
      // console.log(resp);

      ProducerRef.current = DeviceRef.current.createSendTransport(resp.params);

      // console.log("--- CREATE PRODUCER TRANSPORT ---");

      if (ProducerRef.current) {
        try {
          ProducerRef.current.on("connect", ({ dtlsParameters }, cb, eb) => {
            socket.emit(
              WebSocketEventType.CONNECT_TRANSPORT,
              {
                transport_id: ProducerRef.current!.id,
                dtlsParameters,
              },
              (data) => {
                if (data.type === "success") {
                  cb();
                } else {
                  eb(new Error(data.err));
                }
              },
            );
          });

          ProducerRef.current.on(
            "produce",
            ({ kind, rtpParameters, appData }, cb, eb) => {
              socket.emit(
                WebSocketEventType.PRODUCE,
                {
                  producerTransportId: ProducerRef.current!.id,
                  kind,
                  rtpParameters,
                  isScreenShare: appData.isScreenShare ? true : false,
                },
                (data) => {
                  if (data.type === "success") {
                    // console.log(data.res.producer_id);
                    cb({ id: data.res.producer_id });
                  } else {
                    // console.error(data.err);
                    eb(new Error(data.err));
                  }
                },
              );
            },
          );

          ProducerRef.current.on("connectionstatechange", (state) => {
            // console.log(state);
            switch (state) {
              case "disconnected":
                // console.log("Producer disconnected");
                break;
            }
          });

          return true;
        } catch (error) {
          console.log("Producer Creation error :: ", error);
        }
      }
    }
  }, []);

  const getConsumerStream = React.useCallback(async (producerId: string) => {
    const socket = socketRef.current;
    if (!socket) {
      // console.error("Socket not connected");
      return;
    }
    if (!DeviceRef.current) {
      // console.log("No device found");
      return;
    }
    if (!ConsumerRef.current) {
      // console.warn("No current consumer transport");
      return;
    }
    const rtpCapabilities = DeviceRef.current.rtpCapabilities;
    const data: ConsumerResult = await new Promise((resolve, reject) => {
      socket.emit(
        WebSocketEventType.CONSUME,
        {
          rtpCapabilities,
          consumerTransportId: ConsumerRef.current?.id ?? "",
          producerId: producerId,
        },
        (response) => {
          if (response.type === "success") {
            resolve(response.res);
          } else {
            reject(response.err);
          }
        },
      );
    });

    const { id, kind, rtpParameters } = data;

    // console.log("CONSUMER DATA :: ", data);

    const consumer = await ConsumerRef.current.consume({
      id,
      producerId,
      kind,
      rtpParameters,
    });

    const stream = new MediaStream();
    stream.addTrack(consumer.track);

    return {
      consumer,
      stream,
      kind,
      producerId,
    };
  }, []);

  const consume = React.useCallback(
    async (producerId: string, isScreenShare: boolean) => {
      getConsumerStream(producerId)
        .then((data) => {
          if (!data) {
            // console.log("Couldn't load stream");
            return;
          }
          // console.log("CONSUME STREAM DATA", data);

          const { consumer, kind } = data;
          consumers.current.set(consumer.id, consumer);
          if (kind === "video" || kind === "audio") {
            if (isScreenShare) {
              setScreenStreams((v) => [...v, data]);
            } else {
              setRemoteStreams((v) => [...v, data]);
            }
          }
        })
        .catch((error) => {
          console.log("Error in getting consumer stream", error);
        });
    },
    [getConsumerStream],
  );

  const initialLoad = React.useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) {
      console.error("Socket not connected");
      return;
    }
    try {
      await joinRoom(socket, roomId);
    } catch {
      toast.error("Room not found. Are you in the right room?");
      setTimeout(() => {
        window.location.assign("/");
      }, 4000);
    }
  }, [roomId]);

  const beforeunload = React.useCallback(async () => {
    async function leaveRoom() {
      return new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) {
          reject("Socket not connected");
          return;
        }
        socket.emit(WebSocketEventType.EXIT_ROOM, (data) => {
          if (data.type === "success") {
            resolve(data.res);
          } else {
            reject(data.err);
          }
        });
      });
    }
    await leaveRoom();
    setIsWaitingRoom(true);
    socketRef.current?.disconnect();
  }, []);

  const handleAudioChange = (device: MediaDeviceInfo) => {
    setSelectedAudioDevice(device);
  };

  const handleVideoChange = (device: MediaDeviceInfo) => {
    setSelectedVideoDevice(device);
  };

  const toggleAudio = async () => {
    if (!isAudioEnabled) {
      await enableAudio();
    } else {
      await disableAudio();
    }
  };

  const enableAudio = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: selectedAudioDevice?.deviceId,
      },
    });
    // TODO: This audio stream is to be used for audio producer
    const audioStream = stream.getAudioTracks()[0];
    if (ProducerRef.current) {
      audioProducer.current = await ProducerRef.current.produce({
        track: audioStream,
      });
    }

    window.localAudioStream = stream;
    setIsAudioEnabled(true);
  };

  const disableAudio = async () => {
    if (window.localAudioStream) {
      window.localAudioStream.getTracks().forEach((track) => track.stop());
      window.localAudioStream = null;
    }
    if (audioProducer.current) {
      const socket = socketRef.current;
      if (!socket) {
        // console.error("Socket not connected");
        return;
      }
      closeProducer(socket, audioProducer.current.id);
      audioProducer.current.close();
    }
    setIsAudioEnabled(false);
  };

  const toggleVideo = async () => {
    if (!isVideoEnabled) {
      await enableVideo();
    } else {
      await disableVideo();
    }
  };

  const enableVideo = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: selectedVideoDevice?.deviceId,
      },
    });
    const videoStream = stream.getVideoTracks()[0];
    if (ProducerRef.current) {
      videoProducer.current = await ProducerRef.current.produce({
        track: videoStream,
      });
    }
    window.localStream = stream;
    setLocalStream(stream);
    setIsVideoEnabled(true);
  };

  const disableVideo = async () => {
    if (window.localStream) {
      window.localStream.getTracks().forEach((track) => track.stop());
      window.localStream = null;
    }
    if (videoProducer.current) {
      const socket = socketRef.current;
      if (!socket) {
        // console.error("Socket not connected");
        return;
      }
      closeProducer(socket, videoProducer.current.id);
      videoProducer.current.close();
    }
    setLocalStream(null);
    setIsVideoEnabled(false);
  };

  useEffect(() => {
    let isDisconnected = false;
    const socket: CustomSocket = io(
      // "ws://localhost:5000",
      // "wss://192.168.29.49:5000",
      "wss://server-meet-clone.mukund.page",
      {
        extraHeaders: {
          "data-name": name,
          "data-admin": "false",
        },
      },
    );

    socket.on(WebSocketEventType.DISCONNECT, () => {
      setIsDisconnected(true);
      isDisconnected = true;
      // Clearing Refs
      DeviceRef.current = null;
      ProducerRef.current = null;
      ConsumerRef.current = null;
      consumers.current = new Map();
      videoProducer.current = null;
      audioProducer.current = null;

      // Clearing states
      setRemoteStreams([]);
      setScreenStreams([]);
    });

    socket.io.on("reconnect", () => {
      toast.info("You have been reconnected");
      setTimeout(() => {
        setIsDisconnected(false);
        setIsWaitingRoom(true);
        isDisconnected = false;
      }, 500);
    });

    socket.on("connect", async () => {
      socketRef.current = socket;
      await initialLoad();
    });

    socket.on(WebSocketEventType.USER_JOINED, async (data) => {
      if (!isDisconnected) {
        toast.info(data.message);
      }
      const users = await getInRoomUsers(socket);
      setRoomUsers(users);
    });

    socket.on(WebSocketEventType.USER_LEFT, async (data) => {
      if (!isDisconnected) {
        toast.info(data.message);
      }
      const users = await getInRoomUsers(socket);
      setRoomUsers(users);
    });

    socket.on(WebSocketEventType.USER_ACCEPTED, async () => {
      setIsWaitingRoom(false);
      if (!isDisconnected) {
        toast.info("You've been accepted");
      }
      const users = await getInRoomUsers(socket);
      setRoomUsers(users);
      // NOTE: To Check and Modify Later
      const data = await getRouterRTPCapabilties(socket);
      await loadDevice(data);
      await createConsumerTransport();
      const producers = await getProducers(socket);
      setProducers(producers.filter((p) => !p.isScreenShare));
      setScreenProducers(producers.filter((p) => p.isScreenShare));
      await createProducerTransport();
    });

    socket.on(WebSocketEventType.USER_REJECTED, () => {
      window.location.assign("/");
    });

    socket.on(WebSocketEventType.USER_KICKED, () => {
      window.location.assign("/");
    });

    socket.on(WebSocketEventType.NEW_PRODUCERS, (data) => {
      setProducers((v) => [...v, ...data.filter((p) => !p.isScreenShare)]);
      setScreenProducers((v) => [...v, ...data.filter((p) => p.isScreenShare)]);
    });

    socket.on(WebSocketEventType.PRODUCER_CLOSED, (data) => {
      setProducers((v) =>
        v.filter((prod) => prod.producer_id !== data.producer_id),
      );
      setScreenProducers((v) =>
        v.filter((prod) => prod.producer_id !== data.producer_id),
      );
      setRemoteStreams((v) =>
        v.filter((s) => s.producerId !== data.producer_id),
      );
      setScreenStreams((v) =>
        v.filter((s) => s.producerId !== data.producer_id),
      );
    });

    const handleUnload = () => {
      void beforeunload();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      handleUnload();
      socket.disconnect();
    };
  }, [
    name,
    beforeunload,
    createConsumerTransport,
    createProducerTransport,
    initialLoad,
    loadDevice,
  ]);

  useEffect(() => {
    producers.forEach((producer) => {
      void consume(producer.producer_id, false);
    });
  }, [producers, roomId, name, consume]);

  useEffect(() => {
    screenProducers.forEach((producer) => {
      void consume(producer.producer_id, true);
    });
  }, [screenProducers, roomId, name, consume]);

  useEffect(() => {
    const getDevices = async () => {
      await requestMicAndCamAccess();
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(
        (device) => device.kind === "audioinput",
      );
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );
      setAudioDevices(audioDevices);
      setVideoDevices(videoDevices);
      setSelectedAudioDevice((prev) => {
        if (
          prev &&
          audioDevices.find((device) => device.deviceId === prev.deviceId)
        ) {
          return prev;
        }
        return audioDevices[0];
      });
      setSelectedVideoDevice((prev) => {
        if (
          prev &&
          videoDevices.find((device) => device.deviceId === prev.deviceId)
        ) {
          return prev;
        }
        return videoDevices[0];
      });
    };
    void getDevices();
    // Handle Add or Remove Device
    function handleDeviceChange() {
      void getDevices();
    }
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange,
      );
    };
  }, []);

  return (
    <div className="relative flex min-h-[100dvh] flex-col gap-2 p-4 pb-24">
      <div
        className={cn(
          "grid grid-cols-1 gap-2 overflow-x-auto",
          isWaitingRoom
            ? "opacity-50 transition-opacity hover:opacity-100"
            : "lg:grid-cols-3 xl:grid-cols-4",
        )}
      >
        <div className="lg:col-span-3 xl:col-span-3">
          {!isDisconnected && (
            <ScreenCarousel
              usersInRoom={roomUsers}
              remoteStreams={screenStreams}
              producerContainer={screenProducers}
              userId={socketRef.current?.id}
            />
          )}
        </div>
        <div className="flex flex-col gap-2 lg:col-span-3 lg:grid lg:grid-cols-3 xl:col-span-1 xl:flex xl:flex-col">
          {!isDisconnected && (
            <UserCarousel
              usersInRoom={roomUsers}
              remoteStreams={remoteStreams}
              producerContainer={producers}
              userId={socketRef.current?.id}
            />
          )}
          <MemoizedLocalPannel
            name={name}
            stream={localStream}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
          />
        </div>
      </div>
      {isWaitingRoom && !isDisconnected ? (
        <>
          <Loading message="Wait for the host to accept you..." />
        </>
      ) : null}
      {isDisconnected && (
        <>
          <Loading message="You have been disconnected..." />
        </>
      )}
      {/* Controls */}
      <div className="fixed bottom-4 left-0 right-0 z-50 flex h-16 max-w-full flex-col overflow-x-auto p-2">
        <div className="mx-auto flex gap-4">
          <TooltipProvider>
            <AudioControl
              audioDevices={audioDevices}
              handleAudioChange={handleAudioChange}
              isAudioEnabled={isAudioEnabled}
              selectedAudioDevice={selectedAudioDevice}
              toggleAudio={toggleAudio}
            />
            <VideoControl
              videoDevices={videoDevices}
              handleVideoChange={handleVideoChange}
              isVideoEnabled={isVideoEnabled}
              selectedVideoDevice={selectedVideoDevice}
              toggleVideo={toggleVideo}
            />
            <EndControl />
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
