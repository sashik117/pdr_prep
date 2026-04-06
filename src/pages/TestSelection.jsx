import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, BookOpen, Brain, Calendar, ArrowRight, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const modes = [
  { id: 'quick', icon: Zap, label: 'Швидкий тест', desc: '10 питань — швидка перевірка', questions: 10 },
  { id: 'full', icon: BookOpen, label: 'Повний іспит', desc: '20 питань як на іспиті ГСЦ', questions: 20 },
  { id: 'difficult', icon: Brain, label: 'Складні питання', desc: 'Питання, в яких ви помилялись', questions: 10 },
  { id: 'daily', icon: Calendar, label: 'Виклик дня', desc: 'Унікальний набір на сьогодні', questions: 15 },
];

const categories = ['A', 'B', 'C', 'D', 'BE', 'CE'];

const topics = [
  'Дорожні знаки',
  'Дорожня розмітка',
  'Сигнали регулювальника',
  'Проїзд перехресть',
  'Перевезення пасажирів',
  'Швидкісний режим',
  'Проїзд пішохідних переходів',
  'Маневрування',
  'Обгін',
  'Зупинка і стоянка',
];

export default function TestSelection() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedMode = urlParams.get('mode');

  const [selectedMode, setSelectedMode] = useState(preselectedMode || 'quick');
  const [selectedCategory, setSelectedCategory] = useState('B');
  const [selectedTopic, setSelectedTopic] = useState(null);

  const handleStart = () => {
    const params = new URLSearchParams({
      mode: selectedMode,
      category: selectedCategory,
    });
    if (selectedTopic) params.set('topic', selectedTopic);
    navigate(`/test?${params.toString()}`);
  };

  const currentMode = modes.find(m => m.id === selectedMode);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Обрати тест</h1>
        <p className="text-muted-foreground mt-2">Налаштуйте параметри тестування</p>
      </motion.div>

      {/* Mode selection */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Режим</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left",
                selectedMode === mode.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/20 bg-card"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                selectedMode === mode.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <mode.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-foreground">{mode.label}</div>
                <div className="text-sm text-muted-foreground">{mode.desc}</div>
                <Badge variant="secondary" className="mt-2 text-xs">{mode.questions} питань</Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Категорія</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                selectedCategory === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-muted-foreground/20"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Topic */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Тема</h2>
          <span className="text-xs text-muted-foreground">(необов'язково)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTopic(null)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
              !selectedTopic
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <Filter className="w-3.5 h-3.5 inline mr-1.5" />
            Усі теми
          </button>
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => setSelectedTopic(topic)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                selectedTopic === topic
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {topic}
            </button>
          ))}
        </div>
      </div>

      {/* Start button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-4"
      >
        <Button onClick={handleStart} size="lg" className="w-full sm:w-auto h-13 px-10 text-base rounded-xl">
          Розпочати {currentMode?.label?.toLowerCase()}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
}