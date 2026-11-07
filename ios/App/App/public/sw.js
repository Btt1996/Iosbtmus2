/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "version.json",
    "revision": "5f741b10afcf7f1f1fcb737a492e553c"
  }, {
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "74cda71813273f348597ca714bfa8466"
  }, {
    "url": "pwa-512x512.png",
    "revision": "74cda71813273f348597ca714bfa8466"
  }, {
    "url": "pwa-192x192.png",
    "revision": "4ab0e70a479e4f0c4233a16ae4f0b4c1"
  }, {
    "url": "index.html",
    "revision": "585c82cea7fe6508741e459b98aaab81"
  }, {
    "url": "icon.svg",
    "revision": "6f06049f10ca690e1f85d881d956e47f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "475ed7a2646fcfed4daca4874f98e8fd"
  }, {
    "url": "app-logo.png",
    "revision": "74cda71813273f348597ca714bfa8466"
  }, {
    "url": "app-logo.jpeg",
    "revision": "2a97cd3a577a562f44683ece26809936"
  }, {
    "url": "assets/x2Engine-D6rGokwJ.js",
    "revision": null
  }, {
    "url": "assets/x1Spotify-DPUkPyBD.js",
    "revision": null
  }, {
    "url": "assets/web-DcEbE63m.js",
    "revision": null
  }, {
    "url": "assets/vendor-motion-C5Z3obA2.js",
    "revision": null
  }, {
    "url": "assets/vendor-icons-C6RbhaoL.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-BWaJ3C7D.js",
    "revision": null
  }, {
    "url": "assets/index-DJknvYvn.css",
    "revision": null
  }, {
    "url": "assets/index-C6DrOt14.js",
    "revision": null
  }, {
    "url": "assets/definitions-C1UMrbAL.js",
    "revision": null
  }, {
    "url": "assets/db-TyPbOD66.js",
    "revision": null
  }, {
    "url": "assets/X2BenchmarkModal-gTEIeCAY.js",
    "revision": null
  }, {
    "url": "assets/TelegramDiscoveryModal-BKXqetKz.js",
    "revision": null
  }, {
    "url": "assets/SyncScreen-BU37PjZF.js",
    "revision": null
  }, {
    "url": "assets/SettingsScreen-DWgHcgyE.js",
    "revision": null
  }, {
    "url": "assets/SearchScreen-z0F7ZC7t.js",
    "revision": null
  }, {
    "url": "assets/PlaylistsScreen-W9HwKVh8.js",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_2186_2fa71473.png",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_2066_a9343c53.jpeg",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_2062_50539de2.jpeg",
    "revision": null
  }, {
    "url": "assets/aistudio/10AE0B21-3C8A-4A49-8198-9C9C16A8CCC7_4116fe22.png",
    "revision": null
  }, {
    "url": "app-logo.jpeg",
    "revision": "2a97cd3a577a562f44683ece26809936"
  }, {
    "url": "app-logo.png",
    "revision": "74cda71813273f348597ca714bfa8466"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "475ed7a2646fcfed4daca4874f98e8fd"
  }, {
    "url": "icon.svg",
    "revision": "6f06049f10ca690e1f85d881d956e47f"
  }, {
    "url": "pwa-192x192.png",
    "revision": "4ab0e70a479e4f0c4233a16ae4f0b4c1"
  }, {
    "url": "pwa-512x512.png",
    "revision": "74cda71813273f348597ca714bfa8466"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "74cda71813273f348597ca714bfa8466"
  }, {
    "url": "version.json",
    "revision": "5f741b10afcf7f1f1fcb737a492e553c"
  }, {
    "url": "manifest.webmanifest",
    "revision": "304d509c1f1bda8e032da6885f7a038e"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
