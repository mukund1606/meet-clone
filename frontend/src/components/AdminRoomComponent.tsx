import { cn } from "@/lib/utils";
import type { CustomWindow } from "@/types/customWindow";
import { mergeData, type RemoteStream } from "@/utils";
import {
  WebSocketEventType,
  type ConsumerResult,
  type CustomSocket,
  type Peer,
  type ProducerContainer,
  type webRtcTransportParams,
} from "@/utils/client";
import {
  closeProducer,
  createRoom,
  getInRoomUsers,
  getInWaitingRoomUsers,
  getProducers,
  getRouterRTPCapabilties,
  joinRoom,
  requestMicAndCamAccess,
} from "@/utils/helpers";
import Avvvatars from "avvvatars-react";
import { Device } from "mediasoup-client";
import type {
  Consumer,
  Producer,
  RtpCapabilities,
  Transport,
} from "mediasoup-client/lib/types";
import React, { memo, useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import {
  AudioControl,
  EndControl,
  RecordingControl,
  ScreenShareControl,
  UsersControl,
  VideoControl,
} from "./Controls";
import Loading from "./Loading";
import NewPannel from "./NewPannel";
import { TooltipProvider } from "./ui/tooltip";

declare let window: CustomWindow;
export default function AdminRoomComponent({
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
  const screenProducer = React.useRef<Producer | null>(null);
  const screenAudioProducer = React.useRef<Producer | null>(null);

  // NOTE: States
  const [isDisconnected, setIsDisconnected] = React.useState(false);
  const [waitingRoomUsers, setWaitingRoomUsers] = React.useState<Array<Peer>>(
    [],
  );
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
  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);
  const [localStream, setLocalStream] = React.useState<MediaStream | null>(
    null,
  );
  const [localScreenStream, setLocalScreenStream] =
    React.useState<MediaStream | null>(null);

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
      await createRoom(socket, roomId);
    } catch (error) {
      console.log("Error in creating room", error);
      // return;
    }
    await joinRoom(socket, roomId);
    const [waitingRoomUsers, roomUsers] = await Promise.all([
      getInWaitingRoomUsers(socket),
      getInRoomUsers(socket),
    ]);
    setWaitingRoomUsers(waitingRoomUsers);
    setRoomUsers(roomUsers);
    const data = await getRouterRTPCapabilties(socket);
    await loadDevice(data);
    await createConsumerTransport();
    const producers = await getProducers(socket);
    setProducers(producers.filter((p) => !p.isScreenShare));
    setScreenProducers(producers.filter((p) => p.isScreenShare));
    await createProducerTransport();
  }, [roomId, createConsumerTransport, createProducerTransport, loadDevice]);

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

  const toggleScreenShare = async () => {
    if (!isScreenShareEnabled) {
      await enableScreenShare();
    } else {
      await disableScreenShare();
    }
  };

  const enableScreenShare = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.error("Please Select Screen To Share");
        return;
      }
    }
    if (!stream) {
      return;
    }
    // TODO: This screen stream is to be used for screen share producer
    const videoStream = stream.getVideoTracks()[0];
    if (!videoStream) return;
    videoStream.onended = async () => {
      await disableScreenShare();
    };
    const audioStream = stream.getAudioTracks()[0];
    if (ProducerRef.current) {
      screenProducer.current = await ProducerRef.current.produce({
        track: videoStream,
        appData: {
          isScreenShare: true,
        },
      });
      if (audioStream) {
        screenAudioProducer.current = await ProducerRef.current.produce({
          track: audioStream,
          appData: {
            isScreenShare: true,
          },
        });
      }
    }
    window.localScreenStream = stream;
    window.localScreenAudioStream = stream;
    setLocalScreenStream(stream);
    setIsScreenShareEnabled(true);
  };

  const disableScreenShare = async () => {
    if (window.localScreenStream) {
      window.localScreenStream.getTracks().forEach((track) => track.stop());
      window.localScreenStream = null;
      // TODO: Producer Cleanup to be implemented
      if (screenProducer.current) {
        const socket = socketRef.current;
        if (!socket) {
          // console.error("Socket not connected");
          return;
        }
        closeProducer(socket, screenProducer.current.id);
        screenProducer.current.close();
      }
    }
    if (window.localScreenAudioStream) {
      window.localScreenAudioStream
        .getTracks()
        .forEach((track) => track.stop());
      window.localScreenAudioStream = null;
      // TODO: Producer Cleanup to be implemented
      if (screenAudioProducer.current) {
        const socket = socketRef.current;
        if (!socket) {
          // console.error("Socket not connected");
          return;
        }
        closeProducer(socket, screenAudioProducer.current.id);
        screenAudioProducer.current.close();
      }
    }
    setIsScreenShareEnabled(false);
  };

  // NOTE: Effects
  useEffect(() => {
    let isDisconnected = false;
    const socket: CustomSocket = io(
      // "ws://localhost:5000",
      // "wss://192.168.29.49:5000",
      "wss://server-meet-clone.mukund.page",
      {
        extraHeaders: {
          "data-name": name,
          "data-admin": "true",
        },
      },
    );

    socket.io.on("reconnect", () => {
      toast.info("You have been reconnected");
      setTimeout(() => {
        setIsDisconnected(false);
        isDisconnected = false;
      }, 500);
    });

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
      screenProducer.current = null;
      screenAudioProducer.current = null;

      // Clearing states
      setRemoteStreams([]);
      setScreenStreams([]);
    });

    socket.on("connect", async () => {
      socketRef.current = socket;
      void initialLoad();
    });

    socket.on(WebSocketEventType.USER_JOINED, async (data) => {
      if (!isDisconnected) {
        toast.info(data.message);
      }
      const users = await getInRoomUsers(socket);
      setRoomUsers(users);
    });

    socket.on(WebSocketEventType.USER_ACCEPTED, async (data) => {
      if (!isDisconnected) {
        toast.info(data.message);
      }
      const [waitingRoomUsers, roomUsers] = await Promise.all([
        getInWaitingRoomUsers(socket),
        getInRoomUsers(socket),
      ]);
      setWaitingRoomUsers(waitingRoomUsers);
      setRoomUsers(roomUsers);
    });

    socket.on(WebSocketEventType.USER_JOINED_WAITING_ROOM, async (data) => {
      if (!isDisconnected) {
        toast.warning(data.message);
      }
      const waitingRoomUsers = await getInWaitingRoomUsers(socket);
      setWaitingRoomUsers(waitingRoomUsers);
    });

    socket.on(WebSocketEventType.USER_LEFT, async (data) => {
      if (!isDisconnected) {
        toast.warning(data.message);
      }
      const users = await getInRoomUsers(socket);
      setRoomUsers(users);
    });

    socket.on(WebSocketEventType.USER_LEFT_WAITING_ROOM, async (data) => {
      if (!isDisconnected) {
        toast.warning(data.message);
      }
      const waitingRoomUsers = await getInWaitingRoomUsers(socket);
      setWaitingRoomUsers(waitingRoomUsers);
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
  }, [name, initialLoad, beforeunload]);

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
      <div className="grid gap-2 overflow-x-auto sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {isScreenShareEnabled && (
          <ScreenShareComponent
            name="Screen"
            stream={localScreenStream}
            isLocal
          />
        )}
        {!isDisconnected && (
          <ScreenCarousel
            usersInRoom={roomUsers}
            remoteStreams={screenStreams}
            producerContainer={screenProducers}
            userId={socketRef.current?.id}
          />
        )}
        <LocalUserComponent name={name} stream={localStream} />
        {!isDisconnected && (
          <UserCarousel
            usersInRoom={roomUsers}
            remoteStreams={remoteStreams}
            producerContainer={producers}
            userId={socketRef.current?.id}
          />
        )}
      </div>
      {isDisconnected && (
        <>
          <Loading message="You have been disconnected..." />
        </>
      )}
      {/* Controls */}
      <div className="fixed bottom-4 left-0 right-0 z-50 flex h-16 max-w-full flex-col p-2">
        <div className="mx-auto flex gap-2 sm:gap-4">
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
            <ScreenShareControl
              isScreenShareEnabled={isScreenShareEnabled}
              toggleScreenShare={toggleScreenShare}
            />
            <RecordingControl />
            <UsersControl
              socket={socketRef.current}
              roomUsers={roomUsers}
              waitingRoomUsers={waitingRoomUsers}
            />
            <EndControl />
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

function LocalUserComponent({
  name,
  stream,
}: {
  name: string;
  stream: MediaStream | null;
}) {
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      void localVideoRef.current.play();
      localVideoRef.current.volume = 0;
      localVideoRef.current.autoplay = true;
    }
  }, [stream]);
  return (
    <div
      className={cn(
        "relative flex h-[clamp(12rem,16rem,40vh)] items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
      )}
    >
      {stream ? (
        <>
          <p className="absolute bottom-0 left-0 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg backdrop-blur-sm">
            You
          </p>
          <div className="flex h-full w-full items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              className="h-full w-full"
            />
          </div>
        </>
      ) : (
        <>
          <p className="absolute bottom-0 left-0 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg backdrop-blur-sm">
            You
          </p>
          <Avvvatars value={name} size={95} />
        </>
      )}
    </div>
  );
}

function ScreenShareComponent({
  name,
  stream,
  isLocal = false,
  className,
}: {
  name: string;
  stream: MediaStream | null;
  isLocal: boolean;
  className?: string;
}) {
  const screenVideoRef = React.useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = stream;
      void screenVideoRef.current.play();
      screenVideoRef.current.volume = isLocal ? 0 : 1;
      screenVideoRef.current.autoplay = true;
    }
  }, [stream, isLocal]);
  return (
    <div
      className={cn(
        "relative flex h-[clamp(12rem,16rem,40vh)] items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
        className,
      )}
    >
      <p className="absolute bottom-0 left-0 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg backdrop-blur-sm">
        You&apos;re Screen
      </p>
      {stream ? (
        <video
          ref={screenVideoRef}
          autoPlay
          playsInline
          className="h-full w-full"
        />
      ) : (
        <>
          <Avvvatars value={name} size={95} />
        </>
      )}
    </div>
  );
}

const ScreenCarousel = ({
  usersInRoom,
  remoteStreams,
  producerContainer,
}: {
  usersInRoom: Peer[];
  remoteStreams: RemoteStream[];
  producerContainer: ProducerContainer[];
  userId?: string;
}) => {
  const users = mergeData(usersInRoom, remoteStreams, producerContainer).filter(
    (user) => user.producers.length > 0,
  );

  return (
    <>
      {users.map((user) => (
        <div
          key={user.userId}
          className={cn(
            "relative flex h-[clamp(12rem,16rem,40vh)] items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
          )}
        >
          <MemoizedScreenPannel user={user} isScreenShare={true} />
        </div>
      ))}
    </>
  );
};

const UserCarousel = ({
  usersInRoom,
  remoteStreams,
  producerContainer,
}: {
  usersInRoom: Peer[];
  remoteStreams: RemoteStream[];
  producerContainer: ProducerContainer[];
  userId?: string;
}) => {
  const users = mergeData(usersInRoom, remoteStreams, producerContainer);
  return (
    <>
      {users.map((user) => (
        <div
          key={user.userId}
          className={cn(
            "relative flex h-[clamp(12rem,16rem,40vh)] items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
          )}
        >
          <MemoizedUserPannel user={user} isScreenShare={false} />
        </div>
      ))}
    </>
  );
};

// const UserPannel = ({ user }: { user: MergedData }) => {
//   const videoRef = React.useRef<HTMLVideoElement | null>(null);
//   const audioRef = React.useRef<HTMLAudioElement | null>(null);

//   useEffect(() => {
//     user.producers.forEach((producer) => {
//       if (producer.kind === "video" && videoRef.current) {
//         videoRef.current.srcObject = producer.stream;
//         void videoRef.current.play();
//         videoRef.current.volume = 0;
//         videoRef.current.autoplay = true;
//       } else if (producer.kind === "audio" && audioRef.current) {
//         audioRef.current.srcObject = producer.stream;
//         void audioRef.current.play();
//         audioRef.current.autoplay = true;
//       }
//     });
//   }, [user]);

//   if (!videoRef.current?.srcObject && audioRef.current?.srcObject) {
//     <>
//       <audio ref={audioRef} autoPlay />
//       <Avvvatars value={user.name} size={95} />
//     </>;
//   }
//   return (
//     <div className="h-full w-full">
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         className="h-full w-full object-cover"
//       />
//       <audio ref={audioRef} autoPlay playsInline />
//     </div>
//   );
// };

// const ScreenPannel = ({ user }: { user: MergedData }) => {
//   const videoRef = React.useRef<HTMLVideoElement | null>(null);
//   const audioRef = React.useRef<HTMLAudioElement | null>(null);

//   useEffect(() => {
//     user.producers.forEach((producer) => {
//       if (producer.kind === "video" && videoRef.current) {
//         videoRef.current.srcObject = producer.stream;
//         void videoRef.current.play();
//         videoRef.current.volume = 0;
//         videoRef.current.autoplay = true;
//       } else if (producer.kind === "audio" && audioRef.current) {
//         audioRef.current.srcObject = producer.stream;
//         void audioRef.current.play();
//         audioRef.current.autoplay = true;
//       }
//     });
//   }, [user]);

//   if (!videoRef.current?.srcObject && audioRef.current?.srcObject) {
//     <>
//       <audio ref={audioRef} autoPlay />
//       <Avvvatars value={user.name} size={95} />
//     </>;
//   }
//   return (
//     <div className="h-full w-full">
//       <video
//         ref={videoRef}
//         autoPlay
//         playsInline
//         className="h-full w-full object-contain"
//       />
//       <audio ref={audioRef} autoPlay playsInline />
//     </div>
//   );
// };

const MemoizedUserPannel = memo(NewPannel);
const MemoizedScreenPannel = memo(NewPannel);
