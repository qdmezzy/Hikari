import { createRouter, createWebHashHistory, Router, RouteRecordRaw } from 'vue-router';
import { getUrlObj, setUrlObj } from './utils/state';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: () => {
      return '/hikari';
    },
  },
  {
    path: '/hikari',
    name: 'Hikari',
    component: () => import('./views/hikari.vue'),
  },
  {
    path: '/book/:type/:state',
    name: 'Bookmarks',
    component: () => import('./views/bookmarks.vue'),
    props: {
      type: String,
      state: Number,
    },
  },
  {
    path: '/:type/:slug',
    name: 'Overview',
    component: () => import('./views/overview.vue'),
    meta: {
      key: true,
    },
  },
  {
    path: '/settings/:path*',
    name: 'Settings',
    component: () => import('./views/settings.vue'),
  },
  {
    path: '/search',
    redirect: '/search/anime',
  },
  {
    path: '/search/:type',
    name: 'Search',
    component: () => import('./views/search.vue'),
    props: {
      type: String,
    },
  },
  {
    path: '/install',
    redirect: '/hikari',
  },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('./views/notFound.vue') },
];

let scrollUntilDebounce;
const scrollUntilTrue = (scrollPosition: number) => {
  let count = 0;
  scrollUntilDebounce = setInterval(() => {
    count++;
    if (count > 50 || scrollPosition - 50 < window.scrollY) {
      clearInterval(scrollUntilDebounce);
    } else {
      $(window).scrollTop(scrollPosition);
    }
  }, 100);
};

let tempRouter: Router | null = null;

export function router() {
  if (!tempRouter) {
    tempRouter = createRouter({
      history: createWebHashHistory(),
      routes,
      scrollBehavior(to, from, savedPosition) {
        clearInterval(scrollUntilDebounce);
        if (savedPosition) {
          if (to.name === 'Bookmarks' && savedPosition.top) {
            scrollUntilTrue(savedPosition.top);
          }
          return savedPosition;
        }
        return { top: 0 };
      },
    });

    tempRouter.beforeEach((to, from, next) => {
      const mode = document.documentElement.getAttribute('mode');
      const popupAllowed = new Set(['Hikari', 'Settings']);
      if (mode === 'popup' && !popupAllowed.has(String(to.name))) {
        next({ name: 'Hikari' });
        return;
      }
      next();
    });

    tempRouter.afterEach((to, from, failure) => {
      if (!failure && to.name !== 'Install') setUrlObj(to.fullPath);
    });
  }
  return tempRouter;
}
