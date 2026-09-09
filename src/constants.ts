import type { TranslationKey } from "./i18n/translate";
export const STORAGE_KEY = "plink:v1";
export const PROFILES_STORAGE_KEY = "plink:profiles:v1";
export const GAMES_STORAGE_KEY = "plink:games:v1";
export const CURRENT_GAME_ID_KEY = "plink:currentGameId:v1";
export const GUEST_GAMES_STORAGE_KEY = "plink:guest:games:v1";
export const GUEST_CURRENT_GAME_ID_KEY = "plink:guest:currentGameId:v1";
export const APP_VIEW_STORAGE_KEY = "plink:view:v1";
export const HOME_TAB_STORAGE_KEY = "plink:homeTab:v1";
export const PLAYERS_VIEW_STORAGE_KEY = "plink:playersView:v1";
export const HOME_NEW_GAME_OPEN_KEY = "plink:homeNewGameOpen:v1";
export const APP_STORE_URL =
  "https://apps.apple.com/us/app/plink-scorekeeper/id6791116577";
// This is Plink's intended Google Play listing URL. It will begin working as
// soon as the `com.plinkscore.app` listing is published in Play Console.
export const GOOGLE_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.plinkscore.app";
export const ROADMAP_URL = "/roadmap.html";
export const REFRESH_PAST_LINKED_PLAYERS_EVENT =
  "plink:refreshPastLinkedPlayers";
export const REFRESH_PAST_INVITED_PLAYERS_EVENT =
  "plink:refreshPastInvitedPlayers";
export const LOCAL_SESSIONS_HINT_DISMISSED_KEY =
  "plink:localSessionsHintDismissed:v1";
export const GAME_TIMER_STORAGE_KEY = "plink:timer:v1";
export const MAX_ABS_SCORE = 999999;
export const DEFAULT_QUICK_SCORE_VALUES = [1, 2] as const;
export const DEFAULT_TEAM_ICON = "dumbbell";
export const TEAM_ICONS = [
  { id: "dumbbell", label: "copy.training" as TranslationKey },
  { id: "trophy", label: "copy.champions" as TranslationKey },
  { id: "shield", label: "copy.defense" as TranslationKey },
  { id: "flag", label: "copy.flag" as TranslationKey },
  { id: "target", label: "new.target" as TranslationKey },
  { id: "zap", label: "copy.fast" as TranslationKey },
  { id: "flame", label: "copy.fire" as TranslationKey },
  { id: "star", label: "copy.allStars" as TranslationKey },
] as const;

export const AVATAR_COLORS = [
  {
    id: "graphite",
    label: "copy.graphite" as TranslationKey,
    value: "#6b7890",
  },
  { id: "sky", label: "copy.sky" as TranslationKey, value: "#36aeea" },
  { id: "aqua", label: "copy.aqua" as TranslationKey, value: "#31cfc3" },
  { id: "mint", label: "copy.mint" as TranslationKey, value: "#47d97d" },
  { id: "lime", label: "copy.lime" as TranslationKey, value: "#9fbe38" },
  { id: "coral", label: "copy.coral" as TranslationKey, value: "#f36f85" },
  { id: "violet", label: "copy.violet" as TranslationKey, value: "#9276e8" },
  { id: "stone", label: "copy.stone" as TranslationKey, value: "#aba39b" },
] as const;
