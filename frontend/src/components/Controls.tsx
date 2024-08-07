import { cn } from "@/lib/utils";
import {
  type CustomSocket,
  type Peer,
  WebSocketEventType,
} from "@/utils/client";
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
import React, { memo } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { SelectSeparator } from "./ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function AudioControlComponent({
  audioDevices,
  handleAudioChange,
  isAudioEnabled,
  selectedAudioDevice,
  toggleAudio,
}: {
  audioDevices: MediaDeviceInfo[];
  handleAudioChange: (device: MediaDeviceInfo) => void;
  isAudioEnabled: boolean;
  selectedAudioDevice?: MediaDeviceInfo;
  toggleAudio: () => Promise<void>;
}) {
  const [isDisabled, setIsDisabled] = React.useState(false);
  return (
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
                      selectedAudioDevice?.deviceId === device.deviceId &&
                        "opacity-100",
                    )}
                  />
                  {device.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon"
            onClick={async () => {
              if (isDisabled) {
                return;
              }
              setIsDisabled(true);
              await toggleAudio();
              setIsDisabled(false);
            }}
            className="rounded-none rounded-r-md"
            variant={isAudioEnabled ? "destructive" : "default"}
            disabled={isDisabled}
          >
            {isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Audio</p>
      </TooltipContent>
    </Tooltip>
  );
}

export const AudioControl = memo(AudioControlComponent);

function VideoControlComponent({
  videoDevices,
  handleVideoChange,
  isVideoEnabled,
  selectedVideoDevice,
  toggleVideo,
}: {
  videoDevices: MediaDeviceInfo[];
  handleVideoChange: (device: MediaDeviceInfo) => void;
  isVideoEnabled: boolean;
  selectedVideoDevice?: MediaDeviceInfo;
  toggleVideo: () => Promise<void>;
}) {
  const [isDisabled, setIsDisabled] = React.useState(false);
  return (
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
                      selectedVideoDevice?.deviceId === device.deviceId &&
                        "opacity-100",
                    )}
                  />
                  {device.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon"
            onClick={async () => {
              if (isDisabled) {
                return;
              }
              setIsDisabled(true);
              await toggleVideo();
              setIsDisabled(false);
            }}
            className="rounded-none rounded-r-md"
            variant={isVideoEnabled ? "destructive" : "default"}
            disabled={isDisabled}
          >
            {isVideoEnabled ? <CameraIcon /> : <CameraOffIcon />}
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Video</p>
      </TooltipContent>
    </Tooltip>
  );
}

export const VideoControl = memo(VideoControlComponent);

function ScreenShareControlComponent({
  isScreenShareEnabled,
  toggleScreenShare,
}: {
  isScreenShareEnabled: boolean;
  toggleScreenShare: () => Promise<void>;
}) {
  const [isDisabled, setIsDisabled] = React.useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="rounded-lg border-2">
          <Button
            size="icon"
            onClick={async () => {
              if (isDisabled) {
                return;
              }
              setIsDisabled(true);
              await toggleScreenShare();
              setIsDisabled(false);
            }}
            className="rounded-md"
            variant={isScreenShareEnabled ? "destructive" : "default"}
            disabled={isDisabled}
          >
            {isScreenShareEnabled ? <MonitorXIcon /> : <MonitorUpIcon />}
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Screen Share</p>
      </TooltipContent>
    </Tooltip>
  );
}

export const ScreenShareControl = memo(ScreenShareControlComponent);

function RecordingControlComponent() {
  const [isDisabled, setIsDisabled] = React.useState(false);
  const [recorder, setRecorder] = React.useState<MediaRecorder | null>(null);
  const [recordingStream, setRecordingStream] =
    React.useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);

  const handleRecording = async () => {
    if (!isRecording) {
      await recordScreen();
    } else {
      await stopRecording();
    }
  };

  const recordScreen = async () => {
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
          // @ts-expect-error - This is a temporary fix for the issue
          preferCurrentTab: true,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          toast.error("Please Select Screen To Record");
          return;
        }
      }
      if (!stream) {
        return;
      }
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
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-lg border-2">
            <Button
              size="icon"
              className="rounded-md"
              variant={isRecording ? "destructive" : "default"}
              onClick={async () => {
                if (isDisabled) {
                  return;
                }
                setIsDisabled(true);
                await handleRecording();
                setIsDisabled(false);
              }}
              disabled={isDisabled}
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
    </>
  );
}

export const RecordingControl = memo(RecordingControlComponent);

function UsersControlComponent({
  socket,
  roomUsers,
  waitingRoomUsers,
}: {
  socket: CustomSocket | null;
  roomUsers: Array<Peer>;
  waitingRoomUsers: Array<Peer>;
}) {
  const removeUser = React.useCallback(
    async (userId: string) => {
      return new Promise((resolve, reject) => {
        if (!socket) {
          reject("Socket not connected");
          return;
        }
        socket.emit(
          WebSocketEventType.KICK_USER,
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
    },
    [socket],
  );

  const acceptUser = React.useCallback(
    async (userId: string) => {
      return new Promise((resolve, reject) => {
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
    },
    [socket],
  );

  const rejectUser = React.useCallback(
    async (userId: string) => {
      return new Promise((resolve, reject) => {
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
    },
    [socket],
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <div className="rounded-lg border-2">
          <Button size="icon" className="relative rounded-md" variant="default">
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
      </SheetTrigger>
      <SheetContent className="p-1">
        <SheetHeader className="h-8"></SheetHeader>
        <div className="flex flex-col gap-2">
          <div className="p-2">
            <SheetTitle className="text-xl underline">Waiting User</SheetTitle>
            <div className="flex flex-col gap-2 pt-8">
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
            </div>
          </div>
          <SelectSeparator />
          <div className="p-2">
            <SheetTitle className="text-xl underline">Joined User</SheetTitle>
            <div className="flex flex-col gap-2 pt-8">
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
                    {!user.isAdmin ? (
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
                    ) : (
                      <p className="px-1.5 tracking-wide">(Admin)</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const UsersControl = memo(UsersControlComponent);

function EndControlComponent() {
  return (
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
  );
}

export const EndControl = memo(EndControlComponent);
