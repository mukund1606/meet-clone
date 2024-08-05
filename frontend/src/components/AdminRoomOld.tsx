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
import React, { useEffect } from "react";
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

export default function AdminRoomComponent({
  roomId,
  name,
}: {
  roomId: string;
  name: string;
}) {
  const [audioDevices, setAudioDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = React.useState<MediaDeviceInfo[]>([]);

  const [selectedAudioDevice, setSelectedAudioDevice] =
    React.useState<MediaDeviceInfo>();
  const [selectedVideoDevice, setSelectedVideoDevice] =
    React.useState<MediaDeviceInfo>();

  useEffect(() => {
    const getDevices = async () => {
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
    // const audioStream = stream.getAudioTracks()[0];

    window.localAudioStream = stream;
    setIsAudioEnabled(true);
  };

  const disableAudio = async () => {
    if (window.localAudioStream) {
      window.localAudioStream.getTracks().forEach((track) => track.stop());
      window.localAudioStream = null;
      // TODO: Producer Cleanup to be implemented
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
    // TODO: This video stream is to be used for video producer
    // const videoStream = stream.getVideoTracks()[0];
    window.localStream = stream;
    setLocalStream(stream);
    setIsVideoEnabled(true);
  };

  const disableVideo = async () => {
    if (window.localStream) {
      window.localStream.getTracks().forEach((track) => track.stop());
      window.localStream = null;
      // TODO: Producer Cleanup to be implemented
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
    // const audioStream = stream.getAudioTracks()[0];
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
    }
    if (window.localScreenAudioStream) {
      window.localScreenAudioStream
        .getTracks()
        .forEach((track) => track.stop());
      window.localScreenAudioStream = null;
      // TODO: Producer Cleanup to be implemented
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
      </div>
      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex h-16 max-w-full flex-col overflow-x-auto p-2">
        <div className="mx-auto flex gap-4">
          {/* Audio */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center rounded-lg border-2">
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
                <div className="flex items-center rounded-lg border-2">
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
                  <Button size="icon" className="rounded-md" variant="default">
                    <UsersRoundIcon />
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
                  <SheetTitle>Users</SheetTitle>
                  <SheetDescription>
                    {/* TODO: TO BE IMPLEMENTED */}
                    <p>Users</p>
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
