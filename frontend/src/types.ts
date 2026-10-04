export type Channel = {
  _id: string;
  title: string;
  description: string;
  members: number;
  messages: number;
};

export type ChatMessage = {
  _id: string;
  text: string;
  nickname: string;
  color: string;
  at: number;
};

export type ModerationState = {
  muted: boolean;
  mutedUntil: number | null;
  strikes: number;
  strikeLimit: number;
  allowance: number;
};

export type ModerationVerdict = {
  allowed: boolean;
  reason: string | null;
  message: string | null;
  strikes?: number;
  remaining?: number;
  mutedUntil?: number | null;
  allowance?: number;
  state: ModerationState;
};

export const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export const API_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

export const MAX_LENGTH = 300;