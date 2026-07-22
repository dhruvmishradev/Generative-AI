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
  thinking?: string;
}

const PRESETS: Record<string, string> = {
  "interstellar.txt": "Directed by Christopher Nolan, the sci-fi masterpiece Interstellar (2014) stars Matthew McConaughey as Cooper, a former NASA pilot who leads a crew of astronauts through a wormhole in search of a new home for humanity. The film features an incredible cast including Anne Hathaway, Jessica Chastain, and Michael Caine. It currently boasts an impressive rating of 8.7/10. It is a stunning visual and emotional journey about love, time, and human survival.",
  "the_dark_knight.txt": "The Dark Knight is a gritty 2008 superhero action-drama co-written and directed by Christopher Nolan. Based on the DC Comics character Batman, the film is the second installment in The Dark Knight Trilogy. It stars Christian Bale as Bruce Wayne / Batman, alongside Heath Ledger as the iconic Joker, Gary Oldman, Aaron Eckhart, Maggie Gyllenhaal, and Michael Caine. The movie was a critical and commercial triumph, securing a rating of 9.0/10.",
  "spirited_away.txt": "Spirited Away is a breathtaking 2001 Japanese animated fantasy film written and directed by Hayao Miyazaki. The movie tells the story of Chihiro Ogino, a 10-year-old girl who enters the world of spirits. After her parents are turned into pigs, she takes a job working in Yubaba's bathhouse to find a way to free them. Featuring voice acting by Rumi Hiiragi and Miyu Irino, this masterpiece has earned a rating of 8.6/10 globally."
};

const CHAT_MODES = {
  Angry: {
    system: "You are an Angry AI Agent. You respond aggressively and impatiently.",
    welcome: "What do you want? State it clearly and quickly.",
    emoji: "😤",
    sub: "Grumpy Mode"
  },
  Funny: {
    system: "You are a very funny AI Agent. You respond with humor and jokes.",
    welcome: "Welcome! Ask me anything, and I'll give it a humorous spin.",
    emoji: "😂",
    sub: "Funny Mode"
  },
  Sad: {
    system: "You are a very Sad AI Agent. You respond in a depressed and emotional tone.",
    welcome: "I'm here... I suppose. Ask whatever you want, if it matters...",
    emoji: "😢",
    sub: "Sad Mode"
  }
} as const;

interface ProviderConfig {
  name: string;
  models: { id: string; name: string }[];
  defaultModel: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  mistral: {
    name: "Mistral AI",
    models: [
      { id: "mistral-small-2506", name: "Mistral Small (Recommended)" },
      { id: "mistral-medium-latest", name: "Mistral Medium" },
      { id: "mistral-large-latest", name: "Mistral Large" }
    ],
    defaultModel: "mistral-small-2506"
  },
  groq: {
    name: "Groq",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Recommended)" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B" }
    ],
    defaultModel: "llama-3.3-70b-versatile"
  },
  google: {
    name: "Google Gemini",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Recommended)" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" }
    ],
    defaultModel: "gemini-2.0-flash"
  },
  huggingface: {
    name: "Hugging Face",
    models: [
      { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1 (Recommended)" },
      { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B Instruct" },
      { id: "microsoft/Phi-3-mini-4k-instruct", name: "Phi 3 Mini" }
    ],
    defaultModel: "deepseek-ai/DeepSeek-R1"
  }
};

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"extract" | "chat">("extract");

  // API Configuration Status from server
  const [serverKeysStatus, setServerKeysStatus] = useState<Record<string, boolean>>({});

  // --- CineExtract Independent States ---
  const [extractProvider, setExtractProvider] = useState<string>("mistral");
  const [extractModel, setExtractModel] = useState<string>("mistral-small-2506");
  const [extractTemperature, setExtractTemperature] = useState<number>(0.1);

  const [paragraph, setParagraph] = useState("");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extractedMovie, setExtractedMovie] = useState<Movie | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<"card" | "json">("card");
  const [jsonCopied, setJsonCopied] = useState(false);

  // --- MoodBot Chat Independent States ---
  const [chatProvider, setChatProvider] = useState<string>("mistral");
  const [chatModel, setChatModel] = useState<string>("mistral-small-2506");
  const [chatTemperature, setChatTemperature] = useState<number>(0.8);
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState<boolean>(false);

  const [chatMode, setChatMode] = useState<keyof typeof CHAT_MODES>("Funny");
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [expandedThoughts, setExpandedThoughts] = useState<Record<number, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSettingsRef = useRef<HTMLDivElement>(null);
  const outputPanelRef = useRef<HTMLDivElement>(null);

  // Load backend config status
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const data = await res.json();
          setServerKeysStatus(data);
        }
      } catch (err) {
        console.error("Failed to load server configuration status", err);
      }
    }
    fetchConfig();
  }, []);

  // Automatically scroll down to the structured output panel when extraction starts or finishes (for mobile/tablet layouts)
  useEffect(() => {
    if (extractLoading && outputPanelRef.current) {
      outputPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [extractLoading]);

  useEffect(() => {
    if (extractedMovie && outputPanelRef.current) {
      outputPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [extractedMovie]);

  // Close chat inline settings when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatSettingsRef.current && !chatSettingsRef.current.contains(event.target as Node)) {
        setIsChatSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update default models when provider changes
  const handleExtractProviderChange = (newProvider: string) => {
    setExtractProvider(newProvider);
    setExtractModel(PROVIDERS[newProvider].defaultModel);
  };

  const handleChatProviderChange = (newProvider: string) => {
    setChatProvider(newProvider);
    setChatModel(PROVIDERS[newProvider].defaultModel);
  };

  // Movie extract helpers
  const wordCount = paragraph.trim() ? paragraph.trim().split(/\s+/).length : 0;
  const charCount = paragraph.length;

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
          provider: extractProvider,
          model: extractModel,
          temperature: extractTemperature
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Structured extraction failed.");
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

  // Chat scroll logic
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatLoading]);

  const handleStartChat = () => {
    setIsChatActive(true);
    setChatMessages([]);
    setChatError("");
    setExpandedThoughts({});
  };

  const handleNewChat = () => {
    setChatMessages([]);
    setChatError("");
    setChatLoading(false);
    setExpandedThoughts({});
  };

  const handleChangeMode = () => {
    setIsChatActive(false);
    setChatMessages([]);
    setChatError("");
    setChatLoading(false);
    setExpandedThoughts({});
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
          mode: chatMode,
          provider: chatProvider,
          model: chatModel,
          temperature: chatTemperature
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate response.");
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: data.content, thinking: data.thinking }
      ]);
    } catch (err: any) {
      setChatError(err?.message || "An unexpected error occurred during chat.");
    } finally {
      setChatLoading(false);
    }
  };

  const toggleThought = (index: number) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const activeModeDetails = CHAT_MODES[chatMode];

  // Dynamically filter providers to only show those that have configured keys on the server
  const getFilteredProviders = () => {
    return Object.keys(PROVIDERS).filter((pKey) => {
      return serverKeysStatus[pKey] === true;
    });
  };

  const chatFilteredProviders = getFilteredProviders();
  const extractFilteredProviders = getFilteredProviders();

  return (
    <div className="oled-app-shell">
      {/* ── SIDEBAR NAVIGATION RAIL ── */}
      <aside className="oled-sidebar">
        <div className="sidebar-brand">
          <h2>CineSage AI</h2>
          <span>V1.8.0</span>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setActiveTab("extract")}
            className={`nav-button ${activeTab === "extract" ? "active" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
            </svg>
            <span>Extractor</span>
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`nav-button ${activeTab === "chat" ? "active" : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>MoodBot Chat</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="dot active"></span>
            <span>SYSTEM ONLINE</span>
          </div>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <main className="oled-workspace">
        {/* WORKSPACE AREA */}
        <div className="workspace-content">
          {/* TAB 1: CINEMA EXTRACTOR */}
          {activeTab === "extract" && (
            <div className="extractor-view fade-in">
              <div className="workspace-panel">
                <div className="panel-header">
                  <h3>Synopsis Source</h3>
                  <div className="preset-list">
                    {Object.keys(PRESETS).map((key) => (
                      <button
                        key={key}
                        onClick={() => handleApplyPreset(key)}
                        className={`preset-button-item ${paragraph === PRESETS[key] ? "selected" : ""}`}
                      >
                        {key.replace(".txt", "").replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* INDEPENDENT EXTRACTOR SETTINGS DOCK (MOVED TO TOP SIDE, ABOVE TEXTAREA) */}
                <div className="local-settings-card extract-top-settings">
                  <div className="local-settings-header">
                    <h4>Model Parameters (Extractor Only)</h4>
                  </div>
                  <div className="settings-grid">
                    <div className="dock-column">
                      <label>API Provider</label>
                      <select
                        value={extractProvider}
                        onChange={(e) => handleExtractProviderChange(e.target.value)}
                        className="dock-select"
                      >
                        {extractFilteredProviders.map((pKey) => (
                          <option key={pKey} value={pKey}>
                            {PROVIDERS[pKey].name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="dock-column">
                      <label>Active Model</label>
                      <select
                        value={extractModel}
                        onChange={(e) => setExtractModel(e.target.value)}
                        className="dock-select"
                      >
                        {PROVIDERS[extractProvider].models.map((mObj) => (
                          <option key={mObj.id} value={mObj.id}>
                            {mObj.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="dock-column temp-column">
                      <div className="slider-labels">
                        <label>Temperature</label>
                        <span>{extractTemperature.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={extractTemperature}
                        onChange={(e) => setExtractTemperature(parseFloat(e.target.value))}
                        className="dock-slider"
                      />
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <textarea
                    value={paragraph}
                    onChange={(e) => setParagraph(e.target.value)}
                    placeholder="Enter raw synopsis description text..."
                    className="editor-textarea"
                    disabled={extractLoading}
                  />
                  <div className="input-footer">
                    <span>{wordCount} words | {charCount} characters</span>
                  </div>
                </div>

                <div className="panel-actions">
                  <button
                    onClick={handleRunExtractor}
                    disabled={extractLoading || !paragraph.trim()}
                    className="btn-action-primary"
                  >
                    {extractLoading ? (
                      <>
                        <span className="inline-loader"></span>
                        <span>Extracting data...</span>
                      </>
                    ) : (
                      <span>Run Extractor</span>
                    )}
                  </button>
                  <button
                    onClick={handleClearExtract}
                    disabled={extractLoading}
                    className="btn-action-secondary"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* OUTPUT PANEL */}
              <div ref={outputPanelRef} className="workspace-panel output-panel">
                <div className="panel-header header-between">
                  <h3>Structured Output</h3>
                  {extractedMovie && (
                    <div className="segmented-toggle">
                      <button
                        onClick={() => setActiveOutputTab("card")}
                        className={`toggle-option ${activeOutputTab === "card" ? "active" : ""}`}
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => setActiveOutputTab("json")}
                        className={`toggle-option ${activeOutputTab === "json" ? "active" : ""}`}
                      >
                        JSON
                      </button>
                    </div>
                  )}
                </div>

                <div className="output-body">
                  {extractError && (
                    <div className="panel-alert error-type">
                      <span className="alert-symbol">⚠️</span>
                      <div className="alert-body">
                        <h4>Extraction Failed</h4>
                        <p>{extractError}</p>
                      </div>
                    </div>
                  )}

                  {extractLoading && (
                    <div className="panel-loading">
                      <div className="line-pulse-loader"></div>
                      <p>Processing request via {extractProvider.toUpperCase()}...</p>
                    </div>
                  )}

                  {!extractedMovie && !extractLoading && !extractError && (
                    <div className="panel-empty-state">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      <p>No compiled metadata loaded</p>
                      <span>Fill the input synopsis field and click "Run Extractor".</span>
                    </div>
                  )}

                  {extractedMovie && !extractLoading && (
                    <div className="panel-data-viewer fade-in">
                      {activeOutputTab === "card" ? (
                        <div className="movie-metadata-sheet">
                          <div className="sheet-top">
                            <h2 className="movie-title-display">{extractedMovie.title}</h2>
                            {extractedMovie.release_year && (
                              <span className="year-label">{extractedMovie.release_year}</span>
                            )}
                          </div>

                          <div className="genre-row-tags">
                            {extractedMovie.genre && extractedMovie.genre.length > 0 ? (
                              extractedMovie.genre.map((genre, i) => (
                                <span key={i} className="genre-badge-item">{genre}</span>
                              ))
                            ) : (
                              <span className="genre-badge-item empty">Genre N/A</span>
                            )}
                          </div>

                          <div className="metadata-vertical-grid">
                            <div className="meta-cell">
                              <span className="cell-title">Director</span>
                              <span className="cell-desc">{extractedMovie.director || "Not Mentioned"}</span>
                            </div>
                            <div className="meta-cell">
                              <span className="cell-title">IMDb Rating</span>
                              <span className="cell-desc rating-display">
                                {extractedMovie.rating ? `★ ${extractedMovie.rating} / 10` : "Not Mentioned"}
                              </span>
                            </div>
                          </div>

                          <div className="sheet-section">
                            <span className="section-title">Plot Summary</span>
                            <p className="summary-desc-text">{extractedMovie.summary || "No summary."}</p>
                          </div>

                          <div className="sheet-section">
                            <span className="section-title">Cast Members</span>
                            <div className="cast-chips-grid">
                              {extractedMovie.cast && extractedMovie.cast.length > 0 ? (
                                extractedMovie.cast.map((actor, i) => (
                                  <span key={i} className="cast-chip-element">{actor}</span>
                                ))
                              ) : (
                                <span className="no-cast-elements">No cast list extracted.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="raw-json-viewer-console">
                          <div className="console-header-block">
                            <span>JSON OBJECT RESULT</span>
                            <button
                              onClick={handleCopyJson}
                              className={`console-copy-btn ${jsonCopied ? "copied-success" : ""}`}
                            >
                              {jsonCopied ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <pre className="console-pre-code">
                            <code>{JSON.stringify(extractedMovie, null, 2)}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MULTI-PERSONALITY CHAT */}
          {activeTab === "chat" && (
            <div className="chat-view-container fade-in">
              {/* SEGMENTED SLIDER FOR VIBE SELECTION */}
              <div className="chat-vibe-bar">
                <span className="vibe-title">Mood Mode:</span>
                <div className="vibe-toggle-group-segmented">
                  {(Object.keys(CHAT_MODES) as Array<keyof typeof CHAT_MODES>).map((mKey) => {
                    const cfg = CHAT_MODES[mKey];
                    const isSelected = chatMode === mKey;
                    return (
                      <button
                        key={mKey}
                        onClick={() => {
                          setChatMode(mKey);
                          if (isChatActive) {
                            handleNewChat();
                          }
                        }}
                        className={`vibe-toggle-btn-segmented ${isSelected ? "active" : ""}`}
                      >
                        <span className="vibe-emoji">{cfg.emoji}</span>
                        <span className="vibe-label">{mKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CHAT DISPLAY PANELS */}
              <div className="chat-main-area-premium">
                {!isChatActive ? (
                  /* SETUP WELCOME PANEL (OVERHAULED FULLY ELEVATED UI) */
                  <div className="chat-placeholder-start-premium">
                    <div className="start-glow-bg"></div>
                    <span className="start-emoji-premium">{activeModeDetails.emoji}</span>
                    <h3>Initialize {chatMode} Mode</h3>
                    <p className="start-desc-text">Ready to begin a thread with the MoodBot? Adjust parameters below.</p>

                    {/* SELECTOR PILL DOCK */}
                    <div className="settings-trigger-box-premium" ref={chatSettingsRef}>
                      <span className="settings-label-text">Model Config:</span>
                      <button
                        onClick={() => setIsChatSettingsOpen(!isChatSettingsOpen)}
                        className={`model-pill-trigger-premium ${isChatSettingsOpen ? "active" : ""}`}
                      >
                        <span>{PROVIDERS[chatProvider].name} — {chatModel.split("/").pop()}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>

                      {isChatSettingsOpen && (
                        <div className="chat-inline-settings-overlay-premium fade-in">
                          <div className="overlay-header-premium">
                            <h5>Parameters Settings</h5>
                          </div>
                          
                          <div className="overlay-column-premium">
                            <label>API Provider</label>
                            <select
                              value={chatProvider}
                              onChange={(e) => handleChatProviderChange(e.target.value)}
                              className="dock-select-premium"
                            >
                              {chatFilteredProviders.map((pKey) => (
                                <option key={pKey} value={pKey}>
                                  {PROVIDERS[pKey].name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="overlay-column-premium">
                            <label>Active Model</label>
                            <select
                              value={chatModel}
                              onChange={(e) => setChatModel(e.target.value)}
                              className="dock-select-premium"
                            >
                              {PROVIDERS[chatProvider].models.map((mObj) => (
                                <option key={mObj.id} value={mObj.id}>
                                  {mObj.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="overlay-column-premium">
                            <div className="slider-labels-premium">
                              <label>Temperature</label>
                              <span>{chatTemperature.toFixed(1)}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={chatTemperature}
                              onChange={(e) => setChatTemperature(parseFloat(e.target.value))}
                              className="dock-slider-premium"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button onClick={handleStartChat} className="btn-chat-init-premium">
                      Start Chat Thread
                    </button>
                  </div>
                ) : (
                  /* ACTIVE CHAT WORKSPACE (BORDERLESS, FLOATING CONTROL ROW) */
                  <div className="chat-active-console-premium">
                    <header className="active-console-header-premium">
                      <div className="header-info-premium">
                        <span className="glow-dot-premium"></span>
                        <h4>MoodBot ({chatMode})</h4>
                      </div>

                      {/* RIGHT SIDE FLOATING SELECTOR CARD */}
                      <div className="header-parameters-inline-dock-premium" ref={chatSettingsRef}>
                        <button
                          onClick={() => setIsChatSettingsOpen(!isChatSettingsOpen)}
                          className={`model-pill-trigger-premium ${isChatSettingsOpen ? "active" : ""}`}
                        >
                          <span>{chatModel.split("/").pop()}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>

                        {isChatSettingsOpen && (
                          <div className="chat-inline-settings-overlay-premium fade-in">
                            <div className="overlay-header-premium">
                              <h5>Active Parameters</h5>
                            </div>
                            
                            <div className="overlay-column-premium">
                              <label>Provider</label>
                              <select
                                value={chatProvider}
                                onChange={(e) => handleChatProviderChange(e.target.value)}
                                className="dock-select-premium"
                              >
                                {chatFilteredProviders.map((pKey) => (
                                  <option key={pKey} value={pKey}>
                                    {PROVIDERS[pKey].name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="overlay-column-premium">
                              <label>Model</label>
                              <select
                                value={chatModel}
                                onChange={(e) => setChatModel(e.target.value)}
                                className="dock-select-premium"
                              >
                                {PROVIDERS[chatProvider].models.map((mObj) => (
                                  <option key={mObj.id} value={mObj.id}>
                                    {mObj.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="overlay-column-premium">
                              <div className="slider-labels-premium">
                                <label>Temp</label>
                                <span>{chatTemperature.toFixed(1)}</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={chatTemperature}
                                onChange={(e) => setChatTemperature(parseFloat(e.target.value))}
                                className="dock-slider-premium"
                              />
                            </div>
                          </div>
                        )}

                        <button onClick={handleChangeMode} className="change-vibe-link-premium">
                          Exit
                        </button>
                      </div>
                    </header>

                    {/* INTERACTIVE MESSAGES LIST */}
                    <div className="console-log-scroll-premium">
                      {chatMessages.length === 0 && !chatLoading ? (
                        <div className="console-welcome-text-premium fade-in">
                          <span className="welcome-avatar-premium">{activeModeDetails.emoji}</span>
                          <h3>{activeModeDetails.welcome}</h3>
                          <p>Ready to stream using model configuration <code>{chatModel}</code>.</p>
                        </div>
                      ) : (
                        <div className="message-log-flow-premium">
                          {chatMessages.map((msg, i) => (
                            <div key={i} className={`message-row-premium ${msg.role}`}>
                              <div className="message-bubble-body-premium">
                                {/* Bot Avatar Profile Circle */}
                                {msg.role === "assistant" && (
                                  <div className="bot-profile-circle">
                                    {activeModeDetails.emoji}
                                  </div>
                                )}

                                <div className="message-content-wrapper-premium">
                                  <span className="sender-tag-premium">
                                    {msg.role === "user" ? "You" : `MoodBot (${chatMode})`}
                                  </span>

                                  {/* Thought process logs */}
                                  {msg.role === "assistant" && msg.thinking && (
                                    <div className="thoughts-collapse-panel-premium">
                                      <button
                                        onClick={() => toggleThought(i)}
                                        className={`thoughts-header-btn-premium ${expandedThoughts[i] ? "open" : ""}`}
                                      >
                                        <span className="bulb">💡</span>
                                        <span>Reasoning Log</span>
                                        <span className="arrow">{expandedThoughts[i] ? "▲" : "▼"}</span>
                                      </button>
                                      {expandedThoughts[i] && (
                                        <div className="thoughts-content-body-premium">
                                          {msg.thinking}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="message-bubble-content-premium">
                                    {msg.content}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {chatLoading && (
                            <div className="message-row-premium assistant">
                              <div className="message-bubble-body-premium">
                                <div className="bot-profile-circle loading-glow">
                                  {activeModeDetails.emoji}
                                </div>
                                <div className="message-content-wrapper-premium">
                                  <span className="sender-tag-premium pulse-loader-tag">{chatMode} is typing...</span>
                                  <div className="dot-typing-indicator-premium">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {chatError && (
                            <div className="panel-alert-premium error-type-premium">
                              <span className="alert-symbol">❌</span>
                              <div className="alert-body">
                                <h4>Connection Error</h4>
                                <p>{chatError}</p>
                              </div>
                            </div>
                          )}

                          <div ref={chatEndRef} />
                        </div>
                      )}
                    </div>

                    {/* FLOATING CAPSULE SEND BAR FORM (NEXT-LEVEL INTERFACE) */}
                    <div className="chat-input-wrapper-floating">
                      <form onSubmit={handleSendChatMessage} className="chat-send-form-floating">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={`Message MoodBot...`}
                          className="chat-field-input-floating"
                          disabled={chatLoading}
                        />
                        <button
                          type="submit"
                          disabled={chatLoading || !chatInput.trim()}
                          className="chat-send-btn-floating"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
