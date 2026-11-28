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
  bot?: boolean | { app?: string; dogrulandi?: boolean; sahip?: string | null }; // geliştirici botu: uygulama bilgisi
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
  bot?: BotCfg;
  appCmds?: AppCmd[]; // sunucudaki botların / komutları
};
export type BotMod = { on?: boolean; antinuke?: boolean; spam?: boolean; invites?: boolean; links?: boolean; mentions?: boolean; caps?: boolean; words?: string };
export type BotCfg = { added?: boolean; mod?: BotMod };
export type Role = { id: string; name: string; color?: string; perms?: string[]; hoist?: boolean; bot?: boolean; mention?: boolean };

// Geliştirici botları: komut, kart (embed), bileşen (buton / seçim / kişi-rol-oda seçici), form
export type AppOpt = { ad: string; aciklama?: string; tur: string; zorunlu?: boolean; secimler: { ad: string; deger: string | number }[] };
export type AppCmd = { app: string; bot: string; ad: string; aciklama?: string; secenekler: AppOpt[] };
export type Embed = { baslik?: string; aciklama?: string; renk?: string | null; url?: string | null; alanlar?: { ad: string; deger: string; satir?: boolean }[]; resim?: string | null; kucukResim?: string | null; altyazi?: string };
export type Comp = {
  tur: 'buton' | 'secim' | 'kisi' | 'rol' | 'oda'; id?: string; stil?: string; etiket?: string; emoji?: string | null; url?: string; kapali?: boolean;
  yerTutucu?: string; min?: number; max?: number; odaTuru?: string; secenekler?: { etiket: string; deger: string; aciklama?: string | null; emoji?: string | null }[];
};
export type AppFormField = { id: string; etiket: string; tur: 'kisa' | 'uzun' | 'dosya' | 'kisi' | 'rol' | 'oda'; kabul?: string; zorunlu?: boolean; yerTutucu?: string; deger?: string; min?: number; max?: number };
export type AppForm = { iid: string; app: string; bot: string; baslik: string; alanlar: AppFormField[] };

export type Dm = { id: string; with?: string; name?: string; members?: string[]; owner?: string | null; last?: number };

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
  bot?: { title?: string; text?: string; tone?: string; fields?: [string, string][]; plain?: boolean };
  app?: string; // geliştirici botunun mesajı
  appInfo?: { id: string; ad: string; gorunenAd?: string; dogrulandi?: boolean };
  embeds?: Embed[];
  comps?: Comp[][];
  ephemeral?: boolean; // sadece sen görüyorsun
  kalici?: boolean;
  loading?: boolean; // bot düşünüyor…
  inter?: { user: string; cmd?: string };
  channelId?: string;
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
  prefs?: Prefs | null;
  social?: { friends?: string[]; reqIn?: string[]; reqOut?: string[]; blocked?: string[] };
};

// Hesapta saklanan tercihler (her cihazda aynı). Sunucuya gönderirken hepsi birlikte gider, yoksa eksik alanlar silinir.
export type Prefs = { notif?: boolean; muted?: string[]; ch?: Record<string, 'all' | 'none'>; srv?: Record<string, { lvl?: string; ev?: number; rol?: number }>; order?: string[]; muteUntil?: Record<string, number>; emoji?: unknown };
