import React from "react";

export default function Loading({ message }: { message?: string }) {
  return (
    <div className="mx-auto my-auto flex w-full flex-col items-center justify-center pb-16">
      <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-foreground" />
      {message && <p className="text-2xl">{message}</p>}
    </div>
  );
}
