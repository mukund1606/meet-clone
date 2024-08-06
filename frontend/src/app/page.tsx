import RoomForm from "@/components/RoomForm";
import { Button } from "@/components/ui/button";
import { getServerAuthSession } from "@/server/auth";
import Link from "next/link";

export default async function Home() {
  const session = await getServerAuthSession();
  return (
    <div className="flex h-[100dvh] w-screen flex-col gap-2 p-4">
      {session ? (
        <div className="ml-auto">
          <Button asChild>
            <Link href="/api/auth/signout">Sign Out</Link>
          </Button>
        </div>
      ) : null}
      <div className="mx-auto my-auto">
        <RoomForm />
      </div>
    </div>
  );
}
