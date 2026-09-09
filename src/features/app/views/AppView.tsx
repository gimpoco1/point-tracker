import { lazy, Suspense, useEffect, useState } from "react";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNativeAndroidApp, isNativeApp } from "../../../lib/nativePlatform";
import { useAppContext } from "../context/AppContext";
import { AppDialogs } from "../components/AppDialogs";
import { AppLoadingScreen } from "../components/AppLoadingScreen";
import { AppRoutes } from "./AppRoutes";
import { AppToast } from "../components/AppToast";
import { AppTopBar } from "../components/AppTopBar";
import { GameStartSplash } from "../components/GameStartSplash";

const DotGrid = lazy(() => import("../../../components/DotGrid/DotGrid"));

type IdleWindow = Window & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
};

export function AppView() {
  const {
    authDialogOpen,
    gameStartSplashCue,
    handleTouchEnd,
    handleTouchStart,
    isAppBootLoading,
    isResumingActiveGameView,
  } = useAppContext();
  const isLoading = isAppBootLoading || isResumingActiveGameView;
  const [showBackdrop, setShowBackdrop] = useState(false);

  useEffect(() => {
    if (!isNativeApp() || isLoading) return;
    void SplashScreen.hide({ fadeOutDuration: 0 });
  }, [isLoading]);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    if (!idleWindow.requestIdleCallback) {
      const timeoutId = window.setTimeout(() => setShowBackdrop(true), 0);
      return () => window.clearTimeout(timeoutId);
    }

    const idleCallbackId = idleWindow.requestIdleCallback(
      () => setShowBackdrop(true),
      { timeout: 2000 },
    );
    return () => idleWindow.cancelIdleCallback?.(idleCallbackId);
  }, []);

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  return (
    <div
      className="app"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={`appBackdrop${authDialogOpen ? " appBackdrop--hidden" : ""}`}
        aria-hidden="true"
      >
        {showBackdrop ? (
          <Suspense fallback={null}>
            <DotGrid
              dotSize={3}
              gap={23}
              baseColor="#202b34"
              activeColor="#d8ff4f"
              proximity={140}
              shockRadius={250}
              shockStrength={5}
              resistance={750}
              returnDuration={1.5}
              idleSpeed={1.75}
              idleStrength={4.5}
              reducedMotionScale={isNativeAndroidApp() ? 1 : undefined}
            />
          </Suspense>
        ) : null}
      </div>
      <AppTopBar />
      <AppRoutes />
      {gameStartSplashCue ? (
        <GameStartSplash key={gameStartSplashCue.token} />
      ) : null}
      <AppDialogs />
      <AppToast />
    </div>
  );
}
