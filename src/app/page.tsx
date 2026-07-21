"use client";

import { useState, useEffect, useRef } from "react";

// Types
interface Movie {
  title: string;
  release_year: number | null;
  genre: string[];
  director: string | null;
  cast: string[];
  rating: number | null;
  summary: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const PRESETS: Record<string, string> = {
  "interstellar.txt": "Directed by Christopher Nolan, the sci-fi masterpiece Interstellar (2014) stars Matthew McConaughey as Cooper, a former NASA pilot who leads a crew of astronauts through a wormhole in search of a new home for humanity. The film features an incredible cast including Anne Hathaway, Jessica Chastain, and Michael Caine. It currently boasts an impressive rating of 8.7/10. It is a stunning visual and emotional journey about love, time, and human survival.",
  "the_dark_knight.txt": "The Dark Knight is a gritty 2008 superhero action-drama co-written and directed by Christopher Nolan. Based on the DC Comics character Batman, the film is the second installment in The Dark Knight Trilogy. It stars Christian Bale as Bruce Wayne / Batman, alongside Heath Ledger as the iconic Joker, Gary Oldman, Aaron Eckhart, Maggie Gyllenhaal, and Michael Caine. The movie was a critical and commercial triumph, securing a rating of 9.0/10.",
  "spirited_away.txt": "Spirited Away is a breathtaking 2001 Japanese animated fantasy film written and directed by Hayao Miyazaki. The movie tells the story of Chihiro Ogino, a 10-year-old girl who enters the world of spirits. After her parents are turned into pigs, she takes a job working in Yubaba's bathhouse to find a way to free them. Featuring voice acting by Rumi Hiiragi and Miyu Irino, this masterpiece has earned a rating of 8.6/10 globally."
};

const CHAT_MODES = {
  Angry: {
    system: "You are an Angry AI Agent. You respond aggressively and impatiently.",
    welcome: "What do you WANT?",
    emoji: "😤",
    sub: "angry mode",
    color: "#ef4444",
    bgGlow: "rgba(239, 68, 68, 0.05)",
    shadow: "0 0 25px rgba(239, 68, 68, 0.15)"
  },
  Funny: {
    system: "You are a very funny AI Agent. You respond with humor and jokes.",
    welcome: "How can I make you laugh today?",
    emoji: "😂",
    sub: "funny mode",
    color: "#f59e0b",
    bgGlow: "rgba(245, 158, 11, 0.05)",
    shadow: "0 0 25px rgba(245, 158, 11, 0.15)"
  },
  Sad: {
    system: "You are a very Sad AI Agent. You respond in a depressed and emotional tone.",
    welcome: "I'm here... I guess.",
    emoji: "😢",
    sub: "sad mode",
    color: "#3b82f6",
    bgGlow: "rgba(59, 130, 246, 0.05)",
    shadow: "0 0 25px rgba(59, 130, 246, 0.15)"
  }
} as const;

export default function App() {
  // Navigation
  const [activeTool, setActiveTool] = useState<"extract" | "chat">("extract");

  // Server API Key Status
  const [isServerKeySet, setIsServerKeySet] = useState<boolean | null>(null);

  // Check config on load
  useEffect(() => {
    async function checkConfig() {
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          setIsServerKeySet(data.isKeySet);
        } else {
          setIsServerKeySet(false);
        }
      } catch (err) {
        setIsServerKeySet(false);
      }
    }
    checkConfig();
  }, []);

  // --- CineExtract AI States ---
  const [paragraph, setParagraph] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [model, setModel] = useState("mistral-small-2506");
  const [temperature, setTemperature] = useState(0.1);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractedMovie, setExtractedMovie] = useState<Movie | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<"data" | "json">("data");
  const [jsonCopied, setJsonCopied] = useState(false);

  // Word & Character count
  const charCount = paragraph.length;
  const wordCount = paragraph.trim() ? paragraph.trim().split(/\s+/).length : 0;

  const handleApplyPreset = (key: string) => {
    setParagraph(PRESETS[key] || "");
  };

  const handleClearExtract = () => {
    setParagraph("");
    setExtractedMovie(null);
    setExtractError("");
  };

  const handleRunExtractor = async () => {
    if (!paragraph.trim()) {
      setExtractError("Please enter a paragraph to extract information.");
      return;
    }

    setExtractLoading(true);
    setExtractError("");
    setExtractedMovie(null);

    try {
      const res = await fetch("/api/extract-structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraph,
          apiKey: customApiKey || undefined,
          model,
          temperature
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Extraction failed.");
      }

      setExtractedMovie(data);
    } catch (err: any) {
      setExtractError(err?.message || "An unexpected error occurred during extraction.");
    } finally {
      setExtractLoading(false);
    }
  };

  const handleCopyJson = async () => {
    if (!extractedMovie) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(extractedMovie, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    } catch (err) {
      // ignore
    }
  };

  // --- MoodBot Chat States ---
  const [chatMode, setChatMode] = useState<keyof typeof CHAT_MODES>("Funny");
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatLoading]);

  const handleStartChat = () => {
    setIsChatActive(true);
    setChatMessages([]);
    setChatError("");
  };

  const handleNewChat = () => {
    setChatMessages([]);
    setChatError("");
    setChatLoading(false);
  };

  const handleChangeMode = () => {
    setIsChatActive(false);
    setChatMessages([]);
    setChatError("");
    setChatLoading(false);
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatError("");

    const newMessages = [...chatMessages, { role: "user" as const, content: userText }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          mode: chatMode
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate AI response.");
      }

      setChatMessages((prev) => [...prev, { role: "assistant" as const, content: data.content }]);
    } catch (err: any) {
      setChatError(err?.message || "An unexpected error occurred during chat.");
    } finally {
      setChatLoading(false);
    }
  };

  const activeModeDetails = CHAT_MODES[chatMode];

  return (
    <div className="dashboard-layout">
      {/* ── LEFT NAVIGATION SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-glow"></span>
          CineExtract AI
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveTool("extract")}
            className={`nav-item ${activeTool === "extract" ? "active" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <span>CineExtract AI</span>
          </button>
          <button
            onClick={() => setActiveTool("chat")}
            className={`nav-item ${activeTool === "chat" ? "active" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>MoodBot Chat</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="server-status">
            <span className={`status-indicator ${isServerKeySet ? "active" : isServerKeySet === false ? "inactive" : "checking"}`}></span>
            <span className="status-label">
              {isServerKeySet ? "Mistral Server Active" : isServerKeySet === false ? "No Mistral Env Key" : "Checking server..."}
            </span>
          </div>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE CONTENT ── */}
      <main className="workspace">
        {/* CineExtract Tool */}
        {activeTool === "extract" && (
          <div className="tool-container fade-in">
            <header className="workspace-header">
              <h1>🔍 Professional Movie Info Extractor</h1>
              <p>Extract highly structured metadata (genres, cast, ratings, plot) dynamically from any plain paragraph.</p>
            </header>

            <div className="workspace-grid">
              {/* Left Column: Inputs & Parameters */}
              <div className="input-panel">
                {/* Preset Selector */}
                <div className="control-group">
                  <label className="section-label">Source Document Presets</label>
                  <div className="preset-buttons">
                    {Object.keys(PRESETS).map((key) => (
                      <button
                        key={key}
                        onClick={() => handleApplyPreset(key)}
                        className="preset-btn"
                      >
                        📄 {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Text Input */}
                <div className="control-group">
                  <div className="label-row">
                    <label className="section-label">Source Paragraph</label>
                    <span className="stats">
                      {wordCount} W | {charCount} C
                    </span>
                  </div>
                  <textarea
                    value={paragraph}
                    onChange={(e) => setParagraph(e.target.value)}
                    placeholder="Paste a movie description, synopsis, review, or summary here..."
                    className="source-textarea"
                    disabled={extractLoading}
                  />
                </div>

                {/* Extract action buttons */}
                <div className="action-row">
                  <button
                    onClick={handleRunExtractor}
                    disabled={extractLoading || !paragraph.trim()}
                    className="run-btn"
                  >
                    {extractLoading ? (
                      <>
                        <span className="loading-spinner"></span>
                        Extracting...
                      </>
                    ) : (
                      <>
                        <span>Run Extractor</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClearExtract}
                    className="clear-btn"
                    disabled={extractLoading}
                  >
                    Clear
                  </button>
                </div>

                {/* Parameters Accordion/Panel */}
                <div className="parameters-panel">
                  <h3 className="section-title">Parameters & Config</h3>
                  
                  <div className="param-field">
                    <label>Mistral API Key (Optional Override)</label>
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder={isServerKeySet ? "•••••••••••••••• (Using Server Key)" : "Enter custom Mistral API key..."}
                      className="param-input"
                    />
                  </div>

                  <div className="param-row">
                    <div className="param-field half">
                      <label>Model</label>
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="param-select"
                      >
                        <option value="mistral-small-2506">mistral-small-2506 (Recommended)</option>
                        <option value="mistral-medium-latest">mistral-medium-latest</option>
                        <option value="open-mixtral-8x7b">open-mixtral-8x7b</option>
                      </select>
                    </div>

                    <div className="param-field half">
                      <div className="slider-label">
                        <label>Temperature</label>
                        <span>{temperature.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="param-slider"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Structured Results Panel */}
              <div className="output-panel">
                <div className="output-tabs-header">
                  <span className="section-label">Structured Output</span>
                  {extractedMovie && (
                    <div className="tabs-buttons">
                      <button
                        onClick={() => setActiveOutputTab("data")}
                        className={`tab-btn ${activeOutputTab === "data" ? "active" : ""}`}
                      >
                        Structured Card
                      </button>
                      <button
                        onClick={() => setActiveOutputTab("json")}
                        className={`tab-btn ${activeOutputTab === "json" ? "active" : ""}`}
                      >
                        Raw JSON
                      </button>
                    </div>
                  )}
                </div>

                <div className="output-area">
                  {extractError && (
                    <div className="extract-error-alert">
                      <span className="error-icon">⚠️</span>
                      <p>{extractError}</p>
                    </div>
                  )}

                  {extractLoading && (
                    <div className="extraction-loader">
                      <div className="spinner-glow"></div>
                      <p>Compiling workspace & extracting structured properties...</p>
                    </div>
                  )}

                  {!extractedMovie && !extractLoading && !extractError && (
                    <div className="output-empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="empty-icon">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                        <line x1="7" y1="2" x2="7" y2="22"></line>
                        <line x1="17" y1="2" x2="17" y2="22"></line>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <line x1="2" y1="7" x2="7" y2="7"></line>
                        <line x1="2" y1="17" x2="7" y2="17"></line>
                        <line x1="17" y1="17" x2="22" y2="17"></line>
                        <line x1="17" y1="7" x2="22" y2="7"></line>
                      </svg>
                      <p>awaiting_workspace_compilation</p>
                      <span>Select a preset or paste some text, then click "Run Extractor".</span>
                    </div>
                  )}

                  {extractedMovie && !extractLoading && (
                    <div className="output-content-container">
                      {activeOutputTab === "data" ? (
                        <div className="movie-details-card fade-in">
                          <h2 className="movie-title">{extractedMovie.title}</h2>
                          
                          <div className="genre-tags">
                            {extractedMovie.genre && extractedMovie.genre.length > 0 ? (
                              extractedMovie.genre.map((g, i) => (
                                <span key={i} className="genre-tag">{g}</span>
                              ))
                            ) : (
                              <span className="genre-tag empty">No Genre Extracted</span>
                            )}
                          </div>

                          <div className="details-grid">
                            <div className="grid-cell">
                              <span className="cell-label">Release Year</span>
                              <span className="cell-value">{extractedMovie.release_year || "N/A"}</span>
                            </div>
                            <div className="grid-cell">
                              <span className="cell-label">Director</span>
                              <span className="cell-value">{extractedMovie.director || "N/A"}</span>
                            </div>
                            <div className="grid-cell">
                              <span className="cell-label">IMDb Rating</span>
                              <span className="cell-value rating">
                                {extractedMovie.rating ? `⭐ ${extractedMovie.rating} / 10` : "N/A"}
                              </span>
                            </div>
                          </div>

                          <div className="plot-section">
                            <span className="section-subtitle">Plot Summary</span>
                            <p className="plot-text">{extractedMovie.summary || "No summary extracted."}</p>
                          </div>

                          <div className="cast-section">
                            <span className="section-subtitle">Cast Members</span>
                            <div className="cast-chips">
                              {extractedMovie.cast && extractedMovie.cast.length > 0 ? (
                                extractedMovie.cast.map((actor, i) => (
                                  <span key={i} className="cast-chip">{actor}</span>
                                ))
                              ) : (
                                <span className="no-cast-tag">No cast members extracted</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="json-code-block fade-in">
                          <div className="code-header">
                            <span>JSON Response</span>
                            <button
                              onClick={handleCopyJson}
                              className={`copy-code-btn ${jsonCopied ? "success" : ""}`}
                            >
                              {jsonCopied ? "Copied! ✓" : "Copy Schema"}
                            </button>
                          </div>
                          <pre className="code-content">
                            <code>{JSON.stringify(extractedMovie, null, 2)}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MoodBot Chat Tool */}
        {activeTool === "chat" && (
          <div className="tool-container fade-in">
            {/* Mode selection screen */}
            {!isChatActive ? (
              <div className="chat-setup-container fade-in">
                <header className="setup-header">
                  <h1>Choose a Chat Mode</h1>
                  <p>Engage with our multi-personality AI bot, built with specific emotional responses.</p>
                </header>

                <div className="modes-grid">
                  {(Object.keys(CHAT_MODES) as Array<keyof typeof CHAT_MODES>).map((modeKey) => {
                    const cfg = CHAT_MODES[modeKey];
                    const isSelected = chatMode === modeKey;
                    return (
                      <button
                        key={modeKey}
                        onClick={() => setChatMode(modeKey)}
                        className={`mode-setup-card card-${modeKey.toLowerCase()} ${isSelected ? "selected" : ""}`}
                      >
                        <span className="setup-emoji">{cfg.emoji}</span>
                        <h3 className="setup-mode-title">{modeKey} Mode</h3>
                        <span className="setup-mode-sub">{cfg.sub}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="setup-footer">
                  <button
                    onClick={handleStartChat}
                    className="start-chat-btn"
                    style={{
                      borderColor: activeModeDetails.color,
                      boxShadow: activeModeDetails.shadow,
                      background: `linear-gradient(135deg, ${activeModeDetails.color}33 0%, #000000 100%)`
                    }}
                  >
                    Start in {chatMode} Mode →
                  </button>
                </div>
              </div>
            ) : (
              /* Chat active screen */
              <div
                className="chat-room-container fade-in"
                style={{
                  border: `1px solid ${activeModeDetails.color}30`,
                  boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 40px ${activeModeDetails.color}08`
                }}
              >
                {/* Chat Top Bar */}
                <header className="chat-header">
                  <div className="chat-identity">
                    <span className="mode-badge-dot" style={{ backgroundColor: activeModeDetails.color }}></span>
                    <span className="mode-badge-text" style={{ color: activeModeDetails.color }}>{activeModeDetails.sub}</span>
                  </div>

                  <div className="chat-actions">
                    <button onClick={handleNewChat} className="chat-ctrl-btn">
                      New Chat
                    </button>
                    <button onClick={handleChangeMode} className="chat-ctrl-btn primary">
                      Change Mode
                    </button>
                  </div>
                </header>

                {/* Chat Log messages */}
                <div className="chat-log-area">
                  {chatMessages.length === 0 && !chatLoading ? (
                    <div className="chat-welcome-state">
                      <span className="welcome-emoji animate-bounce">{activeModeDetails.emoji}</span>
                      <h2>{activeModeDetails.welcome}</h2>
                      <span className="welcome-sub">{activeModeDetails.sub} active</span>
                    </div>
                  ) : (
                    <div className="chat-messages-list">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`chat-message-row ${msg.role}`}>
                          <div className={`chat-bubble ${msg.role === "assistant" ? "assistant-" + chatMode.toLowerCase() : ""}`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}

                      {chatLoading && (
                        <div className="chat-message-row assistant">
                          <div className={`chat-bubble thinking assistant-${chatMode.toLowerCase()}`}>
                            <div className="thinking-dots" style={{ "--theme-color": activeModeDetails.color } as React.CSSProperties}>
                              <span className="t-dot"></span>
                              <span className="t-dot"></span>
                              <span className="t-dot"></span>
                            </div>
                          </div>
                        </div>
                      )}

                      {chatError && (
                        <div className="chat-error-message">
                          <span className="error-icon">❌</span>
                          <p>{chatError}</p>
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>

                {/* Chat input form */}
                <form onSubmit={handleSendChatMessage} className="chat-input-form">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Message MoodBot (${chatMode})...`}
                    className="chat-text-input"
                    disabled={chatLoading}
                    style={{ caretColor: activeModeDetails.color }}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="chat-send-btn"
                    style={{
                      color: chatInput.trim() ? activeModeDetails.color : "#4b5563",
                      borderColor: chatInput.trim() ? `${activeModeDetails.color}50` : "rgba(255,255,255,0.05)"
                    }}
                  >
                    ↑
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
