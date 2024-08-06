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

function RecordingControlComponent({
  isRecording,
  toggleRecording,
}: {
  isRecording: boolean;
  toggleRecording: () => Promise<void>;
}) {
  const [isDisabled, setIsDisabled] = React.useState(false);
  return (
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
              await toggleRecording();
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
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Waiting User</SheetTitle>
          <div className="flex flex-col gap-2">
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
          <SelectSeparator />
          <SheetTitle>Joined User</SheetTitle>
          <div className="flex flex-col gap-2">
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
          </div>
        </SheetHeader>
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
