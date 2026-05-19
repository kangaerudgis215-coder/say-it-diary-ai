## 概要
「話すだけで日記を生成」モード（Speak Mode）を追加します。上級者向けで、チャット形式かスピーク形式かを選択できるようにします。当日・過去・ペンアイコンすべてに適用します。

## モード選択 UI
ペンアイコン（ComposeFAB）タップ時、および「この日の日記を書く」ボタンタップ時に、モード選択シートを表示：

- **🗨 SO-KIと会話する**（既存のチャットモード／初心者向け）
- **🎙 話してそのまま日記化**（新規スピークモード／上級者向け）

選択は localStorage に「次回からのデフォルト」として保存可能（チェックボックス）。

## スピークモード画面 `/speak?date=YYYY-MM-DD`

シンプルな音声メモ風画面：

```
┌────────────────────────────────┐
│  ←戻る   2026/5/19           │
├────────────────────────────────┤
│  今日あったことを話してみよう  │
│                                │
│  [入力されたテキストが        │
│   どんどん貯まっていく        │
│   タップで編集も可能]         │
│                                │
│  ───── 残り: 6 / 10 ─────      │
│                                │
│      🎙 タップで話す           │
│      （または ⌨️ で入力）       │
│                                │
│  [✨ 日記を生成する]           │
└────────────────────────────────┘
```

### 動作
- 大きなマイクボタン1つ。タップ→録音開始、再タップで停止。停止のたびに認識結果を末尾に追記（改行区切り）。
- キーボードアイコンでテキスト直接入力も可能。
- 「区切り」を1ターンとカウント（マイクの開始〜停止 or 手動送信1回）。
- **上限**: 10ターン または 約300語。超過したら新規入力欄を無効化し「制限に達しました。日記を生成しましょう」と表示。
- **生成ボタン出現条件**: 累計 40 語以上（チャットの ChatBubble 最低3往復に相当）になったら下部に固定表示。
- 生成ボタン押下 → 既存の日記生成パイプラインを再利用（後述）。

## 既存パイプラインへの接続
スピークモードでもチャットと同じく `conversations` + `messages` テーブルを使う：
- セッション開始時に `conversations` に1行作成
- 各ターンを `messages` に `role='user'` として保存（`assistant` メッセージは無し）
- 「日記を生成」押下 → 既存の chat edge function の "diary生成リクエスト" 部分と同じ呼び出し方を使う（`Chat.tsx` の `handleFinishDiary` ロジックを共通化）。
- 生成後の Review 画面遷移はチャットと同一。

これにより diary_entries / expressions / diary_sentences への保存・既存の Review/Quiz/Recall フローはそのまま動作します。

## ホーム表示
`SelectedDayChatPreview` を拡張、または新規 `SelectedDaySpeakPreview` を追加：
- そのdiaryが **chat由来** か **speak由来** かを `conversations` に `mode` カラムを追加して判別
- speak由来の場合は「🎙 あなたのスピーク」プレビュー（user発話のみ縦並び）
- chat由来は従来通りのチャットプレビュー
- 両方ある日は両方表示（タブ切替）

## 技術メモ
- DB: `conversations` に `mode TEXT NOT NULL DEFAULT 'chat'` 追加（migration 1本）。値: `'chat' | 'speak'`。
- 新規ファイル:
  - `src/pages/Speak.tsx`
  - `src/components/speak/SpeakComposer.tsx`（マイク + テキストエリア + ターンカウンタ）
  - `src/components/home/ComposeModeSheet.tsx`（モード選択シート）
  - `src/components/home/SelectedDaySpeakPreview.tsx`
  - `src/lib/diaryGeneration.ts`（Chat.tsx から生成ロジックを抽出して共通化）
- ルーティング: `App.tsx` に `/speak` 追加
- 既存 `ComposeFAB`・Home の "この日の日記を書く"・`SelectedDayChatPreview` の「続きを話す」ボタンを Sheet 経由に変更
- マイク・効果音は既存の `audioSession` / `useSpeechRecognition` を再利用（最近の安定化対応をそのまま享受）

## 範囲外
- 音声波形ビジュアライザ（後日）
- スピーク履歴の再編集（最低限のテキスト編集のみ）
- 多言語切替（日本語UI固定、認識は英語 `en-US`）
