import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStorage, type Note, type Deck, NO_DECK } from '@/context/StorageContext';
import { useColors } from '@/hooks/useColors';

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MILESTONE_KEY = 'streak_last_milestone_v1';
const STREAK_MILESTONES = [3, 7, 15, 30, 100];
const STREAK_MESSAGES: Record<number, string> = {
  3:   'Você está criando um hábito!',
  7:   'Uma semana completa!',
  15:  'Excelente consistência!',
  30:  'Um mês inteiro estudando!',
  100: 'Parabéns! Você alcançou uma ofensiva impressionante.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/** Compute current streak and max streak from a set of date keys (YYYY-MM-DD). */
function computeStreaks(dateSet: Set<string>): {
  current: number;
  max: number;
  activeDays: number;
} {
  const activeDays = dateSet.size;
  if (activeDays === 0) return { current: 0, max: 0, activeDays: 0 };

  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!dateSet.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (dateSet.has(toDateKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = Array.from(dateSet).sort();
  let max = 0;
  let run = 0;
  let prev: Date | null = null;

  for (const key of sorted) {
    const d = parseLocalDate(key);
    if (prev === null) {
      run = 1;
    } else {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86_400_000);
      if (diff === 1) {
        run++;
      } else {
        max = Math.max(max, run);
        run = 1;
      }
    }
    prev = d;
  }
  max = Math.max(max, run);

  return { current, max, activeDays };
}

// ─── Dot rendering ───────────────────────────────────────────────────────────

function dotConfig(count: number): { size: number; opacity: number } | null {
  if (count === 0) return null;
  if (count <= 5)  return { size: 5,  opacity: 0.38 };
  if (count <= 15) return { size: 7,  opacity: 0.62 };
  if (count <= 30) return { size: 9,  opacity: 0.82 };
  return { size: 10, opacity: 1.0 };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayData {
  dateKey: string;
  notes: Note[];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MilestoneToast({
  streak, onDismiss,
}: { streak: number; onDismiss: () => void }) {
  const msg = STREAK_MESSAGES[streak];
  if (!msg) return null;
  return (
    <View style={s.toastContainer}>
      <View style={s.toast}>
        <Text style={s.toastStreak}>🔥 {streak} dias</Text>
        <Text style={s.toastMsg}>{msg}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Day Detail Modal ────────────────────────────────────────────────────────

function DayModal({
  data, decks, onClose, onNotePress,
}: {
  data: DayData | null;
  decks: Deck[];
  onClose: () => void;
  onNotePress: (note: Note) => void;
}) {
  const c = useColors();
  if (!data) return null;

  const date = parseLocalDate(data.dateKey);
  const formatted = date.toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const byDeck = useMemo(() => {
    const map = new Map<string, { deck: Deck; notes: Note[] }>();
    for (const note of data.notes) {
      const deck = decks.find((d) => d.id === note.deckId) ?? NO_DECK;
      if (!map.has(deck.id)) map.set(deck.id, { deck, notes: [] });
      map.get(deck.id)!.notes.push(note);
    }
    return Array.from(map.values());
  }, [data.notes, decks]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.overlay} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: c.card }]}>
        <View style={s.sheetHandle} />
        <View style={s.sheetHeader}>
          <View>
            <Text style={[s.sheetDate, { color: c.foreground }]}>{formatted}</Text>
            <Text style={[s.sheetCount, { color: c.mutedForeground }]}>
              {data.notes.length} cartão{data.notes.length !== 1 ? 'ões' : ''} criado{data.notes.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: c.muted }]}>
            <Feather name="x" size={18} color={c.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {byDeck.map(({ deck, notes }) => (
            <View key={deck.id} style={{ marginBottom: 20 }}>
              {/* Deck header */}
              <View style={s.deckHeader}>
                <View style={[s.deckDot, { backgroundColor: deck.color }]} />
                <Text style={[s.deckName, { color: c.foreground }]}>{deck.name}</Text>
                <Text style={[s.deckNoteCount, { color: c.mutedForeground }]}>
                  {notes.length}
                </Text>
              </View>

              {/* Notes — tappable to open for editing */}
              {notes.map((note) => (
                <TouchableOpacity
                  key={note.id}
                  activeOpacity={0.7}
                  onPress={() => onNotePress(note)}
                  style={[s.noteRow, { backgroundColor: c.background, borderColor: c.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.noteFront, { color: c.foreground }]} numberOfLines={2}>
                      {note.front}
                    </Text>
                    {note.back ? (
                      <Text style={[s.noteBack, { color: c.mutedForeground }]} numberOfLines={1}>
                        {note.back}
                      </Text>
                    ) : null}
                  </View>
                  <View style={s.noteRowRight}>
                    {note.completed && (
                      <View style={[s.completedBadge, { backgroundColor: '#10B98120' }]}>
                        <Feather name="check" size={11} color="#10B981" />
                      </View>
                    )}
                    {note.authorName ? (
                      <View style={[s.authorBadge, { backgroundColor: note.authorColor ?? '#9CA3AF' }]}>
                        <Text style={s.authorInitials}>{note.authorInitials ?? note.authorName[0]}</Text>
                      </View>
                    ) : null}
                    <Feather name="chevron-right" size={14} color={c.mutedForeground} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── GitHub-style Heatmap (last 10 weeks) ────────────────────────────────────

const NUM_WEEKS = 10;
const CELL = 24;   // px — cell width & height
const CGAP = 3;    // px — gap between cells
const DAY_LABEL_W = 24; // px — width of day-name column

// Map a count → one of 5 intensity levels (0–4)
function intensityLevel(count: number, max: number): number {
  if (count === 0 || max === 0) return 0;
  const r = count / max;
  if (r <= 0.15) return 1;
  if (r <= 0.40) return 2;
  if (r <= 0.70) return 3;
  return 4;
}

function GitHubHeatmap({ notesByDate }: { notesByDate: Map<string, Note[]> }) {
  const c = useColors();

  // ── Build grid: columns = weeks (oldest→newest), rows = weekdays (Sun=0) ──
  const { columns, monthLabels, maxCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start of current week (Sunday)
    const currentSunday = new Date(today);
    currentSunday.setDate(today.getDate() - today.getDay());

    // Grid starts NUM_WEEKS-1 weeks before
    const gridStart = new Date(currentSunday);
    gridStart.setDate(currentSunday.getDate() - (NUM_WEEKS - 1) * 7);

    let maxCount = 0;
    const columns: { key: string; count: number; isFuture: boolean }[][] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < NUM_WEEKS; w++) {
      const col: { key: string; count: number; isFuture: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + w * 7 + d);
        const isFuture = date > today;
        const key = toDateKey(date);
        const count = isFuture ? 0 : (notesByDate.get(key)?.length ?? 0);
        if (!isFuture) maxCount = Math.max(maxCount, count);
        col.push({ key, count, isFuture });

        if (d === 0 && date.getMonth() !== lastMonth) {
          lastMonth = date.getMonth();
          monthLabels.push({ col: w, label: MONTHS_SHORT[date.getMonth()] });
        }
      }
      columns.push(col);
    }

    return { columns, monthLabels, maxCount };
  }, [notesByDate]);

  const cellBg = (level: number) => {
    switch (level) {
      case 1: return c.primary + '33';
      case 2: return c.primary + '66';
      case 3: return c.primary + 'AA';
      case 4: return c.primary;
      default: return c.muted;
    }
  };

  // Only label alternating rows so it stays legible
  const DAY_LABELS = ['Dom', '', 'Ter', '', 'Qui', '', 'Sáb'];

  const colStep = CELL + CGAP;
  const totalW = DAY_LABEL_W + CGAP + NUM_WEEKS * colStep - CGAP;

  return (
    <View>
      {/* Month labels */}
      <View style={{ flexDirection: 'row', width: totalW, marginBottom: 4 }}>
        <View style={{ width: DAY_LABEL_W + CGAP }} />
        {columns.map((_, wi) => {
          const ml = monthLabels.find((m) => m.col === wi);
          return (
            <View key={wi} style={{ width: CELL, marginRight: wi < NUM_WEEKS - 1 ? CGAP : 0 }}>
              {ml ? (
                <Text style={[s.hmMonthLabel, { color: c.mutedForeground }]}>{ml.label}</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Grid rows */}
      {DAY_LABELS.map((label, di) => (
        <View key={di} style={{ flexDirection: 'row', width: totalW, marginBottom: CGAP }}>
          {/* Day label */}
          <View style={{ width: DAY_LABEL_W, marginRight: CGAP, justifyContent: 'center' }}>
            <Text style={[s.hmDayLabel, { color: c.mutedForeground }]}>{label}</Text>
          </View>

          {/* Cells for this day across all weeks */}
          {columns.map((col, wi) => {
            const cell = col[di];
            const level = cell.isFuture ? -1 : intensityLevel(cell.count, maxCount);
            return (
              <View
                key={wi}
                style={[
                  {
                    width: CELL,
                    height: CELL,
                    borderRadius: 3,
                    marginRight: wi < NUM_WEEKS - 1 ? CGAP : 0,
                    backgroundColor: level < 0 ? 'transparent' : cellBg(level),
                  },
                ]}
              />
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={s.hmLegend}>
        <Text style={[s.hmLegendLabel, { color: c.mutedForeground }]}>Menos</Text>
        {[0, 1, 2, 3, 4].map((level) => (
          <View key={level} style={[s.hmLegendCell, { backgroundColor: cellBg(level) }]} />
        ))}
        <Text style={[s.hmLegendLabel, { color: c.mutedForeground }]}>Mais</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notes, decks } = useStorage();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [milestone, setMilestone] = useState<number | null>(null);

  // ── Index notes by date ──────────────────────────────────────────────────
  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of notes) {
      const key = note.createdAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(note);
    }
    return map;
  }, [notes]);

  const dateSet = useMemo(() => new Set(notesByDate.keys()), [notesByDate]);

  // ── Streak & stats ───────────────────────────────────────────────────────
  const { current: currentStreak, max: maxStreak, activeDays } = useMemo(
    () => computeStreaks(dateSet),
    [dateSet],
  );

  const completedCards = useMemo(
    () => notes.filter((n) => n.completed).length,
    [notes],
  );

  // ── Milestone detection ──────────────────────────────────────────────────
  useEffect(() => {
    if (currentStreak === 0) return;
    AsyncStorage.getItem(MILESTONE_KEY).then((raw) => {
      const last = raw ? parseInt(raw, 10) : 0;
      const reached = STREAK_MILESTONES.filter((m) => m <= currentStreak && m > last);
      if (reached.length > 0) {
        const highest = Math.max(...reached);
        setMilestone(highest);
        AsyncStorage.setItem(MILESTONE_KEY, String(highest));
      }
    });
  }, [currentStreak]);

  // ── Advanced stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (notes.length === 0) return null;

    const totalCards = notes.length;
    const avgPerDay = activeDays > 0 ? (totalCards / activeDays).toFixed(1) : '0';

    const byMonth = new Map<string, number>();
    for (const [key, arr] of notesByDate) {
      const monthKey = key.slice(0, 7);
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + arr.length);
    }
    let bestMonthKey = '';
    let bestMonthCount = 0;
    for (const [k, v] of byMonth) {
      if (v > bestMonthCount) { bestMonthCount = v; bestMonthKey = k; }
    }
    const bestMonth = bestMonthKey
      ? (() => {
          const [y, m] = bestMonthKey.split('-').map(Number);
          return `${MONTHS[m - 1]} ${y}`;
        })()
      : '-';

    let bestDayKey = '';
    let bestDayCount = 0;
    for (const [k, arr] of notesByDate) {
      if (arr.length > bestDayCount) { bestDayCount = arr.length; bestDayKey = k; }
    }
    const bestDay = bestDayKey
      ? parseLocalDate(bestDayKey).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-';

    const byAuthor = new Map<string, number>();
    for (const note of notes) {
      const name = note.authorName ?? 'Sem perfil';
      byAuthor.set(name, (byAuthor.get(name) ?? 0) + 1);
    }

    return { totalCards, avgPerDay, bestMonth, bestDay, byAuthor };
  }, [notes, notesByDate, activeDays]);

  // ── Calendar grid ────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    const now = new Date();
    if (viewYear === now.getFullYear() && viewMonth === now.getMonth()) return;
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, [viewYear, viewMonth]);

  const handleDayPress = useCallback((day: number) => {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayNotes = notesByDate.get(key) ?? [];
    if (dayNotes.length === 0) return;
    setSelectedDay({ dateKey: key, notes: dayNotes });
  }, [viewYear, viewMonth, notesByDate]);

  const handleNotePress = useCallback((note: Note) => {
    setSelectedDay(null);
    // Navigate to the deck page with the note pre-selected for editing
    router.push({ pathname: '/deck/[id]', params: { id: note.deckId, openNote: note.id } });
  }, [router]);

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const isAtFutureLimit = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const miniStats = [
    { icon: '🏆', value: maxStreak, label: 'Recorde' },
    { icon: '📅', value: activeDays, label: 'Dias ativos' },
    { icon: '📝', value: notes.length, label: 'Cartões' },
    { icon: '✅', value: completedCards, label: 'Concluídos' },
    { icon: '📚', value: decks.length, label: 'Baralhos' },
  ];

  return (
    <View style={[s.root, { backgroundColor: c.background }]}>
      {milestone !== null && (
        <MilestoneToast streak={milestone} onDismiss={() => setMilestone(null)} />
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Text style={[s.headerTitle, { color: c.foreground }]}>Calendário</Text>
        </View>

        {/* Streak + Top Stats */}
        <View style={s.topStats}>
          <View style={[s.streakCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={s.streakFire}>🔥</Text>
            <Text style={[s.streakNumber, { color: c.foreground }]}>{currentStreak}</Text>
            <Text style={[s.streakLabel, { color: c.mutedForeground }]}>
              dia{currentStreak !== 1 ? 's' : ''} seguido{currentStreak !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={s.miniStats}>
            {miniStats.map((stat) => (
              <View key={stat.label} style={[s.miniStat, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={s.miniStatIcon}>{stat.icon}</Text>
                <Text style={[s.miniStatVal, { color: c.foreground }]}>{stat.value}</Text>
                <Text style={[s.miniStatLabel, { color: c.mutedForeground }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Calendar Card */}
        <View style={[s.calendarCard, { backgroundColor: c.card, borderColor: c.border }]}>
          {/* Month nav */}
          <View style={s.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="chevron-left" size={20} color={c.mutedForeground} />
            </TouchableOpacity>
            <Text style={[s.monthLabel, { color: c.foreground }]}>
              {MONTHS[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity
              onPress={nextMonth}
              style={[s.navBtn, isAtFutureLimit && { opacity: 0.3 }]}
              disabled={isAtFutureLimit}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-right" size={20} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Week day labels */}
          <View style={s.weekRow}>
            {WEEK_DAYS.map((d) => (
              <Text key={d} style={[s.weekDay, { color: c.mutedForeground }]}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={s.grid}>
            {calendarDays.map((day, idx) => {
              if (day === null) return <View key={`empty-${idx}`} style={s.dayCell} />;
              const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = notesByDate.get(key)?.length ?? 0;
              const dot = dotConfig(count);
              const todayCell = isToday(day);
              return (
                <TouchableOpacity
                  key={key}
                  style={s.dayCell}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={count > 0 ? 0.6 : 1}
                >
                  <View style={[s.dayNumber, todayCell && { backgroundColor: c.primary, borderRadius: 14 }]}>
                    <Text style={[
                      s.dayText,
                      { color: todayCell ? c.primaryForeground : c.foreground },
                    ]}>
                      {day}
                    </Text>
                  </View>
                  <View style={s.dotSlot}>
                    {dot !== null && (
                      <View
                        style={[
                          s.dot,
                          {
                            width: dot.size,
                            height: dot.size,
                            borderRadius: dot.size / 2,
                            backgroundColor: c.primary,
                            opacity: dot.opacity,
                          },
                        ]}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={s.legend}>
            <Text style={[s.legendText, { color: c.mutedForeground }]}>Menos</Text>
            {[0.3, 0.5, 0.7, 1.0].map((op) => (
              <View
                key={op}
                style={[s.legendDot, { backgroundColor: c.primary, opacity: op }]}
              />
            ))}
            <Text style={[s.legendText, { color: c.mutedForeground }]}>Mais</Text>
          </View>
        </View>

        {/* GitHub heatmap */}
        <View style={[s.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.sectionTitle, { color: c.foreground }]}>Últimas 10 semanas</Text>
          <Text style={[s.sectionSubtitle, { color: c.mutedForeground }]}>
            Cartões criados por dia
          </Text>
          <GitHubHeatmap notesByDate={notesByDate} />
        </View>

        {/* Extra stats */}
        {stats && (
          <View style={[s.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[s.sectionTitle, { color: c.foreground }]}>Estatísticas</Text>

            <View style={s.statsGrid}>
              <View style={[s.statItem, { borderColor: c.border }]}>
                <Text style={[s.statItemLabel, { color: c.mutedForeground }]}>Média por dia ativo</Text>
                <Text style={[s.statItemVal, { color: c.foreground }]}>{stats.avgPerDay} cartões</Text>
              </View>
              <View style={[s.statItem, { borderColor: c.border }]}>
                <Text style={[s.statItemLabel, { color: c.mutedForeground }]}>Mês mais produtivo</Text>
                <Text style={[s.statItemVal, { color: c.foreground }]}>{stats.bestMonth}</Text>
              </View>
              <View style={[s.statItem, { borderColor: c.border }]}>
                <Text style={[s.statItemLabel, { color: c.mutedForeground }]}>Dia mais ativo</Text>
                <Text style={[s.statItemVal, { color: c.foreground }]}>{stats.bestDay}</Text>
              </View>
            </View>

            {stats.byAuthor.size > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[s.authorTitle, { color: c.mutedForeground }]}>Cartões por perfil</Text>
                {Array.from(stats.byAuthor.entries()).map(([name, count]) => (
                  <View key={name} style={s.authorRow}>
                    <Text style={[s.authorName, { color: c.foreground }]}>{name}</Text>
                    <View style={[s.authorBar, { backgroundColor: c.muted }]}>
                      <View
                        style={[
                          s.authorBarFill,
                          {
                            backgroundColor: c.primary,
                            width: `${(count / (stats.totalCards || 1)) * 100}%`,
                            opacity: 0.8,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.authorCount, { color: c.mutedForeground }]}>{count}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {selectedDay && (
        <DayModal
          data={selectedDay}
          decks={decks}
          onClose={() => setSelectedDay(null)}
          onNotePress={handleNotePress}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },

  // ── Top streak ──────────────────────────────────────────────────────────
  topStats: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  streakCard: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    gap: 2,
  },
  streakFire: { fontSize: 28 },
  streakNumber: { fontSize: 26, fontFamily: 'Inter_700Bold', lineHeight: 30 },
  streakLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  miniStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniStat: {
    width: '31%',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 9,
    gap: 1,
  },
  miniStatIcon: { fontSize: 14 },
  miniStatVal: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  miniStatLabel: { fontSize: 9, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  // ── Calendar card ────────────────────────────────────────────────────────
  calendarCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    paddingBottom: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dayNumber: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  dotSlot: { height: 12, alignItems: 'center', justifyContent: 'center' },
  dot: {},
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 8,
  },
  legendText: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },

  // ── Section card ─────────────────────────────────────────────────────────
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 14 },

  // ── GitHub heatmap ────────────────────────────────────────────────────────
  hmMonthLabel: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
  },
  hmDayLabel: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  hmLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 8,
  },
  hmLegendLabel: {
    fontSize: 9,
    fontFamily: 'Inter_400Regular',
  },
  hmLegendCell: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },

  // ── Stats grid ────────────────────────────────────────────────────────────
  statsGrid: { gap: 8 },
  statItem: { borderBottomWidth: 1, paddingBottom: 8 },
  statItemLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  statItemVal: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  authorTitle: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  authorName: { fontSize: 13, fontFamily: 'Inter_500Medium', width: 72 },
  authorBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  authorBarFill: { height: '100%', borderRadius: 4 },
  authorCount: { fontSize: 12, fontFamily: 'Inter_400Regular', width: 30, textAlign: 'right' },

  // ── Day modal ─────────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  sheetDate: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  sheetCount: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  closeBtn: { padding: 6, borderRadius: 20 },
  deckHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  deckDot: { width: 10, height: 10, borderRadius: 5 },
  deckName: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  deckNoteCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 6,
  },
  noteRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteFront: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  noteBack: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  authorBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorInitials: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#fff' },

  // ── Milestone toast ───────────────────────────────────────────────────────
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  toastStreak: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  toastMsg: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#ffffffcc' },
});
