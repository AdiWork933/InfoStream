const state = {
  allArticles: [],
  filteredArticles: [],
  visibleCount: 12,
};

const dom = {
  searchInput: document.getElementById("searchInput"),
  sourceFilter: document.getElementById("sourceFilter"),
  sortOrder: document.getElementById("sortOrder"),
  newsGrid: document.getElementById("newsGrid"),
  emptyState: document.getElementById("emptyState"),
  errorState: document.getElementById("errorState"),
  loadingState: document.getElementById("loadingState"),
  articleCount: document.getElementById("articleCount"),
  lastUpdated: document.getElementById("lastUpdated"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  modeLight: document.getElementById("modeLight"),
  modeDark: document.getElementById("modeDark"),
  modeRead: document.getElementById("modeRead"),
  fontInc: document.getElementById("fontInc"),
  fontDec: document.getElementById("fontDec"),
  readerTitle: document.getElementById("readerTitle"),
  readerMeta: document.getElementById("readerMeta"),
  readerContent: document.getElementById("readerContent"),
  readerLink: document.getElementById("readerLink"),
};

function showSkeletons(count = 6) {
  dom.loadingState.innerHTML = "";
  for (let i = 0; i < count; i += 1) {
    dom.loadingState.innerHTML += `<div class="col-12 col-md-6 col-xl-4"><div class="skeleton"></div></div>`;
  }
}

function clearSkeletons() {
  dom.loadingState.innerHTML = "";
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function formatDate(isoDate) {
  if (!isoDate) return "Date unavailable";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString();
}

function renderSourceOptions() {
  const uniqueSources = [...new Set(state.allArticles.map((a) => a.source))].sort((a, b) =>
    a.localeCompare(b)
  );

  dom.sourceFilter.innerHTML = `<option value="all">All sources</option>${uniqueSources
    .map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`)
    .join("")}`;
}

function applyFilters() {
  const searchValue = dom.searchInput.value.trim().toLowerCase();
  const selectedSource = dom.sourceFilter.value;
  const sortOrder = dom.sortOrder.value;

  const filtered = state.allArticles.filter((article) => {
    const title = (article.title || "").toLowerCase();
    const summaryText = (article.summary_text || "").toLowerCase();
    const matchesSearch = !searchValue || title.includes(searchValue) || summaryText.includes(searchValue);
    const matchesSource = selectedSource === "all" || article.source === selectedSource;
    return matchesSearch && matchesSource;
  });

  filtered.sort((a, b) => {
    const aDate = a.published ? new Date(a.published).getTime() : 0;
    const bDate = b.published ? new Date(b.published).getTime() : 0;
    return sortOrder === "latest" ? bDate - aDate : aDate - bDate;
  });

  state.filteredArticles = filtered;
  renderArticles();
}

function renderArticles() {
  const articles = state.filteredArticles.slice(0, state.visibleCount);
  dom.newsGrid.innerHTML = articles
    .map((article, idx) => {
      const realIndex = idx;
      const summary = escapeHtml(article.summary_text || "No summary available.");
      return `
      <div class="col-12 col-md-6 col-xl-4">
        <article class="card news-card h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge source-badge">${escapeHtml(article.source)}</span>
              <small class="text-secondary">${formatDate(article.published)}</small>
            </div>
            <h5 class="card-title">
              <a class="news-title-link" target="_blank" rel="noopener noreferrer" href="${escapeHtml(article.link)}">
                ${escapeHtml(article.title)}
              </a>
            </h5>
            <p class="card-text text-secondary flex-grow-1">${summary}</p>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-primary js-read-btn" data-index="${realIndex}">Read mode</button>
              <button class="btn btn-sm btn-outline-secondary js-bookmark-btn" data-link="${escapeHtml(article.link)}">Bookmark</button>
            </div>
          </div>
        </article>
      </div>`;
    })
    .join("");

  dom.articleCount.textContent = `${state.filteredArticles.length} articles shown`;
  dom.emptyState.classList.toggle("d-none", state.filteredArticles.length > 0);
  dom.loadMoreBtn.classList.toggle("d-none", state.filteredArticles.length <= state.visibleCount);
}

function setupGridActions() {
  dom.newsGrid.addEventListener("click", (event) => {
    const readBtn = event.target.closest(".js-read-btn");
    const bookmarkBtn = event.target.closest(".js-bookmark-btn");

    if (readBtn) {
      const idx = Number(readBtn.dataset.index);
      const article = state.filteredArticles[idx];
      if (!article) return;

      dom.readerTitle.textContent = article.title || "Untitled";
      dom.readerMeta.textContent = `${article.source || "Unknown"} • ${formatDate(article.published)}`;
      dom.readerContent.textContent = article.full_text || article.summary_text || "No article text available.";
      dom.readerLink.href = article.link || "#";
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("readerModal"));
      modal.show();
    }

    if (bookmarkBtn) {
      const link = bookmarkBtn.dataset.link;
      if (!link) return;
      const key = "infostream:bookmarks";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      if (!current.includes(link)) {
        current.push(link);
        localStorage.setItem(key, JSON.stringify(current));
        bookmarkBtn.textContent = "Saved";
      }
    }
  });
}

function setTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("infostream:theme", mode);
}

function setupThemeAndFont() {
  const savedTheme = localStorage.getItem("infostream:theme") || "light";
  const savedFont = Number(localStorage.getItem("infostream:font")) || 16;

  setTheme(savedTheme);
  document.body.style.setProperty("--font-size", `${savedFont}px`);

  dom.modeLight.addEventListener("click", () => setTheme("light"));
  dom.modeDark.addEventListener("click", () => setTheme("dark"));
  dom.modeRead.addEventListener("click", () => setTheme("reading"));

  dom.fontInc.addEventListener("click", () => {
    const current = Number(localStorage.getItem("infostream:font")) || 16;
    const next = Math.min(current + 1, 22);
    document.body.style.setProperty("--font-size", `${next}px`);
    localStorage.setItem("infostream:font", String(next));
  });

  dom.fontDec.addEventListener("click", () => {
    const current = Number(localStorage.getItem("infostream:font")) || 16;
    const next = Math.max(current - 1, 14);
    document.body.style.setProperty("--font-size", `${next}px`);
    localStorage.setItem("infostream:font", String(next));
  });
}

async function fetchNews() {
  dom.errorState.classList.add("d-none");
  showSkeletons();
  try {
    const response = await fetch("/api/news", { cache: "no-store" });
    const payload = await response.json();
    clearSkeletons();

    if (!response.ok && payload.status !== "loading") {
      throw new Error(payload.error || "Unable to fetch latest news.");
    }

    state.allArticles = payload.data || [];
    state.visibleCount = 12;
    renderSourceOptions();
    applyFilters();

    if (payload.last_updated) {
      dom.lastUpdated.textContent = `Last updated: ${formatDate(payload.last_updated)}`;
    } else {
      dom.lastUpdated.textContent = "";
    }
  } catch (error) {
    clearSkeletons();
    dom.errorState.textContent = error.message || "Unexpected error while fetching news.";
    dom.errorState.classList.remove("d-none");
    state.allArticles = [];
    state.filteredArticles = [];
    renderArticles();
  }
}

function setupControls() {
  dom.searchInput.addEventListener("input", applyFilters);
  dom.sourceFilter.addEventListener("change", applyFilters);
  dom.sortOrder.addEventListener("change", applyFilters);
  dom.refreshBtn.addEventListener("click", fetchNews);
  dom.loadMoreBtn.addEventListener("click", () => {
    state.visibleCount += 9;
    renderArticles();
  });
}

function bootstrapApp() {
  setupControls();
  setupGridActions();
  setupThemeAndFont();
  fetchNews();
}

bootstrapApp();
