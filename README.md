MyCMS 2025
シンプルで柔軟なコンテンツ管理システム
機能

セクション管理
記事投稿・編集・削除
画像アップロード
レスポンシブデザイン

ローカル開発
必要な環境

Node.js 18以上

セットアップ
bash# サーバーディレクトリに移動
cd server

# 依存パッケージをインストール
npm install

# サーバー起動
npm start
サーバーが http://localhost:4000 で起動します。
その後、別のターミナルで以下を実行:
bash# プロジェクトルートで
npx http-server -p 3000
ブラウザで http://localhost:3000 を開いてください。
デプロイ
RenderまたはHerokuにデプロイ可能です。
環境変数

PORT: サーバーポート（自動設定）

ライセンス
MIT
