import { Server, type ServerOptions, type Socket } from "socket.io";
import moment from "moment";
import type { H3Event } from "h3";
import { User } from "../types";
import { userJoin, getRoomsUsers, removeMessage } from "./users";

const options: Partial<ServerOptions> = {
   path: '/api/socket.io',
   serveClient: false
}

export const io = new Server(options);

const both = "Nuxt 3 Socket Chat App";

export const initSocket = (event: H3Event) => {
   // @ts-ignore
   io.attach(event.node.res.socket?.server);

   io.on('connection', (socket: Socket) => {
      // Join Room
      socket.on('joinRoom', (payload: User) => {
         if (!payload.username || !payload.room) {
            socket.emit('error', 'Invalid payload');
            return;
         }

         const user = userJoin({ ...payload, id: socket.id });
         socket.join(user.room);
         socket.broadcast.to(user.room).emit('message', formatMessage(both, `${user.username} has joined the chat.`));

         const roomUsers = getRoomsUsers(user.room);
         io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: roomUsers
         });
      })

      // Typing Message
      socket.on('typing', (room: string, username: string) => {
         socket.broadcast.to(room).emit('typing', username);
      })

      // Send Message
      socket.on('sendMessage', (payload: { text: string; messageId: number }) => {
         console.log('Received payload:', payload);
         const user = getCurrentUser(socket.id);

         if (user) {
            const message = formatMessage(user.username, payload.text);
            message.messageId = payload.messageId;
            io.to(user.room).emit('message', message);
         }
      });

      // Kick User
      socket.on('kickUser', (room: string, username: string) => {
         const user = getCurrentUser(socket.id);

         if (user && user.username === 'admin') {
            const userToKick = getRoomsUsers(room).find(user => user.username === username);

            if (userToKick) {
               io.to(userToKick.id).emit('kicked', 'You have been kicked from the room.');
               io.sockets.sockets.get(userToKick.id)?.leave(room);
               userLeave(userToKick.id);
               socket.broadcast.to(room).emit('message', formatMessage(both, `${username} has been kicked out of the room.`));
               io.to(room).emit('roomUsers', {
                  room,
                  users: getRoomsUsers(room)
               });
            } else {
               console.log('User to kick not found');
            }
         } else {
            console.log('Current user is not an admin');
         }
      });

      // Update Message
      socket.on('updateMessage', ({ messageId, text }) => {
         const user = getCurrentUser(socket.id);

         if (user) {
            io.to(user.room).emit('messageUpdate', { messageId, text, edited: true });
         }
      });

      // Update Reply
      socket.on('updateReply', ({ replyId, text }) => {
         const user = getCurrentUser(socket.id);

         if (user) {
            io.to(user.room).emit('replyUpdate', { replyId, text, edited: true });
         }
      });


      // Send Reply
      socket.on('sendReply', ({ text, replyId, originalMessageId }) => {
         const user = getCurrentUser(socket.id);
         if (user) {
            io.to(user.room).emit('reply', {
               text,
               replyId,
               originalMessageId,
            });
         }
      });

      // Delete Message
      socket.on('deleteMessage', (messageId: string) => {
         const user = getCurrentUser(socket.id);

         if (user) {
            removeMessage(user.room, messageId);
            io.to(user.room).emit('messageDeleted', messageId);
         }
      });

      // Delete Reply
      socket.on('deleteReply', (replyId: string) => {
         const user = getCurrentUser(socket.id);

         if (user) {
            io.to(user.room).emit('replyDeleted', replyId);
         }
      });


      // Disconnect 
      socket.on('disconnect', () => {
         const user = userLeave(socket.id);

         if (user) {
            socket.broadcast.to(user.room).emit('message', formatMessage(both, `${user.username} has left the chat.`));
            const roomUsers = getRoomsUsers(user.room);
            io.to(user.room).emit('roomUsers', {
               room: user.room,
               users: roomUsers
            });
         }

      });
   })
}

export function formatMessage(username: string, text: string) {
   return {
      messageId: Date.now(),
      username,
      text,
      time: moment().format('h:mm a')
   }
}