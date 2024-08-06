import { cn } from "@/lib/utils";
import type { MergedData } from "@/utils";
import Avvvatars from "avvvatars-react";
import { MicIcon, MicOffIcon } from "lucide-react";
import React, { useEffect } from "react";

export default function NewPannel({
  user,
  isScreenShare,
}: {
  user: MergedData;
  isScreenShare: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [currentVideo, setCurrentVideo] = React.useState<MediaStream | null>(
    null,
  );
  const [currentAudio, setCurrentAudio] = React.useState<MediaStream | null>(
    null,
  );

  const latestVideoRef = React.useRef<number>(0);
  const latestAudioRef = React.useRef<number>(0);

  useEffect(() => {
    const videos: MediaStream[] = [];
    const audios: MediaStream[] = [];
    user.producers.forEach((producer) => {
      if (producer.kind === "video") {
        const videoTracks = producer.stream;
        videos.push(videoTracks);
      } else if (producer.kind === "audio") {
        const audioTracks = producer.stream;
        audios.push(audioTracks);
      }
    });

    const video = videos[0] ? videos[0] : null;
    const audio = audios[0] ? audios[0] : null;

    if (video) {
      const videoTimestamp = Date.now();
      if (videoTimestamp > latestVideoRef.current) {
        latestVideoRef.current = videoTimestamp;
        if (!currentVideo || video.id !== currentVideo.id) {
          setCurrentVideo(video);
        }
      }
    } else {
      setCurrentVideo(null);
    }

    if (audio) {
      const audioTimestamp = Date.now();
      if (audioTimestamp > latestAudioRef.current) {
        latestAudioRef.current = audioTimestamp;
        if (!currentAudio || audio.id !== currentAudio.id) {
          setCurrentAudio(audio);
        }
      }
    } else {
      setCurrentAudio(null);
    }
  }, [user.producers, currentVideo, currentAudio]);

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== currentVideo) {
      videoRef.current.srcObject = currentVideo;
      videoRef.current.play().catch(console.error);
      videoRef.current.volume = 0;
      videoRef.current.autoplay = true;
    }
  }, [currentVideo]);

  useEffect(() => {
    if (audioRef.current && audioRef.current.srcObject !== currentAudio) {
      audioRef.current.srcObject = currentAudio;
      audioRef.current.play().catch(console.error);
      audioRef.current.autoplay = true;
    }
  }, [currentAudio]);

  return (
    <div className="relative h-full w-full">
      <div className="flex h-full w-full items-center justify-center">
        <video ref={videoRef} autoPlay playsInline className="h-full w-full" />
      </div>
      <audio ref={audioRef} autoPlay playsInline />
      <p className="absolute bottom-0 left-0 z-10 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg text-white">
        {isScreenShare ? `${user.name}'s Screen` : user.name}
      </p>
      <div
        className={cn(
          "absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 p-1",
          currentAudio ? "opacity-0" : "opacity-100",
        )}
      >
        <MicOffIcon className="h-4 w-4" />
      </div>
      <div
        className={cn(
          "absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 p-1",
          !currentAudio ? "opacity-0" : "opacity-100",
          currentVideo && "opacity-0",
        )}
      >
        <MicIcon className="h-4 w-4" />
      </div>
      <div
        className={cn(
          "absolute inset-0 flex h-full w-full items-center justify-center bg-background transition-opacity",
          currentVideo ? "opacity-0" : "opacity-100",
        )}
      >
        <Avvvatars value={user.name} size={95} />
      </div>
    </div>
  );
}

export function OldPannel({
  user,
  isScreenShare,
}: {
  user: MergedData;
  isScreenShare: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [currentVideo, setCurrentVideo] = React.useState<MediaStream | null>(
    null,
  );
  const [currentAudio, setCurrentAudio] = React.useState<MediaStream | null>(
    null,
  );

  useEffect(() => {
    const videos: MediaStream[] = [];
    const audios: MediaStream[] = [];
    user.producers.forEach((producer) => {
      if (producer.kind === "video") {
        const videoTracks = producer.stream;
        videos.push(videoTracks);
      } else if (producer.kind === "audio") {
        const audioTracks = producer.stream;
        audios.push(audioTracks);
      }
    });
    const video = videos[0] ? videos[0] : null;
    const audio = audios[0] ? audios[0] : null;
    if (!currentVideo && video) {
      setCurrentVideo(video);
    } else if (!videos.find((v) => v.id === currentVideo?.id)?.active) {
      setCurrentVideo(video);
    }
    if (!currentAudio && audio) {
      setCurrentAudio(audio);
    } else if (!audios.find((v) => v.id === currentAudio?.id)?.active) {
      setCurrentAudio(audio);
    }
  }, [user.producers, currentVideo, currentAudio]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = currentVideo;
      void videoRef.current.play();
      videoRef.current.volume = 0;
      videoRef.current.autoplay = true;
    }
  }, [currentVideo]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = currentAudio;
      void audioRef.current.play();
      audioRef.current.autoplay = true;
    }
  }, [currentAudio]);

  return (
    <div className="relative h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      <audio ref={audioRef} autoPlay playsInline />
      <p className="absolute bottom-0 left-0 z-10 h-auto w-auto rounded-sm bg-black/20 p-1 px-3 text-lg text-white">
        {isScreenShare ? `${user.name}'s Screen` : user.name}
      </p>
      <div
        className={cn(
          "absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 p-1",
          currentAudio ? "opacity-0" : "opacity-100",
        )}
      >
        <MicOffIcon className="h-4 w-4" />
      </div>
      <div
        className={cn(
          "absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 p-1",
          !currentAudio ? "opacity-0" : "opacity-100",
          currentVideo && "opacity-0",
        )}
      >
        <MicIcon className="h-4 w-4" />
      </div>
      <div
        className={cn(
          "absolute inset-0 flex h-full w-full items-center justify-center bg-background transition-opacity",
          currentVideo ? "opacity-0" : "opacity-100",
        )}
      >
        <Avvvatars value={user.name} size={95} />
      </div>
    </div>
  );
}
