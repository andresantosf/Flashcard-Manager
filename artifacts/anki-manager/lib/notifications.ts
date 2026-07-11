import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'anki-manager';
const TODAY_REMINDER_ID = 'streak-reminder-today';

// ── Handler: show notifications even while app is foregrounded ────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Setup: request permissions + Android channel ──────────────────────────────
export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Anki Manager',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── New card: fires immediately when a card is added ──────────────────────────
export async function sendNewCardNotification(authorName: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📝 Novo cartão',
      body: `${authorName} adicionou um novo cartão`,
      sound: true,
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: null, // immediate
  });
}

// ── Daily reminder: schedule for 21:00 today if it hasn't passed ──────────────
export async function scheduleDailyReminder(streak: number): Promise<void> {
  if (Platform.OS === 'web') return;

  // Always cancel the previous one before rescheduling
  try {
    await Notifications.cancelScheduledNotificationAsync(TODAY_REMINDER_ID);
  } catch (_) {}

  const now = new Date();
  const trigger = new Date();
  trigger.setHours(21, 0, 0, 0);

  // If 21:00 already passed for today, don't schedule
  if (trigger <= now) return;

  const hasStreak = streak > 0;
  const title = hasStreak ? '🔥 Sua ofensiva está em risco!' : '📚 Hora de estudar!';
  const body = hasStreak
    ? `Não perca sua ofensiva de ${streak} dia${streak !== 1 ? 's' : ''}!`
    : 'Você não adicionou nenhum cartão hoje.';

  await Notifications.scheduleNotificationAsync({
    identifier: TODAY_REMINDER_ID,
    content: {
      title,
      body,
      sound: true,
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });
}

// ── Cancel the streak reminder (called when a card is added today) ────────────
export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(TODAY_REMINDER_ID);
  } catch (_) {}
}
