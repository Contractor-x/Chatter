declare module 'socket.io-client' {
  export interface Socket {
    id: string;
    connected: boolean;
    on(event: string, listener: (...args: any[]) => void): Socket;
    off(event: string, listener: (...args: any[]) => void): Socket;
    emit(event: string, ...args: any[]): Socket;
    connect(): Socket;
    close(): Socket;
  }

  export interface SocketOptions {
    transports?: string[];
    query?: Record<string, string>;
    reconnection?: boolean;
    timeout?: number;
  }

  export function io(url?: string, options?: SocketOptions): Socket;

  const client: (url?: string, options?: SocketOptions) => Socket;
  export default client;
}