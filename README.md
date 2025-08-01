

# イベント用貸出管理システム (Event Lending Management System)

[](https://react.dev/)
[](https://vitejs.dev/)
[](https://www.typescriptlang.org/)
[](https://supabase.io/)
[](https://tailwindcss.com/)

イベント運営における物品の貸出・返却を効率化し、リアルタイムで状況を可視化するためのWebアプリケーションです。


-----

## ✨ 主な機能

本システムは、イベント運営を円滑にするための多彩な機能を提供します。

  * **📊 ダッシュボード**: 登録物品数、イベント数、貸出状況などを一目で把握できます。人気物品ランキングや最近のアクティビティも表示されます。
  * **📦 物品管理**:
      * **バーコードスキャン・手動入力**による物品登録
      * CSVファイルによる**一括登録**とバリデーション
      * 登録済み物品の一覧表示、検索、編集、削除
  * **🗓️ イベント管理**:
      * イベントの新規作成
      * 既存イベントの検索、編集、削除
      * 過去のイベント情報をコピーして新しいイベントの物品を登録
  * **🔄 貸出・返却管理**:
      * **バーコードスキャン**または**ID手動入力**によるスピーディな貸出・返却処理
      * 貸出中の物品と経過時間をリアルタイムで表示
      * 誤操作時のための**自動処理キャンセル機能**や**再貸出機能**
  * **📈 貸出履歴と統計**:
      * イベントごとの貸出・返却ログの閲覧とソート
      * 貸出回数、総貸出時間、平均時間などの統計データをグラフや表で可視化
      * 時間帯ごとの貸出傾向を分析できるヒートマップ機能
      * 各種統計データのエクスポート（CSV、画像）
  * **👤 ユーザー認証とプロフィール**:
      * メールアドレスまたはGoogleアカウントによる認証
      * ユーザープロフィールの編集機能

-----

## 🛠️ 技術スタック

モダンな技術スタックを採用し、高速でインタラクティブなUI/UXを実現しています。

  * **フロントエンド**: React, Vite, TypeScript, Tailwind CSS, styled-components
  * **バックエンド & DB**: Supabase (Authentication, Database, Storage)
  * **UI & アニメーション**: Lucide React, Framer Motion, GSAP
  * **ライブラリ**:
      * `react-chartjs-2`: 統計グラフの描画
      * `react-zxing`: バーコードスキャン機能
      * `html2canvas`: 統計データの画像エクスポート

-----

## 🚀 セットアップと実行方法

1.  **リポジトリをクローン**:

    ```bash
    git clone https://github.com/your-username/event-lending-management.git
    cd event-lending-management
    ```

2.  **依存関係をインストール**:

    ```bash
    npm install
    ```

3.  **Supabaseのセットアップ**:

      * Supabaseプロジェクトを作成します。
      * `supabase/migrations` 内のSQLファイルを実行して、テーブルとポリシーを設定します。
      * プロジェクトルートに `.env` ファイルを作成し、SupabaseのURLとAnonキーを記述します。
        ```.env
        VITE_SUPABASE_URL=YOUR_SUPABASE_URL
        VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        ```
        （本プロジェクトには`.env`ファイルが添付されているため、その内容を参考にしてください）

4.  **開発サーバーを起動**:

    ```bash
    npm run dev
    ```

5.  ブラウザで `http://localhost:5173` を開きます。

-----

## 📁 ディレクトリ構成（主要部分）

```
event_lending_management/
├── supabase/
│   └── migrations/ # データベースのマイグレーションファイル
├── src/
│   ├── components/ # Reactコンポーネント
│   ├── lib/        # Supabaseクライアントなどの共通ライブラリ
│   └── App.tsx     # アプリケーションのメインコンポーネント
├── .env            # 環境変数ファイル
├── package.json    # プロジェクト設定と依存関係
└── vite.config.ts  # Viteの設定ファイル
```

