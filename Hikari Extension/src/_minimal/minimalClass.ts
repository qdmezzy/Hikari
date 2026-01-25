import { ref } from 'vue';
import { createApp } from '../utils/Vue';
import minimalApp from './minimalApp.vue';
import { status } from '../_provider/definitions';
import { router } from './router';
import { Progress } from '../utils/progress';

export class Minimal {
  private minimalVue;

  private fillState = ref(null);

  constructor(
    public minimal,
    closeFunction = () => window.close(),
    fullscreenFunction: null | Function = null,
  ) {
    if (document.body.hasAttribute('hash')) {
      document.location.hash = document.body.getAttribute('hash')!;
    }
    this.minimal.find('body').append(j.html('<div id="minimalApp"></div>'));
    this.minimalVue = createApp(minimalApp, this.minimal.find('#minimalApp').get(0), {
      use: vue => {
        vue.use(router());
        vue.provide('fill', this.fillState);
        vue.provide('closeFunction', closeFunction);
        vue.provide('fullscreenFunction', fullscreenFunction);
        vue.provide('rootHtml', this.minimal.get(0));
        vue.provide('rootBody', this.minimal.get(0).ownerDocument.body);
        vue.provide('rootDocument', this.minimal.get(0).ownerDocument);
        vue.provide('rootWindow', this.minimal.get(0).ownerDocument.defaultView);
      },
    });

    const mode = this.minimal.get(0).getAttribute('mode');
    if (mode === 'popup') {
      if (document.location.hash && document.location.hash !== '#/hikari') {
        document.location.hash = '#/hikari';
      }
      router().replace({ name: 'Hikari' });
    }
  }

  fill(data, home: boolean) {
    if (home) {
      router().push({ name: 'Hikari' });
    }
    this.fillState.value = data;
  }
}

export type bookmarkItem = {
  title: string;
  type: 'anime' | 'manga';
  url: string;
  image: string;
  imageLarge: string;
  imageBanner?: string;
  status: status;
  score?: any;
  watchedEp: number;
  totalEp: number;
  streamUrl?: string;
  streamIcon?: string;
  progressEp?: number;
  progressText?: string;
  progress?: Progress;
};
