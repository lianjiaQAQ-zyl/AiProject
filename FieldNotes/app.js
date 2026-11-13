import { mountPet } from "./pet.js";
import { articles } from "./data.js";

const main = document.querySelector("#main");
const search = document.querySelector("#search");
const query = document.querySelector("#query");
const results = document.querySelector("#search-results");
const [featured] = articles;
const categories = ["全部", ...new Set(articles.map(article => article.category))];
let category = "全部";

const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const articleUrl = article => '#article/' + encodeURIComponent(article.id);

function articleRows(items) {
  return items.map(article => `
    <a class="article-row" href="${articleUrl(article)}">
      <time class="mono" datetime="${article.date}">${article.date}</time>
      <span class="row-copy"><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.summary)}</span></span>
      <span class="row-meta mono">${escapeHtml(article.category)} · ${article.minutes} 分钟</span>
      <span aria-hidden="true" class="arrow">↗</span>
    </a>`).join("");
}

function archiveMarkup() {
  const items = category === "全部" ? articles : articles.filter(article => article.category === category);
  return articleRows(items);
}

function desktop() {
  const shortcuts = [
    ["posts", "文章", "folder"],
    ["notes", "笔记", "folder"],
    ["about", "关于", "file"]
  ];
  return `<div class="desktop">
    <nav class="desktop-shortcuts" aria-label="桌面快捷入口">
      ${shortcuts.map(([route, label, icon]) => `
        <a class="desktop-shortcut" href="#${route}">
          <span class="desktop-icon desktop-icon--${icon}" aria-hidden="true"></span>
          <span>${label}</span>
        </a>`).join("")}
    </nav>
    <section class="desktop-window" aria-labelledby="recent-title">
      <header><h2 id="recent-title">最近更新</h2><a href="#posts">全部文章 ↗</a></header>
      ${articles.slice(0, 3).map(article => `
        <a class="desktop-entry" href="${articleUrl(article)}">
          <span>${escapeHtml(article.title)}</span>
          <time class="mono" datetime="${article.date}">${article.date.slice(5)}</time>
        </a>`).join("")}
    </section>
  </div>`;
}

function archiveSection() {
  return `<section class="archive">
    <div class="archive-head"><h2>文章索引</h2><div class="filters" aria-label="按分类筛选">
    ${categories.map(label => `<button type="button" data-category="${label}" aria-pressed="${label === category}">${label}</button>`).join("")}
    </div></div>
    <div id="archive-results" aria-live="polite">${archiveMarkup()}</div>
  </section>`;
}

function home() {
  return `
    <section class="intro">
      <p>关于软件开发与工具使用的实践笔记。</p>
      <div class="pet-stage">
        <button class="desktop-pet" type="button" aria-label="让橘色桌宠跳一下"><span class="pet-sprite" aria-hidden="true"></span></button>
      </div>
    </section>
    ${desktop()}
    ${archiveSection()}`;
}

function articlePage(article) {
  return `<div class="article-layout">
    <aside class="contents" aria-label="文章目录">
      <a class="back" href="#home">← 文章索引</a>
      <h2>目录</h2>
      ${article.sections.map(([heading], index) =>
        `<button type="button" data-section="section-${index}">${escapeHtml(heading)}</button>`).join("")}
    </aside>
    <article class="reading">
      <div class="eyebrow mono">${escapeHtml(article.category)} / ${article.date} / ${article.minutes} 分钟</div>
      <h1>${escapeHtml(article.title)}</h1><p class="lede">${escapeHtml(article.summary)}</p>
      ${article === featured ? '<img class="article-cover" src="assets/feature.jpg" alt="三层浏览器窗口示意图">' : ""}
      ${article.sections.map(([heading, body], index) =>
        `<section id="section-${index}"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`).join("")}
      <a class="back" href="#home">← 返回文章索引</a>
    </article>
  </div>`;
}

function render() {
  const route = location.hash.slice(1) || "home";
  const article = articles.find(item => route === 'article/' + item.id);
  const pages = {
    posts: archiveSection(),
    notes: `<section class="archive"><div class="archive-head"><h1>笔记</h1></div>
      ${articleRows(articles.filter(item => ["随笔", "实验"].includes(item.category)))}
      </section>`,
    about: `<section class="reading"><div class="eyebrow mono">ABOUT</div><h1>关于栈间笔记</h1>
      <p class="lede">记录做软件时遇到的问题、做过的实验和留下来的工具。</p>
      <p>这是博客的前端原型。文章和作者介绍均为示例内容。</p><a class="back" href="#home">← 浏览文章</a></section>`
  };
  const page = article ? "home" : Object.hasOwn(pages, route) ? route : "home";
  main.innerHTML = article ? articlePage(article) : pages[page] ?? home();
  mountPet(main);
  document.title = (article?.title ?? ({ posts: "文章索引", notes: "笔记", about: "关于" })[page] ?? "Field Notes") + " · 栈间笔记";
  document.querySelectorAll("[data-nav]").forEach(link => {
    if (link.dataset.nav === (["posts", "notes"].includes(page) ? "home" : page)) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

function updateSearch() {
  const term = query.value.trim().toLowerCase();
  const items = articles.filter(article =>
    [article.title, article.category, article.summary].some(field => field.toLowerCase().includes(term))
  );
  results.innerHTML = items.length ? articleRows(items) : "<p class='empty'>没有找到相关的文章。</p>";
}

function openSearch() {
  query.value = "";
  updateSearch();
  search.showModal();
  query.focus();
}

main.addEventListener("click", event => {
  const section = event.target.closest("[data-section]");
  if (section) {
    document.getElementById(section.dataset.section)?.scrollIntoView();
    return;
  }
  const filter = event.target.closest("[data-category]");
  if (!filter) return;
  category = filter.dataset.category;
  main.querySelectorAll("[data-category]").forEach(button =>
    button.setAttribute("aria-pressed", String(button === filter)));
  document.querySelector("#archive-results").innerHTML = archiveMarkup();
});
document.querySelector("#search-open").addEventListener("click", openSearch);
query.addEventListener("input", updateSearch);
results.addEventListener("click", event => {
  if (event.target.closest("a")) search.close();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && search.open) {
    event.preventDefault();
    search.close();
    return;
  }
  if (event.key.toLowerCase() === "s" && !event.repeat && !event.metaKey && !event.ctrlKey &&
      !event.altKey && !search.open && !event.target.closest("input, textarea, select, [contenteditable]")) {
    event.preventDefault();
    openSearch();
  }
});
window.addEventListener("hashchange", render);
render();
