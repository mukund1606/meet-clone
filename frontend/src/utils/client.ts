// import { env } from "@/env";

import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./common";

export * from "./common";
// export const config = {
//   ws: {
//     url: env.NEXT_PUBLIC_WS_URL,
//   },
// };

export type CustomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
