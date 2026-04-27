import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:4000';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: false,
    });
  }

  return socket;
}
