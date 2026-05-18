const grid = document.querySelector("#run-grid");
const detail = document.querySelector("#detail");
const count = document.querySelector("#run-count");
const cardTemplate = document.querySelector("#run-card-template");

const state = {
  runs: [],
  selectedId: null
};

main().catch((error) => {
  count.textContent = "Unavailable";
  grid.innerHTML = `<div class="empty-state"><h2>Gallery data failed to load</h2><p>${escapeHtml(error.message)}</p></div>`;
});

async function main() {
  const index = await loadJson("./examples/index.json");
  state.runs = Array.isArray(index.runs) ? index.runs : [];
  count.textContent = `${state.runs.length} run${state.runs.length === 1 ? "" : "s"}`;
  renderRunGrid();
  if (state.runs[0]) await selectRun(state.runs[0].id);
}

function renderRunGrid() {
  grid.textContent = "";
  if (state.runs.length === 0) {
    grid.innerHTML =
      '<div class="empty-state"><h2>No public runs yet</h2><p>Publish a run from VibeStudio, then add it to the gallery.</p></div>';
    return;
  }
  for (const run of state.runs) {
    const node = cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = run.id;
    node.classList.toggle("selected", run.id === state.selectedId);
    node.querySelector(".run-thumb").src = run.thumbnailUrl;
    node.querySelector(".run-thumb").alt = `${run.title} thumbnail`;
    node.querySelector(".run-title").textContent = run.title;
    node.querySelector(".run-meta").textContent = `${formatDuration(run.duration)} · ${run.shotCount} shots`;
    node.querySelector(".run-tags").replaceChildren(...tagNodes(run.tags ?? []));
    node.addEventListener("click", () => {
      void selectRun(run.id);
    });
    grid.append(node);
  }
}

async function selectRun(id) {
  state.selectedId = id;
  renderRunGrid();
  const run = await loadJson(`./examples/runs/${encodeURIComponent(id)}.json`);
  renderDetail(run);
}

function renderDetail(run) {
  detail.innerHTML = `
    <div class="detail-layout">
      <video class="hero-video" src="${attr(run.urls.videoUrl)}" poster="${attr(run.urls.thumbnailUrl)}" controls playsinline></video>
      <section class="detail-header">
        <div class="detail-title-row">
          <div>
            <h2>${escapeHtml(run.title)}</h2>
            <p class="muted">${formatDuration(run.storyboard.duration)} · ${run.storyboard.shotCount} shots · ${escapeHtml(run.storyboard.exportMode || "export")}</p>
          </div>
          <a class="repo-link" href="${attr(run.urls.manifestUrl)}">Manifest</a>
        </div>
        <div class="tag-list">${tagHtml(run.tags ?? [])}</div>
      </section>
      ${referenceHtml(run.character)}
      <section class="prompt-list">
        ${(run.copyBlocks ?? []).map((block) => promptBlockHtml(block.label, block.text)).join("")}
      </section>
      <section class="shot-list">
        <div class="section-head"><h2>Shot Prompts</h2><span class="muted">Copy individual beats</span></div>
        ${(run.shots ?? []).map((shot, index) => shotHtml(shot, index)).join("")}
      </section>
    </div>
  `;
  detail.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = button.closest("[data-copy-scope]").querySelector("[data-copy-text]").textContent;
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1200);
    });
  });
}

function referenceHtml(character) {
  if (!character?.imageUrl) return "";
  const fields = character.fields ?? {};
  return `
    <section class="reference-card">
      <img src="${attr(character.imageUrl)}" alt="${attr(character.label || character.name || "Character sheet")}" />
      <div class="field-grid">
        <h2>${escapeHtml(character.label || character.name || "Character Reference")}</h2>
        ${fieldHtml("Character", fields.character)}
        ${fieldHtml("Role", fields.role)}
        ${fieldHtml("Outfit", fields.outfit)}
        ${fieldHtml("Gear", fields.gear)}
        ${fieldHtml("Movement", fields.movementStyle)}
        ${fieldHtml("Palette", fields.palette)}
        ${fieldHtml("Style", fields.visualStyle)}
      </div>
    </section>
  `;
}

function shotHtml(shot, index) {
  return `
    <article class="shot-card" data-copy-scope>
      <div class="prompt-title-row">
        <div>
          <h3>${index + 1}. ${escapeHtml(shot.title)}</h3>
          <p class="shot-meta">${formatDuration(shot.duration)} · ${escapeHtml(shot.generationMode)} · ${escapeHtml(shot.seedanceModel)}</p>
        </div>
        <button class="copy-button" type="button" data-copy>Copy</button>
      </div>
      <pre class="prompt-code" data-copy-text>${escapeHtml(shot.finalPrompt || shot.prompt)}</pre>
    </article>
  `;
}

function promptBlockHtml(label, text) {
  return `
    <article class="prompt-card" data-copy-scope>
      <div class="prompt-title-row">
        <h2>${escapeHtml(label)}</h2>
        <button class="copy-button" type="button" data-copy>Copy</button>
      </div>
      <pre class="prompt-code" data-copy-text>${escapeHtml(text)}</pre>
    </article>
  `;
}

function fieldHtml(label, value) {
  return value ? `<div><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>` : "";
}

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function tagNodes(tags) {
  return tags.slice(0, 4).map((tag) => {
    const node = document.createElement("span");
    node.className = "tag";
    node.textContent = tag;
    return node;
  });
}

function tagHtml(tags) {
  return tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
}

function formatDuration(value) {
  return Number.isFinite(value) ? `${Math.round(value)}s` : "n/a";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function attr(value) {
  return escapeHtml(value);
}
