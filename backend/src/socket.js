import { Server } from 'socket.io';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      // no-op for now
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitAvailabilityUpdate(payload) {
  if (!io) return;
  io.emit('availability:update', payload);
}
