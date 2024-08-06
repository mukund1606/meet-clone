"use client";

import dynamic from "next/dynamic";
import React from "react";

const RoomComponent = dynamic(() => import("@/components/RoomComponent"), {
  ssr: false,
});

import Loading from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useLocalStorage } from "@mantine/hooks";
import Link from "next/link";

export default function Room({ roomId }: { roomId: string }) {
  const [initialInteraction, setInitialInteraction] = React.useState(false);
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
  if (!initialInteraction) {
    return (
      <div className="flex min-h-[100dvh]">
        <div className="mx-auto my-auto p-4">
          <Card className="w-[350px]">
            <CardHeader>
              <CardTitle>Enter Room</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <div className="grid grid-cols-3 gap-4">
                  <p>Room ID:</p>
                  <p className="col-span-2 uppercase">{roomId}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <p>Name:</p>
                  <p className="col-span-2 uppercase">{name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    setInitialInteraction(true);
                  }}
                >
                  Join Room
                </Button>
                <Button className="w-full" asChild variant="destructive">
                  <Link href="/">Go Back</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  return <RoomComponent roomId={roomId.toLowerCase()} name={name} />;
}
