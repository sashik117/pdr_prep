import { Link } from 'react-router-dom';
import { BookOpen, Zap, Brain, Calendar, ArrowRight, Shield, BarChart3, Trophy, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const testModes = [
  { icon: Zap, title: 'Швидкий тест', description: '10 питань для перевірки знань', path: '/tests?mode=quick', color: 'bg-primary/10 text-primary' },
  { icon: BookOpen, title: 'Повний іспит', description: '20 питань як на реальному іспиті', path: '/tests?mode=full', color: 'bg-accent/20 text-accent-foreground' },
  { icon: Brain, title: 'Складні питання', description: 'Тренування помилок', path: '/tests?mode=difficult', color: 'bg-destructive/10 text-destructive' },
  { icon: Calendar, title: 'Виклик дня', description: 'Щоденний випадковий набір', path: '/tests?mode=daily', color: 'bg-success/10 text-success' },
  { icon: Brain, title: 'Повторення (SRS)', description: 'Інтервальне повторення SM-2', path: '/tests?mode=srs', color: 'bg-purple-100 text-purple-700' },
];

const features = [
  { icon: Shield, title: 'Офіційні білети', desc: 'Питання з ГСЦ МВС' },
  { icon: Brain, title: 'Розумне навчання', desc: 'Адаптація під ваш рівень' },
  { icon: BarChart3, title: 'Детальна статистика', desc: 'Відстежуйте прогрес' },
  { icon: Trophy, title: 'Досягнення', desc: 'Мотивація через геймифікацію' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center pt-8 sm:pt-16"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Shield className="w-4 h-4" />
          Офіційні білети ГСЦ МВС
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-foreground tracking-tight leading-tight">
          Підготовка до іспиту
          <br />
          <span className="text-primary">з ПДР</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
          Інтелектуальна система навчання, яка адаптується під вас. 
          Тренуйтесь на реальних питаннях і здайте іспит з першого разу.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Button asChild size="lg" className="h-13 px-8 text-base rounded-xl">
            <Link to="/tests">
              Почати навчання
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-13 px-8 text-base rounded-xl">
            <Link to="/progress">Мій прогрес</Link>
          </Button>
        </div>
      </motion.section>

      {/* Test modes */}
      <section>
        <h2 className="text-2xl font-bold text-foreground mb-6">Режими тестування</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {testModes.map((mode, i) => (
            <motion.div
              key={mode.title}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <Link
                to={mode.path}
                className="group block p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${mode.color} flex items-center justify-center mb-4`}>
                  <mode.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{mode.title}</h3>
                <p className="text-sm text-muted-foreground">{mode.description}</p>
                <div className="mt-4 flex items-center text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Розпочати <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Import link */}
      <div className="flex justify-center">
        <Link to="/import" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <Upload className="w-4 h-4" />
          Імпорт питань з JSON
        </Link>
      </div>

      {/* Features */}
      <section className="pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i + 4}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="flex flex-col items-center text-center p-6 rounded-2xl bg-card border border-border"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}