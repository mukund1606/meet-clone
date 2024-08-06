import { cn } from "@/lib/utils";
import type { CustomWindow } from "@/types/customWindow";
import { mergeData, type MergedData, type RemoteStream } from "@/utils";
import {
  type ClientToServerEvents,
  // config,
  type ConsumerResult,
  type Peer,
  type ProducerContainer,
  type ServerToClientEvents,
  type webRtcTransportParams,
  WebSocketEventType,
} from "@/utils/client";
import Avvvatars from "avvvatars-react";
import {
  CameraIcon,
  CameraOffIcon,
  ChevronDownIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
} from "lucide-react";
import { Device } from "mediasoup-client";
import type {
  Consumer,
  Producer,
  RtpCapabilities,
  Transport,
} from "mediasoup-client/lib/types";
import React, { memo, useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import Loading from "./Loading";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

declare let window: CustomWindow;

export default function RoomComponent({
  roomId,
  name,
}: {
  roomId: string;
  name: string;
}) {
  // NOTE: Socket.io Ref
  const socketRef = React.useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [isWaitingRoom, setIsWaitingRoom] = React.useState(true);
  const [roomUsers, setRoomUsers] = React.useState<Array<Peer>>([]);

  const [remoteStreams, setRemoteStreams] = React.useState<RemoteStream[]>([]);
  const [screenStreams, setScreenStreams] = React.useState<RemoteStream[]>([]);
  const [producers, setProducers] = React.useState<ProducerContainer[]>([]);
  const [screenProducers, setScreenProducers] = React.useState<
    ProducerContainer[]
  >([]);

  const DeviceRef = React.useRef<Device | null>(null);
  const ProducerRef = React.useRef<Transport | null>(null);
  const ConsumerRef = React.useRef<Transport | null>(null);
  const consumers = React.useRef<Map<string, Consumer>>(new Map());
  const videoProducer = React.useRef<Producer | null>(null);
  const audioProducer = React.useRef<Producer | null>(null);

  const joinRoom = React.useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject("Socket not connected");
        return;
      }
      socket.emit(WebSocketEventType.JOIN_ROOM, { roomId: roomId }, (data) => {
        if (data.type === "success") {
          resolve(data.res);
        } else {
          reject(data.err);
        }
      });
    });
  }, [roomId]);

  const getInRoomUsers = React.useCallback(async (): Promise<Array<Peer>> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject("Socket not connected");
        return;
      }
      socket.emit(WebSocketEventType.GET_IN_ROOM_USERS, (data) => {
        if (data.type === "success") {
          setRoomUsers(data.res);
          resolve(data.res);
        } else {
          reject(data.err);
        }
      });
    });
  }, []);

  // NOTE: To Check and Modify Later
  const loadDevice = React.useCallback(async (rtp: RtpCapabilities) => {
    if (socketRef.current && !DeviceRef.current) {
      const device = new Device();
      await device.load({ routerRtpCapabilities: rtp });
      DeviceRef.current = device;
      console.log("--- Device Loaded successfully with RTP capabilities ---");
      return;
    } else {
      console.error(
        "Couldn't load device. check socket or theres current active device",
      );
      return;
    }
  }, []);

  // NOTE: To Check and Modify Later
  const getRouterRTPCapabilties = React.useCallback(async (): Promise<void> => {
    const socket = socketRef.current;
    if (!socket) {
      console.error("Socket not connected");
      return;
    }
    await new Promise((resolve, reject) => {
      socket.emit(
        WebSocketEventType.GET_ROUTER_RTP_CAPABILITIES,
        async (data) => {
          if (data.type === "success") {
            await loadDevice(data.res);
            resolve(data.res);
          } else {
            console.error(data.err);
            reject(data.err);
          }
        },
      );
    });
  }, [loadDevice]);

  // NOTE: To Check and Modify Later
  const getProducers = React.useCallback(async () => {
    const producers: ProducerContainer[] = await new Promise(
      (resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) {
          reject("Socket not connected");
          return;
        }
        socket.emit(WebSocketEventType.GET_PRODUCERS, (data) => {
          if (data.type === "success") {
            resolve(data.res);
          } else {
            reject(data.err);
          }
        });
      },
    );
    setProducers(producers.filter((p) => !p.isScreenShare));
    setScreenProducers(producers.filter((p) => p.isScreenShare));
  }, []);

  // NOTE: To Check and Modify Later
  const createConsumerTransport = React.useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) {
      console.error("Socket not connected");
      return;
    }
    if (ConsumerRef.current) {
      console.log("Already initialized a consumer transport");
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
                console.error(response.err);
                reject(response);
              }
            },
          );
        },
      );

      if (!data) {
        throw new Error("No Transport created");
      }
      console.log("Consumer Transport :: ", data);
      if (!DeviceRef.current || !socketRef.current) {
        console.error("No device or socket found");
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
        console.log("Consumer state", state);
        if (state === "connected") {
          console.log("--- Connected Consumer Transport ---");
        }
        if (state === "disconnected") {
          ConsumerRef.current?.close();
        }
      });

      // TODO: Should I call getProducers here?
      await getProducers();
      // (await sendRequest(WebSocketEventType.GET_PRODUCERS, {})) as {
      //   producer_id: string;
      // }[];
    } catch (error) {
      console.log("error creating consumer transport", error);
    }
  }, [getProducers]);

  // NOTE: To Check and Modify Later
  const createProducerTransport = React.useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) {
      console.error("Socket not connected");
      return;
    }
    if (DeviceRef.current && socketRef.current) {
      console.log("resp");
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
      console.log(resp);

      ProducerRef.current = DeviceRef.current.createSendTransport(resp.params);

      console.log("--- CREATE PRODUCER TRANSPORT ---");

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
            ({ kind, rtpParameters }, cb, eb) => {
              socket.emit(
                WebSocketEventType.PRODUCE,
                {
                  producerTransportId: ProducerRef.current!.id,
                  kind,
                  rtpParameters,
                  isScreenShare: false,
                },
                (data) => {
                  if (data.type === "success") {
                    console.log(data.res.producer_id);
                    cb({ id: data.res.producer_id });
                  } else {
                    console.error(data.err);
                    eb(new Error(data.err));
                  }
                },
              );
            },
          );

          ProducerRef.current.on("connectionstatechange", (state) => {
            console.log(state);
            switch (state) {
              case "disconnected":
                console.log("Producer disconnected");
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

  const closeProducer = React.useCallback((producerId: string) => {
    const socket = socketRef.current;
    if (!socket) {
      console.error("Socket not connected");
      return;
    }
    socket.emit(WebSocketEventType.CLOSE_PRODUCER, {
      producerId,
    });
  }, []);

  const getConsumerStream = React.useCallback(async (producerId: string) => {
    const socket = socketRef.current;
    if (!socket) {
      console.error("Socket not connected");
      return;
    }
    if (!DeviceRef.current) {
      console.log("No device found");
      return;
    }
    if (!ConsumerRef.current) {
      console.warn("No current consumer transport");
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

    console.log("CONSUMER DATA :: ", data);

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
            console.log("Couldn't load stream");
            return;
          }
          console.log("CONSUME STREAM DATA", data);

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
    try {
      await joinRoom();
    } catch (error) {
      toast.error("Error while joining the room");
      setTimeout(() => {
        window.location.assign("/");
      }, 1500);
    }
  }, [joinRoom]);

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

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      "wss://server.meet-clone.mukund.page",
      {
        extraHeaders: {
          "data-name": name,
          "data-admin": "false",
        },
      },
    );
    socket.on("connect", async () => {
      socketRef.current = socket;
      await initialLoad();

      socket.on(WebSocketEventType.USER_JOINED, (data) => {
        toast.info(data.message);
        void getInRoomUsers();
      });

      socket.on(WebSocketEventType.USER_LEFT, (data) => {
        toast.warning(data.message);
        void getInRoomUsers();
      });

      socket.on(WebSocketEventType.USER_ACCEPTED, async () => {
        setIsWaitingRoom(false);
        await getInRoomUsers();
        // NOTE: To Check and Modify Later
        await getRouterRTPCapabilties();
        await createConsumerTransport();
        await getProducers();
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
        setScreenProducers((v) => [
          ...v,
          ...data.filter((p) => p.isScreenShare),
        ]);
      });

      socket.on(WebSocketEventType.PRODUCER_CLOSED, (data) => {
        setProducers((v) =>
          v.filter((prod) => prod.producer_id !== data.producer_id),
        );
        setScreenProducers((v) =>
          v.filter((prod) => prod.producer_id !== data.producer_id),
        );
      });
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
    initialLoad,
    beforeunload,
    getInRoomUsers,
    getRouterRTPCapabilties,
    createConsumerTransport,
    getProducers,
    createProducerTransport,
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

  // NOTE: After Socket.io Ref
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);

  const [selectedAudioDevice, setSelectedAudioDevice] =
    React.useState<MediaDeviceInfo>();
  const [selectedVideoDevice, setSelectedVideoDevice] =
    React.useState<MediaDeviceInfo>();

  useEffect(() => {
    const isFirefox = () => {
      return navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
    };
    const requestAccess = async () => {
      try {
        let stream: MediaStream;
        if (isFirefox()) {
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
        return null;
      }
    };
    const getDevices = async () => {
      await requestAccess();
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

  const handleAudioChange = (device: MediaDeviceInfo) => {
    setSelectedAudioDevice(device);
  };

  const handleVideoChange = (device: MediaDeviceInfo) => {
    setSelectedVideoDevice(device);
  };

  const [isAudioEnabled, setIsAudioEnabled] = React.useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = React.useState(false);

  const [localStream, setLocalStream] = React.useState<MediaStream | null>(
    null,
  );

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
      closeProducer(audioProducer.current.id);
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
      closeProducer(videoProducer.current.id);
      videoProducer.current.close();
    }
    setLocalStream(null);
    setIsVideoEnabled(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col gap-2 p-4">
      <div
        className={cn(
          "grid max-h-[calc(100vh-64px)] gap-2 overflow-x-auto",
          isWaitingRoom
            ? "grid-cols-1 opacity-50 transition-opacity hover:opacity-100"
            : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        )}
      >
        <ScreenCarousel
          usersInRoom={roomUsers}
          remoteStreams={screenStreams}
          producerContainer={screenProducers}
          userId={socketRef.current?.id}
        />
        <LocalUserComponent name={name} stream={localStream} />
        <UserCarousel
          usersInRoom={roomUsers}
          remoteStreams={remoteStreams}
          producerContainer={producers}
          userId={socketRef.current?.id}
        />
      </div>
      {isWaitingRoom ? (
        <>
          <Loading message="Wait for the host to accept you..." />
        </>
      ) : null}
      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex h-16 max-w-full flex-col overflow-x-auto p-2">
        <div className="mx-auto flex gap-4">
          {/* Audio */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center rounded-lg border-2 bg-background">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        className="w-fit rounded-none rounded-l-md"
                        variant="ghost"
                      >
                        <ChevronDownIcon className="w-6" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Audio Devices</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {audioDevices.map((device) => (
                        <DropdownMenuItem
                          key={device.deviceId}
                          onClick={() => handleAudioChange(device)}
                          className="flex items-center gap-1"
                        >
                          <MicIcon
                            className={cn(
                              "h-5 w-5 opacity-0",
                              selectedAudioDevice?.deviceId ===
                                device.deviceId && "opacity-100",
                            )}
                          />
                          {device.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="icon"
                    onClick={toggleAudio}
                    className="rounded-none rounded-r-md"
                    variant={isAudioEnabled ? "destructive" : "default"}
                  >
                    {isAudioEnabled ? <MicOffIcon /> : <MicIcon />}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Audio</p>
              </TooltipContent>
            </Tooltip>

            {/* Video */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center rounded-lg border-2 bg-background">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        className="w-fit rounded-none rounded-l-md"
                        variant="ghost"
                      >
                        <ChevronDownIcon className="w-6" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuLabel>Video Devices</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {videoDevices.map((device) => (
                        <DropdownMenuItem
                          key={device.deviceId}
                          onClick={() => handleVideoChange(device)}
                          className="flex items-center gap-1"
                        >
                          <CameraIcon
                            className={cn(
                              "h-5 w-5 opacity-0",
                              selectedVideoDevice?.deviceId ===
                                device.deviceId && "opacity-100",
                            )}
                          />
                          {device.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="icon"
                    onClick={toggleVideo}
                    className="rounded-none rounded-r-md"
                    variant={isVideoEnabled ? "destructive" : "default"}
                  >
                    {isVideoEnabled ? <CameraOffIcon /> : <CameraIcon />}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Video</p>
              </TooltipContent>
            </Tooltip>

            {/* End */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border-2">
                  <Button
                    size="icon"
                    className="rounded-md"
                    variant="destructive"
                    onClick={() => window.location.assign("/")}
                  >
                    <PhoneOffIcon />
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Call End</p>
              </TooltipContent>
            </Tooltip>
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
        "relative flex h-[28vh] items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
      )}
    >
      {stream ? (
        <>
          <p className="absolute bottom-0 left-0 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg">
            You
          </p>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        </>
      ) : (
        <>
          <p className="absolute bottom-0 left-0 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg">
            You
          </p>
          <Avvvatars value={name} size={95} />
        </>
      )}
    </div>
  );
}

// function ScreenShareComponent({
//   name,
//   stream,
//   isLocal = false,
//   className,
// }: {
//   name: string;
//   stream: MediaStream | null;
//   isLocal: boolean;
//   className?: string;
// }) {
//   const screenVideoRef = React.useRef<HTMLVideoElement | null>(null);
//   useEffect(() => {
//     if (screenVideoRef.current) {
//       screenVideoRef.current.srcObject = stream;
//       void screenVideoRef.current.play();
//       screenVideoRef.current.volume = isLocal ? 0 : 1;
//       screenVideoRef.current.autoplay = true;
//     }
//   }, [stream, isLocal]);
//   return (
//     <div
//       className={cn(
//         "relative flex w-full items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
//         className,
//       )}
//     >
//       {stream ? (
//         <video
//           ref={screenVideoRef}
//           autoPlay
//           playsInline
//           className="h-full w-full"
//         />
//       ) : (
//         <>
//           <Avvvatars value={name} size={95} />
//         </>
//       )}
//     </div>
//   );
// }

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
            "relative flex h-[28vh] items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
          )}
        >
          <p className="absolute bottom-0 left-0 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg">
            {user.name}&apos;s Screen
          </p>
          {user.producers.length <= 0 ? (
            <Avvvatars value={user.name} size={95} />
          ) : (
            <MemoizedUserPannel user={user} />
          )}
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
            "relative flex h-[28vh] items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
          )}
        >
          <p className="absolute bottom-0 left-0 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg">
            {user.name}
          </p>
          {user.producers.length <= 0 ? (
            <Avvvatars value={user.name} size={95} />
          ) : (
            <MemoizedUserPannel user={user} />
          )}
        </div>
      ))}
    </>
  );
};

const UserPannel = ({ user }: { user: MergedData }) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    user.producers.forEach((producer) => {
      if (producer.kind === "video" && videoRef.current) {
        videoRef.current.srcObject = producer.stream;
        void videoRef.current.play();
        videoRef.current.volume = 0;
        videoRef.current.autoplay = true;
      } else if (producer.kind === "audio" && audioRef.current) {
        audioRef.current.srcObject = producer.stream;
        void audioRef.current.play();
        audioRef.current.autoplay = true;
      }
    });
  }, [user]);

  if (!videoRef.current?.srcObject && audioRef.current?.srcObject) {
    <>
      <audio ref={audioRef} autoPlay />
      <Avvvatars value={user.name} size={95} />
    </>;
  }
  return (
    <div className="h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      <audio ref={audioRef} autoPlay playsInline />
    </div>
  );
};

const MemoizedUserPannel = memo(UserPannel);
