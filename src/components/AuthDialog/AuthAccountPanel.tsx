import { translate } from "../../i18n/translate";
import {
  AlertTriangle,
  Bug,
  Heart,
  Mail,
  Map,
  LogOut,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  APP_STORE_URL,
  GOOGLE_PLAY_STORE_URL,
  ROADMAP_URL,
} from "../../constants";
import { isNativeAndroidApp, isNativeApp } from "../../lib/nativePlatform";
import {
  FEEDBACK_EMAIL_URL,
  getReportAProblemEmailUrl,
} from "../../utils/feedbackEmail";
import { AuthAccountIdentity } from "./AuthAccountIdentity";
import { AuthAccountStorage } from "./AuthAccountStorage";
import { useAuthDialogContext } from "./AuthDialogContext";
import { AuthPlanSection } from "./AuthPlanSection";
import { AuthTransferSection } from "./AuthTransferSection";
import { AuthAppSettings } from "./AuthAppSettings";
import { AppStoreBanner } from "../AppStoreBanner/AppStoreBanner";

export function AuthAccountPanel() {
  const {
    busy,
    confirmingAccountDeletion,
    deleteAccount,
    setConfirmingAccountDeletion,
    signOut,
  } = useAuthDialogContext();
  const nativeApp = isNativeApp();
  const rateUrl = isNativeAndroidApp() ? GOOGLE_PLAY_STORE_URL : APP_STORE_URL;

  return (
    <div className="authDialog__panel">
      <div className="authDialog__accountOverview">
        <div className="authDialog__sectionHeading">
          <span className="authDialog__sectionHeadingIcon" aria-hidden="true">
            <UserRound size={17} strokeWidth={2.4} />
          </span>
          <span>{translate("copy.profileAndAccount")}</span>
        </div>
        <AuthAccountIdentity />
        <AuthAccountStorage />
        <AuthPlanSection />
      </div>
      <AuthAppSettings />
      <AppStoreBanner className="appStoreBanner--dark" />
      <AuthTransferSection />
      <button
        className="btn btn--wide btn--dangerSolid authDialog__signOutBtn"
        type="button"
        onClick={signOut}
        disabled={busy}
      >
        <LogOut size={17} strokeWidth={2.3} aria-hidden="true" />
        <span>
          {busy ? translate("copy.signingOut") : translate("copy.signOut")}
        </span>
      </button>
      {confirmingAccountDeletion ? (
        <section className="authDialog__deleteAccount" role="alert">
          <div className="authDialog__deleteAccountCopy">
            <AlertTriangle size={18} strokeWidth={2.4} aria-hidden="true" />
            <div>
              <strong>{translate("copy.permanentlyDeleteThisAccount")}</strong>
              <p>
                {translate(
                  "copy.cloudSessionsPlayersTeamsAndAccountAccessWillBeRemovedWebSubscriptions",
                )}
              </p>
            </div>
          </div>
          <div className="authDialog__deleteAccountActions">
            <button
              className="btn btn--ghost btn--wide"
              type="button"
              disabled={busy}
              onClick={() => setConfirmingAccountDeletion(false)}
            >
              {translate("copy.keepAccount")}
            </button>
            <button
              className="btn btn--dangerSolid btn--wide"
              type="button"
              disabled={busy}
              onClick={() => void deleteAccount()}
            >
              {busy
                ? translate("copy.deleting")
                : translate("copy.deletePermanently")}
            </button>
          </div>
        </section>
      ) : (
        <button
          className="btn btn--ghost btn--wide authDialog__deleteAccountBtn"
          type="button"
          disabled={busy}
          onClick={() => setConfirmingAccountDeletion(true)}
        >
          <Trash2 size={17} strokeWidth={2.3} aria-hidden="true" />
          <span>{translate("copy.deleteAccount")}</span>
        </button>
      )}
      <div
        className="authDialog__links"
        aria-label={translate("copy.accountLinks")}
      >
        <a href="/guides/index.html">{translate("copy.guides")}</a>
        <span aria-hidden="true">·</span>
        <a href="/privacy.html">{translate("copy.privacy")}</a>
        <span aria-hidden="true">·</span>
        <a href="/support.html">{translate("copy.support")}</a>
        {!nativeApp ? (
          <>
            <span aria-hidden="true">·</span>
            <a href={ROADMAP_URL}>{translate("copy.roadmap")}</a>
          </>
        ) : null}
      </div>
      <section
        className="authDialog__community"
        aria-label={translate("copy.communityLinks")}
      >
        {nativeApp ? (
          <div className="authDialog__communityActions">
            <>
              <a href={rateUrl} target="_blank" rel="noreferrer">
                <Heart size={17} strokeWidth={2.3} aria-hidden="true" />
                <span>{translate("copy.ratePlink")}</span>
              </a>
              <span aria-hidden="true">·</span>
            </>
            <a href={ROADMAP_URL}>
              <Map size={18} strokeWidth={2.1} aria-hidden="true" />
              <span>{translate("copy.roadmap")}</span>
            </a>
          </div>
        ) : null}
        <p>{translate("copy.haveAnIdeaOrSuggestion")}</p>
        <div className="authDialog__feedbackActions">
          <a className="authDialog__feedbackLink" href={FEEDBACK_EMAIL_URL}>
            <Mail size={19} strokeWidth={2.2} aria-hidden="true" />
            <span>{translate("copy.sendFeedback")}</span>
          </a>
          <a
            className="authDialog__feedbackLink authDialog__feedbackLink--report"
            href={getReportAProblemEmailUrl()}
          >
            <Bug size={19} strokeWidth={2.2} aria-hidden="true" />
            <span>{translate("copy.reportAProblem")}</span>
          </a>
        </div>
      </section>
    </div>
  );
}
