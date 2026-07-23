const imagePool = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDoL8x7EefxGyE7UzUG80PhDIxD3ALP4YlDJiVADxcG3MfkrhRrT_WQHBfvxPAIhdu1Dd2gHt8f2Els4ysIB2AkBWMYPFAlPBgp550TTeeeUddeyFc6wu_p1XyfnSFkjUv6ULO9Sy2rRnkHUp73a_Hb7dFZ8Gu5EzkMKfmzdtdeEMvD9xlo0p0lNgxM8rIlvaB-elt1u_CDcKlq__zjkApjZR5ozq_jvA-bt1UwOyxameM2v27EMLBs",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDnoeXNnN8sevJvkNO1pyWFMSF_xzEj1_8j-IKj5qUj9-SpHQ1dHZDGR1S--lrVfvte6FD7iFq6ImdSZvAp9k__tcSgyco06BrLCfGgvfcz2G60FLVF3fLMvZhTGNKwb5jGZ68s8BV7bx4LzCqoaM9LT7fDX2gLHD1hNvfdACLoMEaA9bl6GdoLeEqy5TLgB4fiD2LNmoDN4mQV65nO1y515rJ4DCsoOjA88WF38jFT_lISiT7zFQBI",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBoBwFXlXzdtn1whEExSuYv8rR5jheTT4BZe3i6QeX_TDOAh22JzJPQ6ysMjS0o4-hLqMYo0-32g24KmBkj0DxbvLiNOA6DYOlwd6NUvDLJ2DhaI6dyk1NsG86gZwX5E0K1OO4HDpEh4yGm4i2c9k5cmEbduDP3OcZU7gNrDZ96QdSbbYb30eHrqfGzcIZ0SzcIq7IHPR5jGo-8GcHTWxY3FVOp17yC8s5z2PpcbFbJASMzLtVeGT5T",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA-GZfopH1Z1w00s1YZMHycyeRFet0qvMvfWFFoa8BNKwP8K7yvl2w9XQBjDUIT-aVqm8RD0cbJbsXQIBBoJ9eGTfWlPI4BvwGRA5el-YMsRorUr_f4B8QAh14vbsBFMb57PamWr60jg_hnIINyW7_EW5PuSKqsKNNS9j44IPKtH03G78DsWNFfFY-l9qWmPkWk1ZL2fNk0ZBJ5KsIJ6U1V1lYxsFOS5vO_8bj8K0VqRtvraX7abPuc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBWb55ZiN26itNw1Idd0hi51WKm6hJmh3oyfcLGihsJRoRHn25XbeC0axlOKYVpFRQ56dMQGenDR40oJ-FcJ-bWF8A7ZSGz7ymG-dXUk_wBsevsJX_dvETrWaQfRMuIh1k545M4RXT4ZQPKclPT0mBcg7OzDhHzHFSFxx7NAXBhJuQZM4vXRe_ebYcKsrf-ZGUr2n-lKCRCLCYu4fGs9x_ieWYpztx7-0bRcjGbhSaHKjPVGSytwqQU",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCQ6a__QUqyXdRGK3IXrO5oAxd2j0XvGuxeKbIWPSekhG5Ye9jQVp4AGcI7SaK7mWAhWptnLOh2JqprZ2CIaJ4BNn0hlGIf_kQ6REEpWpNvzIS_AqfbXuGizCq34la7ZwcfLE-1aMHlY6CDmMw3OeHK6-QY1Of9B1yduE4diEKPQdMQwG0VWsYgOyvQsvwfvrJ8kzaB81PMg6FeANCrQ_Dbf1JmkrQDsd92weOIfAjo1pHv5t_Yi9tj",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA11tkVfsqXbv5vxZkywgNRraU_5qOSDKQ3Wyat69OVoLWD2OCJNhmmXM3fj7UHDTe8b7VMYXoQt-GnyvM_ys_z-HX8BwZtcYRWTkXkhExcI8bIaJNLipqR1mPUq_vKuMFFyQliLt9JbC2PMwYXdpjG2pHb6gWgAsNncO3KoIbeAFIlHEt-amoq7qybu50KN-O5SqTXmNZs2EuISgFWLcENY_A9Db-mjImPppdtGb3wS2njQYMFUQdE"
];

const seedIdeas = [
  {
    id: "idea-heat-road",
    title: "高温末日城市道路热损伤",
    project: "明日乐园",
    category: "场景",
    tags: ["高温", "末日", "城市", "材质"],
    content: "高温末日里的城市道路，柏油因为长期高温变形，车辆轮胎留下融化痕迹。",
    summary: "道路不是背景，而是灾害持续时间的证据。融化柏油、轮胎拖痕和维修失败能直接说明城市系统已经失控。",
    expansion: ["道路材质变化", "建筑外立面热变形", "废弃车辆轮胎痕迹", "强光下的低饱和色彩"],
    image: imagePool[0],
    status: "AI 已整理",
    createdTime: "07-10 02:40"
  },
  {
    id: "idea-oasis-court",
    title: "绿洲中庭植物系统",
    project: "明日乐园",
    category: "场景",
    tags: ["植物", "室内", "生态", "光影"],
    content: "避难城市内部保留一个人工绿洲中庭，植物被管线和雾化系统维持。",
    summary: "绿洲中庭可以作为末日环境里的情绪反差，同时暴露能源、供水与阶层分配问题。",
    expansion: ["雾化管线", "植物维护轨道", "透明遮阳结构", "居民流线"],
    image: imagePool[2],
    status: "待归档",
    createdTime: "07-09 22:16"
  },
  {
    id: "idea-maintenance-suit",
    title: "高温维护服角色轮廓",
    project: "明日乐园",
    category: "角色",
    tags: ["角色", "防护", "工业", "剪影"],
    content: "城市维修人员需要在高温道路上工作，服装应强调隔热层、外置水袋和简易工具挂点。",
    summary: "维护服可以把世界观里的能源短缺、体力劳动和技术退化集中到角色身上。",
    expansion: ["头盔遮阳结构", "外置冷却罐", "磨损手套", "工具腰封"],
    image: imagePool[4],
    status: "AI 已整理",
    createdTime: "07-09 17:32"
  },
  {
    id: "idea-prop-sensor",
    title: "道路热流监测桩",
    project: "明日乐园",
    category: "道具",
    tags: ["道具", "能源", "传感器", "街道"],
    content: "道路边缘设置旧式热流监测桩，用颜色灯带提示地表温度，许多已经失灵。",
    summary: "监测桩能给场景一个可读的安全规则，也能表现系统衰败。",
    expansion: ["失灵灯带", "临时维修胶带", "温度刻度", "警戒涂装"],
    image: imagePool[5],
    status: "待归档",
    createdTime: "07-08 11:05"
  },
  {
    id: "idea-shot-sun",
    title: "正午热浪压迫镜头",
    project: "明日乐园",
    category: "镜头",
    tags: ["镜头", "热浪", "压迫", "强光"],
    content: "低机位看向道路尽头，远处建筑被热浪扭曲，人物在强光里几乎只剩剪影。",
    summary: "镜头语言强化热灾害，让空间尺度和人物脆弱感同时成立。",
    expansion: ["低机位", "长焦压缩", "热浪折射", "高反差剪影"],
    image: imagePool[3],
    status: "AI 已整理",
    createdTime: "07-08 09:48"
  },
  {
    id: "idea-material-asphalt",
    title: "焦化柏油材质规则",
    project: "明日乐园",
    category: "材质",
    tags: ["材质", "柏油", "焦化", "纹理"],
    content: "柏油表面出现焦化、油亮反光、开裂和重新凝固的边缘。",
    summary: "材质规则可以统一所有道路资产，避免每个镜头里热损伤表现不一致。",
    expansion: ["油亮高光", "焦化边缘", "龟裂纹理", "轮胎压痕"],
    image: imagePool[6],
    status: "待归档",
    createdTime: "07-07 21:20"
  }
];

const storageKey = "creative-vault-web-ideas";
let ideas = JSON.parse(localStorage.getItem(storageKey) || "null") || seedIdeas;
let selectedIdea = ideas[0];
let selectedCategory = "all";
let selectedTag = "all";
let selectedAiMode = "expand";

const grid = document.querySelector("#assetGrid");
const tagStrip = document.querySelector("#tagStrip");
const detailPanel = document.querySelector("#detailPanel");
const detailTitle = document.querySelector("#detailTitle");
const searchInput = document.querySelector("#searchInput");
const captureDialog = document.querySelector("#captureDialog");
const aiResult = document.querySelector("#aiResult");

function saveIdeas() {
  localStorage.setItem(storageKey, JSON.stringify(ideas));
}

function filteredIdeas() {
  const query = searchInput.value.trim().toLowerCase();
  return ideas.filter((idea) => {
    const categoryOk = selectedCategory === "all" || idea.category === selectedCategory;
    const tagOk = selectedTag === "all" || idea.tags.includes(selectedTag);
    const text = `${idea.title} ${idea.project} ${idea.category} ${idea.tags.join(" ")} ${idea.content}`.toLowerCase();
    return categoryOk && tagOk && (!query || text.includes(query));
  });
}

function renderTags() {
  const tags = ["all", ...new Set(ideas.flatMap((idea) => idea.tags))];
  tagStrip.innerHTML = tags.map((tag) => {
    const label = tag === "all" ? "全部标签" : tag;
    return `<button class="tag ${selectedTag === tag ? "active" : ""}" data-tag="${tag}">${label}</button>`;
  }).join("");
  tagStrip.querySelectorAll(".tag").forEach((button) => {
    button.addEventListener("click", () => {
      selectedTag = button.dataset.tag;
      render();
    });
  });
}

function renderGrid() {
  const visible = filteredIdeas();
  document.querySelector("#assetCount").textContent = ideas.length;
  grid.innerHTML = visible.map((idea) => `
    <button class="asset-card ${selectedIdea?.id === idea.id ? "selected" : ""}" data-id="${idea.id}">
      <div class="thumb"><img src="${idea.image}" alt="${idea.title}" /></div>
      <div class="asset-body">
        <div class="asset-meta"><span>${idea.category}</span><span>${idea.status}</span></div>
        <div class="asset-title">${idea.title}</div>
        <div class="asset-tags">${idea.tags.slice(0, 3).map((tag) => `<span>#${tag}</span>`).join("")}</div>
      </div>
    </button>
  `).join("");

  grid.querySelectorAll(".asset-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedIdea = ideas.find((idea) => idea.id === card.dataset.id);
      render();
    });
  });
}

function renderDetail() {
  if (!selectedIdea) return;
  detailTitle.textContent = selectedIdea.title;
  document.querySelector("#canvasImage").src = selectedIdea.image;
  detailPanel.className = "";
  detailPanel.innerHTML = `
    <img class="detail-cover" src="${selectedIdea.image}" alt="${selectedIdea.title}" />
    <section class="detail-section">
      <h4>原始记录</h4>
      <p>${selectedIdea.content}</p>
    </section>
    <section class="detail-section">
      <h4>AI 整理结果</h4>
      <p>${selectedIdea.summary}</p>
    </section>
    <section class="detail-section">
      <h4>视觉关键词</h4>
      <div class="asset-tags">${selectedIdea.tags.map((tag) => `<span>#${tag}</span>`).join("")}</div>
    </section>
    <section class="detail-section">
      <h4>延展方向</h4>
      <ul>${selectedIdea.expansion.map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>
    <section class="detail-section">
      <h4>关联内容</h4>
      <p>${relatedIdeas(selectedIdea).map((item) => item.title).join(" / ") || "暂无关联内容"}</p>
    </section>
  `;
}

function relatedIdeas(idea) {
  return ideas.filter((item) => item.id !== idea.id && item.tags.some((tag) => idea.tags.includes(tag))).slice(0, 3);
}

function renderArchive() {
  document.querySelector("#archiveList").innerHTML = ideas.map((idea) => `
    <article class="archive-item">
      <img src="${idea.image}" alt="${idea.title}" />
      <div>
        <h3>${idea.title}</h3>
        <p>${idea.project} / ${idea.category} / ${idea.createdTime}</p>
      </div>
      <span class="tag">${idea.status}</span>
    </article>
  `).join("");
}

function renderAiResult() {
  const source = document.querySelector("#aiPrompt").value;
  const titleMap = {
    expand: "完整视觉方向",
    organize: "美术设定文档",
    check: "漏洞检查"
  };
  const blocks = {
    expand: [
      ["设计核心", "城市道路、建筑外壳和人群动线都要体现长期高温造成的维护失败。重点不是灾难瞬间，而是灾难已经成为日常。"],
      ["场景规则", "地表材料出现融化、重新凝固、开裂和反光。道路边缘保留临时维修痕迹，用以说明系统仍在低效运转。"],
      ["镜头方向", "优先使用低机位和长焦压缩，让热浪折射吞掉远处建筑轮廓。人物只作为尺度参照。"]
    ],
    organize: [
      ["项目背景", source],
      ["视觉目标", "建立一个被极端高温长期侵蚀的避难城市，强调工业残骸、能源短缺和局部维持的秩序。"],
      ["设计原则", "所有资产必须能解释自身维护逻辑。每个道具和材质变化都服务于世界观，而不是单纯装饰。"]
    ],
    check: [
      ["问题", "如果城市仍可居住，需要解释供水、隔热、能源和道路维护系统，否则空间逻辑会显得只为画面服务。"],
      ["建议增加", "增加道路热流监测桩、遮阳维修棚、地下冷却管线入口、失效能源警示牌。"],
      ["需要回避", "不要让所有区域都同等破败。应保留少量仍在运行的基础设施，形成可信的生存层级。"]
    ]
  };

  aiResult.innerHTML = `
    <h3>${titleMap[selectedAiMode]}</h3>
    <div class="result-grid">
      ${blocks[selectedAiMode].map(([heading, body]) => `
        <div class="result-block">
          <h4>${heading}</h4>
          <p>${body}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function render() {
  renderTags();
  renderGrid();
  renderDetail();
  renderArchive();
  renderAiResult();
}

document.querySelectorAll(".topnav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".topnav-item").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`[data-panel="${button.dataset.view}"]`).classList.add("active");
  });
});

document.querySelectorAll(".tree-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tree-item").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedCategory = button.dataset.category;
    render();
  });
});

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    selectedAiMode = button.dataset.mode;
    renderAiResult();
  });
});

searchInput.addEventListener("input", renderGrid);
document.querySelector("#runAi").addEventListener("click", renderAiResult);
document.querySelector("#openCapture").addEventListener("click", () => captureDialog.showModal());
document.querySelector("#closeCapture").addEventListener("click", () => captureDialog.close());
document.querySelector("#cancelCapture").addEventListener("click", () => captureDialog.close());

document.querySelector("#captureForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const content = document.querySelector("#newIdeaContent").value.trim();
  const category = document.querySelector("#newIdeaCategory").value;
  const tags = document.querySelector("#newIdeaTags").value.split(",").map((tag) => tag.trim()).filter(Boolean);
  const title = content.length > 18 ? content.slice(0, 18) : content;
  const idea = {
    id: `idea-${Date.now()}`,
    title,
    project: document.querySelector("#newIdeaProject").value,
    category,
    tags,
    content,
    summary: "AI 占位整理：这条灵感已经提取为设计核心、视觉关键词和延展方向，后续可替换为真实大模型接口。",
    expansion: ["材质规则", "空间影响", "镜头表现", "关联资产"],
    image: imagePool[ideas.length % imagePool.length],
    status: "待归档",
    createdTime: "刚刚"
  };
  ideas = [idea, ...ideas];
  selectedIdea = idea;
  saveIdeas();
  captureDialog.close();
  render();
});

render();
