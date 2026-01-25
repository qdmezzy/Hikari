<template>
  <div class="hikari-shell" :class="{ 'is-auth': !session }">
    <div v-if="authLoading" class="hikari-loading">Loading...</div>

    <div v-else-if="!session" class="hikari-auth">
      <div class="hikari-auth-inner">
        <div v-if="authStep === 'onboarding'" class="hikari-auth-card onboarding-card">
          <div class="onboarding-icon">
            <span class="material-icons">auto_awesome</span>
          </div>
          <h2>Welcome to Hikari</h2>
          <p>Track your anime progress automatically while you watch</p>

          <div class="onboarding-feature">
            <div class="feature-icon feature-orange">
              <span class="material-icons">bolt</span>
            </div>
            <div>
              <div class="feature-title">Auto-tracking</div>
              <div class="feature-sub">We detect when you&apos;re watching and update your progress</div>
            </div>
          </div>

          <div class="onboarding-feature">
            <div class="feature-icon feature-green">
              <span class="material-icons">link</span>
            </div>
            <div>
              <div class="feature-title">Quicklinks</div>
              <div class="feature-sub">Jump to your favorite sites from any Hikari page</div>
            </div>
          </div>

          <button class="hikari-primary onboarding-cta" @click="authStep = 'quicklinks'">
            Get Started
            <span class="material-icons">arrow_forward</span>
          </button>
        </div>

        <div v-else-if="authStep === 'quicklinks'" class="hikari-auth-card quicklinks-card">
          <button class="back-btn" @click="authStep = 'onboarding'">
            <span class="material-icons">chevron_left</span>
            Back
          </button>
          <div class="quicklinks-header-block">
            <div class="quicklinks-title">Choose Quicklinks</div>
            <div class="quicklinks-sub">Select your favorite streaming and reading sites</div>
          </div>

          <div class="quicklinks-scroll">
            <div class="quicklinks-group">
              <div class="group-title">Streaming</div>
              <div class="site-list">
                <button
                  v-for="site in streamingSites"
                  :key="site.id"
                  class="site-row"
                  :class="{ active: settings.quicklinks.includes(site.id) }"
                  @click="toggleQuicklink(site.id)"
                >
                  <div class="site-icon" :style="{ background: site.color }">{{ site.icon }}</div>
                  <span>{{ site.name }}</span>
                  <span class="material-icons check-icon">check</span>
                </button>
              </div>
            </div>

            <div class="quicklinks-group">
              <div class="group-title">Manga</div>
              <div class="site-list">
                <button
                  v-for="site in mangaSites"
                  :key="site.id"
                  class="site-row"
                  :class="{ active: settings.quicklinks.includes(site.id) }"
                  @click="toggleQuicklink(site.id)"
                >
                  <div class="site-icon" :style="{ background: site.color }">{{ site.icon }}</div>
                  <span>{{ site.name }}</span>
                  <span class="material-icons check-icon">check</span>
                </button>
              </div>
            </div>
          </div>

          <button class="hikari-primary onboarding-cta" @click="authStep = 'login'">
            Continue
            <span class="material-icons">arrow_forward</span>
          </button>
          <div class="quicklinks-count">{{ settings.quicklinks.length }} sites selected</div>
        </div>

        <div v-else class="hikari-auth-card">
          <div class="auth-brand">
            <div class="hikari-logo">H</div>
            <div>
              <div class="hikari-title">Hikari</div>
              <div class="hikari-subtitle">Extension</div>
            </div>
          </div>

          <h2>Sign in to Hikari</h2>
          <p>Use the same account as the web app.</p>

          <form class="hikari-form" @submit.prevent="handleSignIn">
            <label>
              <span>Email</span>
              <input v-model.trim="loginEmail" type="email" autocomplete="email" />
            </label>
            <label>
              <span>Password</span>
              <input v-model="loginPassword" type="password" autocomplete="current-password" />
            </label>

            <button type="submit" :disabled="loginPending" class="hikari-primary">
              <span v-if="loginPending">Signing in...</span>
              <span v-else>Sign in</span>
            </button>
          </form>

          <p v-if="loginError" class="hikari-error">{{ loginError }}</p>
          <button class="ghost-btn" @click="authStep = 'quicklinks'">
            <span class="material-icons">chevron_left</span>
            Back to quicklinks
          </button>
        </div>
      </div>
    </div>

    <div v-else class="hikari-app">
      <header class="hikari-header">
        <div class="hikari-brand">
          <div class="hikari-logo">H</div>
          <div class="hikari-title">Hikari</div>
        </div>
        <nav class="hikari-nav">
          <button
            class="hikari-nav-btn"
            :class="{ active: view === 'dashboard' }"
            @click="view = 'dashboard'"
          >
            <span class="material-icons">show_chart</span>
          </button>
          <button
            class="hikari-nav-btn"
            :class="{ active: view === 'detected' }"
            @click="view = 'detected'"
          >
            <span class="material-icons">play_circle_filled</span>
          </button>
          <button
            class="hikari-nav-btn"
            :class="{ active: view === 'settings' }"
            @click="view = 'settings'"
          >
            <span class="material-icons">settings</span>
          </button>
        </nav>
      </header>

      <main class="hikari-main">
        <section v-if="view === 'dashboard'" class="hikari-view">
          <div class="hikari-stats">
            <div class="stat-card">
              <div class="stat-icon stat-blue">
                <span class="material-icons">schedule</span>
              </div>
              <div>
                <div class="stat-value">{{ stats.timeWatched }}</div>
                <div class="stat-label">Watched</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-green">
                <span class="material-icons">check_circle</span>
              </div>
              <div>
                <div class="stat-value">{{ stats.completed }}</div>
                <div class="stat-label">Done</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-orange">
                <span class="material-icons">local_fire_department</span>
              </div>
              <div>
                <div class="stat-value">{{ stats.streak }}</div>
                <div class="stat-label">Streak</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-pink">
                <span class="material-icons">trending_up</span>
              </div>
              <div>
                <div class="stat-value">{{ stats.episodes }}</div>
                <div class="stat-label">Eps</div>
              </div>
            </div>
          </div>

          <div class="hikari-section">
            <div class="hikari-note">
              <div class="note-dot"></div>
              <div>
                <div class="note-title">Auto-tracking active</div>
                <div class="note-sub">
                  {{ detectedSite ? `Watching ${detectedSite}` : 'Waiting for a supported site' }}
                </div>
                <div class="note-sub">{{ lastAutoUpdateLabel }}</div>
              </div>
            </div>
          </div>

          <div class="hikari-section">
            <div class="hikari-section-header">
              <div class="section-title">
                <span class="material-icons">history</span>
                Recent activity
              </div>
              <button class="link-btn" @click="openInHikari('/history')">View all</button>
            </div>

            <div v-if="dashboardLoading" class="hikari-muted">Loading history...</div>
            <div v-else-if="recentItems.length === 0" class="hikari-muted">
              No recent updates yet.
            </div>

            <div v-else class="watching-list">
              <div v-for="item in recentItems" :key="item.mediaId" class="watching-card">
                <img :src="item.image || placeholder" :alt="item.title" />
                <div class="watching-meta">
                  <div class="watching-title">{{ item.title }}</div>
                  <div class="watching-progress">
                    {{ formatProgressLabel(item.progress, item.total) }}
                  </div>
                  <div class="watching-time">
                    {{ formatRelativeTime(item.updatedAt, nowTick) || 'Recently updated' }}
                  </div>
                  <div class="watching-bar">
                    <span :style="{ width: `${item.progressPercent || 0}%` }"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section v-if="view === 'detected'" class="hikari-view">
          <div class="hikari-detected-banner">
            <div class="note-dot"></div>
            <span>{{ detectedTab ? `Detected on ${detectedSite}` : 'No active tab detected' }}</span>
          </div>

          <div class="detected-card">
            <div class="detected-hero">
              <img :src="detectedImage || placeholder" alt="" />
              <div class="detected-overlay"></div>
            </div>
            <div class="detected-body">
              <div class="detected-cover">
                <img :src="detectedImage || placeholder" alt="" />
              </div>
              <div class="detected-info">
                <div class="detected-title">{{ detectedTitle || 'No media detected' }}</div>
                <div class="detected-sub">
                  {{ detectedTotal ? `${detectedTotal} episodes` : 'Episodes unknown' }}
                </div>
                <div v-if="detectedMatchNote" class="detected-match">{{ detectedMatchNote }}</div>
              </div>
            </div>

            <div class="detected-actions">
              <div class="status-dropdown">
                <button class="status-trigger" @click="statusOpen = !statusOpen">
                  {{ statusLabel }}
                  <span class="material-icons">expand_more</span>
                </button>
                <div v-if="statusOpen" class="status-menu">
                  <button
                    v-for="option in statusOptions"
                    :key="option.id"
                    :class="{ active: detectedStatus === option.id }"
                    @click="selectStatus(option.id)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div class="progress-control">
                <div class="progress-header">
                  <span>Episode</span>
                  <span>{{ detectedProgress }} / {{ detectedTotal || '?' }}</span>
                </div>
                <div class="progress-row">
                  <button class="progress-btn" @click="adjustDetected(-1)">-</button>
                  <input
                    type="number"
                    min="0"
                    :max="detectedTotal || undefined"
                    v-model.number="detectedProgress"
                    @change="clampDetected"
                  />
                  <button class="progress-btn primary" @click="adjustDetected(1)">+</button>
                </div>
                <div class="progress-bar">
                  <span :style="{ width: detectedTotal ? `${(detectedProgress / detectedTotal) * 100}%` : '0%' }"></span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="detectedLoading" class="hikari-muted">Matching title...</div>
          <div v-if="detectedError" class="hikari-error">{{ detectedError }}</div>

          <div class="detected-buttons">
            <button class="hikari-secondary" @click="openInHikari(mediaLinkPath)" :disabled="!detectedMedia">
              Open in Hikari
            </button>
            <button
              class="hikari-primary"
              @click="saveDetected"
              :disabled="savePending || !detectedMedia"
            >
              {{ savePending ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </section>

        <section v-if="view === 'settings'" class="hikari-view">
          <div class="hikari-settings">
            <h3>Settings</h3>
            <div class="settings-list">
              <div class="setting-row">
                <div>
                  <div class="setting-title">Auto-track</div>
                  <div class="setting-sub">Update progress automatically</div>
                </div>
                <button class="toggle" :class="{ on: settings.autoTrack }" @click="toggleSetting('autoTrack')">
                  <span></span>
                </button>
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-title">Notifications</div>
                  <div class="setting-sub">New episode alerts</div>
                </div>
                <button class="toggle" :class="{ on: settings.notifications }" @click="toggleSetting('notifications')">
                  <span></span>
                </button>
              </div>
              <div class="setting-row">
                <div>
                  <div class="setting-title">Spoiler Shield</div>
                  <div class="setting-sub">Hide content past your progress</div>
                </div>
                <button class="toggle" :class="{ on: settings.spoilerShield }" @click="toggleSetting('spoilerShield')">
                  <span></span>
                </button>
              </div>
            </div>

            <button class="quicklinks-row" @click="view = 'quicklinks'">
              <div class="quicklinks-icon">
                <span class="material-icons">link</span>
              </div>
              <div>
                <div class="setting-title">Manage Quicklinks</div>
                <div class="setting-sub">{{ settings.quicklinks.length }} sites enabled</div>
              </div>
              <span class="material-icons">chevron_right</span>
            </button>

            <div class="settings-advanced">
              <div>
                <div class="setting-title">Advanced settings</div>
                <div class="setting-sub">Full controls from the classic panel</div>
              </div>
              <div class="advanced-list">
                <button
                  v-for="item in advancedSettings"
                  :key="item.key"
                  class="advanced-link"
                  @click="openSettingsSection(item.key)"
                >
                  <span class="material-icons">{{ item.icon }}</span>
                  <span>{{ item.label }}</span>
                </button>
              </div>
            </div>

            <div class="profile-row">
              <div class="profile-avatar">{{ profileInitial }}</div>
              <div class="profile-info">
                <div class="setting-title">{{ profileName }}</div>
                <div class="setting-sub">{{ profileEmail }}</div>
              </div>
              <button class="link-btn" @click="handleSignOut">Sign out</button>
            </div>
          </div>
        </section>

        <section v-if="view === 'quicklinks'" class="hikari-view">
          <div class="quicklinks-header">
            <button class="link-btn" @click="view = 'settings'">
              <span class="material-icons">chevron_left</span>
              Back
            </button>
            <div>
              <div class="setting-title">Manage Quicklinks</div>
              <div class="setting-sub">Shown on every Hikari page</div>
            </div>
          </div>

          <div class="quicklinks-list">
            <div class="quicklinks-group">
              <div class="group-title">Streaming</div>
              <button
                v-for="site in streamingSites"
                :key="site.id"
                class="site-row"
                :class="{ active: settings.quicklinks.includes(site.id) }"
                @click="toggleQuicklink(site.id)"
              >
                <div class="site-icon" :style="{ background: site.color }">{{ site.icon }}</div>
                <span>{{ site.name }}</span>
                <span class="material-icons check-icon">check</span>
              </button>
            </div>

            <div class="quicklinks-group">
              <div class="group-title">Manga</div>
              <button
                v-for="site in mangaSites"
                :key="site.id"
                class="site-row"
                :class="{ active: settings.quicklinks.includes(site.id) }"
                @click="toggleQuicklink(site.id)"
              >
                <div class="site-icon" :style="{ background: site.color }">{{ site.icon }}</div>
                <span>{{ site.name }}</span>
                <span class="material-icons check-icon">check</span>
              </button>
            </div>
          </div>

          <button class="hikari-primary quicklinks-save" @click="view = 'settings'">Save changes</button>
        </section>
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { fetchEntries, fetchEntry, upsertEntry } from '../../hikari/client';
import { fetchMediaById, searchAniList } from '../../hikari/anilist';
import {
  cacheMatch,
  getCachedMatch,
  getExtensionSettings,
  getLastAutoUpdate,
  setExtensionSettings,
  type ExtensionSettings,
  type LastAutoUpdate,
} from '../../hikari/storage';
import { getValidSession, signInWithPassword, signOut } from '../../hikari/auth';
import { HIKARI_WEB_URL } from '../../hikari/config';
import { router } from '../router';

type View = 'dashboard' | 'detected' | 'settings' | 'quicklinks';
type AuthStep = 'onboarding' | 'quicklinks' | 'login';

type QuicklinkPage = {
  key: string;
  name: string;
  domain: string;
  search?: { anime: string | null; manga: string | null };
};

type WatchingItem = {
  mediaId: number;
  title: string;
  image: string;
  progress: number;
  total: number | null;
  status: string;
  mediaType: 'ANIME' | 'MANGA';
};

type HistoryItem = WatchingItem & {
  updatedAt?: string | number | null;
  progressPercent?: number;
};

const quicklinkPages = require('../../utils/quicklinks.json') as QuicklinkPage[];
const extraQuicklinks: QuicklinkPage[] = [
  {
    key: 'Crunchyroll',
    name: 'Crunchyroll',
    domain: 'https://www.crunchyroll.com',
    search: { anime: 'https://www.crunchyroll.com/search?q={searchterm}', manga: null },
  },
  {
    key: 'Funimation',
    name: 'Funimation',
    domain: 'https://www.funimation.com',
    search: { anime: 'https://www.funimation.com/search/?q={searchterm}', manga: null },
  },
  {
    key: 'PrimeVideo',
    name: 'Prime Video',
    domain: 'https://www.primevideo.com',
    search: { anime: 'https://www.primevideo.com/search/ref=atv_nb_sr?phrase={searchterm}', manga: null },
  },
  {
    key: 'DisneyPlus',
    name: 'Disney+',
    domain: 'https://www.disneyplus.com',
    search: { anime: 'https://www.disneyplus.com/search?q={searchterm}', manga: null },
  },
  {
    key: 'Max',
    name: 'Max',
    domain: 'https://www.max.com',
    search: { anime: 'https://play.max.com/search?q={searchterm}', manga: null },
  },
];

const allQuicklinks = (() => {
  const combined = new Map<string, QuicklinkPage>();
  [...extraQuicklinks, ...quicklinkPages].forEach((site) => {
    combined.set(site.key, site);
  });
  return Array.from(combined.values());
})();

const quicklinkPalette = [
  '#F47521',
  '#5B0BB5',
  '#E50914',
  '#1CE783',
  '#00BAFF',
  '#00A8E1',
  '#F97316',
  '#A855F7',
  '#EC4899',
  '#22C55E',
  '#38BDF8',
  '#F59E0B',
];

const makeSite = (site: QuicklinkPage, index: number) => {
  const initials = site.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    id: site.key,
    name: site.name,
    color: quicklinkPalette[index % quicklinkPalette.length],
    icon: initials,
  };
};

const streamingSites = computed(() =>
  allQuicklinks
    .filter((site) => site.search?.anime)
    .map((site, index) => makeSite(site, index)),
);

const mangaSites = computed(() =>
  allQuicklinks
    .filter((site) => site.search?.manga)
    .map((site, index) => makeSite(site, index + streamingSites.value.length)),
);

const statusOptions = [
  { id: 'watching', label: 'Watching' },
  { id: 'completed', label: 'Completed' },
  { id: 'plan_to_watch', label: 'Planned' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'rewatching', label: 'Rewatching' },
];

const placeholder = 'https://via.placeholder.com/120x180?text=Hikari';

const fill = inject('fill') as { value: any } | undefined;
const detectedTab = computed(() => fill?.value || null);

const view = ref<View>('dashboard');
const authStep = ref<AuthStep>('onboarding');
const session = ref<any>(null);
const authLoading = ref(true);

const loginEmail = ref('');
const loginPassword = ref('');
const loginError = ref('');
const loginPending = ref(false);

const defaultQuicklinks = allQuicklinks.map((site) => site.key);

const settings = ref<ExtensionSettings>({
  autoTrack: true,
  notifications: true,
  spoilerShield: true,
  quicklinks: defaultQuicklinks,
});

const normalizeQuicklinks = (list: string[]) => {
  const keyMap = new Map(allQuicklinks.map((site) => [site.key.toLowerCase(), site.key]));
  const nameMap = new Map(allQuicklinks.map((site) => [site.name.toLowerCase(), site.key]));
  const normalized = new Set<string>();
  (list || []).forEach((item) => {
    const target = item?.toLowerCase?.() || '';
    const match = keyMap.get(target) || nameMap.get(target);
    if (match) normalized.add(match);
  });
  return Array.from(normalized);
};

const dashboardLoading = ref(false);
const watchingItems = ref<WatchingItem[]>([]);
const recentItems = ref<HistoryItem[]>([]);
const stats = ref({
  timeWatched: '0h',
  completed: 0,
  streak: 0,
  episodes: 0,
});

const detectedLoading = ref(false);
const detectedError = ref('');
const detectedMedia = ref<any>(null);
const detectedTitle = ref('');
const detectedImage = ref('');
const detectedTotal = ref<number | null>(null);
const detectedProgress = ref(0);
const detectedStatus = ref('watching');
const statusOpen = ref(false);
const detectedMatchNote = ref('');
const savePending = ref(false);
const lastAutoUpdate = ref<LastAutoUpdate | null>(null);
const nowTick = ref(Date.now());

let refreshTimer: number | null = null;
let nowTimer: number | null = null;

const statusLabel = computed(() => {
  return statusOptions.find((option) => option.id === detectedStatus.value)?.label || 'Watching';
});

const detectedSite = computed(() => detectedTab.value?.site || '');
const lastAutoUpdateLabel = computed(() => {
  nowTick.value;
  if (!lastAutoUpdate.value?.at) return 'No auto updates yet.';
  const when = formatRelativeTime(lastAutoUpdate.value.at) || 'just now';
  const details: string[] = [];
  if (lastAutoUpdate.value.title) details.push(lastAutoUpdate.value.title);
  if (typeof lastAutoUpdate.value.episode === 'number') details.push(`Ep ${lastAutoUpdate.value.episode}`);
  if (details.length) return `Last auto update: ${when} - ${details.join(' ')}`;
  return `Last auto update: ${when}`;
});

const profileName = computed(() => session.value?.user?.displayName || session.value?.user?.email || 'User');
const profileEmail = computed(() => session.value?.user?.email || '');
const profileInitial = computed(() => profileName.value?.slice(0, 1).toUpperCase() || 'H');

const mediaLinkPath = computed(() => (detectedMedia.value ? `/media/${detectedMedia.value.id}` : '/'));

const loadSession = async () => {
  authLoading.value = true;
  try {
    session.value = await getValidSession();
  } catch (error) {
    session.value = null;
  } finally {
    authLoading.value = false;
  }
};

const handleSignIn = async () => {
  loginError.value = '';
  if (!loginEmail.value || !loginPassword.value) {
    loginError.value = 'Enter email and password.';
    return;
  }
  loginPending.value = true;
  try {
    await signInWithPassword(loginEmail.value, loginPassword.value);
    await loadSession();
    await loadDashboard();
    await resolveDetected();
  } catch (error: any) {
    loginError.value = error?.message || 'Sign in failed.';
  } finally {
    loginPending.value = false;
  }
};

const handleSignOut = async () => {
  await signOut();
  session.value = null;
  watchingItems.value = [];
};

const loadSettings = async () => {
  const stored = await getExtensionSettings();
  const normalizedQuicklinks = normalizeQuicklinks(stored.quicklinks || []);
  const next = {
    ...stored,
    quicklinks: normalizedQuicklinks.length ? normalizedQuicklinks : defaultQuicklinks,
  };
  settings.value = next;
  if (normalizedQuicklinks.length !== (stored.quicklinks || []).length) {
    await setExtensionSettings(next);
  }
};

const loadLastAutoUpdate = async () => {
  lastAutoUpdate.value = await getLastAutoUpdate();
};

const toggleSetting = async (key: keyof ExtensionSettings) => {
  const next = { ...settings.value, [key]: !settings.value[key] };
  settings.value = next;
  await setExtensionSettings(next);
};

const toggleQuicklink = async (id: string) => {
  const list = settings.value.quicklinks || [];
  const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
  settings.value = { ...settings.value, quicklinks: next };
  await setExtensionSettings(settings.value);
};

const openInHikari = (path: string) => {
  if (!path) return;
  const url = `${HIKARI_WEB_URL}${path}`;
  if (chrome?.tabs) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
};

const clampValue = (value: number, max: number | null) => {
  const next = Math.max(0, Math.floor(value || 0));
  if (max !== null) return Math.min(next, max);
  return next;
};

const clampDetected = () => {
  detectedProgress.value = clampValue(detectedProgress.value, detectedTotal.value);
};

const adjustDetected = (delta: number) => {
  detectedProgress.value = clampValue(detectedProgress.value + delta, detectedTotal.value);
};

const formatRelativeTime = (value?: string | number | null, now?: number) => {
  if (!value) return '';
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(timestamp)) return '';
  const diffSeconds = Math.floor(((now || Date.now()) - timestamp) / 1000);
  if (diffSeconds < 60) return 'just now';
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
};

const mediaCache = new Map<number, any>();
const getMediaInfo = async (mediaId: number) => {
  if (mediaCache.has(mediaId)) return mediaCache.get(mediaId);
  let media = null;
  try {
    media = await fetchMediaById(mediaId);
  } catch (error) {
    media = null;
  }
  if (media) {
    mediaCache.set(mediaId, media);
  }
  return media;
};

const resolveMediaTotal = (media: any, mediaType: 'ANIME' | 'MANGA') => {
  if (!media) return null;
  if (mediaType === 'MANGA') return media.chapters || null;
  if (media.episodes) return media.episodes;
  const nextEpisode = media.nextAiringEpisode?.episode;
  if (nextEpisode && nextEpisode > 1) return nextEpisode - 1;
  return null;
};

const computeProgressPercent = (progress: number, total: number | null) => {
  if (!progress || progress <= 0) return 0;
  if (total && total > 0) return Math.min(100, (progress / total) * 100);
  return 100;
};

const formatProgressLabel = (progress: number, total: number | null) => {
  if (total && total > 0) return `Ep ${progress} of ${total}`;
  return `Progress ${progress}`;
};

const advancedSettings = [
  { key: 'tracking', label: 'Tracking', icon: 'visibility' },
  { key: 'theming', label: 'Theming', icon: 'palette' },
  { key: 'onsite', label: 'Onsite', icon: 'view_quilt' },
  { key: 'streaming', label: 'Quicklinks', icon: 'rss_feed' },
  { key: 'videoPlayerSection', label: 'Video Player', icon: 'play_circle_filled' },
  { key: 'minimalSection', label: 'Extension Popup', icon: 'picture_in_picture' },
  { key: 'estimationSection', label: 'Progress Estimation', icon: 'update' },
  { key: 'notifiactionSection', label: 'Notifications', icon: 'notifications' },
  { key: 'permissions-overview', label: 'Permissions', icon: 'lock_open' },
  { key: 'customDomains', label: 'Custom Domains', icon: 'web' },
  { key: 'DiscordSection', label: 'Discord Rich Presence', icon: 'forum' },
  { key: 'miscellaneous', label: 'Misc', icon: 'code' },
];

const openSettingsSection = (key: string) => {
  router().push({ name: 'Settings', params: { path: [key] } });
};

const selectStatus = (status: string) => {
  detectedStatus.value = status;
  statusOpen.value = false;
};

const normalizeTitle = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const cleanupTitle = (value: string) => {
  if (!value) return '';
  return value
    .replace(/[-|].*$/, '')
    .replace(/(episode|ep|season|part|cour)\s*\d+.*/i, '')
    .replace(/\s+\d+\s*$/, '')
    .trim();
};

const pickBestMatch = (items: any[], title: string) => {
  if (!items?.length) return null;
  const target = normalizeTitle(title);
  if (!target) return items[0];
  let best = items[0];
  let bestScore = -1;
  items.forEach((item) => {
    const candidate = normalizeTitle(item?.title?.english || item?.title?.romaji || '');
    let score = 0;
    if (candidate.includes(target)) score += target.length;
    if (target.includes(candidate)) score += candidate.length * 0.8;
    score += target.split(' ').filter((word) => candidate.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });
  return best;
};

const buildCacheKey = (payload: any) => {
  if (!payload) return null;
  return payload.overviewUrl || payload.url || `${payload.site || 'site'}:${payload.identifier || payload.title}`;
};
const resolveDetected = async () => {
  const payload = detectedTab.value;
  if (!payload) {
    detectedTitle.value = '';
    detectedMedia.value = null;
    detectedImage.value = '';
    detectedTotal.value = null;
    detectedProgress.value = 0;
    detectedStatus.value = 'watching';
    detectedError.value = '';
    detectedMatchNote.value = '';
    return;
  }

  detectedLoading.value = true;
  detectedError.value = '';
  detectedMatchNote.value = '';
  detectedTitle.value = cleanupTitle(payload.title || '') || payload.title || 'Unknown title';
  detectedImage.value = payload.image || '';
  detectedProgress.value = clampValue(payload.episode || 0, null);
  detectedStatus.value = 'watching';
  detectedMedia.value = null;

  const cacheKey = buildCacheKey(payload);
  let media = null;
  if (cacheKey) {
    const cachedId = await getCachedMatch(cacheKey);
    if (cachedId) {
      try {
        media = await fetchMediaById(cachedId);
        detectedMatchNote.value = 'Matched from cache';
      } catch (error) {
        media = null;
      }
    }
  }

  if (!media) {
    try {
      const results = await searchAniList(detectedTitle.value);
      media = pickBestMatch(results, detectedTitle.value);
      if (media && cacheKey) {
        await cacheMatch(cacheKey, media.id);
        detectedMatchNote.value = 'Matched by search';
      }
    } catch (error: any) {
      detectedError.value = error?.message || 'AniList lookup failed.';
    }
  }

  if (media) {
    detectedMedia.value = media;
    detectedImage.value = media.coverImage?.large || detectedImage.value;
    detectedTotal.value = resolveMediaTotal(media, media.type || 'ANIME');
    if (session.value) {
      try {
        const entry = await fetchEntry(media.id);
        if (entry) {
          detectedStatus.value = entry.status;
          detectedProgress.value = clampValue(entry.progress || 0, detectedTotal.value);
        }
      } catch (error) {
        detectedError.value = '';
      }
    }
  } else if (!detectedError.value) {
    detectedError.value = 'No match found yet.';
  }

  detectedLoading.value = false;
};

const saveDetected = async () => {
  if (!session.value || !detectedMedia.value) return;
  savePending.value = true;
  try {
    await upsertEntry({
      user_id: session.value.user.id,
      media_id: detectedMedia.value.id,
      media_type: detectedMedia.value.type || 'ANIME',
      status: detectedStatus.value as any,
      progress: clampValue(detectedProgress.value, detectedTotal.value),
    });
    await loadDashboard();
  } catch (error) {
    detectedError.value = 'Could not save entry.';
  } finally {
    savePending.value = false;
  }
};

const loadDashboard = async () => {
  if (!session.value) return;
  dashboardLoading.value = true;
  try {
    const entries = await fetchEntries({ limit: 200, orderBy: 'updated_at', orderDir: 'desc' });
    const lastUpdate = lastAutoUpdate.value;
    const entriesWithOverrides = entries.map((entry: any) => {
      if (!lastUpdate?.mediaId || entry.media_id !== lastUpdate.mediaId) return entry;
      const progressOverride =
        typeof lastUpdate.episode === 'number'
          ? Math.max(entry.progress || 0, lastUpdate.episode)
          : entry.progress;
      const updatedOverride = lastUpdate.at || entry.updated_at || entry.created_at;
      return {
        ...entry,
        progress: progressOverride,
        updated_at: updatedOverride,
      };
    });

    if (lastUpdate?.mediaId && !entriesWithOverrides.some((entry: any) => entry.media_id === lastUpdate.mediaId)) {
      entriesWithOverrides.push({
        media_id: lastUpdate.mediaId,
        media_type: 'ANIME',
        status: 'watching',
        progress: lastUpdate.episode || 0,
        updated_at: lastUpdate.at,
        created_at: lastUpdate.at,
      });
    }

    const totalEpisodes = entriesWithOverrides.reduce((sum, entry: any) => sum + (entry.progress || 0), 0);
    const completed = entriesWithOverrides.filter((entry: any) => entry.status === 'completed').length;
    stats.value = {
      timeWatched: `${Math.round((totalEpisodes * 24) / 60)}h`,
      completed,
      streak: computeStreak(entriesWithOverrides),
      episodes: totalEpisodes,
    };

    const getEntryTime = (entry: any) => {
      const value = entry.updated_at || entry.created_at || 0;
      if (!value) return 0;
      return typeof value === 'number' ? value : new Date(value).getTime();
    };

    const sortedEntries = [...entriesWithOverrides].sort((a, b) => getEntryTime(b) - getEntryTime(a));

    const watching = sortedEntries
      .filter((entry) => ['watching', 'rewatching'].includes(entry.status))
      .slice(0, 6);
    const mediaItems = await Promise.all(
      watching.map(async (entry) => {
        const media = await getMediaInfo(entry.media_id);
        const total = resolveMediaTotal(media, entry.media_type || media?.type || 'ANIME');
        return {
          mediaId: entry.media_id,
          title: media?.title?.english || media?.title?.romaji || `ID ${entry.media_id}`,
          image: media?.coverImage?.large || placeholder,
          progress: entry.progress || 0,
          total,
          status: entry.status,
          mediaType: entry.media_type || 'ANIME',
        } as WatchingItem;
      }),
    );
    watchingItems.value = mediaItems;

    const recentEntries = sortedEntries.slice(0, 6);
    const recentMediaItems = await Promise.all(
      recentEntries.map(async (entry) => {
        const media = await getMediaInfo(entry.media_id);
        const updatedValue = entry.updated_at || entry.created_at || '';
        const total = resolveMediaTotal(media, entry.media_type || media?.type || 'ANIME');
        const progress = entry.progress || 0;
        return {
          mediaId: entry.media_id,
          title: media?.title?.english || media?.title?.romaji || `ID ${entry.media_id}`,
          image: media?.coverImage?.large || placeholder,
          progress,
          total,
          status: entry.status,
          mediaType: entry.media_type || 'ANIME',
          updatedAt: updatedValue,
          progressPercent: computeProgressPercent(progress, total),
        } as HistoryItem;
      }),
    );
    recentItems.value = recentMediaItems;
  } catch (error) {
    watchingItems.value = [];
    recentItems.value = [];
  } finally {
    dashboardLoading.value = false;
  }
};

const incrementWatching = async (item: WatchingItem) => {
  if (!session.value) return;
  const nextProgress = clampValue(item.progress + 1, item.total);
  const prevProgress = item.progress;
  item.progress = nextProgress;
  try {
    await upsertEntry({
      user_id: session.value.user.id,
      media_id: item.mediaId,
      media_type: item.mediaType,
      status: item.status as any,
      progress: nextProgress,
    });
    stats.value.episodes = stats.value.episodes + 1;
  } catch (error) {
    item.progress = prevProgress;
  }
};

const computeStreak = (entries: any[]) => {
  if (!entries?.length) return 0;
  const dates = new Set<string>();
  entries.forEach((entry) => {
    const value = entry.updated_at || entry.created_at;
    if (!value) return;
    const dateKey = new Date(value).toISOString().slice(0, 10);
    dates.add(dateKey);
  });
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const applyAutoUpdate = async (update: LastAutoUpdate | null) => {
  if (!update?.mediaId) return;
  const media = await getMediaInfo(update.mediaId);
  const mediaType = (media?.type || 'ANIME') as 'ANIME' | 'MANGA';
  const total = resolveMediaTotal(media, mediaType);
  const progress = update.episode || 0;
  const nextItem: HistoryItem = {
    mediaId: update.mediaId,
    title: media?.title?.english || media?.title?.romaji || update.title || `ID ${update.mediaId}`,
    image: media?.coverImage?.large || placeholder,
    progress,
    total,
    status: 'watching',
    mediaType,
    updatedAt: update.at,
    progressPercent: computeProgressPercent(progress, total),
  };
  const nextList = [nextItem, ...recentItems.value.filter(item => item.mediaId !== update.mediaId)];
  recentItems.value = nextList.slice(0, 6);
};

onMounted(async () => {
  await loadSession();
  await loadSettings();
  await loadLastAutoUpdate();
  if (session.value) {
    await loadDashboard();
  }
  await resolveDetected();

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes.hikariLastAutoUpdate) {
        lastAutoUpdate.value = changes.hikariLastAutoUpdate.newValue || null;
        loadSession().then(() => {
          if (session.value) {
            loadDashboard();
            resolveDetected();
          }
        });
      }
    });
  }

  nowTimer = window.setInterval(() => {
    nowTick.value = Date.now();
  }, 60 * 1000);

  refreshTimer = window.setInterval(() => {
    loadSession().then(() => {
      loadLastAutoUpdate();
      if (session.value) {
        loadDashboard();
        resolveDetected();
      } else {
        watchingItems.value = [];
        recentItems.value = [];
      }
    });
  }, 30 * 1000);
});

onBeforeUnmount(() => {
  if (nowTimer) window.clearInterval(nowTimer);
  if (refreshTimer) window.clearInterval(refreshTimer);
});

watch(detectedTab, () => {
  resolveDetected();
});

watch(session, (value) => {
  if (!value) {
    watchingItems.value = [];
    recentItems.value = [];
    authStep.value = 'onboarding';
    return;
  }
  loadDashboard();
  resolveDetected();
});

watch(lastAutoUpdate, (value) => {
  applyAutoUpdate(value);
});
</script>

<style lang="less" scoped>
.hikari-shell {
  min-height: 100%;
  width: 100%;
  background: transparent;
  color: #ffffff;
  font-family: "Space Grotesk", "Segoe UI", sans-serif;
  border-radius: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0;
}

.hikari-shell.is-auth {
  padding: 0;
  background: transparent;
  border-radius: 0;
  overflow: visible;
}

.hikari-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  color: #a3a3a3;
}

.hikari-auth {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.hikari-auth-inner {
  width: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hikari-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hikari-logo {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f97316, #ea580c);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #ffffff;
}

.hikari-title {
  font-weight: 600;
  font-size: 16px;
}

.hikari-subtitle {
  color: #737373;
  font-size: 12px;
}

.hikari-auth-card {
  background: #0f0f0f;
  border: 1px solid #1f1f1f;
  border-radius: 24px;
  padding: 22px;
  box-shadow: none;
  min-height: auto;
  width: 100%;
}

.hikari-auth-card h2 {
  font-size: 18px;
  margin: 0 0 6px;
}

.hikari-auth-card p {
  color: #737373;
  margin: 0 0 18px;
  font-size: 13px;
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.onboarding-card {
  text-align: center;
}

.onboarding-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: linear-gradient(135deg, #f97316, #ea580c);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: #ffffff;
}

.onboarding-feature {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: #171717;
  border: 1px solid #262626;
  text-align: left;
  margin: 12px 0;
}

.feature-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.feature-orange {
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
}

.feature-green {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.feature-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
}

.feature-sub {
  font-size: 12px;
  color: #737373;
  line-height: 1.4;
}

.onboarding-cta {
  width: 100%;
  margin-top: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.quicklinks-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quicklinks-header-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quicklinks-title {
  font-size: 16px;
  font-weight: 600;
}

.quicklinks-sub {
  font-size: 12px;
  color: #737373;
}

.quicklinks-scroll {
  max-height: 340px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.site-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quicklinks-count {
  text-align: center;
  font-size: 11px;
  color: #737373;
  margin-top: -6px;
}

.back-btn,
.ghost-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a3a3a3;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.ghost-btn {
  margin-top: 12px;
}

.hikari-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.hikari-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #a3a3a3;
}

.hikari-form input {
  background: #141414;
  border: 1px solid #262626;
  border-radius: 14px;
  padding: 10px 12px;
  color: #ffffff;
}

.hikari-primary {
  background: #f97316;
  color: #0a0a0a;
  border: none;
  border-radius: 14px;
  padding: 12px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.hikari-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hikari-secondary {
  background: transparent;
  color: #ffffff;
  border: 1px solid #262626;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
}

.hikari-error {
  color: #f87171;
  font-size: 12px;
  margin-top: 10px;
}

.hikari-app {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: #141414;
  border-radius: 22px;
  border: 1px solid #1f1f1f;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  width: calc(100% - 24px);
  max-width: 420px;
  margin: 12px auto;
}

.hikari-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #262626;
  background: #141414;
}

.hikari-nav {
  display: flex;
  gap: 8px;
}

.hikari-nav-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #737373;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hikari-nav-btn.active {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.hikari-main {
  flex: 1;
  overflow-y: auto;
}

.hikari-view {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hikari-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  background: #1a1a1a;
  border-radius: 14px;
  padding: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon span {
  font-size: 18px;
}

.stat-blue {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.stat-green {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.stat-orange {
  background: rgba(249, 115, 22, 0.2);
  color: #f97316;
}

.stat-pink {
  background: rgba(236, 72, 153, 0.2);
  color: #f472b6;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
}

.stat-label {
  font-size: 11px;
  color: #737373;
}

.hikari-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

.section-title span {
  color: #f97316;
}

.link-btn {
  background: transparent;
  border: none;
  color: #f97316;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.watching-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.watching-card {
  background: #1a1a1a;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  gap: 12px;
  align-items: center;
}

.watching-card img {
  width: 46px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
}

.watching-meta {
  flex: 1;
}

.watching-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.watching-progress {
  font-size: 11px;
  color: #737373;
}

.watching-time {
  font-size: 10px;
  color: #8a8a8a;
  margin-top: 4px;
}

.watching-bar {
  margin-top: 8px;
  height: 8px;
  background: #262626;
  border-radius: 999px;
  overflow: hidden;
}

.watching-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #f97316, #fb923c);
  box-shadow: 0 0 8px rgba(249, 115, 22, 0.4);
  width: 0%;
  transition: width 0.3s ease;
}

.watching-add {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  background: #f97316;
  color: #0a0a0a;
  font-weight: 700;
  cursor: pointer;
}

.hikari-muted {
  font-size: 12px;
  color: #737373;
}

.hikari-note {
  margin-top: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(249, 115, 22, 0.1);
  border: 1px solid rgba(249, 115, 22, 0.2);
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.note-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #34d399;
  margin-top: 4px;
}

.note-title {
  font-size: 12px;
  color: #34d399;
}

.note-sub {
  font-size: 11px;
  color: #737373;
}

.hikari-detected-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(249, 115, 22, 0.1);
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12px;
  color: #f97316;
}

.detected-card {
  background: #1a1a1a;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid #262626;
}

.detected-hero {
  position: relative;
  height: 90px;
}

.detected-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.4;
}

.detected-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent, #1a1a1a);
}

.detected-body {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin-top: -32px;
}

.detected-cover {
  width: 56px;
  height: 82px;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid #0a0a0a;
}

.detected-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detected-info {
  flex: 1;
  padding-top: 18px;
}

.detected-title {
  font-size: 14px;
  font-weight: 600;
}

.detected-sub {
  font-size: 11px;
  color: #737373;
  margin-top: 4px;
}

.detected-match {
  font-size: 11px;
  color: #f97316;
  margin-top: 6px;
}

.detected-actions {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.status-dropdown {
  position: relative;
}

.status-trigger {
  width: 100%;
  border: 1px solid #262626;
  border-radius: 10px;
  padding: 10px 12px;
  background: #141414;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  background: #1a1a1a;
  border: 1px solid #262626;
  border-radius: 10px;
  overflow: hidden;
  z-index: 10;
}

.status-menu button {
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  color: #ffffff;
  text-align: left;
  cursor: pointer;
}

.status-menu button.active {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.progress-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #737373;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: #262626;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.progress-btn.primary {
  background: #f97316;
  color: #0a0a0a;
}

.progress-row input {
  flex: 1;
  background: #141414;
  border: 1px solid #262626;
  border-radius: 10px;
  padding: 8px;
  color: #ffffff;
  text-align: center;
}

.progress-bar {
  height: 6px;
  background: #262626;
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar span {
  display: block;
  height: 100%;
  background: #f97316;
  width: 0%;
}

.detected-buttons {
  display: flex;
  gap: 10px;
}

.detected-buttons button {
  flex: 1;
}
.hikari-settings h3 {
  margin: 0 0 12px;
  font-size: 14px;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.setting-title {
  font-size: 13px;
  font-weight: 600;
}

.setting-sub {
  font-size: 11px;
  color: #737373;
}

.toggle {
  width: 40px;
  height: 22px;
  background: #262626;
  border-radius: 999px;
  border: none;
  position: relative;
  cursor: pointer;
}

.toggle span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #ffffff;
  transition: transform 0.2s ease;
}

.toggle.on {
  background: #f97316;
}

.toggle.on span {
  transform: translateX(18px);
}

.quicklinks-row {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #262626;
  background: #141414;
  cursor: pointer;
  color: #ffffff;
}

.quicklinks-icon {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: rgba(249, 115, 22, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f97316;
}

.settings-advanced {
  margin-top: 16px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #262626;
  background: #141414;
}

.advanced-list {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.advanced-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #262626;
  background: #0f0f0f;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
}

.advanced-link span.material-icons {
  font-size: 16px;
  color: #f97316;
}

.profile-row {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #262626;
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f97316, #ea580c);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.profile-info {
  flex: 1;
}

.quicklinks-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quicklinks-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-title {
  font-size: 11px;
  color: #737373;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.site-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #262626;
  background: #141414;
  color: #ffffff;
  cursor: pointer;
  position: relative;
}

.site-row.active {
  border-color: #f97316;
}

.site-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #ffffff;
  font-size: 11px;
}

.check-icon {
  margin-left: auto;
  color: #f97316;
  opacity: 0;
}

.site-row.active .check-icon {
  opacity: 1;
}

.quicklinks-save {
  margin-top: 12px;
}
</style>
