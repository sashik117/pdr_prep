import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Star, Zap, Calendar, Shield, Award, Target, BookOpen, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const ACHIEVEMENTS = [
  { id: 'first_test', icon: Star, name: 'Перший крок', desc: 'Пройти перший тест', check: (p) => (p.total_tests || 0) >= 1 },
  { id: 'sign_master', icon: Shield, name: 'Майстер знаків', desc: '100 правильних відповідей', check: (p) => (p.total_correct || 0) >= 100 },
  { id: 'streak_7', icon: Calendar, name: 'Пунктуальний учень', desc: '7 днів активності', check: (p) => (p.activity_dates || []).length >= 7 },
  { id: 'perfect_test', icon: Trophy, name: 'Бездоганний', desc: 'Тест без помилок', check: (p, r) => r.some(t => t.score_percent === 100) },
  { id: 'ten_tests', icon: BookOpen, name: 'Старанний учень', desc: 'Пройти 10 тестів', check: (p) => (p.total_tests || 0) >= 10 },
  { id: 'examiner', icon: Award, name: 'Екзаменатор', desc: '3 тести без помилок', check: (p, r) => r.filter(t => t.score_percent === 100).length >= 3 },
  { id: 'speed_demon', icon: Zap, name: 'Блискавка', desc: 'Тест менше ніж за 2 хвилини', check: (p, r) => r.some(t => (t.time_spent_seconds || 999) < 120) },
  { id: 'accuracy_90', icon: Target, name: 'Снайпер', desc: '90% загальна точність', check: (p) => (p.total_questions_answered || 0) > 0 && ((p.total_correct || 0) / (p.total_questions_answered || 1)) >= 0.9 },
];

function AchievementToast({ achievement, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -40, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30 cursor-pointer"
      onClick={onClose}
    >
      <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center shrink-0">
        <achievement.icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium opacity-80">🏆 Нове досягнення!</p>
        <p className="text-sm font-bold">{achievement.name}</p>
        <p className="text-xs opacity-80">{achievement.desc}</p>
      </div>
    </motion.div>
  );
}

export default function Achievements() {
  const [newAchievements, setNewAchievements] = useState([]);
  const prevEarnedRef = useRef(null);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user || null;
    },
  });

  const { data: progressList = [] } = useQuery({
    queryKey: ['userProgress'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from('user_progress').select('*').eq('created_by', user.email);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: results = [] } = useQuery({
    queryKey: ['testResults'],
    queryFn: async () => {
      const { data } = await supabase.from('test_results').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!user,
  });

  const progress = progressList[0] || {};

  const achievementsWithStatus = ACHIEVEMENTS.map((a) => ({
    ...a,
    earned: !!user && a.check(progress, results),
  }));

  useEffect(() => {
    if (!user || progressList.length === 0) return;
    const currentEarned = new Set(achievementsWithStatus.filter(a => a.earned).map(a => a.id));
    if (prevEarnedRef.current === null) {
      prevEarnedRef.current = currentEarned;
      return;
    }
    const newlyEarned = [...currentEarned].filter(id => !prevEarnedRef.current.has(id));
    if (newlyEarned.length > 0) {
      const toShow = ACHIEVEMENTS.filter(a => newlyEarned.includes(a.id));
      setNewAchievements(prev => [...prev, ...toShow]);
    }
    prevEarnedRef.current = currentEarned;
  }, [achievementsWithStatus, user]);

  const earnedCount = achievementsWithStatus.filter(a => a.earned).length;

  if (!userLoading && !user) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Тільки для зареєстрованих</h2>
        <p className="text-muted-foreground">Увійдіть або зареєструйтесь щоб отримувати досягнення</p>
        <Button onClick={() => window.location.href = '/login'}>Увійти / Зареєструватись</Button>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {newAchievements.map((ach) => (
          <AchievementToast
            key={ach.id}
            achievement={ach}
            onClose={() => setNewAchievements(prev => prev.filter(a => a.id !== ach.id))}
          />
        ))}
      </AnimatePresence>

      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground">Досягнення</h1>
          <p className="text-muted-foreground mt-1">Отримано {earnedCount} з {ACHIEVEMENTS.length}</p>
        </motion.div>

        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(earnedCount / ACHIEVEMENTS.length) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievementsWithStatus.map((ach, i) => (
            <motion.div key={ach.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={cn("transition-all", ach.earned ? "border-primary/30 bg-primary/5" : "opacity-50")}>
                <CardContent className="p-6 flex items-start gap-4">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", ach.earned ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <ach.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{ach.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{ach.desc}</p>
                    {ach.earned && <span className="inline-block mt-2 text-xs font-medium text-primary">Отримано ✓</span>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
}