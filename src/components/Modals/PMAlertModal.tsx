import React, { useState, useEffect } from 'react';
import { PropertyListing, PMAlertDraft } from '../../types';
import { generatePMAlertDraft } from '../../services/api';
import {
  BellRing,
  X,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Hash,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface PMAlertModalProps {
  isOpen: boolean;
  listing: PropertyListing | null;
  onClose: () => void;
  onMarkRenewed: (listingId: number) => void;
}

export const PMAlertModal: React.FC<PMAlertModalProps> = ({
  isOpen,
  listing,
  onClose,
  onMarkRenewed,
}) => {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp' | 'slack'>('email');
  const [draft, setDraft] = useState<PMAlertDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && listing) {
      loadDraft(listing);
    } else {
      setDraft(null);
    }
  }, [isOpen, listing]);

  const loadDraft = async (item: PropertyListing) => {
    setIsLoading(true);
    setCopied(false);
    try {
      const res = await generatePMAlertDraft(item);
      if (res.success && res.draft) {
        setDraft(res.draft);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !listing) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <BellRing className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                PM Renewal Notice Generator
              </h2>
              <p className="text-xs text-slate-300">
                Automated follow-up communication for <strong className="text-amber-300">{listing.pm}</strong> regarding{' '}
                <strong className="text-white">{listing.property}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Listing Info Summary Strip */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-4">
            <span>
              <strong>Property:</strong> {listing.property}
            </span>
            <span>
              <strong>Location:</strong> {listing.location}
            </span>
            <span>
              <strong>Units:</strong> {listing.availableUnits}
            </span>
          </div>
          <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px]">
            Expired {listing.date} • Not Renewed
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Gemini drafting personalized PM message...</p>
            </div>
          ) : draft ? (
            <>
              {/* Channel Tabs */}
              <div className="flex border-b border-slate-200 gap-2">
                <button
                  onClick={() => setActiveTab('email')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'email'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email Draft
                </button>
                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'whatsapp'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
                <button
                  onClick={() => setActiveTab('slack')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === 'slack'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  Slack Channel
                </button>
              </div>

              {/* Tab 1: Email */}
              {activeTab === 'email' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Subject Line:
                    </label>
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200 text-xs font-semibold text-slate-800">
                      <span className="flex-1">{draft.emailSubject}</span>
                      <button
                        onClick={() => handleCopy(draft.emailSubject)}
                        className="text-slate-400 hover:text-indigo-600 text-xs p-1"
                        title="Copy Subject"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Email Body:
                    </label>
                    <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs font-sans whitespace-pre-wrap leading-relaxed text-slate-800">
                      {draft.emailBody}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      handleCopy(`Subject: ${draft.emailSubject}\n\n${draft.emailBody}`)
                    }
                    className="self-start flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-3 py-1.5 rounded text-xs border border-indigo-200 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Full Email!' : 'Copy Full Email'}</span>
                  </button>
                </div>
              )}

              {/* Tab 2: WhatsApp */}
              {activeTab === 'whatsapp' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      WhatsApp Formatted Message:
                    </label>
                    <div className="bg-emerald-50/50 p-3 rounded border border-emerald-200 text-xs whitespace-pre-wrap leading-relaxed text-slate-800">
                      {draft.whatsappMessage}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(draft.whatsappMessage)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy WhatsApp Message'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Slack */}
              {activeTab === 'slack' && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Slack Notice:
                    </label>
                    <div className="bg-slate-900 text-slate-100 p-3 rounded border border-slate-700 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {draft.slackMessage}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(draft.slackMessage)}
                    className="self-start flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Slack Format'}</span>
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              onMarkRenewed(listing.id);
              onClose();
            }}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark Listing as Renewed</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
