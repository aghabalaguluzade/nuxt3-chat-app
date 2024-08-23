export interface Chat {
   value: string;
   messageId: number;
   username: string;
   text: string;
   time: string;
   edited: boolean;
   replies?: Reply[];
   room?: string;
}

export type User = {
   id: string;
   username: string;
   room: string;
   isOnline: boolean;
};

export interface Reply {
   replyId: string;
   messageId: number;
   username: string;
   text: string;
   replyTo: number;
   edited: boolean;
   time: string;
}
 