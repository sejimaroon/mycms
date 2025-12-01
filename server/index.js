import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 4000;
const dataFile = path.join(__dirname, "data.json");
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage, limits: { fieldSize: 15728640, fileSize: 15728640 } });

// CORS設定
app.use(cors());

// Helmet設定（CSPを緩和）
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// 静的ファイルの配信（フロントエンド）
const frontendPath = path.join(__dirname, "..", "frontend");
const adminPath = path.join(__dirname, "..", "admin", "dist");
const cssPath = path.join(__dirname, "..", "css");
const imagesPath = path.join(__dirname, "..", "images");

app.use("/css", express.static(cssPath));
app.use("/images", express.static(imagesPath));
app.use("/admin", express.static(adminPath));
app.use(express.static(frontendPath));

// ルートパス - フロントエンドのindex.htmlを配信
app.get("/", (req, res) => {
  const indexPath = path.join(frontendPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      message: "MyCMS API Server",
      version: "1.0.0",
      endpoints: {
        sections: "/api/sections",
        posts: "/api/posts",
        admin: "/admin (coming soon)"
      },
      status: "running"
    });
  }
});

// 管理画面用のルート
app.get("/admin", (req, res) => {
  const adminIndexPath = path.join(adminPath, "index.html");
  if (fs.existsSync(adminIndexPath)) {
    res.sendFile(adminIndexPath);
  } else {
    res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Admin - MyCMS</title>
      </head>
      <body>
        <h1>管理画面</h1>
        <p>Admin画面がビルドされていません。</p>
        <p>以下のコマンドでビルドしてください：</p>
        <pre>cd admin && npm run build</pre>
        <p><a href="/">フロントエンドに戻る</a></p>
      </body>
      </html>
    `);
  }
});

// ヘルスチェックエンドポイント
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

function formatDefaultId(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function ensureUniqueId(baseId, posts) {
  let id = baseId;
  let n = 2;
  const hasId = (x) => posts.some((p) => String(p.id) === String(x));
  while (hasId(id)) {
    id = `${baseId}-${n++}`;
  }
  return id;
}

function readData() {
  if (!fs.existsSync(dataFile)) return { sections: [], posts: [], nextSectionId: 1 };
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return { sections: [], posts: [], nextSectionId: 1 };
  }
}

function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function tryParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function extractPlainTextFromBlocks(blocks) {
  const lines = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.type === "heading" || node.type === "paragraph") {
      if (node.content) lines.push(String(node.content));
    } else if (node.type === "columns") {
      if (Array.isArray(node.children)) node.children.forEach((col) => Array.isArray(col) && col.forEach(walk));
    } else if (node.type === "grid") {
      if (Array.isArray(node.children)) node.children.forEach(walk);
    }
  };
  walk(blocks);
  return lines.join("\n");
}

function parseBlocksAndPlainTextFromBody(body) {
  let blocks = null;
  if (body && body.blocks) {
    if (typeof body.blocks === "string") blocks = tryParseJson(body.blocks);
    else if (Array.isArray(body.blocks)) blocks = body.blocks;
  }
  if (!blocks && body && typeof body.content === "string") {
    const parsed = tryParseJson(body.content);
    if (Array.isArray(parsed)) blocks = parsed;
  }
  if (blocks) {
    const plain = extractPlainTextFromBlocks(blocks);
    return { blocks, plain };
  }
  return { blocks: null, plain: null };
}

function migratePostsIfNeeded(data) {
  const out = { ...data };
  out.posts = Array.isArray(out.posts) ? out.posts.map((p) => ({ ...p })) : [];
  let changed = false;
  for (const post of out.posts) {
    if (typeof post.blocks === "string") {
      const parsed = tryParseJson(post.blocks);
      if (Array.isArray(parsed)) {
        post.blocks = parsed;
        if (typeof post.content === "string" && post.content.trim().startsWith("[")) {
          post.content = extractPlainTextFromBlocks(parsed);
        }
        changed = true;
      }
    }
    if (!Array.isArray(post.blocks) && typeof post.content === "string" && post.content.trim().startsWith("[")) {
      const parsed = tryParseJson(post.content);
      if (Array.isArray(parsed)) {
        post.blocks = parsed;
        post.content = extractPlainTextFromBlocks(parsed);
        changed = true;
      }
    }
  }
  return { changed, data: out };
}

// セクション管理API
app.get("/api/sections", (req, res) => {
  const data = readData();
  res.json(data.sections || []);
});

app.post("/api/sections", (req, res) => {
  const data = readData();
  const newSection = {
    id: data.nextSectionId || 1,
    name: req.body.name,
    description: req.body.description || "",
    createdAt: new Date().toISOString().split('T')[0],
    order: data.sections.length + 1,
    style: req.body.style || {
      backgroundColor: "#ffffff",
      borderColor: "#dee2e6",
      titleColor: "#000000",
      contentColor: "#495057"
    }
  };
  data.sections.push(newSection);
  data.nextSectionId = (data.nextSectionId || 1) + 1;
  saveData(data);
  res.json(newSection);
});

app.put("/api/sections/:id", (req, res) => {
  const data = readData();
  const sectionId = parseInt(req.params.id);
  const sectionIndex = data.sections.findIndex(s => s.id === sectionId);

  if (sectionIndex === -1) {
    return res.status(404).json({ error: "セクションが見つかりません" });
  }

  data.sections[sectionIndex] = { ...data.sections[sectionIndex], ...req.body };
  saveData(data);
  res.json(data.sections[sectionIndex]);
});

app.delete("/api/sections/:id", (req, res) => {
  const data = readData();
  const sectionId = parseInt(req.params.id);
  data.sections = data.sections.filter(s => s.id !== sectionId);
  data.posts = data.posts.filter(p => p.sectionId !== sectionId);
  saveData(data);
  res.json({ success: true });
});

app.get("/api/posts", (req, res) => {
  const current = readData();
  const { changed, data } = migratePostsIfNeeded(current);
  if (changed) saveData(data);
  const { sectionId } = req.query;
  let posts = data.posts || [];
  if (sectionId) {
    posts = posts.filter((p) => p.sectionId === parseInt(sectionId));
  }
  res.json(posts);
});

app.post("/api/posts", upload.single("image"), (req, res) => {
  try {
    console.log("POST /api/posts - body:", req.body);
    console.log("POST /api/posts - file:", req.file);

    const data = readData();
    const { blocks, plain } = parseBlocksAndPlainTextFromBody(req.body);
    const providedIdRaw = req.body.id !== undefined ? String(req.body.id).trim() : "";
    const baseId = providedIdRaw || formatDefaultId();
    const id = ensureUniqueId(baseId, data.posts || []);
    const newPost = {
      id,
      title: req.body.title || "",
      content: plain !== null ? plain : (typeof req.body.content === "string" ? req.body.content : ""),
      blocks: blocks,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      date: new Date().toISOString().split('T')[0],
      sectionId: parseInt(req.body.sectionId) || 1
    };

    console.log("New post:", newPost);

    data.posts.push(newPost);
    saveData(data);
    res.json(newPost);
  } catch (err) {
    console.error("POST /api/posts error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/posts/:id", (req, res) => {
  const data = readData();
  const postId = String(req.params.id);
  const postIndex = data.posts.findIndex(p => String(p.id) === postId);

  if (postIndex === -1) {
    return res.status(404).json({ error: "投稿が見つかりません" });
  }

  const post = data.posts[postIndex];
  if (post.image) {
    const imagePath = path.join(__dirname, post.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  data.posts.splice(postIndex, 1);
  saveData(data);
  res.json({ success: true });
});

app.put("/api/posts/:id", upload.single("image"), (req, res) => {
  const data = readData();
  const postId = String(req.params.id);
  const postIndex = data.posts.findIndex(p => String(p.id) === postId);

  if (postIndex === -1) {
    return res.status(404).json({ error: "投稿が見つかりません" });
  }

  const existingPost = data.posts[postIndex];
  const { blocks, plain } = parseBlocksAndPlainTextFromBody(req.body);
  data.posts[postIndex] = {
    ...existingPost,
    title: req.body.title || existingPost.title,
    content: plain !== null ? plain : (typeof req.body.content === "string" ? req.body.content : existingPost.content),
    blocks: blocks !== null ? blocks : (existingPost.blocks || null),
    sectionId: req.body.sectionId ? parseInt(req.body.sectionId) : existingPost.sectionId,
    image: req.file ? `/uploads/${req.file.filename}` : existingPost.image
  };

  saveData(data);
  res.json(data.posts[postIndex]);
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
