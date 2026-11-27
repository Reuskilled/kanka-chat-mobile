// Sunucunun gönderdiği verilerin (kullandığımız kısmının) biçimi
export type User = {
  name: string;
  id?: string;
  displayName?: string | null;
  pronouns?: string | null;
  color?: string;
  avatar?: string | null;
  status?: string | null; // özel durum yazısı
  bio?: string | null;
  level?: number;
  xp?: number;
  streak?: number | { n?: number };
  friendCount?: number;
  theme?: string[] | null;
  bannerImg?: string | null;
  activities?: { name?: string; type?: string; detail?: string }[];
  sp?: number | null; // Spark
  bot?: boolean;
  gizli?: boolean;
};

export type Channel = {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'forum' | 'stage' | string;
  cat?: string | null;
  topic?: string;
  slow?: number;
  private?: boolean;
  locked?: boolean;
  readonly?: boolean;
};

export type Category = { id: string; name: string };

export type Server = {
  id: string;
  name: string;
  icon?: string | null;
  iconImg?: string | null;
  banner?: string | null;
  bannerColor?: string | null;
  owner: string;
  members: string[];
  channels: Channel[];
  categories: Category[];
  memberRoles?: Record<string, string[]>;
  customRoles?: Role[];
  roles?: Record<string, string>; // eski "mod" rolü
  myPerms?: string[];
  bans?: Record<string, { by: string; time: number; reason?: string }>;
  timeouts?: Record<string, number>;
  invite?: string;
  vanity?: string | null;
  public?: boolean;
  filter?: boolean;
  slow?: number;
  description?: string;
  energy?: { total: number; level: number };
};
export type Role = { id: string; name: string; color?: string; perms?: string[]; hoist?: boolean; bot?: boolean; mention?: boolean };

export type Dm = { id: string; with?: string; name?: string; members?: string[]; last?: number };

export type Msg = {
  id: string;
  author: string;
  color?: string;
  time: number;
  kind: string;
  text?: string;
  enc?: unknown;
  reactions?: Record<string, string[]>;
  replyTo?: { id: string; author: string; text?: string; enc?: boolean } | null;
  edited?: number;
  deleted?: boolean;
  files?: { id?: string; url: string; name?: string; size?: number; kind?: string }[];
  image?: string | null;
  audio?: string | null;
  duration?: number;
  gif?: string | null;
  bot?: { title?: string; text?: string; tone?: string };
};

export type LoginResult = {
  error?: string;
  needTfa?: boolean;
  banned?: boolean;
  token?: string;
  user?: User;
  users?: User[];
  online?: [string, string][];
  servers?: Server[];
  dms?: Dm[];
  voice?: Record<string, string[]>;
  ageGate?: 'need' | 'locked' | 'u15' | null;
  minor?: boolean;
  lastMsg?: Record<string, number>;
  social?: { friends?: string[]; reqIn?: string[]; reqOut?: string[]; blocked?: string[] };
};
