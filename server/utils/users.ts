import { User } from "~/types";

export const users = [] as User[];

const messages: { room: string, messageId: string, content: string }[] = [];

export function userJoin(user: User) {
   user.isOnline = true;
   users.push(user);
   return user;
}

export function getCurrentUser(id: string) {
   return users.find(user => user.id ===  id);
}

export function userLeave(id: string) {
   const index = users.findIndex(user => user.id === id);

   if(index !== -1) {
      const user = users[index];
      user.isOnline = false;
      return users.splice(index, 1)[0];
   }
}

export function getRoomsUsers(room: string) {
   return users.filter(user => user.room === room);
}

export function removeMessage(room: string, messageId: string) {
   const index = messages.findIndex(msg => msg.messageId === messageId);

   if(index !== -1) {
      return messages.splice(index, 1);
   }
}