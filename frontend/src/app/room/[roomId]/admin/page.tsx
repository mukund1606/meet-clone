import { getServerAuthSession } from "@/server/auth";
import { redirect } from "next/navigation";
import AdminRoom from "./main";

export default async function AdminRoomPage({
  params,
}: {
  params: { roomId: string };
}) {
  const session = await getServerAuthSession();
  if (!session) {
    redirect(`/room/${params.roomId}`);
  }
  return <AdminRoom roomId={params.roomId} />;
}
