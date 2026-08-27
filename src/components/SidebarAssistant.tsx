import React, { useState, useRef, useEffect } from 'react';
import { PropertyListing, ChatMessage } from '../types';
import { sendChatMessage } from '../services/api';
import {
  Sparkles,
  Send,
  AlertTriangle,
  MessageSquare,
  Wand2,
  BellRing,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

interface SidebarAssistantProps {
  listings: PropertyListing[];
  onDraftPMAlert: (listing: PropertyListing) => void;
  onOpenExtractModal: (initialText?: string) => void;
  onFilterByPM: (pm: string) => void;
  onFilterByStatus: (status: string) => void;
}

export const SidebarAssistant: React.FC<SidebarAssistantProps> = ({
  listings,
  onDraftPMAlert,
  onOpenExtractModal,
  onFilterByPM,
  onFilterByStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'alerts' | 'extract'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your **Property Portfolio AI Assistant**. I have direct access to all **${listings.length} listings** in your tracker. Ask me about PM workloads, regional stock, renewal bottlenecks, or compliance data.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  // Compute expired & unrenewed anomalies
  const flaggedAnomalies = listings.filter(
    (l) => l.status === 'Expired' && l.renewStatus === 'Not Renewed'
  );

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSending(true);

    try {
      const response = await sendChatMessage(text, messages, listings);
      const assistantMsg: ChatMessage = {
        id: 'msg_ai_' + Date.now(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: response.sources,
        suggestedActions: response.suggestedActions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: '⚠️ Apologies, could not process request right now. Please verify connection.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    handleSendMessage(promptText);
  };

  const handleActionClick = (action: { actionType: string; value: any }) => {
    if (action.actionType === 'filter_pm') {
      onFilterByPM(String(action.value));
    } else if (action.actionType === 'filter_status') {
      onFilterByStatus(String(action.value));
    }
  };

  return (
    <aside className="w-[320px] bg-slate-50 flex flex-col border-l border-slate-200 shrink-0 overflow-hidden">
      {/* Sidebar Header */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            AI Studio Assistant
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Gemini 2.5</span>
      </div>

      {/* High Density Tabs */}
      <div className="grid grid-cols-3 bg-slate-100 p-1 border-b border-slate-200 shrink-0 text-[11px] font-semibold">
        <button
          onClick={() => setActiveTab('chat')}
          className={`py-1 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'chat'
              ? 'bg-white text-indigo-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          Chat
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`py-1 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'alerts'
              ? 'bg-white text-rose-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BellRing className="w-3 h-3" />
          Alerts
          {flaggedAnomalies.length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] px-1 rounded-full font-mono">
              {flaggedAnomalies.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('extract')}
          className={`py-1 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'extract'
              ? 'bg-white text-emerald-700 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wand2 className="w-3 h-3" />
          Extract
        </button>
      </div>

      {/* TAB CONTENT: CHAT */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white/70 border-b border-slate-200 flex flex-wrap gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block w-full mb-0.5">
              Quick Inquiries:
            </span>
            <button
              onClick={() => handleQuickPrompt('Which projects managed by Nor Ozir are still active?')}
              className="text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
            >
              Nor Ozir Active?
            </button>
            <button
              onClick={() => handleQuickPrompt('What is our total available inventory in Sabak Bernam?')}
              className="text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
            >
              Sabak Bernam Stock
            </button>
            <button
              onClick={() => handleQuickPrompt('Generate a summary of renewal anomalies and expired listings.')}
              className="text-[10px] bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
            >
              Daily Summary
            </button>
            <button
              onClick={() => handleQuickPrompt('List all Freehold Malay Reserved properties that need attention.')}
              className="text-[10px] bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
            >
              Malay Reserved (FMR)
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto text-[11px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg max-w-[95%] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-2xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none shadow-2xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{renderFormattedContent(msg.content)}</div>

                  {/* Sources or Action Chips */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap gap-1">
                      {msg.suggestedActions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleActionClick(action)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1 cursor-pointer"
                        >
                          <span>{action.label}</span>
                          <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isSending && (
              <div className="self-start bg-white p-2.5 rounded-lg border border-slate-200 text-slate-500 text-[11px] flex items-center gap-2">
                <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />
                <span>Gemini analyzing dataset...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input */}
          <div className="p-2 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask Gemini about inventory, PMs..."
                className="flex-1 text-[11px] border border-slate-200 rounded px-2.5 py-1.5 outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isSending}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-1.5 rounded transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: AUTO-ALERTS & ACTIONS */}
      {activeTab === 'alerts' && (
        <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="bg-rose-50 p-2.5 rounded border border-rose-200 text-[11px]">
            <div className="flex items-center gap-1.5 text-rose-800 font-bold mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{flaggedAnomalies.length} Renewal Anomalies Detected</span>
            </div>
            <p className="text-[10px] text-rose-700 leading-snug">
              Listings marked as <strong>Expired</strong> with status <strong>Not Renewed</strong>.
              Generate automated follow-up notices for the assigned PMs.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {flaggedAnomalies.map((listing) => (
              <div
                key={listing.id}
                className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <span className="font-semibold text-slate-900 text-[11px] block leading-tight">
                      {listing.property}
                    </span>
                    <span className="text-[10px] text-slate-500">{listing.location}</span>
                  </div>
                  <span className="bg-rose-50 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-100 shrink-0">
                    Expired {listing.date}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                  <span className="text-slate-600">
                    PM: <strong className="text-indigo-600">{listing.pm}</strong> | Stock:{' '}
                    <strong>{listing.availableUnits}</strong>
                  </span>
                  <button
                    onClick={() => onDraftPMAlert(listing)}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <BellRing className="w-2.5 h-2.5" />
                    Draft Notice
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: SMART EXTRACTION WIDGET */}
      {activeTab === 'extract' && (
        <div className="flex-1 p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="bg-indigo-950 p-3 rounded text-white shadow-xs">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase">
                Smart Text-to-Table
              </p>
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed mb-2.5">
              Paste unstructured real estate messages (from WhatsApp, emails, or brochures) to
              instantly extract project names, PMs, inventory, and tenure.
            </p>

            <textarea
              rows={4}
              value={quickPasteText}
              onChange={(e) => setQuickPasteText(e.target.value)}
              placeholder="e.g. 'Hey team, we just got a new leasehold project in Shah Alam called Service Apartment Linkar 52. Haneah will manage it. 256/495 units available...'"
              className="w-full text-[11px] bg-slate-900/90 text-white border border-slate-700 rounded p-2 outline-none focus:border-indigo-400 placeholder-slate-500"
            />

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  onOpenExtractModal(quickPasteText);
                  setQuickPasteText('');
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Wand2 className="w-3 h-3" />
                Launch Full Extractor
              </button>
            </div>
          </div>

          {/* Sample Prompts */}
          <div className="bg-white p-3 rounded border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Sample Data Inputs:
            </p>
            <div className="space-y-1.5">
              <button
                onClick={() =>
                  setQuickPasteText(
                    'Hey team, we just got a new leasehold project in Shah Alam called Service Apartment Linkar 52. Haneah will manage it. There are 495 total units and 256 are still available. Let us list it today, October 26th.'
                  )
                }
                className="w-full text-left text-[10px] bg-slate-50 hover:bg-slate-100 p-2 rounded border border-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <strong>Sample 1:</strong> Shah Alam Apartment (WhatsApp style)
              </button>

              <button
                onClick={() =>
                  setQuickPasteText(
                    'New Freehold Malay Reserved project launched in Dengkil called Ds Jenderam Harmoni. Zuraini assigned as PM. 20/75 units available, listed on 27.10, status Active.'
                  )
                }
                className="w-full text-left text-[10px] bg-slate-50 hover:bg-slate-100 p-2 rounded border border-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                <strong>Sample 2:</strong> Freehold Malay Reserved Listing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-2.5 border-t border-slate-200 bg-white text-[9px] text-slate-400 text-center font-medium shrink-0 flex items-center justify-center gap-1">
        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
        SYNCED WITH MASTER TABLE • {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
      </footer>
    </aside>
  );
};

// Simple helper to render bold text and linebreaks safely
function renderFormattedContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Process markdown-like **bold**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <div key={idx} className={line.startsWith('- ') ? 'pl-2 text-slate-700' : 'mb-1'}>
        {parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-bold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </div>
    );
  });
}
