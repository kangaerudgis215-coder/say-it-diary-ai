## ゴール

- Googleログイン削除。アプリ起動 → 即使える
- 日記/会話/表現/復習データを **localStorage** に保存（Supabase DBは使わない）
- AI機能（チャット、日記生成、表現抽出、評価、励まし）はそのまま **匿名でEdge Functionを呼ぶ**
- 「ダッシュボード（Mastered Diaries / DailyEncouragement の Pro系UI）」は隠す
- Pro課金/Stripe導線は当面隠す（コードは残置）

## アプローチ（最小侵襲）

DB呼び出しを全部書き換えると影響範囲が大きすぎるため、**互換シム（compat shim）** を1枚かぶせて既存コードを温存する。

### 1. ローカルアイデンティティ

- 初回起動時に `crypto.randomUUID()` で `local_user_id` を発行 → localStorage 保存
- `useAuth()` を書き換え、Supabase Authを呼ばずに固定ユーザ `{ id: localUserId }` を返す（loading即false / user常にtruthy）
- これで `useAuth().user.id` を参照している全コンポーネントは無修正で動く

### 2. データ層シム（`src/lib/supabase.ts` を差し替え）

`supabase`オブジェクトをラップし、`.from('table')` をlocalStorageドライバへ橋渡し：

```text
localStorage keys:
  soki_local_db_v1:diary_entries        → DiaryEntry[]
  soki_local_db_v1:diary_sentences      → DiarySentence[]
  soki_local_db_v1:expressions          → Expression[]
  soki_local_db_v1:conversations        → Conversation[]
  soki_local_db_v1:messages             → Message[]
  soki_local_db_v1:recall_sessions      → RecallSession[]
  soki_local_db_v1:full_diary_attempts  → ...
  soki_local_db_v1:instant_attempts     → ...
  soki_local_db_v1:spoken_vocab         → ...
  soki_local_db_v1:profile              → Profile
```

提供するメソッドチェーン（既存コードで使われているものだけ）:
- `.select(cols).eq().neq().in().gte().lte().order().limit().maybeSingle().single()`
- `.insert(row).select().single()`
- `.update(patch).eq()`
- `.upsert(row, {onConflict})`
- `.delete().eq()`
- ストリーク等は `.rpc()` 不使用箇所のみ。RPCは廃止して、ストリーク計算をTSで実装（`src/lib/localStreak.ts`）してprofileに反映

`supabase.functions.invoke('chat'|'tag-expressions'|'evaluate-recall'|'daily-encouragement', ...)` は **本物の supabase クライアント**へパススルー（AIは引き続きEdge Function経由で動く）。Edge Functions は匿名キーで呼べる前提（既に verify_jwt=false ）。

`supabase.auth.*` は noop に。

### 3. オンボーディング/ルーティング

- `Onboarding.tsx`: フッターを「**はじめる**」ボタンに置換（Google削除）。タップで `local_user_id` を確実に作って `/` へ
- `Index.tsx`: 未onboardedなら `/onboarding` へ、それ以外は `<Home />`
- `Auth.tsx`: `/` へリダイレクト

### 4. ダッシュボード非表示

- `Home.tsx` / `Progress.tsx` から下記を非表示（コンポーネントは残す）:
  - `<MasteredDiariesBadge />`
  - `<DailyEncouragement />`（AI呼び出しもしない）
- Pro課金UI（PaywallSheetなど）があればフラグでoff

### 5. Edge Function側

- `chat`, `tag-expressions`, `evaluate-recall`, `daily-encouragement` の `userId` は body から受け取って使うのみ（auth.uidに依存しない）。既にそうなっているか確認、依存していれば修正

### 6. 後片付け

- `src/integrations/lovable/index.ts` への参照を `Onboarding.tsx` から削除
- `useAuth` の signUp/signIn/signOut は no-op で残す（呼び出し元エラー回避）

## 影響範囲（概算）

新規/書き換え:
- `src/lib/localDb.ts`（新規）── localStorageドライバ＋クエリビルダ
- `src/lib/localStreak.ts`（新規）
- `src/lib/supabase.ts`（差し替え）── localDb と本物クライアントを合成
- `src/hooks/useAuth.tsx`（差し替え）
- `src/pages/Onboarding.tsx`（Google削除）
- `src/pages/Index.tsx`（loading不要に）
- `src/pages/Home.tsx`（ダッシュボードUI非表示）
- `src/pages/Progress.tsx`（DailyEncouragement非表示）

その他コンポーネントは無修正で動く想定（インターフェースを温存するため）。

## トレードオフ

- **Pro**: 既存コードへの侵襲ゼロに近い。ロールバック簡単（localDbシムを外して本物clientに戻すだけ）
- **Con**: シム経由なのでクエリの一部（複雑なjoinやfilter）が未対応の可能性 → 動作確認しながらシム側に追加

## 検証

- 起動 → ログイン画面出ない
- チャット送信 → SO-KIから返信（AI動作）
- 日記生成 → 表示・保存される
- リロード → データ残っている
- 並び替えクイズ → 正常動作
- 進捗タブ → ストリーク計算される
