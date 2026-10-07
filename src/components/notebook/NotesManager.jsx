import { useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckSquare,
  FileText,
  Lightbulb,
  LineChart,
  Plus,
  Save,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";

import NoteEditor from "./NoteEditor";
import TradingSetupEditor from "./TradingSetupEditor";

const STORAGE_KEY = "edgeflo-notebook-notes";

const NOTE_TYPES = [
  {
    id: "note",
    title: "Blank Note",
    description: "Write anything freely.",
    icon: FileText,
  },
  {
    id: "journal",
    title: "Journal",
    description:
      "Record your thoughts and daily experiences.",
    icon: BookOpen,
  },
  {
    id: "trading-setup",
    title: "Trading Setup",
    description:
      "Document a complete trading setup.",
    icon: LineChart,
  },
  {
    id: "trade-analysis",
    title: "Trade Analysis",
    description:
      "Analyze an executed trade.",
    icon: Target,
  },
  {
    id: "psychology",
    title: "Trading Psychology",
    description:
      "Track emotions, discipline and mindset.",
    icon: Lightbulb,
  },
  {
    id: "checklist",
    title: "Checklist",
    description:
      "Create a reusable checklist.",
    icon: CheckSquare,
  },
  {
    id: "daily-plan",
    title: "Daily Plan",
    description:
      "Plan your priorities and trading day.",
    icon: CalendarDays,
  },
];

function createNote(type = "note") {
  const now = new Date().toISOString();

  return {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,

    title:
      NOTE_TYPES.find(
        (item) => item.id === type
      )?.title || "Untitled Note",

    content: "",

    type,

    favorite: false,

    createdAt: now,

    updatedAt: now,

    setup: "",
    symbol: "",
    bias: "Bullish",
    entry: "",
    stopLoss: "",
    takeProfit: "",
    risk: "",
    rewardRisk: null,
  };
}

function getNoteType(type) {
  return (
    NOTE_TYPES.find(
      (item) => item.id === type
    ) || NOTE_TYPES[0]
  );
}

export default function NotesManager({
  onBack,
}) {
  const [notes, setNotes] = useState([]);

  const [
    selectedNoteId,
    setSelectedNoteId,
  ] = useState(null);

  const [search, setSearch] =
    useState("");

  const [saved, setSaved] =
    useState(false);

  const [
    showNoteTypes,
    setShowNoteTypes,
  ] = useState(false);

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        setNotes([]);
        return;
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        setNotes([]);
        return;
      }

      setNotes(parsed);

      if (parsed.length > 0) {
        setSelectedNoteId(
          parsed[0].id
        );
      }
    } catch (error) {
      console.error(
        "Failed to load notebook notes:",
        error
      );

      setNotes([]);
    }
  }, []);

  const selectedNote = useMemo(() => {
    return (
      notes.find(
        (note) =>
          note.id === selectedNoteId
      ) || null
    );
  }, [notes, selectedNoteId]);

  const filteredNotes = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return notes;
    }

    return notes.filter((note) => {
      const title =
        note.title?.toLowerCase() || "";

      const content =
        note.content?.toLowerCase() || "";

      const type =
        note.type?.toLowerCase() || "";

      const symbol =
        note.symbol?.toLowerCase() || "";

      const setup =
        note.setup?.toLowerCase() || "";

      return (
        title.includes(query) ||
        content.includes(query) ||
        type.includes(query) ||
        symbol.includes(query) ||
        setup.includes(query)
      );
    });
  }, [notes, search]);

  const persistNotes = (
    updatedNotes
  ) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedNotes)
      );

      return true;
    } catch (error) {
      console.error(
        "Failed to save notebook notes:",
        error
      );

      return false;
    }
  };

  const showSavedState = (
    duration = 1500
  ) => {
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, duration);
  };

  const createNoteWithType = (
    type
  ) => {
    const note = createNote(type);

    const updatedNotes = [
      note,
      ...notes,
    ];

    setNotes(updatedNotes);

    setSelectedNoteId(note.id);

    setShowNoteTypes(false);

    const success =
      persistNotes(updatedNotes);

    if (success) {
      showSavedState(1200);
    }
  };

  const updateSelectedNote = (
    field,
    value
  ) => {
    if (!selectedNoteId) return;

    setNotes((currentNotes) =>
      currentNotes.map((note) =>
        note.id === selectedNoteId
          ? {
              ...note,
              [field]: value,
              updatedAt:
                new Date().toISOString(),
            }
          : note
      )
    );

    setSaved(false);
  };

  const saveNote = () => {
    if (!selectedNoteId) {
      return;
    }

    const updatedNotes = notes.map(
      (note) =>
        note.id === selectedNoteId
          ? {
              ...note,
              updatedAt:
                new Date().toISOString(),
            }
          : note
    );

    setNotes(updatedNotes);

    const success =
      persistNotes(updatedNotes);

    if (success) {
      showSavedState();
    }
  };

  const saveTradingSetup = (
    data
  ) => {
    if (!selectedNoteId) {
      return;
    }

    const updatedNotes = notes.map(
      (note) =>
        note.id === selectedNoteId
          ? {
              ...note,

              title:
                data.setup ||
                note.title ||
                "Trading Setup",

              setup: data.setup || "",

              symbol: data.symbol || "",

              bias:
                data.bias ||
                "Bullish",

              entry: data.entry || "",

              stopLoss:
                data.stopLoss || "",

              takeProfit:
                data.takeProfit || "",

              risk: data.risk || "",

              rewardRisk:
                data.rewardRisk ??
                null,

              content:
                data.content || "",

              updatedAt:
                new Date().toISOString(),
            }
          : note
    );

    setNotes(updatedNotes);

    const success =
      persistNotes(updatedNotes);

    if (success) {
      showSavedState();
    }
  };

  const deleteNote = () => {
    if (!selectedNoteId) {
      return;
    }

    const remainingNotes =
      notes.filter(
        (note) =>
          note.id !== selectedNoteId
      );

    setNotes(remainingNotes);

    setSelectedNoteId(
      remainingNotes[0]?.id || null
    );

    persistNotes(remainingNotes);

    showSavedState(1200);
  };

  const toggleFavorite = () => {
    if (!selectedNoteId) {
      return;
    }

    const updatedNotes = notes.map(
      (note) =>
        note.id === selectedNoteId
          ? {
              ...note,
              favorite:
                !note.favorite,
              updatedAt:
                new Date().toISOString(),
            }
          : note
    );

    setNotes(updatedNotes);

    persistNotes(updatedNotes);
  };

  const changeNoteType = (
    type
  ) => {
    if (!selectedNoteId) {
      return;
    }

    const updatedNotes = notes.map(
      (note) =>
        note.id === selectedNoteId
          ? {
              ...note,
              type,
              updatedAt:
                new Date().toISOString(),
            }
          : note
    );

    setNotes(updatedNotes);

    persistNotes(updatedNotes);
  };

  return (
    <div className="space-y-5">
      {/* HEADER */}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Notes
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Your personal knowledge and
                trading workspace.
              </p>
            </div>
          </div>

          {/* NEW NOTE */}

          <div className="relative">
            <button
              onClick={() =>
                setShowNoteTypes(
                  (current) =>
                    !current
                )
              }
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              <Plus size={17} />
              New Note
            </button>

            {showNoteTypes && (
              <div className="absolute right-0 top-12 z-50 w-[340px] overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Create New
                    </p>

                    <p className="mt-0.5 text-xs text-gray-400">
                      Choose a workspace type
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setShowNoteTypes(
                        false
                      )
                    }
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="max-h-[420px] overflow-y-auto p-1">
                  {NOTE_TYPES.map(
                    (item) => {
                      const Icon =
                        item.icon;

                      return (
                        <button
                          key={item.id}
                          onClick={() =>
                            createNoteWithType(
                              item.id
                            )
                          }
                          className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-purple-50"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                            <Icon size={19} />
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {item.title}
                            </p>

                            <p className="mt-0.5 text-xs text-gray-500">
                              {
                                item.description
                              }
                            </p>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN NOTE WORKSPACE */}

      <div className="grid min-h-[600px] grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[280px_1fr]">
        {/* NOTE LIST */}

        <div className="border-b border-gray-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-gray-200 p-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search notes..."
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto p-2">
            {filteredNotes.length ===
            0 ? (
              <div className="p-6 text-center">
                <FileText
                  size={30}
                  className="mx-auto text-gray-300"
                />

                <p className="mt-3 text-sm font-semibold text-gray-600">
                  No notes yet
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Click New Note to
                  create one.
                </p>
              </div>
            ) : (
              filteredNotes.map(
                (note) => {
                  const noteType =
                    getNoteType(
                      note.type
                    );

                  const Icon =
                    noteType.icon;

                  return (
                    <button
                      key={note.id}
                      onClick={() =>
                        setSelectedNoteId(
                          note.id
                        )
                      }
                      className={`mb-1 w-full rounded-xl p-3 text-left transition ${
                        selectedNoteId ===
                        note.id
                          ? "bg-purple-50 text-purple-700"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <Icon size={15} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {note.title ||
                                "Untitled Note"}
                            </span>

                            {note.favorite && (
                              <span className="text-yellow-500">
                                ★
                              </span>
                            )}
                          </div>

                          <p className="mt-1 truncate text-xs text-gray-400">
                            {note.content
                              ? note.content.replace(
                                  /<[^>]*>/g,
                                  " "
                                )
                              : note.symbol ||
                                noteType.title}
                          </p>

                          <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            {
                              noteType.title
                            }
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>

        {/* EDITOR */}

        <div className="flex min-h-[600px] flex-col">
          {!selectedNote ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center">
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                  <FileText size={30} />
                </div>

                <h3 className="mt-5 font-semibold text-gray-800">
                  Your Notebook
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Create a note and
                  build your personal
                  knowledge base.
                </p>

                <button
                  onClick={() =>
                    setShowNoteTypes(
                      true
                    )
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700"
                >
                  <Plus size={16} />
                  Create Note
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* NOTE HEADER */}

              <div className="border-b border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <input
                    value={
                      selectedNote.title
                    }
                    onChange={(event) =>
                      updateSelectedNote(
                        "title",
                        event.target.value
                      )
                    }
                    placeholder="Note title"
                    className="min-w-0 flex-1 text-xl font-bold text-gray-900 outline-none"
                  />

                  <button
                    onClick={
                      toggleFavorite
                    }
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      selectedNote.favorite
                        ? "bg-yellow-50 text-yellow-600"
                        : "text-gray-400 hover:bg-gray-100"
                    }`}
                    title="Favorite"
                  >
                    ★
                  </button>

                  <button
                    onClick={saveNote}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-purple-700"
                  >
                    <Save size={16} />
                    Save
                  </button>

                  <button
                    onClick={deleteNote}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    title="Delete note"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400">
                    Type:
                  </span>

                  <select
                    value={
                      selectedNote.type ||
                      "note"
                    }
                    onChange={(event) =>
                      changeNoteType(
                        event.target.value
                      )
                    }
                    className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-600 outline-none focus:border-purple-400"
                  >
                    {NOTE_TYPES.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.title}
                        </option>
                      )
                    )}
                  </select>

                  <span className="ml-auto text-xs text-gray-400">
                    {saved
                      ? "✓ Saved successfully"
                      : "Local workspace"}
                  </span>
                </div>
              </div>

              {/* NOTE CONTENT */}

              <div className="flex-1 overflow-y-auto">
                {/* BLANK NOTE */}

                {selectedNote.type ===
                  "note" ? (
                  <div className="p-6">
                    <NoteEditor
                      key={selectedNote.id}
                      content={
                        selectedNote.content ||
                        ""
                      }
                      onChange={(
                        value
                      ) =>
                        updateSelectedNote(
                          "content",
                          value
                        )
                      }
                    />
                  </div>
                ) : /* JOURNAL */

                selectedNote.type ===
                  "journal" ? (
                  <div className="p-6">
                    <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                      <h3 className="font-bold text-gray-900">
                        Journal Entry
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Record what
                        happened, what
                        you learned and
                        how you felt.
                      </p>
                    </div>

                    <NoteEditor
                      key={selectedNote.id}
                      content={
                        selectedNote.content ||
                        ""
                      }
                      onChange={(
                        value
                      ) =>
                        updateSelectedNote(
                          "content",
                          value
                        )
                      }
                    />
                  </div>
                ) : /* TRADING SETUP */

                selectedNote.type ===
                  "trading-setup" ? (
                  <TradingSetupEditor
                    key={selectedNote.id}
                    note={selectedNote}
                    onBack={() => {}}
                    onSave={
                      saveTradingSetup
                    }
                  />
                ) : /* CHECKLIST */

                selectedNote.type ===
                  "checklist" ? (
                  <div className="p-6">
                    <div className="mb-5 rounded-2xl border border-green-100 bg-green-50 p-5">
                      <h3 className="font-bold text-gray-900">
                        Checklist
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Build a
                        checklist for
                        repeatable
                        processes.
                      </p>
                    </div>

                    <textarea
                      value={
                        selectedNote.content ||
                        ""
                      }
                      onChange={(event) =>
                        updateSelectedNote(
                          "content",
                          event.target.value
                        )
                      }
                      placeholder={`☐ Check higher timeframe bias

☐ Mark support and resistance

☐ Check liquidity

☐ Confirm setup

☐ Define invalidation

☐ Calculate risk

☐ Execute only if rules are satisfied`}
                      className="min-h-[430px] w-full resize-none rounded-2xl border border-gray-200 p-5 font-mono text-sm leading-8 text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                ) : /* DAILY PLAN */

                selectedNote.type ===
                  "daily-plan" ? (
                  <div className="p-6">
                    <div className="mb-5 rounded-2xl border border-orange-100 bg-orange-50 p-5">
                      <h3 className="font-bold text-gray-900">
                        Daily Plan
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        Plan your day
                        before execution
                        begins.
                      </p>
                    </div>

                    <textarea
                      value={
                        selectedNote.content ||
                        ""
                      }
                      onChange={(event) =>
                        updateSelectedNote(
                          "content",
                          event.target.value
                        )
                      }
                      placeholder={`Today's priorities:

1.

2.

3.

Trading focus:

Market bias:

Key levels:

Potential setups:

Things to avoid:`}
                      className="min-h-[430px] w-full resize-none rounded-2xl border border-gray-200 p-5 text-sm leading-8 text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                ) : /* TRADE ANALYSIS / PSYCHOLOGY */

                selectedNote.type ===
                    "trade-analysis" ||
                  selectedNote.type ===
                    "psychology" ? (
                  <div className="p-6">
                    <div className="mb-5 rounded-2xl border border-purple-100 bg-purple-50 p-5">
                      <h3 className="font-bold text-gray-900">
                        {
                          getNoteType(
                            selectedNote.type
                          ).title
                        }
                      </h3>

                      <p className="mt-1 text-sm text-gray-500">
                        {
                          getNoteType(
                            selectedNote.type
                          ).description
                        }
                      </p>
                    </div>

                    <NoteEditor
                      key={selectedNote.id}
                      content={
                        selectedNote.content ||
                        ""
                      }
                      onChange={(
                        value
                      ) =>
                        updateSelectedNote(
                          "content",
                          value
                        )
                      }
                    />
                  </div>
                ) : (
                  /* FALLBACK */

                  <div className="p-6">
                    <textarea
                      value={
                        selectedNote.content ||
                        ""
                      }
                      onChange={(event) =>
                        updateSelectedNote(
                          "content",
                          event.target.value
                        )
                      }
                      placeholder="Start writing..."
                      className="min-h-[470px] w-full resize-none rounded-2xl border border-gray-200 p-5 text-sm leading-8 text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                  </div>
                )}
              </div>

              {/* FOOTER */}

              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
                <span>
                  {selectedNote.content
                    ?.replace(
                      /<[^>]*>/g,
                      " "
                    )
                    .length || 0}{" "}
                  characters
                </span>

                <span>
                  Updated{" "}
                  {selectedNote.updatedAt
                    ? new Date(
                        selectedNote.updatedAt
                      ).toLocaleString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month:
                            "short",
                          hour: "2-digit",
                          minute:
                            "2-digit",
                        }
                      )
                    : "—"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}