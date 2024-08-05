"use client";

import dynamic from "next/dynamic";

const AdminRoomComponent = dynamic(
  () => import("@/components/AdminRoomComponent"),
  {
    ssr: false,
  },
);

import Loading from "@/components/Loading";
import { useLocalStorage } from "@mantine/hooks";

export default function AdminRoom({ roomId }: { roomId: string }) {
  const [name] = useLocalStorage<string>({
    key: "name",
  });
  if (!name) {
    return (
      <div className="flex min-h-screen">
        <Loading message="Loading..." />
      </div>
    );
  }
  return <AdminRoomComponent roomId={roomId} name={name} />;
}
