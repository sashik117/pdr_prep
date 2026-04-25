import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DailyChallenge() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-4">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Calendar className="w-7 h-7 text-primary" />
        Щоденний виклик
      </h1>
      <p className="text-muted-foreground">
        Режим оновлюється під нову структуру прогресу. Поки можеш запускати daily з вибору тесту.
      </p>
      <Button asChild>
        <Link to="/tests?mode=daily">Запустити daily</Link>
      </Button>
    </div>
  );
}