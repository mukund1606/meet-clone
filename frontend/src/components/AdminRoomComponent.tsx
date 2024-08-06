import { cn } from "@/lib/utils";
import type { CustomWindow } from "@/types/customWindow";
import Avvvatars from "avvvatars-react";
import {
  CameraIcon,
  CameraOffIcon,
  ChevronDownIcon,
  Disc3Icon,
  DiscIcon,
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  MonitorXIcon,
  PhoneOffIcon,
  UsersRoundIcon,
} from "lucide-react";
import React, { memo, useEffect } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

declare let window: CustomWindow;

import { mergeData, type MergedData, type RemoteStream } from "@/utils";
import {
  // config,
  WebSocketEventType,
  type ClientToServerEvents,
  type ConsumerResult,
  type Peer,
  type ProducerContainer,
  type ServerToClientEvents,
  type webRtcTransportParams,
} from "@/utils/client";
import { Device } from "mediasoup-client";
import type {
  Consumer,
  Producer,
  RtpCapabilities,
  Transport,
} from "mediasoup-client/lib/types";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { SelectSeparator } from "./ui/select";

export default function AdminRoomComponent({
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
  const [waitingRoomUsers, setWaitingRoomUsers] = React.useState<Array<Peer>>();
  const [roomUsers, setRoomUsers] = React.useState<Array<Peer>>([]);

  const [remoteStreams, setRemoteStreams] = React.useState<RemoteStream[]>([]);
  const [producers, setProducers] = React.useState<ProducerContainer[]>([]);

  const DeviceRef = React.useRef<Device | null>(null);
  const ProducerRef = React.useRef<Transport | null>(null);
  const ConsumerRef = React.useRef<Transport | null>(null);
  const consumers = React.useRef<Map<string, Consumer>>(new Map());
  const videoProducer = React.useRef<Producer | null>(null);
  const audioProducer = React.useRef<Producer | null>(null);
  const screenProducer = React.useRef<Producer | null>(null);
  const screenAudioProducer = React.useRef<Producer | null>(null);

  const createRoom = React.useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject("Socket not connected");
        return;
      }
      socket.emit(
        WebSocketEventType.CREATE_ROOM,
        { roomId: roomId },
        (data) => {
          if (data.type === "success") {
            resolve(data.res);
          } else {
            if (data.err === "Room already exists") {
              resolve(data.err);
            } else {
              reject(data.err);
            }
          }
        },
      );
    });
  }, [roomId]);

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

  const getInWaitingRoomUsers = React.useCallback(async (): Promise<
    Array<Peer>
  > => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject("Socket not connected");
        return;
      }
      socket.emit(WebSocketEventType.GET_IN_WAITING_ROOM_USERS, (data) => {
        if (data.type === "success") {
          console.log("Waiting Room Users", data.res);
          setWaitingRoomUsers(data.res);
          resolve(data.res);
        } else {
          reject(data.err);
        }
      });
    });
  }, []);

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
    setProducers(producers);
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
    async (producerId: string) => {
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
            setRemoteStreams((v) => [...v, data]);
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
      await createRoom();
    } catch (error) {
      console.log("Error in creating room", error);
      // return;
    }
    await joinRoom();
    console.log("Joined Room");
    await getInWaitingRoomUsers();
    console.log("Waiting Room Users");
    await getInRoomUsers();
    // NOTE: To Check and Modify Later
    await getRouterRTPCapabilties();
    await createConsumerTransport();
    await getProducers();
    await createProducerTransport();
  }, [
    createRoom,
    joinRoom,
    getInWaitingRoomUsers,
    getInRoomUsers,
    getRouterRTPCapabilties,
    createConsumerTransport,
    getProducers,
    createProducerTransport,
  ]);

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

  const removeUser = React.useCallback(async (userId: string) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject("Socket not connected");
        return;
      }
      socket.emit(WebSocketEventType.KICK_USER, { peerId: userId }, (data) => {
        if (data.type === "success") {
          resolve(data.res);
        } else {
          reject(data.err);
        }
      });
    });
  }, []);

  const acceptUser = React.useCallback(async (userId: string) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject("Socket not connected");
        return;
      }
      socket.emit(
        WebSocketEventType.ACCEPT_USER,
        { peerId: userId },
        (data) => {
          if (data.type === "success") {
            resolve(data.res);
          } else {
            reject(data.err);
          }
        },
      );
    });
  }, []);

  const rejectUser = React.useCallback(async (userId: string) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket) {
        reject("Socket not connected");
        return;
      }
      socket.emit(
        WebSocketEventType.REJECT_USER,
        { peerId: userId },
        (data) => {
          if (data.type === "success") {
            resolve(data.res);
          } else {
            reject(data.err);
          }
        },
      );
    });
  }, []);

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      // "ws://localhost:5000",
      "wss://server-meet-clone.mukund.page",
      {
        extraHeaders: {
          "data-name": name,
          "data-admin": "true",
        },
      },
    );
    socket.on("connect", async () => {
      socketRef.current = socket;
      void initialLoad();

      socket.on(WebSocketEventType.USER_JOINED, (data) => {
        toast.info(data.message);
        void getInRoomUsers();
      });

      socket.on(WebSocketEventType.USER_ACCEPTED, (data) => {
        toast.info(data.message);
        void getInWaitingRoomUsers();
        void getInRoomUsers();
      });

      socket.on(WebSocketEventType.USER_JOINED_WAITING_ROOM, (data) => {
        toast.info(data.message);
        void getInWaitingRoomUsers();
      });

      socket.on(WebSocketEventType.USER_LEFT, (data) => {
        toast.warning(data.message);
        void getInRoomUsers();
      });

      socket.on(WebSocketEventType.USER_LEFT_WAITING_ROOM, (data) => {
        toast.warning(data.message);
        void getInWaitingRoomUsers();
      });

      socket.on(WebSocketEventType.NEW_PRODUCERS, (data) => {
        setProducers((v) => [...v, ...data]);
      });

      socket.on(WebSocketEventType.PRODUCER_CLOSED, (data) => {
        setProducers((v) =>
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
  }, [name, initialLoad, beforeunload, getInWaitingRoomUsers, getInRoomUsers]);

  useEffect(() => {
    producers.forEach((producer) => {
      void consume(producer.producer_id);
    });
  }, [producers, roomId, name, consume]);

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
  const [isScreenShareEnabled, setIsScreenShareEnabled] = React.useState(false);

  const [localStream, setLocalStream] = React.useState<MediaStream | null>(
    null,
  );
  const [localScreenStream, setLocalScreenStream] =
    React.useState<MediaStream | null>(null);

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

  const toggleScreenShare = async () => {
    if (!isScreenShareEnabled) {
      await enableScreenShare();
    } else {
      await disableScreenShare();
    }
  };

  const enableScreenShare = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
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
        closeProducer(screenProducer.current.id);
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
        closeProducer(screenAudioProducer.current.id);
        screenAudioProducer.current.close();
      }
    }
    setIsScreenShareEnabled(false);
  };

  const [isRecording, setIsRecording] = React.useState(false);
  const [recorder, setRecorder] = React.useState<MediaRecorder | null>(null);
  const [recordingStream, setRecordingStream] =
    React.useState<MediaStream | null>(null);

  const handleRecording = async () => {
    if (!isRecording) {
      await recordScreen();
    } else {
      await stopRecording();
    }
  };

  const recordScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      setRecordingStream(stream);
      const videoStream = stream.getVideoTracks()[0];
      if (!videoStream) return;
      videoStream.onended = async () => {
        await stopRecording();
      };
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });
      setRecorder(mediaRecorder);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "video.webm";
        a.click();
        URL.revokeObjectURL(url);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error recording screen:", error);
    }
  };

  const stopRecording = async () => {
    if (recorder) {
      recorder.stop();
    }
    if (recordingStream) {
      recordingStream.getTracks().forEach((track) => track.stop());
      setRecordingStream(null);
    }
    setIsRecording(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col gap-2 p-4">
      <div className="grid max-h-[calc(100vh-64px)] grid-cols-2 gap-2 overflow-x-auto md:grid-cols-3 lg:grid-cols-4">
        {isScreenShareEnabled && (
          <ScreenShareComponent
            name="Screen"
            stream={localScreenStream}
            isLocal
          />
        )}
        <LocalUserComponent name={name} stream={localStream} />
        <UserCarousel
          usersInRoom={roomUsers}
          remoteStreams={remoteStreams}
          producerContainer={producers}
          userId={socketRef.current?.id}
        />
      </div>
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

            {/* Screen Share */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border-2">
                  <Button
                    size="icon"
                    onClick={toggleScreenShare}
                    className="rounded-md"
                    variant={isScreenShareEnabled ? "destructive" : "default"}
                  >
                    {isScreenShareEnabled ? (
                      <MonitorXIcon />
                    ) : (
                      <MonitorUpIcon />
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Screen Share</p>
              </TooltipContent>
            </Tooltip>

            {/* Recording */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="rounded-lg border-2">
                  <Button
                    size="icon"
                    className="rounded-md"
                    variant={isRecording ? "destructive" : "default"}
                    onClick={handleRecording}
                  >
                    {isRecording ? (
                      <Disc3Icon className="animate-spin" />
                    ) : (
                      <DiscIcon />
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Recording</p>
              </TooltipContent>
            </Tooltip>

            {/* Users */}
            <Sheet>
              <SheetTrigger asChild>
                <div className="rounded-lg border-2">
                  <Button
                    size="icon"
                    className="relative rounded-md"
                    variant="default"
                  >
                    <UsersRoundIcon />
                    {(waitingRoomUsers?.length ?? 0) > 0 ? (
                      <div
                        className={cn(
                          "absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-destructive-foreground",
                          (waitingRoomUsers?.length ?? 0) > 9 && "-right-3",
                        )}
                      >
                        {waitingRoomUsers?.length}
                      </div>
                    ) : null}
                  </Button>
                </div>
                {/* <Tooltip>
                  <TooltipTrigger asChild>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Users</p>
                  </TooltipContent>
                </Tooltip> */}
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Waiting User</SheetTitle>
                  <SheetDescription className="flex flex-col gap-2">
                    {waitingRoomUsers
                      ?.sort((a, b) => a.name.localeCompare(b.name))
                      .map((user, index) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between"
                        >
                          <p className="text-lg font-semibold text-white">
                            {index + 1}. {user.name}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="default"
                              size="icon"
                              className="h-fit w-fit p-1 px-1.5"
                              onClick={() => {
                                void acceptUser(user.id);
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-fit w-fit p-1 px-1.5"
                              onClick={() => {
                                void rejectUser(user.id);
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                  </SheetDescription>
                  <SelectSeparator />
                  <SheetTitle>Joined User</SheetTitle>
                  <SheetDescription className="flex flex-col gap-2">
                    {roomUsers
                      ?.sort((a, b) => a.name.localeCompare(b.name))
                      .map((user, index) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between"
                        >
                          <p className="text-lg font-semibold text-white">
                            {index + 1}. {user.name}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-fit w-fit p-1 px-1.5"
                              onClick={() => {
                                void removeUser(user.id);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                  </SheetDescription>
                </SheetHeader>
              </SheetContent>
            </Sheet>

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
        "relative flex w-full items-center justify-center overflow-hidden rounded-sm border border-white/30 bg-black/10",
        className,
      )}
    >
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
  // console.log("USERS", users);

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
