<template>
  <div class="view home-view home-boot-skeleton">
    <nav
      class="soda-feed__tabs"
      aria-label="&#39318;&#39029;&#20998;&#31867;"
      style="--active-tab-index: 0"
    >
      <button type="button" class="active">&#38899;&#20048;</button>
      <button type="button">&#35270;&#39057;</button>
    </nav>
    <section class="soda-feed">
      <div class="soda-feed__scroller">
        <article class="soda-slide home-boot-slide">
          <div class="soda-slide__backdrop" aria-hidden="true">
            <span class="soda-slide__fallback cover--boot" />
          </div>
          <div class="soda-slide__player">
            <div class="soda-slide__visual" aria-hidden="true">
              <span class="soda-slide__disc" />
              <span class="soda-slide__cover" />
            </div>
            <section class="soda-slide__caption">
              <div class="soda-slide__tag-row">
                <span class="soda-slide__kicker home-boot-pill" />
                <span class="soda-slide__meta-tag home-boot-chip" />
              </div>
              <h1><span class="home-boot-title" /></h1>
              <p><span class="home-boot-line home-boot-line--wide" /></p>
              <div class="soda-slide__position">
                <span class="home-boot-line home-boot-line--short" />
              </div>
            </section>
          </div>
          <section class="soda-lyrics-panel home-boot-lyrics">
            <div class="soda-lyrics-list">
              <button type="button" class="placeholder">
                <span class="home-boot-line" />
              </button>
              <button type="button" class="placeholder active">
                <span class="home-boot-line home-boot-line--wide" />
              </button>
              <button type="button" class="placeholder">
                <span class="home-boot-line home-boot-line--mid" />
              </button>
            </div>
          </section>
          <aside class="soda-action-rail" aria-hidden="true">
            <button type="button"><span class="home-boot-action" /></button>
            <button type="button"><span class="home-boot-action" /></button>
            <button type="button"><span class="home-boot-action" /></button>
            <button type="button" class="soda-action-rail__play">
              <span class="home-boot-action" />
            </button>
          </aside>
          <footer class="soda-slide__footer">
            <div class="soda-slide__progress">
              <span class="soda-slide__progress-time">0:00</span>
              <span class="soda-slide__progress-rail" aria-hidden="true">
                <span />
              </span>
              <span class="soda-slide__progress-time">0:00</span>
            </div>
          </footer>
        </article>
      </div>
    </section>
  </div>
</template>
