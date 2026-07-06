# 第10回課題 — UniFilter AI v6（毎日スマホで開けるプロダクトへ）

## プロダクト概要

**UniFilter AI v6** — 大学生向け AI メールフィルタリングダッシュボード。
ログインしたユーザー自身の Gmail を読み取り専用でリアルタイム取得し、
AI 整理（分類・締切抽出・要約・返信ドラフト・ToDo 抽出）を本物の受信トレイに対して実行する。

v6 では、ユーザーインタビューで挙がった「取り込みの摩擦をなくしてほしい」「スマホ対応がほしい」という声を受け、
**「課題が重なる時期に毎日スマホで開く」** を実現するための 3 機能を追加した。

## v5 → v6 の差分（3点）

| # | 機能 | 内容 |
|---|------|------|
| ① | **表示順の切り替え** | 既定の「重要度順」に加え、ワンタップで「🕐 新着順（日時が新しい順）」へ切り替えられるトグルをメインヘッダーに追加。選択は localStorage に保存され次回も維持される。 |
| ② | **キーワード自動振り分けフィルタ** | ユーザーが登録したキーワードを含むメールを、指定カテゴリ（授業・課題・バイト・サークル 等）へ自動で振り分け。件名・本文・差出人を検索してカードにカテゴリタグを付与し、サイドバーの「マイカテゴリ」から絞り込める。ルールの**追加・編集・削除**に対応し、設定は **localStorage** に保存（外部サーバ不要）。 |
| ③ | **スマホ対応（レスポンシブ）** | 375px〜のスマホで崩れない 1 カラムレイアウトに。サイドバーはハンバーガーで開くドロワー、右パネル（詳細/ダイジェスト）は全画面オーバーレイ化。ボタン・フォント・タップ領域を拡大し、余白・スクロールをスマホ向けに最適化。**メール一覧・ToDo・返信ドラフト**の 3 画面を重点対応。 |

### 1 行サマリ

**Gmail 連携済みの v5 に、「表示順トグル（重要度順⇄新着順）」「キーワード自動振り分け（localStorage 永続・追加/編集/削除）」「375px〜のレスポンシブ（ドロワー＋全画面パネル）」の 3 機能を追加し、忙しい時期も毎日スマホで開ける実用プロダクトにした。**

## v6 の実装ポイント（ファイル：`dashboard.html`）

- **① 表示順**：`sortMode`（`importance`/`date`）を localStorage に保存。`toTimestamp()` で Gmail(RFC2822)・サンプル・取り込みの混在日付フォーマットを吸収し、`date` モードでは種別グルーピングをやめて日時降順のフラット表示に切替。
- **② キーワード振り分け**：`unifilter_v6_filters` に `{keyword, category}` の配列を保存。`matchCategory()` が件名＋本文＋差出人を走査し最初に一致したカテゴリを返す。`categoryColor()` がカテゴリ名から安定した色を生成。空スタブだった `openSettings()` を設定モーダル（追加フォーム＋インライン編集＋削除）に置き換え。
- **③ レスポンシブ**：`@media (max-width: 768px)` で `.app` のグリッドを解除して 1 カラム化。`body.sidebar-open` / `body.panel-visible` のクラス切替でドロワーと全画面パネルを制御（`toggleSidebar` / `openDigestMobile` / `closeMobilePanel`）。

## アーキテクチャ（v5 から継承）

- **ホスティング**：Vercel（静的 HTML ＋ `/api` Serverless Functions）
- **フロント**：フレームワーク・ビルド不使用の単一 HTML / CSS / JS
- **AI 整理**：ブラウザ内ヒューリスティック（キーワード/正規表現）。外部 LLM API は呼ばない
- **OAuth**：Authorization Code フロー（サーバ側で code→トークン交換、`gmail.readonly`、トークンは HttpOnly Cookie）

### OAuth フロー

```
ランディング「Google でログイン」
  → GET /api/auth/login      … 同意画面へリダイレクト（scope=gmail.readonly + openid email、state で CSRF 対策）
  → GET /api/auth/callback   … code をトークンに交換し HttpOnly Cookie に格納 → /lectures/lecture10/dashboard.html
ダッシュボード読み込み
  → GET /api/gmail/messages  … Cookie のトークンで Gmail を取得 {from,subject,body,date}（保存しない）
ログアウト
  → GET /api/auth/logout     … Cookie 破棄 → ランディングへ
```

### ファイル構成

```
/                        ルート。/lectures/lecture10/ へリダイレクト
/api
  /_lib/google.js        OAuth/Cookie 共通ヘルパ（サーバ側のみ）
  /auth/login.js         OAuth 開始
  /auth/callback.js      code → トークン交換、HttpOnly Cookie 発行（→ lecture10 へ）
  /auth/me.js            ログイン状態のみ返す
  /auth/logout.js        Cookie 破棄（→ lecture10 へ）
  /gmail/messages.js     Gmail 受信トレイ取得 → {from,subject,body,date}（永続保存なし）
/lectures/lecture10
  index.html             ① ランディング（ログイン前）
  dashboard.html         ② ダッシュボード（v6：表示順トグル・キーワード振り分け・レスポンシブ）
  README.md              本ファイル
/lectures/lecture9       v5（Gmail 連携版）を温存（壊していない）
```

## localStorage キー

| キー | 内容 |
|------|------|
| `unifilter_v4_state` | 取り込みメール・既読/スター/処理済み・アーカイブ・サンプル表示設定・**表示順(sortMode)** |
| `unifilter_v6_filters` | **キーワード振り分けルール** `[{id, keyword, category}]`（v6 で追加） |

## セキュリティ・プライバシー（v5 から継続）

- スコープは **`gmail.readonly` のみ**（送信・削除・変更なし）。
- クライアントシークレット／アクセストークンはフロントに出さず、`/api`（サーバ側）でのみ扱う。トークンは **HttpOnly Cookie**。
- 取得したメール本文は**サーバに永続保存しない**。ブラウザ側でも Gmail 本文は localStorage に保存しない（軽量な状態と、振り分けルールのみ保存）。
- AI 整理はブラウザ内で完結し、メール本文を外部 AI サービスへ送信しない。

## デプロイ / 動作確認

- 既存の Vercel プロジェクトに push すると自動デプロイされる。
- 本番 URL（v6 が表示される）：https://koudai1969-web3ai-2026-b3xk.vercel.app
- Google Cloud Console の承認済みリダイレクト URI（`.../api/auth/callback`）と Vercel 環境変数（`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`）は v5 のものをそのまま利用。

## 成果物

- Vercel のデプロイ URL（動作版）
- GitHub リポジトリ（認証情報を含まない）
