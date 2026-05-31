
# 新生SO-KI 実装プラン

「英語日記アプリ」から「AI英会話習慣化アプリ」への刷新です。既存画面・コンポーネントの大半を削除し、3画面（ホーム / 会話 / 復習）にスリム化します。

## ⚠️ 最重要：APIキーの安全管理

メッセージに記載いただいた `sk-proj-...` のOpenAIキーは、チャット履歴に残るため**公開済みとして扱う必要があります**。
1. **今すぐ** [OpenAIダッシュボード](https://platform.openai.com/api-keys) で該当キーをRevoke
2. 新しいキーを発行し、Lovableの**Secrets管理**（`OPENAI_API_KEY`）に登録 — コードには絶対書きません
3. クライアントから直接OpenAIを呼ばず、Edge Function経由でのみ呼び出します（キー漏洩防止）

実装は新キーがSecretsに登録された後に進めます。

## アーキテクチャ

```
ローカルストレージ（既存 localDb.ts を流用）
  ├─ conversations: { id, started_at, ended_at, messages[], photo_urls[],
  │                    summary, expressions[], reviewed_at, date }
  └─ profile: { streak, longest_streak, total_words, last_chat_date,
                recovery_days[] }

Edge Functions（OpenAI直結 / OPENAI_API_KEY使用）
  ├─ chat              : GPT-4o ストリーミング（自由会話）
  ├─ summarize         : 会話終了時にサマリー+汎用表現を構造化抽出
  ├─ transcribe        : Whisper（音声→テキスト）
  ├─ tts               : OpenAI TTS（AI返答の読み上げ）
  └─ evaluate-recall   : 復習回答の寛大判定（GPT-4o-mini）
```

写真はlocalStorageに圧縮Base64で保存（PWA / ログインなし前提）。

## 削除する画面・機能

- `/expressions`, `/instant` (Flashcard), `/quiz`, `/recall`, `/progress`, `/speak`, `/calendar`, `/auth`, `/onboarding`
- 神経衰弱、並び替えクイズ、強制終了、文数制限、Google認証
- 関連コンポーネント（`expressions/`, `quiz/`, `game/`, `review/ReviewHub` 等）と Edge Function `tag-expressions`, `daily-encouragement`
- ボトムタブバー（3画面構成なのでホーム集約）

## 新規・改修する画面

### ホーム `/`
- 上部: ストリーク日数 + 累計単語数
- 中央: 大きな波紋アニメーション付き○ボタン → タップで `/chat/new`
- 「復習する」ボタン（未復習件数バッジ）→ `/review`
- 下部: ログ一覧へのリンク `/logs`
- 猫キャラ（既存CatBuddy流用、セリフはログ件数で出し分け）

### 会話 `/chat/:id`
- ChatGPT風のシームレスUI、白背景、ミニマル
- 入力: テキスト + マイク（Whisper）+ 写真添付（カメラロール / 撮影）
- AI返答は自動でTTS再生（ミュート切替あり）
- 「終了」ボタン → サマリー＋汎用表現生成 → 「練習する / あとで」

### 復習 `/review`
- 未復習ログをキューで順次出題
- 各ログのサマリーを文単位に分割し、各文の日本語訳を表示 → ユーザーが英語で発話（Whisper）
- GPT-4o-miniで寛大判定（伝わればOK、沈黙/全く違う内容のみ❌）
- 正解=褒める / 不正解=正解文表示してそのまま次へ
- 全問終了で完了演出、ログに `reviewed_at` を記録

### ログ一覧 `/logs` + 詳細 `/logs/:id`
- 一覧: 日付順、写真サムネイル付き白背景カード、未復習バッジ、削除（警告ダイアログ付き）
- 詳細: 写真 → AIサマリー → 汎用表現リスト（添付の辞書風スタイリッシュレイアウト）→ 会話全文（折りたたみ）

## 技術詳細

- **写真**: `<input type="file" accept="image/*" capture>`、Canvas で長辺1280pxにリサイズ→JPEG Base64
- **Whisper**: MediaRecorder で webm/opus 録音 → FormDataでEdge Function送信 → OpenAI Whisper
- **TTS**: Edge FunctionでOpenAI TTS呼び出し → 音声バイナリをBlobで返却 → `Audio` 要素で再生
- **会話保存**: 終了ボタンで一括保存（途中保存はメッセージ単位でlocalStorageへ）
- **ストリーク**: 「○ボタン経由で1メッセージ以上送信して終了」した日のみ加算。リカバリーは既存ロジック流用
- **既存データ**: 個人利用のため破棄（初回起動時にマイグレーションで `soki_local_db_v1:*` をクリア、新スキーマ `soki_v2:*` を使用）

## 実装ステップ

1. 新キーをSecretsに登録（ユーザー作業 → 私がSecrets追加）
2. Edge Functions 4本作成（chat / summarize / transcribe / tts / evaluate-recall）
3. データ層 `src/lib/conversationStore.ts` 新規作成（localDb の上に新スキーマ）
4. 画面5つ実装（Home / Chat / Review / Logs / LogDetail）
5. ルーティング刷新（App.tsx）、不要ページ・コンポーネント削除
6. 動作確認（マイク権限、TTS再生、写真保存、ストリーク加算）

---

進めてよろしければ、まず **古いOpenAIキーをRevoke → 新キーを発行** してお知らせください。新キーは次のメッセージに貼っていただければ私がSecretsに登録します（コードには出しません）。
