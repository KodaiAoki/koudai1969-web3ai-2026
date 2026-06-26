# 第9回課題 — UniFilter AI v5（Gmail リアルタイム連携・実用化フェーズ）

## プロダクト概要

**UniFilter AI v5** — 大学生向け AI メールフィルタリングダッシュボード。
v5 では **ログインしたユーザー自身の Gmail を読み取り専用でリアルタイム取得**し、
既存の AI 整理（分類・締切抽出・要約・返信ドラフト・ToDo 抽出）を本物の受信トレイに対して実行する。

## v4 → v5 の差分（1行）

**サンプル/手動インポート専用だった v4 を、Google OAuth でログインしたユーザー本人の Gmail を `gmail.readonly` でリアルタイム取得し、既存の AI 整理をそのまま回す「実用版」に拡張した（認証情報はサーバ側のみ、本文は非保存）。**

## 2層構造

1. **ログイン前ランディング**（`index.html`／誰でも見える）
   - プロダクト説明・機能・スクショ風モックアップ
   - 「Google でログイン」ボタン（→ `/api/auth/login`）
   - テストユーザー登録の案内（申請先は `index.html` 内の `TODO` プレースホルダに差し込み）

2. **ログイン後ダッシュボード**（`dashboard.html`／本人のみ）
   - 起動時に `/api/auth/me` でログイン確認 → 未ログインならランディングへ
   - `/api/gmail/messages` で本人の受信トレイを取得し、各メールを既存 `analyzeEmailAI()` に通して表示
   - 複数ユーザーが各自の Google アカウントでログインでき、それぞれ自分のメールだけ見える（トークンは各自の HttpOnly Cookie）

## アーキテクチャ

- **ホスティング**：Vercel（静的 HTML ＋ `/api` Serverless Functions）
- **フロント**：v4 の単一 HTML / CSS / JS をほぼそのまま再利用（フレームワーク・ビルド不使用）
- **AI 整理**：v4 と同じ**ブラウザ内ヒューリスティック**（キーワード/正規表現）。外部 LLM API は呼ばない

### OAuth フロー（Authorization Code / サーバ側）

```
ランディング「Google でログイン」
  → GET /api/auth/login      … 同意画面へリダイレクト（scope=gmail.readonly + openid email、state で CSRF 対策）
  → Google が code を付与
  → GET /api/auth/callback   … サーバ側で code をトークンに交換（client_secret 使用）
                               access_token を HttpOnly/Secure/SameSite Cookie に格納
  → /lectures/lecture9/dashboard.html へ
ダッシュボード読み込み
  → GET /api/gmail/messages  … Cookie のトークンで Gmail API を叩き {from,subject,body,date} を返す（保存しない）
ログアウト
  → GET /api/auth/logout     … Cookie 破棄 → ランディングへ
```

### ファイル構成

```
/api
  /_lib/google.js        OAuth/Cookie 共通ヘルパ（サーバ側のみ）
  /auth/login.js         OAuth 開始（同意画面へリダイレクト）
  /auth/callback.js      code → トークン交換、HttpOnly Cookie 発行
  /auth/me.js            ログイン状態のみ返す
  /auth/logout.js        Cookie 破棄
  /gmail/messages.js     Gmail 受信トレイ取得 → {from,subject,body,date}（永続保存なし）
/lectures/lecture9
  index.html             ① ランディング（ログイン前）
  dashboard.html         ② ダッシュボード（v4 UI/ロジックを再利用＋Gmail 連携）
  README.md              本ファイル
```

## セキュリティ・プライバシー

- **スコープは `gmail.readonly` のみ**。送信・削除・変更系のスコープは一切要求しない。
- **クライアントシークレット／アクセストークンはフロント(JS)に出さない**。Vercel 環境変数に格納し、`/api`（サーバ側）でのみ扱う。トークンは **HttpOnly Cookie**（JS から読めない）。
- **`.env*` は `.gitignore` 済み**で GitHub にコミットしない。
- **取得したメール本文はサーバに永続保存しない**。その場で整形して画面に返すだけ。
- ブラウザ側でも Gmail 本文は localStorage に保存しない（既読/スター/処理済みの軽量な状態だけを保存）。手動インポート分は従来どおり localStorage に保持。
- **AI 解析の経路**：分類・締切抽出・要約・返信ドラフトは**ブラウザ内のヒューリスティック**で完結し、**メール本文を外部 AI サービスへ送信しない**。

## 既存資産の扱い

- v4 の AI 整理・締切抽出・返信ドラフト・締切タイムライン・ToDo 抽出・localStorage 永続化等の UI/ロジックを再利用。
- **手動インポート（テキスト/JSON/CSV）は Gmail 連携できない人向けフォールバックとして維持**。
- v4（`/lectures/lecture8/`）はそのまま温存（壊していない）。

## 必要な準備（デプロイ手順）

### Google Cloud Console
1. プロジェクトを作成
2. **Gmail API** を有効化
3. **OAuth 同意画面**：ユーザー種別「外部」／公開ステータス「テスト」。スコープに `.../auth/gmail.readonly` を追加。**テストユーザー**にログインさせたい Gmail を登録
4. **認証情報 → OAuth クライアント ID（ウェブアプリケーション）** を作成し、承認済みリダイレクト URI を登録：
   - `https://<アプリ名>.vercel.app/api/auth/callback`
   - `http://localhost:3000/api/auth/callback`
5. 発行された **Client ID / Client Secret** を控える

### Vercel 環境変数（Environment Variables）
| 変数名 | 値 |
|--------|-----|
| `GOOGLE_CLIENT_ID` | OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | OAuth クライアントシークレット |
| `GOOGLE_REDIRECT_URI` | `https://<アプリ名>.vercel.app/api/auth/callback` |

### ローカル開発
```
npm i -g vercel
vercel dev      # http://localhost:3000 で /api も動く
```
`.env.local`（コミットされない）に上記 3 変数を設定。`.env.example` を参照。

## 成果物
- Vercel のデプロイ URL（動作版）
- GitHub リポジトリ（認証情報を含まない）
