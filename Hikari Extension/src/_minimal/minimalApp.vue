<template>
  <Theming />
  <MediaModal v-if="!isPopup && route.name !== 'Hikari'" />
  <SettingsPermissionOverviewSmall v-if="!isPopup && isExtension() && route.name !== 'Hikari'" />
  <NavBar
    v-if="!isPopup && rootHtml.getAttribute('mode') !== 'install' && route.name !== 'Hikari'"
  />
  <div
    class="content"
    :class="{ 'content--hikari': route.name === 'Hikari' }"
    v-show="!isPopup || route.name === 'Hikari'"
  >
    <router-view v-slot="{ Component, route }">
      <transition
        :name="(route.meta.transition as string) || 'fade'"
        :duration="(route.meta.duration as number) || 0"
      >
        <keep-alive max="5" :exclude="['overview']">
          <component
            :is="Component"
            v-bind="route.params"
            :key="route.meta.key ? route.path : undefined"
          />
        </keep-alive>
      </transition>
    </router-view>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Theming from './components/theming.vue';
import NavBar from './components/nav/nav-bar.vue';
import MediaModal from './components/media/media-modal.vue';
import SettingsPermissionOverviewSmall from './components/settings/settings-permission-overview-small.vue';

const breakpoint = ref('desktop' as 'desktop' | 'mobile');

const rootWindow = inject('rootWindow') as Window;
const rootHtml = inject('rootHtml') as HTMLElement;
const rootBody = inject('rootBody') as HTMLElement;
const route = useRoute();
const routerInstance = useRouter();
const rootApp = ref<HTMLElement | null>(null);
const isPopup = computed(() => rootHtml.getAttribute('mode') === 'popup');
const defaultHtmlBackground = ref('');
const defaultBodyBackground = ref('');
const defaultHtmlRadius = ref('');
const defaultHasBackImage = ref(false);
const defaultAppBackground = ref('');
const defaultAppMaxWidth = ref('');
const defaultAppMarginLeft = ref('');
const defaultAppMarginRight = ref('');
const defaultAppWidth = ref('');

const applyHikariBackground = () => {
  const app = rootApp.value;
  if (isPopup.value || route.name === 'Hikari') {
    rootHtml.classList.add('hikari-mode');
    rootHtml.classList.remove('backImage');
    rootHtml.style.background = '#0f1133';
    rootHtml.style.backgroundImage = 'none';
    rootBody.style.background = '#0f1133';
    rootHtml.style.borderRadius = '0';
    rootHtml.style.setProperty('--cl-backdrop', 'transparent');
    rootHtml.style.setProperty('--cl-background', 'transparent');
    rootHtml.style.setProperty('--cl-opacity', '1');
    if (app) {
      app.style.background = 'transparent';
      app.style.maxWidth = 'none';
      app.style.marginLeft = '0';
      app.style.marginRight = '0';
      app.style.width = '100%';
    }
    return;
  }
  rootHtml.classList.remove('hikari-mode');
  rootHtml.style.background = defaultHtmlBackground.value;
  rootBody.style.background = defaultBodyBackground.value;
  rootHtml.style.borderRadius = defaultHtmlRadius.value;
  if (defaultHasBackImage.value) {
    rootHtml.classList.add('backImage');
  } else {
    rootHtml.classList.remove('backImage');
  }
  rootHtml.style.backgroundImage = '';
  rootHtml.style.removeProperty('--cl-backdrop');
  rootHtml.style.removeProperty('--cl-background');
  rootHtml.style.removeProperty('--cl-opacity');
  if (app) {
    app.style.background = defaultAppBackground.value;
    app.style.maxWidth = defaultAppMaxWidth.value;
    app.style.marginLeft = defaultAppMarginLeft.value;
    app.style.marginRight = defaultAppMarginRight.value;
    app.style.width = defaultAppWidth.value;
  }
};

function setBreakpoint() {
  if (Math.min(rootWindow.innerWidth, rootWindow.screen.width) < 900) {
    breakpoint.value = 'mobile';
  } else {
    breakpoint.value = 'desktop';
  }
}
setBreakpoint();

function isExtension() {
  return api.type === 'webextension';
}

onMounted(() => {
  rootWindow.addEventListener('resize', setBreakpoint);
  defaultHtmlBackground.value = rootHtml.style.background || '';
  defaultBodyBackground.value = rootBody.style.background || '';
  defaultHtmlRadius.value = rootHtml.style.borderRadius || '';
  defaultHasBackImage.value = rootHtml.classList.contains('backImage');
  rootApp.value = rootBody.querySelector('#minimalApp') as HTMLElement | null;
  if (rootApp.value) {
    defaultAppBackground.value = rootApp.value.style.background || '';
    defaultAppMaxWidth.value = rootApp.value.style.maxWidth || '';
    defaultAppMarginLeft.value = rootApp.value.style.marginLeft || '';
    defaultAppMarginRight.value = rootApp.value.style.marginRight || '';
    defaultAppWidth.value = rootApp.value.style.width || '';
  }
  nextTick(() => {
    const width = Math.min(rootWindow.innerWidth, rootWindow.screen.width);
    if (['popup', 'settings'].includes(rootHtml.getAttribute('mode')!) && width !== 550) {
      rootHtml.style.minWidth = `${width}px`;
      // rootHtml.style.maxWidth = `${rootWindow.innerWidth}px`;
      rootHtml.style.width = 'auto';
      rootBody.style.width = 'auto';
    }
    if (rootHtml.getAttribute('mode') === 'popup' && route.name !== 'Hikari') {
      routerInstance.replace({ name: 'Hikari' });
    }
    applyHikariBackground();
  });
});

onUnmounted(() => {
  rootWindow.removeEventListener('resize', setBreakpoint);
});

watch(
  () => route.name,
  () => {
    applyHikariBackground();
    if (rootHtml.getAttribute('mode') === 'popup' && route.name !== 'Hikari') {
      routerInstance.replace({ name: 'Hikari' });
    }
  },
);

provide('breakpoint', breakpoint);
</script>

<style lang="less">
@import './less/_main.less';
</style>

<style lang="less" scoped>
@import './less/_globals.less';
.content {
  padding: 0 @spacer;
  overflow: auto;
  overflow-x: hidden;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding-top: @spacer;
}

.content--hikari {
  padding: 0;
  overflow: hidden;
}
</style>
