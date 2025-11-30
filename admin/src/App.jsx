import React, { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "../../frontend/style.css";
import API_CONFIG from "./config";

// ブロックタイプの定義
const blockTypes = [
  { type: "heading", label: "見出し" },
  { type: "paragraph", label: "段落" },
  { type: "image", label: "画像" },
  { type: "columns", label: "カラム" },
  { type: "grid", label: "グリッド" },
];

const sizeOptions = ["small", "medium", "large", "full"];
const sizeLabels = { small: "小", medium: "中", large: "大", full: "全幅" };

// ブロック生成関数
const createBlock = (type) => {
  const base = { id: Date.now() + Math.random(), type, size: "full" };
  switch (type) {
    case "heading": return { ...base, content: "", level: 2 };
    case "paragraph": return { ...base, content: "" };
    case "image": return { ...base, url: "", alt: "" };
    case "columns": return { ...base, columns: 2, children: [[], []] };
    case "grid": return { ...base, cols: 3, gap: 16, children: [] };
    default: return base;
  }
};

// ソート可能なブロックコンポーネント
function SortableBlock({ block, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners })}
    </div>
  );
}

// 見出しブロック
const HeadingBlock = ({ block, onUpdate }) => (
  <div className="block-content">
    <select
      value={block.level}
      onChange={(e) => onUpdate({ ...block, level: +e.target.value })}
      style={{ marginBottom: 8, padding: 4 }}
    >
      {[1, 2, 3, 4, 5, 6].map((l) => (
        <option key={l} value={l}>H{l}</option>
      ))}
    </select>
    <input
      type="text"
      value={block.content}
      onChange={(e) => onUpdate({ ...block, content: e.target.value })}
      placeholder="見出しを入力..."
      style={{
        width: "100%",
        fontSize: block.level === 1 ? 24 : block.level === 2 ? 20 : 16,
        fontWeight: "bold",
        padding: 8,
        border: "1px solid #ccc",
        borderRadius: 4,
      }}
    />
  </div>
);

// 段落ブロック
const ParagraphBlock = ({ block, onUpdate }) => (
  <div className="block-content">
    <textarea
      value={block.content}
      onChange={(e) => onUpdate({ ...block, content: e.target.value })}
      placeholder="テキストを入力..."
      rows={4}
      style={{
        width: "100%",
        padding: 8,
        border: "1px solid #ccc",
        borderRadius: 4,
        resize: "vertical",
      }}
    />
  </div>
);

// 画像ブロック
const ImageBlock = ({ block, onUpdate }) => (
  <div className="block-content">
    <input
      type="text"
      value={block.url}
      onChange={(e) => onUpdate({ ...block, url: e.target.value })}
      placeholder="画像URL..."
      style={{
        width: "100%",
        padding: 8,
        marginBottom: 8,
        border: "1px solid #ccc",
        borderRadius: 4,
      }}
    />
    <input
      type="file"
      accept="image/*"
      onChange={(e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => onUpdate({ ...block, url: ev.target.result });
          reader.readAsDataURL(file);
        }
      }}
      style={{ marginBottom: 8 }}
    />
    {block.url && (
      <img
        src={block.url}
        alt={block.alt}
        style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 4 }}
        onError={(e) => (e.target.style.display = "none")}
      />
    )}
  </div>
);

// カラムブロック
const ColumnsBlock = ({ block, onUpdate, renderBlockList, depth }) => {
  const updateColumn = (idx, newChildren) => {
    const children = [...block.children];
    children[idx] = newChildren;
    onUpdate({ ...block, children });
  };

  const addToColumn = (idx, type) => {
    const children = [...block.children];
    children[idx] = [...children[idx], createBlock(type)];
    onUpdate({ ...block, children });
  };

  return (
    <div className="block-content">
      <div style={{ marginBottom: 8 }}>
        <label>カラム数: </label>
        <select
          value={block.columns}
          onChange={(e) => {
            const cols = +e.target.value;
            const children = Array(cols)
              .fill(null)
              .map((_, i) => block.children[i] || []);
            onUpdate({ ...block, columns: cols, children });
          }}
          style={{ padding: 4 }}
        >
          {[2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}カラム</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {block.children.map((col, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              border: "1px dashed #ccc",
              borderRadius: 4,
              padding: 8,
              minHeight: 100,
              backgroundColor: "#f9f9f9",
            }}
          >
            {renderBlockList(col, (newChildren) => updateColumn(i, newChildren), depth + 1)}
            <AddBlockDropdown onAdd={(type) => addToColumn(i, type)} compact />
          </div>
        ))}
      </div>
    </div>
  );
};

// グリッドブロック
const GridBlock = ({ block, onUpdate, renderBlockList, depth }) => {
  const addChild = (type) => {
    onUpdate({ ...block, children: [...block.children, createBlock(type)] });
  };

  const updateChildren = (newChildren) => {
    onUpdate({ ...block, children: newChildren });
  };

  return (
    <div className="block-content">
      <div style={{ marginBottom: 8, display: "flex", gap: 16 }}>
        <label>
          列数:
          <input
            type="number"
            min={1}
            max={6}
            value={block.cols}
            onChange={(e) => onUpdate({ ...block, cols: +e.target.value })}
            style={{ width: 60, marginLeft: 8, padding: 4 }}
          />
        </label>
        <label>
          間隔:
          <input
            type="number"
            min={0}
            max={48}
            value={block.gap}
            onChange={(e) => onUpdate({ ...block, gap: +e.target.value })}
            style={{ width: 60, marginLeft: 8, padding: 4 }}
          />
        </label>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${block.cols}, 1fr)`,
          gap: block.gap,
          border: "1px dashed #ccc",
          borderRadius: 4,
          padding: 8,
          minHeight: 100,
          backgroundColor: "#f9f9f9",
        }}
      >
        {block.children.map((child, i) => (
          <div
            key={child.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: 8,
              backgroundColor: "#fff",
            }}
          >
            {renderBlockList([child], (newChildren) => {
              const updatedChildren = [...block.children];
              if (newChildren.length === 0) {
                updatedChildren.splice(i, 1);
              } else {
                updatedChildren[i] = newChildren[0];
              }
              updateChildren(updatedChildren);
            }, depth + 1)}
          </div>
        ))}
        <div
          style={{
            border: "1px dashed #ccc",
            borderRadius: 4,
            minHeight: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AddBlockDropdown onAdd={addChild} compact />
        </div>
      </div>
    </div>
  );
};

// ブロック追加ドロップダウン
const AddBlockDropdown = ({ onAdd, compact }) => {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          padding: compact ? "4px 8px" : "6px 12px",
          fontSize: compact ? 12 : 14,
          cursor: "pointer",
        }}
      >
        + {!compact && "ブロック追加"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            marginTop: 4,
            backgroundColor: "#fff",
            border: "1px solid #ccc",
            borderRadius: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            minWidth: 120,
          }}
        >
          {blockTypes.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                textAlign: "left",
                border: "none",
                background: "none",
                cursor: "pointer",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "transparent")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ブロックツールバー
const BlockToolbar = ({ block, onUpdate, onDelete, listeners }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
    <span
      {...listeners}
      style={{ cursor: "grab", padding: "4px 8px", backgroundColor: "#eee", borderRadius: 4 }}
    >
      ⋮⋮
    </span>
    <span style={{ fontSize: 12, color: "#666" }}>{block.type}</span>
    <select
      value={block.size}
      onChange={(e) => onUpdate({ ...block, size: e.target.value })}
      style={{ padding: 4, fontSize: 12 }}
    >
      {sizeOptions.map((s) => (
        <option key={s} value={s}>{sizeLabels[s]}</option>
      ))}
    </select>
    <button
      type="button"
      onClick={onDelete}
      style={{
        marginLeft: "auto",
        padding: "4px 8px",
        backgroundColor: "#ff4444",
        color: "#fff",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      削除
    </button>
  </div>
);

export default function App() {
  const [posts, setPosts] = useState([]);
  const [sections, setSections] = useState([]);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [image, setImage] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(1);
  const [activeTab, setActiveTab] = useState("posts");
  const [preview, setPreview] = useState(false);
  const [postIdInput, setPostIdInput] = useState(new Date().toISOString().slice(0, 10));
  const [editingPost, setEditingPost] = useState(null);

  // セクション作成用のstate
  const [newSection, setNewSection] = useState({ name: "", description: "" });
  const [editingSection, setEditingSection] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchSections();
    fetchPosts();
  }, []);

  const fetchSections = async () => {
    try {
      const res = await fetch(`${API_CONFIG.getBaseURL()}/api/sections`);
      const data = await res.json();
      setSections(data);
    } catch (err) {
      console.error("セクション取得エラー:", err);
    }
  };

  const fetchPosts = async (sectionId = null) => {
    try {
      const url = sectionId
        ? `${API_CONFIG.getBaseURL()}/api/posts?sectionId=${sectionId}`
        : `${API_CONFIG.getBaseURL()}/api/posts`;
      const res = await fetch(url);
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error("投稿取得エラー:", err);
    }
  };

  const addSection = async () => {
    if (!newSection.name) return;
    try {
      await fetch(`${API_CONFIG.getBaseURL()}/api/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSection),
      });
      setNewSection({ name: "", description: "" });
      fetchSections();
    } catch (err) {
      console.error("セクション追加エラー:", err);
    }
  };

  const updateSection = async (section) => {
    try {
      await fetch(`${API_CONFIG.getBaseURL()}/api/sections/${section.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(section),
      });
      setEditingSection(null);
      fetchSections();
    } catch (err) {
      console.error("セクション更新エラー:", err);
    }
  };

  const deleteSection = async (sectionId) => {
    if (!confirm("このセクションと関連する投稿を削除してもよろしいですか？")) return;
    try {
      await fetch(`${API_CONFIG.getBaseURL()}/api/sections/${sectionId}`, { method: "DELETE" });
      fetchSections();
      fetchPosts();
    } catch (err) {
      console.error("セクション削除エラー:", err);
    }
  };

  const startEdit = (post) => {
    setActiveTab("posts");
    setEditingPost(post);
    setTitle(post.title || "");
    if (Array.isArray(post.blocks)) {
      setBlocks(post.blocks);
    } else if (typeof post.content === "string" && post.content.trim()) {
      setBlocks([{ id: Date.now() + Math.random(), type: "paragraph", size: "full", content: post.content }]);
    } else {
      setBlocks([]);
    }
    setSelectedSectionId(post.sectionId || 1);
    setPostIdInput(String(post.id));
    setImage(null);
    setPreview(false);
  };

  async function updatePost(e) {
    e.preventDefault();
    if (!editingPost) return;
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("blocks", JSON.stringify(blocks));
      formData.append("sectionId", selectedSectionId.toString());
      if (image) formData.append("image", image);

      const res = await fetch(`${API_CONFIG.getBaseURL()}/api/posts/${encodeURIComponent(editingPost.id)}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        let message = "不明なエラー";
        try {
          const errorData = await res.json();
          message = errorData?.error || JSON.stringify(errorData);
        } catch (_) {
          try {
            const text = await res.text();
            message = (text || "").slice(0, 500);
          } catch (_) { }
        }
        console.error("Update error status=", res.status, message);
        alert("投稿の更新に失敗しました: " + message);
        return;
      }

      let updatedPost;
      try {
        updatedPost = await res.json();
      } catch (e) {
        const text = await res.text();
        console.error("Invalid JSON response:", text);
        alert("投稿の更新に失敗しました: サーバーの応答形式が不正です");
        return;
      }

      setPosts(posts.map((p) => String(p.id) === String(updatedPost.id) ? updatedPost : p));
      setEditingPost(null);
      setTitle("");
      setBlocks([]);
      setImage(null);
      setPostIdInput(new Date().toISOString().slice(0, 10));
    } catch (err) {
      console.error("updatePost error:", err);
      alert("投稿の更新に失敗しました");
    }
  }

  async function addPost(e) {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("blocks", JSON.stringify(blocks));
      formData.append("sectionId", selectedSectionId.toString());
      formData.append("id", postIdInput || "");
      if (image) formData.append("image", image);

      const res = await fetch(`${API_CONFIG.getBaseURL()}/api/posts`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let message = "不明なエラー";
        try {
          const errorData = await res.json();
          message = errorData?.error || JSON.stringify(errorData);
        } catch (_) {
          try {
            const text = await res.text();
            message = (text || "").slice(0, 500);
          } catch (_) { }
        }
        console.error("Server error status=", res.status, message);
        alert("投稿の保存に失敗しました: " + message);
        return;
      }

      let newPost;
      try {
        newPost = await res.json();
      } catch (e) {
        const text = await res.text();
        console.error("Invalid JSON response:", text);
        alert("投稿の保存に失敗しました: サーバーの応答形式が不正です");
        return;
      }
      setPosts([...posts, newPost]);
      setTitle("");
      setBlocks([]);
      setImage(null);
      setPostIdInput(new Date().toISOString().slice(0, 10));
    } catch (err) {
      console.error("addPost error:", err);
      alert("投稿の保存に失敗しました");
    }
  }

  const removePost = async (postId) => {
    try {
      await fetch(`${API_CONFIG.getBaseURL()}/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
      setPosts(posts.filter((p) => String(p.id) !== String(postId)));
    } catch (err) {
      console.error("投稿削除エラー:", err);
    }
  };

  // ドラッグ終了ハンドラ
  const handleDragEnd = (event, blocksList, setBlocksList) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = blocksList.findIndex((b) => b.id === active.id);
      const newIndex = blocksList.findIndex((b) => b.id === over.id);
      setBlocksList(arrayMove(blocksList, oldIndex, newIndex));
    }
  };

  // ブロックリストのレンダリング
  const renderBlockList = (blocksList, setBlocksList, depth = 0) => {
    const updateBlock = (id, updated) => {
      setBlocksList(blocksList.map((b) => (b.id === id ? updated : b)));
    };
    const deleteBlock = (id) => {
      setBlocksList(blocksList.filter((b) => b.id !== id));
    };

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => handleDragEnd(e, blocksList, setBlocksList)}
      >
        <SortableContext items={blocksList.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocksList.map((block) => (
            <SortableBlock key={block.id} block={block}>
              {({ listeners }) => (
                <div
                  className="post-item"
                  style={{
                    marginBottom: 12,
                    border: "1px solid #ccc",
                    padding: 12,
                    borderRadius: 4,
                    backgroundColor: depth > 0 ? "#fafafa" : "#fff",
                  }}
                >
                  {!preview && (
                    <BlockToolbar
                      block={block}
                      onUpdate={(updated) => updateBlock(block.id, updated)}
                      onDelete={() => deleteBlock(block.id)}
                      listeners={listeners}
                    />
                  )}
                  {block.type === "heading" &&
                    (preview ? (
                      React.createElement(
                        `h${block.level}`,
                        { style: { margin: 0 } },
                        block.content
                      )
                    ) : (
                      <HeadingBlock
                        block={block}
                        onUpdate={(updated) => updateBlock(block.id, updated)}
                      />
                    ))}
                  {block.type === "paragraph" &&
                    (preview ? (
                      <p style={{ margin: 0 }}>{block.content}</p>
                    ) : (
                      <ParagraphBlock
                        block={block}
                        onUpdate={(updated) => updateBlock(block.id, updated)}
                      />
                    ))}
                  {block.type === "image" &&
                    (preview ? (
                      block.url && (
                        <img
                          src={block.url}
                          alt={block.alt}
                          style={{ maxWidth: "100%", borderRadius: 4 }}
                        />
                      )
                    ) : (
                      <ImageBlock
                        block={block}
                        onUpdate={(updated) => updateBlock(block.id, updated)}
                      />
                    ))}
                  {block.type === "columns" && (
                    <ColumnsBlock
                      block={block}
                      onUpdate={(updated) => updateBlock(block.id, updated)}
                      renderBlockList={renderBlockList}
                      depth={depth}
                    />
                  )}
                  {block.type === "grid" && (
                    <GridBlock
                      block={block}
                      onUpdate={(updated) => updateBlock(block.id, updated)}
                      renderBlockList={renderBlockList}
                      depth={depth}
                    />
                  )}
                </div>
              )}
            </SortableBlock>
          ))}
        </SortableContext>
      </DndContext>
    );
  };

  return (
    <div className="admin-container">
      <h1>管理画面（Admin）</h1>

      {/* タブナビゲーション */}
      <div className="tab-navigation">
        <button
          className={activeTab === "posts" ? "active" : ""}
          onClick={() => setActiveTab("posts")}
        >
          投稿管理
        </button>
        <button
          className={activeTab === "sections" ? "active" : ""}
          onClick={() => setActiveTab("sections")}
        >
          セクション管理
        </button>
      </div>

      {/* 投稿管理タブ */}
      {activeTab === "posts" && (
        <>
          <h2>新規投稿</h2>
          <form onSubmit={editingPost ? updatePost : addPost}>
            <div className="form-group">
              <label>セクション選択:</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(parseInt(e.target.value))}
                required
              >
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>投稿ID（省略時は日付）:</label>
              <input
                type="text"
                placeholder="例: YYYY-MM-DD または custom-slug"
                value={postIdInput}
                onChange={(e) => setPostIdInput(e.target.value)}
                disabled={!!editingPost}
              />
            </div>
            <input
              type="text"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
            />

            {/* ブロックエディター */}
            <div style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>コンテンツ（ブロックエディター）</h3>
                <button
                  type="button"
                  onClick={() => setPreview(!preview)}
                  style={{ padding: "6px 12px" }}
                >
                  {preview ? "編集モード" : "プレビュー"}
                </button>
              </div>

              {renderBlockList(blocks, setBlocks, 0)}

              {!preview && (
                <div style={{ marginTop: 12 }}>
                  <AddBlockDropdown onAdd={(type) => setBlocks([...blocks, createBlock(type)])} />
                </div>
              )}
            </div>

            <button type="submit">{editingPost ? "更新" : "投稿"}</button>
            {editingPost && (
              <button type="button" onClick={() => { setEditingPost(null); setTitle(""); setBlocks([]); setImage(null); setPostIdInput(new Date().toISOString().slice(0, 10)); }} style={{ marginLeft: 8 }}>
                キャンセル
              </button>
            )}
          </form>

          <h2 className="form__title">投稿一覧</h2>
          <div className="section-filter">
            <button onClick={() => fetchPosts()}>すべて</button>
            {sections.map((section) => (
              <button key={section.id} onClick={() => fetchPosts(section.id)}>
                {section.name}
              </button>
            ))}
          </div>
          <ul className="posts-list">
            {posts.map((p) => {
              const section = sections.find((s) => s.id === p.sectionId);
              return (
                <li key={p.id} className="post-item">
                  <div className="post-header">
                    <h3>{p.title}</h3>
                    <span className="section-badge">{section?.name}</span>
                  </div>
                  {p.image && (
                    <img
                      src={API_CONFIG.getImageURL(p.image)}
                      width="150"
                      alt={p.title}
                    />
                  )}
                  <p>{typeof p.content === "string" && p.content.startsWith("[") ? "（ブロックコンテンツ）" : p.content}</p>
                  <small>{p.date}</small>
                  <button onClick={() => startEdit(p)} style={{ marginRight: 8 }}>
                    編集
                  </button>
                  <button onClick={() => removePost(p.id)} className="delete-btn">
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* セクション管理タブ */}
      {activeTab === "sections" && (
        <>
          <h2>新規セクション作成</h2>
          <div className="section-form">
            <input
              type="text"
              placeholder="セクション名"
              value={newSection.name}
              onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="説明"
              value={newSection.description}
              onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
            />
            <button onClick={addSection}>セクション作成</button>
          </div>

          <h2>セクション一覧</h2>
          <ul className="sections-list">
            {sections.map((section) => (
              <li key={section.id} className="section-item">
                {editingSection?.id === section.id ? (
                  <div className="section-edit">
                    <input
                      value={editingSection.name}
                      onChange={(e) =>
                        setEditingSection({ ...editingSection, name: e.target.value })
                      }
                    />
                    <input
                      value={editingSection.description}
                      onChange={(e) =>
                        setEditingSection({ ...editingSection, description: e.target.value })
                      }
                    />
                    <button onClick={() => updateSection(editingSection)}>保存</button>
                    <button onClick={() => setEditingSection(null)}>キャンセル</button>
                  </div>
                ) : (
                  <div className="section-view">
                    <div className="section-info">
                      <h3>{section.name}</h3>
                      <p>{section.description}</p>
                      <small>作成日: {section.createdAt}</small>
                    </div>
                    <div className="section-actions">
                      <button onClick={() => setEditingSection(section)}>編集</button>
                      <button onClick={() => deleteSection(section.id)} className="delete-btn">
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
