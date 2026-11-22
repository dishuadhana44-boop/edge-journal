import PageHeader from "../components/common/PageHeader";
import AssistantChat from "../components/assistant/AssistantChat";

export default function AIInsightsPage() {
  return (
    <div className="flex h-screen flex-col gap-3 bg-gray-50 px-4 py-4">
      <PageHeader
        title="AI Trading Assistant"
        subtitle="Ask questions and get answers computed from your own EdgeFlo journal."
        icon="ai"
        spaced={false}
      />

      <div className="min-h-0 flex-1">
        <AssistantChat />
      </div>
    </div>
  );
}
