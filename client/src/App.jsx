import React from "react";
import { BookOpenText, LogOut, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { CompanionSurveyScreen } from "./components/CompanionSurveyScreen.jsx";
import { ConversationPractice } from "./components/ConversationPractice.jsx";
import { HistoryPanel } from "./components/HistoryPanel.jsx";
import { ReadingPractice } from "./components/ReadingPractice.jsx";
import { ScoreCard } from "./components/ScoreCard.jsx";
import { VerbiageTraining } from "./components/VerbiageTraining.jsx";
import { useAuth } from "./state/AuthContext.jsx";

const tabs = [
  { id: "conversation", label: "Conversation", icon: MessageCircle },
  { id: "reading", label: "Reading", icon: BookOpenText },
  { id: "verbiage", label: "Verbiage", icon: Sparkles }
];

export default function App() {
  const { user, loading, logout } = useAuth();
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

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <header className="border-b border-stone-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-meadow">Lingo Confidence Coach</p>
            <h1 className="text-2xl font-bold tracking-normal text-ink">Practice that feels like a real conversation.</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
              <span className="font-semibold">{user.name}</span>
              <span className="ml-2 text-stone-500">{user.scores?.sessionsCompleted || 0} sessions</span>
            </div>
            {user.profile?.companionElement?.name && (
              <div className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
                <span className="text-stone-500">Element</span>
                <span className="ml-2 font-semibold text-meadow">{user.profile.companionElement.name}</span>
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
            <section className="rounded-md border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-meadow">Companion Element</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">{user.profile.companionElement.name}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{user.profile.companionElement.description}</p>
            </section>
          )}
          <HistoryPanel />
        </aside>
      </div>
    </main>
  );
}
