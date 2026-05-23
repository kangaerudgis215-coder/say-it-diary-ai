import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  List,
  Brain,
  Sparkles,
  Shuffle,
  TrendingUp,
  Plus,
  Mic,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const TABS: Array<{
  icon: typeof Brain;
  name: string;
  what: string;
  how: string;
}> = [
  {
    icon: CalendarDays,
    name: 'Home（カレンダー）',
    what: 'カレンダー＋ストリーク炎＋猫のSO-KI。日付をタップして日記を書きます。',
    how: 'タップ → 「今日の日記を書く」 → 話すか、チャットで会話。',
  },
  {
    icon: List,
    name: 'Entries（一覧）',
    what: '過去の日記をリスト表示。検索や月別グループで振り返れます。',
    how: 'カードをタップ → 日記詳細・復習画面へ。',
  },
  {
    icon: Brain,
    name: 'Recall（復習）',
    what: '過去の日記を並び替えクイズで思い出す練習。赤いバッジ＝未復習の数。',
    how: '一番古い未復習から順に出題 → 並び替え → 音読 → 完了。',
  },
  {
    icon: Sparkles,
    name: 'Phrases（表現）',
    what: '日記から自動抽出された表現＋自分で追加した表現の一覧。',
    how: '新規 / 練習中 / マスター済みで分類。タップして詳細・差し替え。',
  },
  {
    icon: Shuffle,
    name: 'Flashcards',
    what: 'スワイプ式のフラッシュカードで表現を高速復習。',
    how: '左：もう一度 / 右：覚えた。マスタリーが自動更新されます。',
  },
  {
    icon: TrendingUp,
    name: 'Progress（進捗）',
    what: '今日の語彙数、7日間グラフ、表現マスタリー、AIからの一言。',
    how: '毎晩チェックして成長を確認しよう。',
  },
];

const FLOW: Array<{ step: string; title: string; body: string; Icon: typeof Mic }> = [
  {
    step: '①',
    title: '話す or チャット',
    body: '日付をタップ → マイクで話すか、テキストでSO-KIと会話します。',
    Icon: Mic,
  },
  {
    step: '②',
    title: '日記を生成',
    body: '「Finish Diary」をタップ → AIが英語日記＋使える表現を作成。',
    Icon: BookOpen,
  },
  {
    step: '③',
    title: '復習',
    body: '並び替え → 音読で記憶に定着。翌日以降も Recall タブから何度でも。',
    Icon: Brain,
  },
  {
    step: '④',
    title: '続ける',
    body: 'ストリークの炎が育ち、表現が貯まっていきます。',
    Icon: Sparkles,
  },
];

export default function Help() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col p-4 pb-24 bg-background">
      <header className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="戻る">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">使い方 & ヘルプ</h1>
          <p className="text-xs text-muted-foreground">SO-KIの全機能ガイド 🐾</p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-3 text-foreground/90">アプリの流れ</h2>
        <div className="grid grid-cols-1 gap-2">
          {FLOW.map(({ step, title, body, Icon }) => (
            <Card key={title} className="bg-card/70 border-border/60">
              <CardContent className="py-3 px-4 flex gap-3 items-start">
                <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    <span className="text-primary mr-1">{step}</span>
                    {title}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                    {body}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-bold mb-3 text-foreground/90">下のタブの使い方</h2>
        <div className="grid grid-cols-1 gap-2">
          {TABS.map(({ icon: Icon, name, what, how }) => (
            <Card key={name} className="bg-card/70 border-border/60">
              <CardContent className="py-3 px-4 flex gap-3 items-start">
                <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{name}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed mt-0.5">
                    {what}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                    💡 {how}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mb-2">
        <h2 className="text-sm font-bold mb-3 text-foreground/90">よくある質問</h2>
        <div className="space-y-2">
          <Card className="bg-card/70 border-border/60">
            <CardContent className="py-3 px-4">
              <p className="text-sm font-bold">Q. 過去の日付の日記も書ける？</p>
              <p className="text-xs text-muted-foreground mt-1">
                A. はい。カレンダーから過去の日をタップすればストリークを途切れさせずに埋められます。
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/60">
            <CardContent className="py-3 px-4">
              <p className="text-sm font-bold">Q. 音が出ない / 音声が変</p>
              <p className="text-xs text-muted-foreground mt-1">
                A. ホーム右上の <span className="inline-block px-1.5 py-0.5 rounded bg-muted text-foreground text-[10px] font-mono">🔊</span> ボタンで音声をリセットできます。
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/70 border-border/60">
            <CardContent className="py-3 px-4">
              <p className="text-sm font-bold">Q. 表現を差し替えたい</p>
              <p className="text-xs text-muted-foreground mt-1">
                A. レビュー画面の表現カードをタップ → 「言い換え候補」から選ぶと本文と一緒に更新されます。
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}