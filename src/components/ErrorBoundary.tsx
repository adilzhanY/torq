/**
 * Crash boundary.
 *
 * torq is local-first: a user's entire training history can live only on
 * their phone. So a render crash is not "the screen went blank", it is "my
 * data is gone" — the worst thing this app can do to someone. This catches
 * the throw, keeps the process alive, and says plainly that nothing was
 * lost.
 *
 * The recovery path NEVER touches storage. Every option here re-renders or
 * navigates; none of them clear, migrate or "repair" the database, because
 * a bug in a chart must not be able to take a year of workouts with it.
 * If the crash is in a tab, "Back to Home" gets the user moving again
 * without a restart.
 *
 * Class component on purpose: componentDidCatch has no hook equivalent.
 */
import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { C, R } from "../theme";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { PrimaryButton, Txt } from "./ui";

interface Props {
  children: React.ReactNode;
  /** Reset hook — e.g. send the user back to a known-good tab. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
  /** Bumped on every reset so children remount from scratch. */
  attempt: number;
  showDetail: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0, showDetail: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // No crash reporter wired up yet; the console is what a dev build has.
    console.error("[torq] render crash", error, info?.componentStack);
  }

  private reset = () => {
    this.setState((s) => ({ error: null, attempt: s.attempt + 1, showDetail: false }));
    this.props.onReset?.();
  };

  render() {
    const { error, showDetail } = this.state;
    if (!error) {
      // The key forces a fresh subtree on reset — without it React reuses the
      // same instances and the same bad state throws again immediately.
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    }

    return (
      <View style={{ flex: 1, backgroundColor: C.page, padding: 24, justifyContent: "center" }}>
        <View style={{ alignItems: "center", gap: 14 }}>
          <Logo size={64} />
          <Txt size={24} weight="extrabold" style={{ textAlign: "center" }}>
            Something broke
          </Txt>
          <Txt size={14} color={C.inkSoft} style={{ textAlign: "center", lineHeight: 21 }}>
            A screen crashed, but your workouts are safe — nothing was
            deleted and nothing was changed.
          </Txt>
        </View>

        <View style={{ gap: 10, marginTop: 28 }}>
          <PrimaryButton label="Try again" large onPress={this.reset} />
          <Pressable
            onPress={() => this.setState((s) => ({ showDetail: !s.showDetail }))}
            style={{ alignItems: "center", paddingVertical: 10 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name={showDetail ? "ChevronDown" : "ChevronRight"} size={14} color={C.inkFaint} />
              <Txt size={12.5} weight="bold" color={C.inkFaint}>
                {showDetail ? "Hide details" : "Show technical details"}
              </Txt>
            </View>
          </Pressable>
        </View>

        {showDetail ? (
          <ScrollView
            style={{
              maxHeight: 220,
              marginTop: 4,
              backgroundColor: C.page2,
              borderRadius: R.sm,
              borderWidth: 1,
              borderColor: C.line,
              padding: 12,
            }}
          >
            <Txt size={11} color={C.inkSoft}>
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </Txt>
          </ScrollView>
        ) : null}
      </View>
    );
  }
}
