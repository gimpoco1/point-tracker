import { getCurrentLanguage, translate } from "../../i18n/translate";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
} from "react";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type Provider,
  type Session,
  type User,
} from "@supabase/supabase-js";
import { Browser } from "@capacitor/browser";
import { AVATAR_COLORS } from "../../constants";
import { useAppleSubscription } from "../../features/billing/useAppleSubscription";
import { useEntitlementsContext } from "../../hooks/useEntitlements";
import { hasSupabaseConfig, supabase } from "../../lib/supabase";
import {
  NATIVE_AUTH_COMPLETED_EVENT,
  getAuthRedirectUrl,
  isNativeApp,
  isNativeAndroidApp,
  isNativeIOSApp,
  openExternalUrl,
} from "../../lib/nativePlatform";
import type { BackupSelection } from "../../storage/backupFile";
import {
  loadRemoteSharingPreference,
  updateRemoteSharingPreference,
} from "../../storage/remoteStorage";
import type { Game, PlayerProfile, ToastState, ToastTone } from "../../types";
import { formatPlayerName } from "../../utils/text";
import { LANGUAGE_DIALOG_REOPEN_KEY } from "../../i18n/I18nContext";

export type AuthDialogHandle = {
  open: () => void;
  openPlan: () => void;
  openLocalImport: () => void;
  openPasswordReset: () => void;
  close: () => void;
};

export type DataTransferResult = {
  games: number;
  profiles: number;
  teams: number;
  skippedTeamContent?: boolean;
};

export type AuthDialogProps = {
  session: Session | null;
  onOpenChange?: (open: boolean) => void;
  onConfirmSignOut: () => Promise<boolean>;
  onConfirmAccountDeletion: () => Promise<boolean>;
  localGames?: Game[];
  localProfiles?: PlayerProfile[];
  accountGamesCount?: number;
  accountProfilesCount?: number;
  accountGames?: Game[];
  accountProfiles?: PlayerProfile[];
  onUpdateProfile?: (
    id: string,
    updates: Partial<Pick<PlayerProfile, "name" | "avatarColor">>,
  ) => void;
  onImportLocalData?: (selection: {
    gameIds: string[];
    profileIds: string[];
  }) => Promise<DataTransferResult> | DataTransferResult;
  onImportBackupFile?: (
    file: File,
    selection: BackupSelection,
  ) => Promise<DataTransferResult> | DataTransferResult;
  onDownloadBackupFile?: (
    selection: BackupSelection,
  ) => Promise<DataTransferResult> | DataTransferResult;
};

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function isExistingAccountSignUpResponse(user: User | null) {
  return !!user && !user.is_anonymous && (user.identities?.length ?? 0) === 0;
}

export function useAuthDialogModel(
  props: AuthDialogProps,
  ref: ForwardedRef<AuthDialogHandle>,
) {
  const {
    session,
    onOpenChange,
    onConfirmSignOut,
    onConfirmAccountDeletion,
    localGames = [],
    localProfiles = [],
    accountGamesCount = 0,
    accountProfilesCount = 0,
    accountGames = [],
    accountProfiles = [],
    onUpdateProfile,
    onImportLocalData,
    onImportBackupFile,
    onDownloadBackupFile,
  } = props;
  const {
    isLoading: entitlementsLoading,
    hasSessionPass,
    maxSessions,
    source,
    isPro,
    subscriptionCancelAt,
    subscriptionCancelAtPeriodEnd,
    subscriptionCurrentPeriodEnd,
    subscriptionProvider,
    subscriptionStartedAt,
    subscriptionStatus,
  } = useEntitlementsContext();
  const appleSubscription = useAppleSubscription(session);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const nativeOAuthPendingRef = useRef(false);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const deviceImportRef = useRef<HTMLDivElement | null>(null);
  const planSectionRef = useRef<HTMLElement | null>(null);
  const accountColorOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const billingPeriodOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountDraftName, setAccountDraftName] = useState("");
  const [accountDraftColor, setAccountDraftColor] = useState("");
  const [editingAccountPlayer, setEditingAccountPlayer] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [transferToast, setTransferToast] = useState<ToastState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signupConfirmationEmail, setSignupConfirmationEmail] = useState<
    string | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<Provider | null>(null);
  const [confirmingAccountDeletion, setConfirmingAccountDeletion] =
    useState(false);
  const [hasStripeBillingProfile, setHasStripeBillingProfile] = useState(false);
  const [showTransferTools, setShowTransferTools] = useState(false);
  const [showDeviceImport, setShowDeviceImport] = useState(false);
  const [showDevicePlayersImport, setShowDevicePlayersImport] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [allowPreviousPlayersToInvite, setAllowPreviousPlayersToInvite] =
    useState(true);
  const [sharingPreferenceLoading, setSharingPreferenceLoading] =
    useState(false);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<
    "monthly" | "yearly"
  >("monthly");
  const [appleReferralCode, setAppleReferralCode] = useState("");
  const [appleReferralChecking, setAppleReferralChecking] = useState(false);
  const [appleReferralError, setAppleReferralError] = useState<string | null>(
    null,
  );
  const [appleReferralOffer, setAppleReferralOffer] = useState<{
    billingPeriod: "monthly" | "yearly";
    code: string;
    discountPercent: number;
    url: string;
    validatedAt: number;
  } | null>(null);
  const [localSessionSearch, setLocalSessionSearch] = useState("");
  const [includeGames, setIncludeGames] = useState(true);
  const [includeProfiles, setIncludeProfiles] = useState(true);
  const [selectedLocalGameIds, setSelectedLocalGameIds] = useState<string[]>(
    () => localGames.map((game) => game.id),
  );
  const [selectedLocalProfileIds, setSelectedLocalProfileIds] = useState<
    string[]
  >(() => localProfiles.map((profile) => profile.id));

  useEffect(() => {
    let shouldReopen = false;
    try {
      shouldReopen =
        window.sessionStorage.getItem(LANGUAGE_DIALOG_REOPEN_KEY) === "true";
      if (shouldReopen) {
        window.sessionStorage.removeItem(LANGUAGE_DIALOG_REOPEN_KEY);
      }
    } catch {
      return;
    }

    if (!shouldReopen || dialogRef.current?.open) return;
    dialogRef.current?.showModal();
    onOpenChange?.(true);
  }, [onOpenChange]);
  const selectedLocalGameIdsRef = useRef(selectedLocalGameIds);
  const selectedLocalProfileIdsRef = useRef(selectedLocalProfileIds);
  const normalizedLocalSessionSearch = localSessionSearch.trim().toLowerCase();
  const filteredLocalGames = useMemo(() => {
    if (!normalizedLocalSessionSearch) return localGames;
    return localGames.filter((game) => {
      const searchable = [
        game.name,
        ...game.players.map((player) => player.name),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedLocalSessionSearch);
    });
  }, [localGames, normalizedLocalSessionSearch]);
  const hasFilteredLocalGames = filteredLocalGames.length > 0;
  const allFilteredLocalGamesSelected =
    hasFilteredLocalGames &&
    filteredLocalGames.every((game) => selectedLocalGameIds.includes(game.id));
  const isAwaitingSignupConfirmation =
    mode === "signup" && !!signupConfirmationEmail;
  const transferSelection: BackupSelection = {
    games: includeGames,
    profiles: includeProfiles,
  };

  useEffect(() => {
    setAppleReferralError(null);
    setAppleReferralOffer(null);
  }, [appleReferralCode, selectedBillingPeriod]);
  const accountPlayer =
    accountProfiles.find((profile) => profile.isAccountPlayer) ?? null;
  const accountPlayerName = accountPlayer?.name ?? "";
  const accountPlayerColor =
    accountPlayer?.avatarColor ?? AVATAR_COLORS[0]?.value ?? "#64748b";
  const userId = session?.user.id ?? null;
  const effectiveSubscriptionEndDate = useMemo(() => {
    if (
      subscriptionCancelAtPeriodEnd &&
      (subscriptionStatus === "active" || subscriptionStatus === "trialing")
    ) {
      return subscriptionCancelAt ?? subscriptionCurrentPeriodEnd;
    }

    if (subscriptionStatus === "canceled") {
      return subscriptionCancelAt ?? subscriptionCurrentPeriodEnd;
    }

    return subscriptionCurrentPeriodEnd;
  }, [
    subscriptionCancelAt,
    subscriptionCancelAtPeriodEnd,
    subscriptionCurrentPeriodEnd,
    subscriptionStatus,
  ]);
  const formattedSubscriptionEndDate = useMemo(() => {
    if (!effectiveSubscriptionEndDate) return null;

    const date = new Date(effectiveSubscriptionEndDate);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat(getCurrentLanguage(), {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }, [effectiveSubscriptionEndDate]);
  const renewalLabel = useMemo(() => {
    if (
      !formattedSubscriptionEndDate ||
      !subscriptionStatus ||
      source !== "subscription"
    ) {
      return null;
    }

    if (
      subscriptionCancelAtPeriodEnd &&
      (subscriptionStatus === "active" || subscriptionStatus === "trialing")
    ) {
      return translate("dynamic.endsOn", [formattedSubscriptionEndDate]);
    }

    if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
      return translate("dynamic.renewsOn", [formattedSubscriptionEndDate]);
    }

    if (subscriptionStatus === "canceled") {
      return translate("dynamic.endsOn", [formattedSubscriptionEndDate]);
    }

    return null;
  }, [
    formattedSubscriptionEndDate,
    source,
    subscriptionCancelAtPeriodEnd,
    subscriptionStatus,
  ]);
  const sinceLabel = useMemo(() => {
    if (!subscriptionStartedAt || source !== "subscription") return null;

    const date = new Date(subscriptionStartedAt);
    if (Number.isNaN(date.getTime())) return null;

    return translate("dynamic.since", [
      new Intl.DateTimeFormat(getCurrentLanguage(), {
        month: "short",
        year: "numeric",
      }).format(date),
    ]);
  }, [source, subscriptionStartedAt]);
  const billingPeriodOptions = ["monthly", "yearly"] as const;

  function focusOption(
    refs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
    index: number,
  ) {
    refs.current[index]?.focus();
  }

  function getWrappedIndex(
    length: number,
    currentIndex: number,
    delta: number,
  ) {
    return (currentIndex + delta + length) % length;
  }

  function handleAccountColorRadioKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = getWrappedIndex(AVATAR_COLORS.length, index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = getWrappedIndex(AVATAR_COLORS.length, index, -1);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = AVATAR_COLORS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextColor = AVATAR_COLORS[nextIndex];
    if (!nextColor) return;
    setAccountDraftColor(nextColor.value);
    focusOption(accountColorOptionRefs, nextIndex);
  }

  function handleBillingPeriodRadioKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = getWrappedIndex(billingPeriodOptions.length, index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = getWrappedIndex(billingPeriodOptions.length, index, -1);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = billingPeriodOptions.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextPeriod = billingPeriodOptions[nextIndex];
    if (!nextPeriod) return;
    setSelectedBillingPeriod(nextPeriod);
    focusOption(billingPeriodOptionRefs, nextIndex);
  }

  function resetDialogState() {
    nativeOAuthPendingRef.current = false;
    setBusy(false);
    setOauthProvider(null);
    setNotice(null);
    setTransferToast(null);
    setError(null);
    setRecoveryMode(false);
    setNewPassword("");
    setConfirmNewPassword("");
    setShowTransferTools(false);
    setShowDeviceImport(false);
    setShowAccountDetails(false);
    setShowPlanDetails(false);
    setSelectedBillingPeriod("monthly");
    setEditingAccountPlayer(false);
    setConfirmingAccountDeletion(false);
    setShowDevicePlayersImport(false);
    setLocalSessionSearch("");
    setAccountDraftName(accountPlayerName);
    setAccountDraftColor(accountPlayerColor);
    setSelectedLocalGameIds(localGames.map((game) => game.id));
    setSelectedLocalProfileIds(localProfiles.map((profile) => profile.id));
  }

  function showDialog() {
    if (!dialogRef.current?.open) {
      onOpenChange?.(true);
      dialogRef.current?.showModal();
    }
  }

  function showNativePurchaseResult(message: string, tone: ToastTone) {
    const revealResult = () => {
      showDialog();
      showTransferToast(message, tone);
    };

    revealResult();
    window.requestAnimationFrame(revealResult);
    window.setTimeout(revealResult, 250);
  }

  function scrollToLocalImportSection() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const dialog = dialogRef.current;
        const target = deviceImportRef.current;
        if (!dialog || !target) return;
        const offset = target.offsetTop - 104;
        dialog.scrollTo({
          top: Math.max(0, offset),
          behavior: "smooth",
        });
      });
    });
  }

  function scrollToPlanSection() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const dialog = dialogRef.current;
        const target = planSectionRef.current;
        if (!dialog || !target) return;
        const offset = target.offsetTop - 104;
        dialog.scrollTo({
          top: Math.max(0, offset),
          behavior: "smooth",
        });
      });
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      open() {
        resetDialogState();
        showDialog();
      },
      openPlan() {
        resetDialogState();
        setShowPlanDetails(true);
        showDialog();
        scrollToPlanSection();
      },
      openLocalImport() {
        resetDialogState();
        setShowTransferTools(true);
        setShowDeviceImport(true);
        showDialog();
        scrollToLocalImportSection();
      },
      openPasswordReset() {
        setMode("signin");
        setRecoveryMode(true);
        setNotice(null);
        setTransferToast({
          message: translate("copy.enterANewPasswordForYourAccount"),
          tone: "default",
        });
        setError(null);
        setPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
        setShowTransferTools(false);
        setShowDeviceImport(false);
        setShowAccountDetails(false);
        setEditingAccountPlayer(false);
        showDialog();
      },
      close() {
        if (dialogRef.current?.open) {
          onOpenChange?.(false);
          dialogRef.current.close();
        }
      },
    }),
    [
      accountPlayerColor,
      accountPlayerName,
      localGames,
      localProfiles,
      onOpenChange,
    ],
  );

  useEffect(() => {
    selectedLocalGameIdsRef.current = selectedLocalGameIds;
  }, [selectedLocalGameIds]);

  useEffect(() => {
    selectedLocalProfileIdsRef.current = selectedLocalProfileIds;
  }, [selectedLocalProfileIds]);

  useEffect(() => {
    if (!transferToast) return;
    const timeout = window.setTimeout(() => setTransferToast(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [transferToast]);

  useEffect(() => {
    function resetNativeOAuth() {
      nativeOAuthPendingRef.current = false;
      setOauthProvider(null);
      setBusy(false);
    }

    function handleNativeAuthError(event: Event) {
      const nativeMessage =
        event instanceof CustomEvent && typeof event.detail === "string"
          ? event.detail
          : "";
      resetNativeOAuth();
      setError(
        getAuthErrorMessage(
          nativeMessage,
          translate("copy.authenticationFailed"),
        ),
      );
      setNotice(null);
      showDialog();
    }

    function handleNativeAuthCompleted() {
      if (!nativeOAuthPendingRef.current) return;
      resetNativeOAuth();
      if (dialogRef.current?.open) {
        onOpenChange?.(false);
        dialogRef.current.close();
      }
    }

    const browserListener = isNativeApp()
      ? Browser.addListener("browserFinished", () => {
          if (nativeOAuthPendingRef.current) resetNativeOAuth();
        })
      : null;

    window.addEventListener("plink:auth-error", handleNativeAuthError);
    window.addEventListener(
      NATIVE_AUTH_COMPLETED_EVENT,
      handleNativeAuthCompleted,
    );
    return () => {
      window.removeEventListener("plink:auth-error", handleNativeAuthError);
      window.removeEventListener(
        NATIVE_AUTH_COMPLETED_EVENT,
        handleNativeAuthCompleted,
      );
      void browserListener?.then((handle) => handle.remove());
    };
  }, [onOpenChange]);

  useEffect(() => {
    if (!userId || !supabase) {
      setHasStripeBillingProfile(false);
      return;
    }

    let alive = true;
    const client = supabase;

    async function refreshBillingProfile() {
      try {
        const { data, error: loadError } = await client
          .from("subscriptions")
          .select("customer_id,provider")
          .eq("user_id", userId)
          .maybeSingle();

        if (!alive) return;
        if (loadError || data?.provider !== "stripe" || !data.customer_id) {
          setHasStripeBillingProfile(false);
          return;
        }

        setHasStripeBillingProfile(true);
      } catch {
        if (alive) {
          setHasStripeBillingProfile(false);
        }
      }
    }

    const channel = client.channel(`subscription-billing:${userId}`);
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "subscriptions",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void refreshBillingProfile();
      },
    );
    void channel.subscribe();
    void refreshBillingProfile();

    return () => {
      alive = false;
      void channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !supabase) {
      setAllowPreviousPlayersToInvite(true);
      setSharingPreferenceLoading(false);
      return;
    }

    let alive = true;
    setSharingPreferenceLoading(true);
    void loadRemoteSharingPreference()
      .then((allow) => {
        if (alive) setAllowPreviousPlayersToInvite(allow);
      })
      .catch((loadError) => {
        console.error("Failed to load sharing preference", loadError);
      })
      .finally(() => {
        if (alive) setSharingPreferenceLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [userId]);

  async function updateSharingPreference(allow: boolean) {
    if (!userId || sharingPreferenceLoading) return;
    const previous = allowPreviousPlayersToInvite;
    setAllowPreviousPlayersToInvite(allow);
    setSharingPreferenceLoading(true);
    setError(null);
    try {
      const savedValue = await updateRemoteSharingPreference(allow);
      setAllowPreviousPlayersToInvite(savedValue);
    } catch (saveError) {
      console.error("Failed to update sharing preference", saveError);
      setAllowPreviousPlayersToInvite(previous);
      setError(translate("copy.couldNotUpdateSharingPreference"));
    } finally {
      setSharingPreferenceLoading(false);
    }
  }

  useEffect(() => {
    const visibleGameIds = new Set(localGames.map((game) => game.id));
    const current = selectedLocalGameIdsRef.current;
    const next = current.filter((id) => visibleGameIds.has(id));
    if (areStringArraysEqual(current, next)) return;
    setSelectedLocalGameIds(next);
  }, [localGames]);

  useEffect(() => {
    const visibleProfileIds = new Set(
      localProfiles.map((profile) => profile.id),
    );
    const current = selectedLocalProfileIdsRef.current;
    const next = current.filter((id) => visibleProfileIds.has(id));
    if (areStringArraysEqual(current, next)) return;
    setSelectedLocalProfileIds(next);
  }, [localProfiles]);

  function toggleLocalGame(gameId: string) {
    setSelectedLocalGameIds((current) =>
      current.includes(gameId)
        ? current.filter((id) => id !== gameId)
        : [...current, gameId],
    );
  }

  function toggleFilteredLocalGames() {
    const visibleIds = filteredLocalGames.map((game) => game.id);
    if (visibleIds.length === 0) return;

    setSelectedLocalGameIds((current) => {
      const allVisibleSelected = visibleIds.every((id) => current.includes(id));
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  }

  function toggleLocalProfile(profileId: string) {
    setSelectedLocalProfileIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );
  }

  function getAuthErrorMessage(err: unknown, fallback: string) {
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : "";
    const normalizedMessage = message.toLowerCase();
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code ?? "").toLowerCase()
        : "";
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? Number((err as { status?: unknown }).status)
        : null;

    if (
      status === 429 ||
      code.includes("rate_limit") ||
      normalizedMessage.includes("rate limit")
    ) {
      return translate("copy.tooManyAuthEmailsWereRequested");
    }

    if (
      code === "invalid_credentials" ||
      normalizedMessage.includes("invalid login credentials")
    ) {
      return translate("copy.invalidEmailOrPassword");
    }

    if (
      code === "email_not_confirmed" ||
      normalizedMessage.includes("email not confirmed")
    ) {
      return translate("copy.confirmYourEmailBeforeSigningIn");
    }

    if (
      code === "user_already_exists" ||
      code === "user_already_registered" ||
      normalizedMessage.includes("user already registered")
    ) {
      return translate("copy.anAccountWithThisEmailAlreadyExistsSignInInstead");
    }

    if (code === "weak_password") {
      return translate("copy.enterAPasswordWithAtLeast6Characters");
    }

    if (code === "email_address_invalid") {
      return translate("copy.enterAValidEmailAddress");
    }

    return fallback;
  }

  function openEmailApp() {
    if (typeof window === "undefined") return;

    const target = signupConfirmationEmail?.trim() || email.trim();
    window.location.href = target
      ? `mailto:${encodeURIComponent(target)}`
      : "mailto:";
  }

  async function signInWithProvider(provider: Provider) {
    if (!supabase) {
      setError(translate("copy.supabaseIsNotConfiguredYet"));
      return;
    }

    const native = isNativeApp();
    nativeOAuthPendingRef.current = native;
    setOauthProvider(provider);
    setBusy(true);
    setError(null);
    setNotice(null);
    setSignupConfirmationEmail(null);
    setTransferToast(null);

    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthRedirectUrl(),
          skipBrowserRedirect: native,
          queryParams:
            provider === "google"
              ? {
                  prompt: "select_account",
                }
              : undefined,
        },
      });
      if (oauthError) throw oauthError;
      if (native) {
        if (!data.url) throw new Error("The sign-in page could not be opened.");
        await openExternalUrl(data.url);
      }
    } catch (err) {
      nativeOAuthPendingRef.current = false;
      setOauthProvider(null);
      setBusy(false);
      setError(getAuthErrorMessage(err, translate("copy.couldNotStartSignIn")));
    }
  }

  async function submit() {
    if (!supabase) {
      setError(translate("copy.supabaseIsNotConfiguredYet"));
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedAccountName = formatPlayerName(accountName);
    if (!trimmedEmail || !password) return;
    if (mode === "signup" && !trimmedAccountName) {
      setError(translate("copy.enterYourPlayerName"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setSignupConfirmationEmail(null);
    setTransferToast(null);

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) throw signInError;
        if (dialogRef.current?.open) {
          onOpenChange?.(false);
          dialogRef.current.close();
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: getAuthRedirectUrl(),
            data: {
              name: trimmedAccountName,
              full_name: trimmedAccountName,
              display_name: trimmedAccountName,
              player_name: trimmedAccountName,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (isExistingAccountSignUpResponse(data.user)) {
          setSignupConfirmationEmail(null);
          setError(
            translate("copy.anAccountWithThisEmailAlreadyExistsSignInInstead"),
          );
          return;
        }
        if (!data.session) {
          setPassword("");
          setSignupConfirmationEmail(trimmedEmail);
        } else {
          if (dialogRef.current?.open) {
            onOpenChange?.(false);
            dialogRef.current.close();
          }
        }
      }
    } catch (err) {
      setError(
        getAuthErrorMessage(err, translate("copy.authenticationFailed")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      setError(translate("copy.supabaseIsNotConfiguredYet"));
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(translate("copy.enterYourEmailFirst"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      const redirectTo = getAuthRedirectUrl("recovery");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo,
        },
      );
      if (resetError) throw resetError;
      setNotice(translate("copy.checkYourEmailForAPasswordResetLink"));
    } catch (err) {
      setError(
        getAuthErrorMessage(err, translate("copy.couldNotSendResetLink")),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword() {
    if (!supabase) {
      setError(translate("copy.supabaseIsNotConfiguredYet"));
      return;
    }

    if (newPassword.length < 6) {
      setError(translate("copy.enterAPasswordWithAtLeast6Characters"));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(translate("copy.passwordsDoNotMatch"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setNewPassword("");
      setConfirmNewPassword("");
      setRecoveryMode(false);
      setNotice(translate("copy.passwordUpdated"));
    } catch (err) {
      console.error("Failed to update password", err);
      setError(translate("copy.couldNotUpdatePassword"));
    } finally {
      setBusy(false);
    }
  }

  async function saveAccountPlayerName() {
    const name = formatPlayerName(accountDraftName);
    if (!name || !accountPlayer || !onUpdateProfile) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);
    try {
      const { error: updateError } = (await supabase?.auth.updateUser({
        data: {
          name,
          full_name: name,
          display_name: name,
          player_name: name,
        },
      })) ?? { error: null };
      if (updateError) throw updateError;
      onUpdateProfile(accountPlayer.id, {
        name,
        avatarColor: accountDraftColor || accountPlayer.avatarColor,
      });
      setAccountDraftName(name);
      setEditingAccountPlayer(false);
      setNotice(translate("copy.accountPlayerUpdated"));
    } catch (err) {
      console.error("Failed to update account player", err);
      setError(translate("copy.couldNotUpdatePlayerName"));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase || busy) return;
    const confirmed = await onConfirmSignOut();
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      if (dialogRef.current?.open) {
        onOpenChange?.(false);
        dialogRef.current.close();
      }
    } catch (err) {
      console.error("Failed to sign out", err);
      setError(translate("copy.signOutFailed"));
    } finally {
      setBusy(false);
    }
  }

  function formatTransferParts(result: DataTransferResult) {
    return [
      result.games ? translate("dynamic.session", [result.games]) : "",
      result.profiles ? translate("dynamic.player", [result.profiles]) : "",
      result.teams ? translate("dynamic.team", [result.teams]) : "",
    ].filter(Boolean);
  }

  function showTransferToast(message: string, tone: ToastTone = "default") {
    setNotice(null);
    setTransferToast({ message, tone });
  }

  async function openUrl(url: string) {
    try {
      await openExternalUrl(url);
    } catch {
      showTransferToast(translate("copy.thisLinkIsNotValid"), "error");
    }
  }

  function getBillingErrorMessage(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message.toLowerCase() : "";

    if (message.includes("no stripe billing profile was found")) {
      return translate("copy.noStripeBillingProfileWasFound");
    }

    if (message.includes("already has a session pass")) {
      return translate("copy.thisAccountAlreadyHasASessionPass");
    }

    if (message.includes("referral code is not valid")) {
      return translate("copy.thisReferralCodeIsNotValid");
    }

    if (message.includes("cannot use your own referral code")) {
      return translate("copy.youCannotUseYourOwnReferralCode");
    }

    if (message.includes("not available for that apple plan")) {
      return translate("copy.thisReferralCodeIsNotAvailableForThatPlan");
    }

    if (message.includes("supabase is not configured")) {
      return translate("copy.supabaseIsNotConfiguredYet");
    }

    return fallback;
  }

  async function getInvokeErrorMessage(err: unknown, fallback: string) {
    if (err instanceof FunctionsHttpError) {
      try {
        const payload = (await err.context.json()) as { error?: string };
        if (payload?.error) {
          return payload.error;
        }
      } catch {
        return fallback;
      }
    }

    if (
      err instanceof FunctionsRelayError ||
      err instanceof FunctionsFetchError
    ) {
      return err.message || fallback;
    }

    return getBillingErrorMessage(err, fallback);
  }

  async function requestAppleReferralOffer() {
    const normalizedCode = appleReferralCode.trim().toUpperCase();
    if (!normalizedCode) {
      throw new Error(translate("copy.enterReferralCode"));
    }
    if (!supabase || !hasSupabaseConfig) {
      throw new Error("Supabase is not configured yet.");
    }

    const { data, error: invokeError } = await supabase.functions.invoke<{
      url?: string;
      discountPercent?: number;
      error?: string;
    }>("get-apple-referral-offer", {
      body: {
        code: normalizedCode,
        billingPeriod: selectedBillingPeriod,
      },
    });
    if (invokeError) {
      throw new Error(
        await getInvokeErrorMessage(
          invokeError,
          translate("copy.theReferralOfferCouldNotBeOpened"),
        ),
      );
    }
    if (!data?.url || typeof data.discountPercent !== "number") {
      throw new Error(
        data?.error || translate("copy.theReferralOfferCouldNotBeOpened"),
      );
    }

    return {
      billingPeriod: selectedBillingPeriod,
      code: normalizedCode,
      discountPercent: data.discountPercent,
      url: data.url,
      validatedAt: Date.now(),
    };
  }

  async function validateAppleReferralCode() {
    setAppleReferralChecking(true);
    setAppleReferralError(null);
    try {
      const offer = await requestAppleReferralOffer();
      setAppleReferralOffer(offer);
    } catch (err) {
      setAppleReferralOffer(null);
      setAppleReferralError(
        getBillingErrorMessage(
          err,
          translate("copy.theReferralOfferCouldNotBeOpened"),
        ),
      );
    } finally {
      setAppleReferralChecking(false);
    }
  }

  async function requestBillingUrl(
    functionName:
      | "create-checkout-session"
      | "create-customer-portal-session"
      | "create-session-pass-checkout",
    body: Record<string, unknown>,
    fallback: string,
  ) {
    if (!supabase || !hasSupabaseConfig) {
      throw new Error("Supabase is not configured yet.");
    }

    const { data, error: invokeError } = await supabase.functions.invoke<{
      url?: string;
      error?: string;
    }>(functionName, {
      body,
    });

    if (invokeError) {
      throw new Error(await getInvokeErrorMessage(invokeError, fallback));
    }

    if (!data?.url) {
      throw new Error(data?.error || fallback);
    }

    return data.url;
  }

  async function startUpgradeFlow() {
    if (!session) {
      setError(translate("copy.signInBeforeStartingASubscription"));
      return;
    }
    if (isNativeIOSApp()) {
      let purchaseResult: ToastState = {
        message: translate("copy.thePurchaseCouldNotBeCompleted"),
        tone: "error",
      };
      setBusy(true);
      setError(null);
      setNotice(null);
      setTransferToast(null);
      try {
        const normalizedReferralCode = appleReferralCode.trim().toUpperCase();
        if (normalizedReferralCode) {
          const hasFreshValidation =
            appleReferralOffer?.code === normalizedReferralCode &&
            appleReferralOffer.billingPeriod === selectedBillingPeriod &&
            Date.now() - appleReferralOffer.validatedAt < 55 * 60 * 1000;
          const offer = hasFreshValidation
            ? appleReferralOffer
            : await requestAppleReferralOffer();
          await openExternalUrl(offer.url);
          purchaseResult = {
            message: translate("copy.continueInTheAppStoreToRedeemYourOffer"),
            tone: "default",
          };
          return;
        }

        const result = await appleSubscription.purchase(selectedBillingPeriod);
        if (result.status === "cancelled") {
          purchaseResult = {
            message: translate("copy.purchaseCancelled"),
            tone: "default",
          };
        } else if (result.status === "pending") {
          purchaseResult = {
            message: translate("copy.purchaseWaitingForApproval"),
            tone: "default",
          };
        } else {
          purchaseResult = {
            message: translate("copy.welcomeToPlinkPro"),
            tone: "success",
          };
        }
      } catch (err) {
        purchaseResult = {
          message: getBillingErrorMessage(
            err,
            translate("copy.thePurchaseCouldNotBeCompleted"),
          ),
          tone: "error",
        };
      } finally {
        setBusy(false);
        showNativePurchaseResult(purchaseResult.message, purchaseResult.tone);
      }
      return;
    }

    // Google Play requires its billing flow for these in-app digital purchases.
    // Keep Android out of the web Stripe checkout until its Play Billing bridge
    // and server-side verification are configured with the Play Console app.
    if (isNativeAndroidApp()) {
      setError(translate("copy.checkoutIsNotAvailableYet"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      const url = await requestBillingUrl(
        "create-checkout-session",
        {
          billingPeriod: selectedBillingPeriod,
          origin: window.location.origin,
        },
        translate("copy.checkoutIsNotAvailableYet"),
      );
      await openUrl(url);
    } catch (err) {
      setError(
        getBillingErrorMessage(
          err,
          translate("copy.checkoutIsNotAvailableYet"),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function startSessionPassPurchase() {
    if (!session) {
      setError(translate("copy.signInBeforeBuyingASessionPass"));
      return;
    }
    if (hasSessionPass) {
      showTransferToast(
        translate("dynamic.yourAccountCanAlreadyKeepUpToSessions", [
          maxSessions ?? 100,
        ]),
        "default",
      );
      return;
    }

    if (isNativeIOSApp()) {
      let purchaseResult: ToastState = {
        message: translate("copy.theSessionPassPurchaseCouldNotBeCompleted"),
        tone: "error",
      };
      setBusy(true);
      setError(null);
      setNotice(null);
      setTransferToast(null);
      try {
        const result = await appleSubscription.purchaseSessionPass();
        if (result.status === "cancelled") {
          purchaseResult = {
            message: translate("copy.purchaseCancelled"),
            tone: "default",
          };
        } else if (result.status === "pending") {
          purchaseResult = {
            message: translate("copy.sessionPassWaitingForApproval"),
            tone: "default",
          };
        } else {
          purchaseResult = {
            message: translate(
              "copy.sessionPassAddedYouCanNowKeepUpTo100Sessions",
            ),
            tone: "success",
          };
        }
      } catch (err) {
        purchaseResult = {
          message: getBillingErrorMessage(
            err,
            translate("copy.theSessionPassPurchaseCouldNotBeCompleted"),
          ),
          tone: "error",
        };
      } finally {
        setBusy(false);
        showNativePurchaseResult(purchaseResult.message, purchaseResult.tone);
      }
      return;
    }

    if (isNativeAndroidApp()) {
      setError(translate("copy.sessionPassCheckoutIsNotAvailableYet"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);
    try {
      const url = await requestBillingUrl(
        "create-session-pass-checkout",
        { origin: window.location.origin },
        translate("copy.sessionPassCheckoutIsNotAvailableYet"),
      );
      await openUrl(url);
    } catch (err) {
      setError(
        getBillingErrorMessage(
          err,
          translate("copy.sessionPassCheckoutIsNotAvailableYet"),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function restoreSubscription() {
    if (!session) {
      setError(translate("copy.signInBeforeManagingASubscription"));
      return;
    }
    if (isNativeIOSApp()) {
      setBusy(true);
      setError(null);
      setNotice(null);
      setTransferToast(null);
      try {
        const result = await appleSubscription.restore();
        const restoredBoth = result.active && result.sessionPassActive;
        showTransferToast(
          restoredBoth
            ? translate("copy.plinkProAndSessionPassWereRestored")
            : result.active
              ? translate("copy.plinkProPurchaseWasRestored")
              : result.sessionPassActive
                ? translate("copy.sessionPassWasRestored")
                : translate("copy.noRestorablePlinkPurchasesWereFound"),
          result.active || result.sessionPassActive ? "success" : "default",
        );
      } catch (err) {
        showTransferToast(
          getBillingErrorMessage(
            err,
            translate("copy.purchasesCouldNotBeRestored"),
          ),
          "error",
        );
      } finally {
        setBusy(false);
      }
      return;
    }

    if (isNativeAndroidApp()) {
      setError(translate("copy.billingPortalIsNotAvailableYet"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      const url = await requestBillingUrl(
        "create-customer-portal-session",
        { origin: window.location.origin },
        translate("copy.billingPortalIsNotAvailableYet"),
      );
      await openUrl(url);
    } catch (err) {
      setError(
        getBillingErrorMessage(
          err,
          translate("copy.billingPortalIsNotAvailableYet"),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function manageSubscription() {
    try {
      if (subscriptionProvider === "apple" && isNativeIOSApp()) {
        await appleSubscription.showManageSubscriptions();
        return;
      }

      if (subscriptionProvider === "apple") {
        await openExternalUrl("https://apps.apple.com/account/subscriptions");
        return;
      }

      if (isNativeIOSApp()) {
        await openExternalUrl("https://plinkscore.com");
        return;
      }

      if (isNativeAndroidApp()) {
        throw new Error(translate("copy.subscriptionSettingsCouldNotBeOpened"));
      }

      await restoreSubscription();
    } catch (err) {
      showTransferToast(
        getBillingErrorMessage(
          err,
          translate("copy.subscriptionSettingsCouldNotBeOpened"),
        ),
        "error",
      );
    }
  }

  async function deleteAccount() {
    if (!supabase || !session) {
      setError(translate("copy.signInBeforeDeletingYourAccount"));
      return;
    }
    if (busy) return;

    const confirmed = await onConfirmAccountDeletion();
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      const { error: invokeError } = await supabase.functions.invoke(
        "delete-account",
        { body: {} },
      );
      if (invokeError) {
        throw new Error(
          await getInvokeErrorMessage(
            invokeError,
            translate("copy.yourAccountCouldNotBeDeleted"),
          ),
        );
      }

      await supabase.auth.signOut({ scope: "local" });
      setConfirmingAccountDeletion(false);
      if (dialogRef.current?.open) {
        onOpenChange?.(false);
        dialogRef.current.close();
      }
    } catch (err) {
      setError(translate("copy.yourAccountCouldNotBeDeleted"));
    } finally {
      setBusy(false);
    }
  }

  async function runImportFromDevice(
    selection: { gameIds: string[]; profileIds: string[] } = {
      gameIds: selectedLocalGameIds,
      profileIds: selectedLocalProfileIds,
    },
    emptySelectionMessage = "Select at least one session or player to import.",
  ) {
    const { gameIds, profileIds } = selection;

    if (gameIds.length === 0 && profileIds.length === 0) {
      setError(emptySelectionMessage);
      return;
    }

    if (!onImportLocalData) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      const result = await onImportLocalData({
        gameIds,
        profileIds,
      });
      const parts = formatTransferParts(result);

      if (parts.length === 0) {
        showTransferToast(
          result.skippedTeamContent
            ? "Only team-based sessions were selected. Upgrade to Pro to import them."
            : translate("copy.nothingNewToImportFromThisDevice"),
        );
        return;
      }

      const skippedTeamContentLabel = result.skippedTeamContent
        ? " Team-based sessions were skipped because this account is on Free plan."
        : "";
      showTransferToast(
        translate("dynamic.importedToYourAccount", [
          parts.join(" , "),
          skippedTeamContentLabel,
        ]),
        "success",
      );
    } catch (err) {
      console.error("Failed to import device data", err);
      showTransferToast(translate("copy.importFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function runImportFromFile(file: File) {
    if (!includeGames && !includeProfiles) {
      setError(translate("copy.selectGamesPlayersOrBothFirst"));
      return;
    }
    if (!onImportBackupFile) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      const result = await onImportBackupFile(file, transferSelection);
      const parts = formatTransferParts(result);

      if (parts.length === 0) {
        showTransferToast(
          result.skippedTeamContent
            ? "This backup only contains team data. Upgrade to Pro to restore it."
            : "No new sessions, players, or teams were found in that backup file.",
        );
        return;
      }

      const skippedTeamContentLabel = result.skippedTeamContent
        ? " Team data was skipped because this account is on Free plan."
        : "";
      showTransferToast(
        `Imported ${parts.join(" and ")} from backup file.${skippedTeamContentLabel}`,
        "success",
      );
    } catch (err) {
      console.error("Failed to import backup file", err);
      showTransferToast(translate("copy.importFromFileFailed"), "error");
    } finally {
      setBusy(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  async function runDownloadBackupFile() {
    if (!includeGames && !includeProfiles) {
      setError(translate("copy.selectGamesPlayersOrBothFirst"));
      return;
    }
    if (!onDownloadBackupFile) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    setTransferToast(null);

    try {
      await onDownloadBackupFile(transferSelection);
    } catch (err) {
      console.error("Failed to download backup file", err);
      showTransferToast(translate("copy.backupDownloadFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return {
    allowPreviousPlayersToInvite,
    appleReferralCode,
    appleReferralChecking,
    appleReferralError,
    appleReferralOffer,
    hasSupabaseConfig,
    accountColorOptionRefs,
    accountDraftColor,
    accountDraftName,
    accountGames,
    accountGamesCount,
    accountName,
    accountPlayer,
    accountPlayerColor,
    accountPlayerName,
    accountProfiles,
    accountProfilesCount,
    allFilteredLocalGamesSelected,
    backupInputRef,
    billingPeriodOptionRefs,
    busy,
    confirmingAccountDeletion,
    confirmNewPassword,
    deviceImportRef,
    deleteAccount,
    dialogRef,
    editingAccountPlayer,
    email,
    entitlementsLoading,
    error,
    filteredLocalGames,
    handleAccountColorRadioKeyDown,
    handleBillingPeriodRadioKeyDown,
    hasFilteredLocalGames,
    hasStripeBillingProfile,
    hasSessionPass,
    appleProductsByPeriod: appleSubscription.productsByPeriod,
    appleProductsError: appleSubscription.productsError,
    appleProductsLoading: appleSubscription.isLoadingProducts,
    appleSessionPassError: appleSubscription.sessionPassError,
    appleSessionPassLoading: appleSubscription.isLoadingSessionPass,
    appleSessionPassProduct: appleSubscription.sessionPassProduct,
    includeGames,
    includeProfiles,
    isAwaitingSignupConfirmation,
    isNativeIOS: isNativeIOSApp(),
    isPro,
    localGames,
    localProfiles,
    localSessionSearch,
    maxSessions,
    mode,
    newPassword,
    notice,
    oauthProvider,
    onOpenChange,
    onUpdateProfile,
    openEmailApp,
    password,
    planSectionRef,
    recoveryMode,
    reloadAppleProducts: appleSubscription.reloadProducts,
    renewalLabel,
    manageSubscription,
    restoreSubscription,
    runDownloadBackupFile,
    runImportFromDevice,
    runImportFromFile,
    saveAccountPlayerName,
    selectedBillingPeriod,
    selectedLocalGameIds,
    selectedLocalProfileIds,
    sendPasswordReset,
    session,
    setAccountDraftColor,
    setAccountDraftName,
    setAccountName,
    setAppleReferralCode,
    setConfirmNewPassword,
    setConfirmingAccountDeletion,
    setEditingAccountPlayer,
    setEmail,
    setError,
    setIncludeGames,
    setIncludeProfiles,
    setLocalSessionSearch,
    setMode,
    setNewPassword,
    setNotice,
    setPassword,
    setRecoveryMode,
    setSelectedBillingPeriod,
    setShowAccountDetails,
    setShowDeviceImport,
    setShowDevicePlayersImport,
    setShowPassword,
    setShowPlanDetails,
    setShowTransferTools,
    setSignupConfirmationEmail,
    setTransferToast,
    showAccountDetails,
    showDeviceImport,
    showDevicePlayersImport,
    showPassword,
    showPlanDetails,
    showTransferTools,
    sharingPreferenceLoading,
    signInWithProvider,
    signOut,
    signupConfirmationEmail,
    sinceLabel,
    source,
    subscriptionProvider,
    startSessionPassPurchase,
    startUpgradeFlow,
    submit,
    submitNewPassword,
    toggleFilteredLocalGames,
    toggleLocalGame,
    toggleLocalProfile,
    transferToast,
    updateSharingPreference,
    validateAppleReferralCode,
  };
}
