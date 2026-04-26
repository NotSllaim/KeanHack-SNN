import React from "react";
import { BookOpenText, LogOut, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { CompanionSurveyScreen } from "./components/CompanionSurveyScreen.jsx";
import { ConversationPractice } from "./components/ConversationPractice.jsx";
import { HistoryPanel } from "./components/HistoryPanel.jsx";
import { ReadingPractice } from "./components/ReadingPractice.jsx";
import { ScoreCard } from "./components/ScoreCard.jsx";
import { VerbiageTraining } from "./components/VerbiageTraining.jsx";
import { SolanaUpgrade } from "./components/SolanaUpgrade.jsx";
import logo from "./public/logo.png";
import { useAuth } from "./state/AuthContext.jsx";

const tabs = [
  { id: "conversation", label: "Conversation", icon: MessageCircle },
  { id: "reading", label: "Reading", icon: BookOpenText },
  { id: "verbiage", label: "Verbiage", icon: Sparkles }
];

const companionImages = import.meta.glob("./public/*.png", { eager: true, import: "default" });

export default function App() {
  const { user, loading, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = React.useState("conversation");

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-[#f7f5ef] text-ink">Loading Lingo...</div>;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!user.profile?.companionElement?.name) {
    return <CompanionSurveyScreen />;
  }

  const ActiveActivity = {
    conversation: ConversationPractice,
    reading: ReadingPractice,
    verbiage: VerbiageTraining
  }[activeTab];

  const handleUpgradeComplete = (updatedUser) => {
    updateUser(updatedUser);
  };

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <header className="border-b border-stone-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Lingo logo" className="h-14 w-14 object-contain" />
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-normal text-meadow">Lingo</h1>
              {user.upgraded && (
                <span className="rounded-md bg-meadow px-2 py-1 text-xs font-bold text-white">
                  UPGRADED
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
              <span className="font-semibold">{user.name}</span>
              <span className="ml-2 text-stone-500">{user.scores?.sessionsCompleted || 0} sessions</span>
            </div>
            {user.profile?.companionElement?.name && (
              <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
                <span className="text-stone-500">Level</span>
                <span className="ml-2 font-semibold text-meadow">{user.progress?.level || 1}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700 hover:border-coral hover:text-coral"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-ink text-white"
                      : "border border-stone-200 bg-white text-stone-700 hover:border-meadow hover:text-meadow"
                  }`}
                >
                  <Icon size={17} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <ActiveActivity />
        </section>

        <aside className="space-y-5">
          <ScoreCard
            title="Growth Snapshot"
            icon={TrendingUp}
            scores={[
              { label: "Confidence", value: user.scores?.confidenceAverage || 0 },
              { label: "Clarity", value: user.scores?.clarityAverage || 0 }
            ]}
          />
          {user.profile?.companionElement && (
            <CompanionProgressPanel
              element={user.profile.companionElement}
              progress={user.progress}
            />
          )}
          <SolanaUpgrade onUpgradeComplete={handleUpgradeComplete} isUpgraded={user.upgraded} />
          <HistoryPanel />
        </aside>
      </div>
    </main>
  );
}

function CompanionProgressPanel({ element, progress = {} }) {
  const level = progress.level || 1;
  const isMax = level >= (progress.maxLevel || 3);
  const image = getCompanionImage(element.id, level);

  return (
    <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-center text-sm font-semibold text-meadow">Companion Progress</p>
      {image && (
        <div className="mt-3 flex justify-center">
          <img
            src={image}
            alt={`${element.name} companion level ${level}`}
            className="h-32 w-32 object-contain"
          />
        </div>
      )}
      <div className="mt-3 text-center">
        <h2 className="text-2xl font-bold text-ink">{element.name}</h2>
        <p className="mt-1 text-sm font-semibold text-stone-600">
          Level {level}{isMax ? " - Max" : ""}
        </p>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-stone-700">XP</span>
          <span className="font-bold text-ink">
            {isMax
              ? `${progress.xp || 0} total`
              : `${progress.xpIntoLevel || 0}/${progress.xpForLevel || 100}`}
          </span>
        </div>
        <div className="h-3 rounded-full bg-stone-100">
          <div
            className="h-3 rounded-full bg-meadow transition-all"
            style={{ width: `${progress.progressPercent || 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {isMax ? "Your companion is fully evolved." : `${(progress.nextLevelXp || 100) - (progress.xp || 0)} XP until the next stage.`}
        </p>
      </div>
    </section>
  );
}

function getCompanionImage(elementId, level) {
  const baseName = elementId === "lightning" ? "electric" : elementId;
  return companionImages[`./public/${baseName}${level}.png`] || companionImages[`./public/${baseName}1.png`];
}
