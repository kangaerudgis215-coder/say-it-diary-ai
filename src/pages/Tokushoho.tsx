import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const sections = [
  { title: '販売業者', content: '（ここに記入）' },
  { title: '運営統括責任者', content: '（ここに記入）' },
  { title: '所在地', content: '（ここに記入）' },
  { title: '連絡先メールアドレス', content: '（ここに記入）' },
  { title: '販売URL', content: '（ここに記入）' },
  { title: '販売価格', content: '（ここに記入）' },
  { title: '商品代金以外の必要料金', content: '（ここに記入）' },
  { title: 'お支払い方法', content: '（ここに記入）' },
  { title: '代金の支払い時期', content: '（ここに記入）' },
  { title: '商品の引き渡し時期', content: '（ここに記入）' },
  { title: '返品・キャンセルについて', content: '（ここに記入）' },
  { title: '免責事項', content: '（ここに記入）' },
];

export default function Tokushoho() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-8 font-japanese">
          特定商取引法に基づく表記
        </h1>

        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-1 font-japanese">
                {s.title}
              </h2>
              <p className="text-base font-japanese">{s.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
