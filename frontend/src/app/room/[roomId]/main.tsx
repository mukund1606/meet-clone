"use client";

import dynamic from "next/dynamic";

const RoomComponent = dynamic(() => import("@/components/RoomComponent"), {
  ssr: false,
});

import Loading from "@/components/Loading";
import { useLocalStorage } from "@mantine/hooks";

export default function Room({ roomId }: { roomId: string }) {
  const [name] = useLocalStorage<string>({
    key: "name",
  });
  if (!name) {
    return (
      <div className="flex min-h-[100dvh]">
        <Loading message="Loading..." />
      </div>
    );
  }
  return <RoomComponent roomId={roomId.toLowerCase()} name={name} />;
}
