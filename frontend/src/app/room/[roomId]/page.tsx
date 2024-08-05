import { getServerAuthSession } from "@/server/auth";
import { redirect } from "next/navigation";
import Room from "./main";

export default async function RoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  const session = await getServerAuthSession();
  if (session) {
    redirect(`/room/${params.roomId}/admin`);
  }
  return <Room roomId={params.roomId} />;
}
