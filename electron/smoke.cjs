const fs = require('node:fs/promises');
const path = require('node:path');
const { safelyCallWindowMethod } = require('./windowUtils.cjs');

async function captureFirstScreenSmoke({ app, appProtocol, window }) {
  const screenshotPath = process.env.MAPPIC_FIRST_SCREEN_SMOKE_SCREENSHOT;
  const metricsPath = process.env.MAPPIC_FIRST_SCREEN_SMOKE_METRICS;
  const startedAt = Date.now();

  if (!screenshotPath || !metricsPath) {
    throw new Error('Missing first-screen smoke output paths');
  }

  await waitForSmokeApp(window);
  safelyCallWindowMethod(window, 'show');
  safelyCallWindowMethod(window, 'focus');
  await delay(800);

  const pageMetrics = await collectSmokePageMetrics(window);
  const image = await window.webContents.capturePage();
  const screenshotBytes = image.toPNG();
  const screenshotSize = image.getSize();
  const pixelMetrics = sampleSmokePixels(image);

  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  await fs.writeFile(screenshotPath, screenshotBytes);
  await fs.writeFile(
    metricsPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targetUrl: `${appProtocol}://app/#/home`,
        elapsedMs: Date.now() - startedAt,
        screenshotBytes: screenshotBytes.length,
        screenshotSize,
        ...pixelMetrics,
        ...pageMetrics,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  app.exit(0);
}

async function captureFpsSmoke({ app, appProtocol, window }) {
  const metricsPath = process.env.MAPPIC_FPS_SMOKE_METRICS;
  const startedAt = Date.now();

  if (!metricsPath) {
    throw new Error('Missing FPS smoke metrics path');
  }

  await waitForSmokeApp(window);
  safelyCallWindowMethod(window, 'show');
  safelyCallWindowMethod(window, 'focus');
  await delay(800);

  const metrics = await collectFpsSmokeMetrics(window);

  await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  await fs.writeFile(
    metricsPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targetUrl: `${appProtocol}://app/#/home`,
        elapsedMs: Date.now() - startedAt,
        ...metrics,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  app.exit(0);
}

async function waitForSmokeApp(window) {
  const startedAt = Date.now();
  const timeoutMs = 10000;

  while (Date.now() - startedAt < timeoutMs) {
    const mounted = await window.webContents
      .executeJavaScript(`
        Boolean(
          document.readyState !== 'loading' &&
          document.querySelector('#app') &&
          document.querySelector('#app').children.length > 0
        )
      `)
      .catch(() => false);

    if (mounted) {
      return;
    }

    await delay(100);
  }

  throw new Error('Timed out waiting for first-screen app mount');
}

function collectSmokePageMetrics(window) {
  return window.webContents.executeJavaScript(`
    (() => {
      const appEl = document.querySelector('#app')
      const appRect = appEl?.getBoundingClientRect()
      const navigation = performance.getEntriesByType('navigation')[0]
      const text = (document.body.innerText || '').trim()

      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        textLength: text.length,
        textSample: text.slice(0, 240),
        appChildCount: appEl?.children.length || 0,
        appRect: appRect
          ? {
              width: Math.round(appRect.width),
              height: Math.round(appRect.height)
            }
          : null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        documentHeight: document.documentElement.scrollHeight,
        navigation: navigation
          ? {
              domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
              loadEventMs: Math.round(navigation.loadEventEnd),
              transferSize: navigation.transferSize
            }
          : null
      }
    })()
  `);
}

function collectFpsSmokeMetrics(window) {
  return window.webContents.executeJavaScript(`
    (async () => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const text = (document.body.innerText || '').trim()

      function sampleFrames(durationMs = 1200) {
        return new Promise((resolve) => {
          const startedAt = performance.now()
          let frames = 0
          let lastFrameAt = 0
          let maxFrameDeltaMs = 0
          let longFrames = 0

          function tick(now) {
            frames += 1

            if (lastFrameAt) {
              const delta = now - lastFrameAt
              maxFrameDeltaMs = Math.max(maxFrameDeltaMs, delta)

              if (delta > 50) {
                longFrames += 1
              }
            }

            lastFrameAt = now

            if (now - startedAt >= durationMs) {
              const actualDurationMs = now - startedAt

              resolve({
                frames,
                durationMs: Math.round(actualDurationMs),
                fps: Number(((frames * 1000) / actualDurationMs).toFixed(1)),
                maxFrameDeltaMs: Number(maxFrameDeltaMs.toFixed(1)),
                longFrames
              })
              return
            }

            requestAnimationFrame(tick)
          }

          requestAnimationFrame(tick)
        })
      }

      async function sampleScroller(selector, label) {
        const scroller = document.querySelector(selector)
        const result = {
          label,
          selector,
          found: Boolean(scroller),
          childCount: scroller?.children?.length || 0,
          hydratedCount: scroller
            ? Array.from(scroller.children).filter((child) => (
                !child.classList.contains('soda-slide--light') &&
                !child.classList.contains('soda-mv-slide--light')
              )).length
            : 0,
          clientHeight: scroller?.clientHeight || 0,
          scrollHeight: scroller?.scrollHeight || 0,
          idle: null,
          scroll: null,
          recovery: null
        }

        if (!scroller) {
          return result
        }

        scroller.focus?.()
        result.idle = await sampleFrames(1200)

        const scrollDistance = scroller.clientHeight || 0

        if (scrollDistance > 0 && scroller.scrollHeight > scroller.clientHeight) {
          scroller.scrollTo({
            top: Math.min(scroller.scrollTop + scrollDistance, scroller.scrollHeight - scroller.clientHeight),
            behavior: 'smooth'
          })
        }

        result.scroll = await sampleFrames(1800)

        if (scrollDistance > 0) {
          scroller.scrollTo({ top: 0, behavior: 'auto' })
        }

        await delay(400)
        result.recovery = await sampleFrames(1000)

        return result
      }

      const music = await sampleScroller('.soda-feed__scroller', 'home-music')
      const videoTab = Array.from(document.querySelectorAll('.soda-feed__tabs button'))
        .find((button) => /视频/.test(button.textContent || ''))

      if (videoTab) {
        videoTab.click()
        await delay(1000)
      }

      const video = await sampleScroller('.soda-video-feed__scroller', 'home-video')

      return {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        textLength: text.length,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        music,
        video
      }
    })()
  `);
}

function sampleSmokePixels(image) {
  const { width, height } = image.getSize();
  const bitmap = image.toBitmap();
  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(totalPixels / 20000));
  let sampled = 0;
  let nonWhite = 0;
  let varied = 0;

  for (let pixel = 0; pixel < totalPixels; pixel += step) {
    const offset = pixel * 4;
    const blue = bitmap[offset];
    const green = bitmap[offset + 1];
    const red = bitmap[offset + 2];
    const alpha = bitmap[offset + 3];

    if (alpha < 10) {
      continue;
    }

    sampled += 1;

    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);

    if (max < 245 || min < 245) {
      nonWhite += 1;
    }

    if (max - min > 8) {
      varied += 1;
    }
  }

  return {
    sampledPixels: sampled,
    nonWhiteRatio: sampled ? Number((nonWhite / sampled).toFixed(4)) : 0,
    variedColorRatio: sampled ? Number((varied / sampled).toFixed(4)) : 0,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  captureFirstScreenSmoke,
  captureFpsSmoke,
};
