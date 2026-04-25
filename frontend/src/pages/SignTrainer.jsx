// @ts-nocheck
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { motion } from 'framer-motion';
import {
  BookOpen, Zap, ArrowRight, RotateCcw, Search,
  TriangleAlert, Flag, Ban, Circle, Info, Wrench, Tags,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';

const ROAD_SIGNS = [
  // === 1. ПОПЕРЕДЖУВАЛЬНІ ЗНАКИ ===
  { id: 'w1.1', code: '1.1', name: 'Небезпечний поворот праворуч', category: 'warning', image: '/images/sign_img/1.1z.png' },
  { id: 'w1.2', code: '1.2', name: 'Небезпечний поворот ліворуч', category: 'warning', image: '/images/sign_img/1.2z.png' },
  { id: 'w1.3.1', code: '1.3.1', name: 'Декілька поворотів', category: 'warning', image: '/images/sign_img/1.3.1z.png' },
  { id: 'w1.3.2', code: '1.3.2', name: 'Декілька поворотів', category: 'warning', image: '/images/sign_img/1.3.2z.png' },
  { id: 'w1.4.1', code: '1.4.1', name: 'Напрямок повороту', category: 'warning', image: '/images/sign_img/1.4.1z.png' },
  { id: 'w1.4.2', code: '1.4.2', name: 'Напрямок повороту', category: 'warning', image: '/images/sign_img/1.4.2z.png' },
  { id: 'w1.4.3', code: '1.4.3', name: 'Напрямок повороту', category: 'warning', image: '/images/sign_img/1.4.3z.png' },
  { id: 'w1.4.4', code: '1.4.4', name: 'Напрямок повороту', category: 'warning', image: '/images/sign_img/1.4.4z.png' },
  { id: 'w1.4.5', code: '1.4.5', name: 'Напрямок повороту', category: 'warning', image: '/images/sign_img/1.4.5z.png' },
  { id: 'w1.4.6', code: '1.4.6', name: 'Напрямок повороту', category: 'warning', image: '/images/sign_img/1.4.6z.png' },
  { id: 'w1.4.7', code: '1.4.7', name: 'Напрямок повороту', category: 'warning', image: '/images/sign_img/1.4.7z.png' },
  { id: 'w1.5.1', code: '1.5.1', name: 'Звуження дороги', category: 'warning', image: '/images/sign_img/1.5.1z.png' },
  { id: 'w1.5.2', code: '1.5.2', name: 'Звуження дороги', category: 'warning', image: '/images/sign_img/1.5.2z.png' },
  { id: 'w1.5.3', code: '1.5.3', name: 'Звуження дороги', category: 'warning', image: '/images/sign_img/1.5.3z.png' },
  { id: 'w1.6', code: '1.6', name: 'Крутий підйом', category: 'warning', image: '/images/sign_img/1.6z.png' },
  { id: 'w1.7', code: '1.7', name: 'Крутий спуск', category: 'warning', image: '/images/sign_img/1.7z.png' },
  { id: 'w1.8', code: '1.8', name: 'Виїзд на набережну або берег', category: 'warning', image: '/images/sign_img/1.8z.png' },
  { id: 'w1.9', code: '1.9', name: 'Тунель', category: 'warning', image: '/images/sign_img/1.9z.png' },
  { id: 'w1.10', code: '1.10', name: 'Нерівна дорога', category: 'warning', image: '/images/sign_img/1.10z.png' },
  { id: 'w1.11', code: '1.11', name: 'Пагорб', category: 'warning', image: '/images/sign_img/1.11z.png' },
  { id: 'w1.12', code: '1.12', name: 'Вибоїна', category: 'warning', image: '/images/sign_img/1.12z.png' },
  { id: 'w1.13', code: '1.13', name: 'Слизька дорога', category: 'warning', image: '/images/sign_img/1.13z.png' },
  { id: 'w1.14', code: '1.14', name: 'Викидання кам’яних матеріалів', category: 'warning', image: '/images/sign_img/1.14z.png' },
  { id: 'w1.15', code: '1.15', name: 'Небезпечне узбіччя', category: 'warning', image: '/images/sign_img/1.15z.png' },
  { id: 'w1.16', code: '1.16', name: 'Падіння каміння', category: 'warning', image: '/images/sign_img/1.16z.png' },
  { id: 'w1.17', code: '1.17', name: 'Боковий вітер', category: 'warning', image: '/images/sign_img/1.17z.png' },
  { id: 'w1.18', code: '1.18', name: 'Низьколітаючі літаки', category: 'warning', image: '/images/sign_img/1.18z.png' },
  { id: 'w1.19', code: '1.19', name: 'Перехрещення з рухом по колу', category: 'warning', image: '/images/sign_img/1.19z.png' },
  { id: 'w1.20', code: '1.20', name: 'Перехрещення з трамвайною колією', category: 'warning', image: '/images/sign_img/1.20z.png' },
  { id: 'w1.21', code: '1.21', name: 'Перехрещення рівнозначних доріг', category: 'warning', image: '/images/sign_img/1.21z.png' },
  { id: 'w1.22', code: '1.22', name: 'Перехрещення з другорядною дорогою', category: 'warning', image: '/images/sign_img/1.22z.png' },
  { id: 'w1.23.1', code: '1.23.1', name: 'Прилягання другорядної дороги', category: 'warning', image: '/images/sign_img/1.23.1z.png' },
  { id: 'w1.23.2', code: '1.23.2', name: 'Прилягання другорядної дороги', category: 'warning', image: '/images/sign_img/1.23.2z.png' },
  { id: 'w1.23.3', code: '1.23.3', name: 'Прилягання другорядної дороги', category: 'warning', image: '/images/sign_img/1.23.3z.png' },
  { id: 'w1.23.4', code: '1.23.4', name: 'Прилягання другорядної дороги', category: 'warning', image: '/images/sign_img/1.23.4z.png' },
  { id: 'w1.24', code: '1.24', name: 'Світлофорне регулювання', category: 'warning', image: '/images/sign_img/1.24z.png' },
  { id: 'w1.25', code: '1.25', name: 'Розвідний міст', category: 'warning', image: '/images/sign_img/1.25z.png' },
  { id: 'w1.26', code: '1.26', name: 'Двосторонній рух', category: 'warning', image: '/images/sign_img/1.26z.png' },
  { id: 'w1.27', code: '1.27', name: 'Залізничний переїзд із шлагбаумом', category: 'warning', image: '/images/sign_img/1.27z.png' },
  { id: 'w1.28', code: '1.28', name: 'Залізничний переїзд без шлагбаума', category: 'warning', image: '/images/sign_img/1.28z.png' },
  { id: 'w1.29', code: '1.29', name: 'Одноколійна залізниця', category: 'warning', image: '/images/sign_img/1.29z.png' },
  { id: 'w1.30', code: '1.30', name: 'Багатоколійна залізниця', category: 'warning', image: '/images/sign_img/1.30z.png' },
  { id: 'w1.31.1', code: '1.31.1', name: 'Наближення до залізничного переїзду', category: 'warning', image: '/images/sign_img/1.31.1z.png' },
  { id: 'w1.31.2', code: '1.31.2', name: 'Наближення до залізничного переїзду', category: 'warning', image: '/images/sign_img/1.31.2z.png' },
  { id: 'w1.31.3', code: '1.31.3', name: 'Наближення до залізничного переїзду', category: 'warning', image: '/images/sign_img/1.31.3z.png' },
  { id: 'w1.31.4', code: '1.31.4', name: 'Наближення до залізничного переїзду', category: 'warning', image: '/images/sign_img/1.31.4z.png' },
  { id: 'w1.31.5', code: '1.31.5', name: 'Наближення до залізничного переїзду', category: 'warning', image: '/images/sign_img/1.31.5z.png' },
  { id: 'w1.31.6', code: '1.31.6', name: 'Наближення до залізничного переїзду', category: 'warning', image: '/images/sign_img/1.31.6z.png' },
  { id: 'w1.32', code: '1.32', name: 'Пішохідний перехід', category: 'warning', image: '/images/sign_img/1.32z.png' },
  { id: 'w1.33', code: '1.33', name: 'Діти', category: 'warning', image: '/images/sign_img/1.33z.png' },
  { id: 'w1.34', code: '1.34', name: 'Виїзд велосипедистів', category: 'warning', image: '/images/sign_img/1.34z.png' },
  { id: 'w1.35', code: '1.35', name: 'Перегін худоби', category: 'warning', image: '/images/sign_img/1.35z.png' },
  { id: 'w1.36', code: '1.36', name: 'Дикі тварини', category: 'warning', image: '/images/sign_img/1.36z.png' },
  { id: 'w1.37', code: '1.37', name: 'Дорожні роботи', category: 'warning', image: '/images/sign_img/1.37z.png' },
  { id: 'w1.38', code: '1.38', name: 'Затори в дорожньому русі', category: 'warning', image: '/images/sign_img/1.38z.png' },
  { id: 'w1.39', code: '1.39', name: 'Аварійно небезпечна ділянка (інша небезпека)', category: 'warning', image: '/images/sign_img/1.39z.png' },
  { id: 'w1.40', code: '1.40', name: 'Зміна покриття', category: 'warning', image: '/images/sign_img/1.40z.png' },
  { id: 'w1.41', code: '1.41', name: 'Місце (ділянка) концентрації ДТП', category: 'warning', image: '/images/sign_img/1.41z.png' },

  // === 2. ЗНАКИ ПРІОРИТЕТУ ===
  { id: 'p2.1', code: '2.1', name: 'Дати дорогу', category: 'priority', image: '/images/sign_img/2.1z.png' },
  { id: 'p2.2', code: '2.2', name: 'Проїзд без зупинки заборонено', category: 'priority', image: '/images/sign_img/2.2z.png' },
  { id: 'p2.3', code: '2.3', name: 'Головна дорога', category: 'priority', image: '/images/sign_img/2.3z.png' },
  { id: 'p2.4', code: '2.4', name: 'Кінець головної дороги', category: 'priority', image: '/images/sign_img/2.4z.png' },
  { id: 'p2.5', code: '2.5', name: 'Перевага зустрічного руху', category: 'priority', image: '/images/sign_img/2.5z.png' },
  { id: 'p2.6', code: '2.6', name: 'Перевага перед зустрічним рухом', category: 'priority', image: '/images/sign_img/2.6z.png' },

  // === 3. ЗАБОРОННІ ЗНАКИ ===
  { id: 'f3.1', code: '3.1', name: 'Рух заборонено', category: 'prohibitory', image: '/images/sign_img/3.1z.png' },
  { id: 'f3.2', code: '3.2', name: 'Рух механічних ТЗ заборонено', category: 'prohibitory', image: '/images/sign_img/3.2z.png' },
  { id: 'f3.3', code: '3.3', name: 'Рух вантажних автомобілів заборонено', category: 'prohibitory', image: '/images/sign_img/3.3z.png' },
  { id: 'f3.4', code: '3.4', name: 'Рух з причепом заборонено', category: 'prohibitory', image: '/images/sign_img/3.4z.png' },
  { id: 'f3.5', code: '3.5', name: 'Рух тракторів заборонено', category: 'prohibitory', image: '/images/sign_img/3.5z.png' },
  { id: 'f3.6', code: '3.6', name: 'Рух мотоциклів заборонено', category: 'prohibitory', image: '/images/sign_img/3.6z.png' },
  { id: 'f3.7', code: '3.7', name: 'Рух на мопедах заборонено', category: 'prohibitory', image: '/images/sign_img/3.7z.png' },
  { id: 'f3.8', code: '3.8', name: 'Рух на велосипедах заборонено', category: 'prohibitory', image: '/images/sign_img/3.8z.png' },
  { id: 'f3.9', code: '3.9', name: 'Рух пішоходів заборонено', category: 'prohibitory', image: '/images/sign_img/3.9z.png' },
  { id: 'f3.10', code: '3.10', name: 'Рух з ручними візками заборонено', category: 'prohibitory', image: '/images/sign_img/3.10z.png' },
  { id: 'f3.11', code: '3.11', name: 'Рух гужових возів (саней) заборонено', category: 'prohibitory', image: '/images/sign_img/3.11z.png' },
  { id: 'f3.12', code: '3.12', name: 'Рух ТЗ з небезпечними вантажами заборонено', category: 'prohibitory', image: '/images/sign_img/3.12z.png' },
  { id: 'f3.13', code: '3.13', name: 'Рух ТЗ з вибуховими вантажами заборонено', category: 'prohibitory', image: '/images/sign_img/3.13z.png' },
  { id: 'f3.14', code: '3.14', name: 'Рух ТЗ, що забруднюють воду, заборонено', category: 'prohibitory', image: '/images/sign_img/3.14z.png' },
  { id: 'f3.15', code: '3.15', name: 'Рух ТЗ, маса яких перевищує ... т, заборонено', category: 'prohibitory', image: '/images/sign_img/3.15z.png' },
  { id: 'f3.16', code: '3.16', name: 'Навантаження на вісь перевищує ... т заборонено', category: 'prohibitory', image: '/images/sign_img/3.16z.png' },
  { id: 'f3.17', code: '3.17', name: 'Ширина перевищує ... м заборонено', category: 'prohibitory', image: '/images/sign_img/3.17z.png' },
  { id: 'f3.18', code: '3.18', name: 'Висота перевищує ... м заборонено', category: 'prohibitory', image: '/images/sign_img/3.18z.png' },
  { id: 'f3.19', code: '3.19', name: 'Довжина перевищує ... м заборонено', category: 'prohibitory', image: '/images/sign_img/3.19z.png' },
  { id: 'f3.20', code: '3.20', name: 'Недотримання дистанції ... м заборонено', category: 'prohibitory', image: '/images/sign_img/3.20z.png' },
  { id: 'f3.21', code: '3.21', name: 'В\'їзд заборонено', category: 'prohibitory', image: '/images/sign_img/3.21z.png' },
  { id: 'f3.22', code: '3.22', name: 'Поворот праворуч заборонено', category: 'prohibitory', image: '/images/sign_img/3.22z.png' },
  { id: 'f3.23', code: '3.23', name: 'Поворот ліворуч заборонено', category: 'prohibitory', image: '/images/sign_img/3.23z.png' },
  { id: 'f3.24', code: '3.24', name: 'Розворот заборонено', category: 'prohibitory', image: '/images/sign_img/3.24z.png' },
  { id: 'f3.25', code: '3.25', name: 'Обгін заборонено', category: 'prohibitory', image: '/images/sign_img/3.25z.png' },
  { id: 'f3.26', code: '3.26', name: 'Кінець заборони обгону', category: 'prohibitory', image: '/images/sign_img/3.26z.png' },
  { id: 'f3.27', code: '3.27', name: 'Обгін вантажним автомобілям заборонено', category: 'prohibitory', image: '/images/sign_img/3.27z.png' },
  { id: 'f3.28', code: '3.28', name: 'Кінець заборони обгону вантажним авто', category: 'prohibitory', image: '/images/sign_img/3.28z.png' },
  { id: 'f3.29', code: '3.29', name: 'Обмеження максимальної швидкості', category: 'prohibitory', image: '/images/sign_img/3.29z.png' },
  { id: 'f3.30', code: '3.30', name: 'Кінець обмеження максимальної швидкості', category: 'prohibitory', image: '/images/sign_img/3.30z.png' },
  { id: 'f3.31', code: '3.31', name: 'Зона обмеження максимальної швидкості', category: 'prohibitory', image: '/images/sign_img/3.31z.png' },
  { id: 'f3.32', code: '3.32', name: 'Кінець зони обмеження макс. швидкості', category: 'prohibitory', image: '/images/sign_img/3.32z.png' },
  { id: 'f3.33', code: '3.33', name: 'Подачу звукового сигналу заборонено', category: 'prohibitory', image: '/images/sign_img/3.33z.png' },
  { id: 'f3.34', code: '3.34', name: 'Зупинку заборонено', category: 'prohibitory', image: '/images/sign_img/3.34z.png' },
  { id: 'f3.35', code: '3.35', name: 'Стоянку заборонено', category: 'prohibitory', image: '/images/sign_img/3.35z.png' },
  { id: 'f3.36', code: '3.36', name: 'Стоянку заборонено в непарні числа', category: 'prohibitory', image: '/images/sign_img/3.36z.png' },
  { id: 'f3.37', code: '3.37', name: 'Стоянку заборонено в парні числа', category: 'prohibitory', image: '/images/sign_img/3.37z.png' },
  { id: 'f3.38', code: '3.38', name: 'Зона обмеженої стоянки', category: 'prohibitory', image: '/images/sign_img/3.38z.png' },
  { id: 'f3.39', code: '3.39', name: 'Кінець зони обмеженої стоянки', category: 'prohibitory', image: '/images/sign_img/3.39z.png' },
  { id: 'f3.40', code: '3.40', name: 'Митниця', category: 'prohibitory', image: '/images/sign_img/3.40z.png' },
  { id: 'f3.41', code: '3.41', name: 'Контроль', category: 'prohibitory', image: '/images/sign_img/3.41z.png' },
  { id: 'f3.42', code: '3.42', name: 'Кінець усіх заборон і обмежень', category: 'prohibitory', image: '/images/sign_img/3.42z.png' },
  { id: 'f3.43', code: '3.43', name: 'Небезпека', category: 'prohibitory', image: '/images/sign_img/3.43z.png' },
  { id: 'f3.44', code: '3.44', name: 'Рух зазначених ТЗ заборонено', category: 'prohibitory', image: '/images/sign_img/3.44z.png' },
  { id: 'f3.45', code: '3.45', name: 'Рух зазначених ТЗ заборонено', category: 'prohibitory', image: '/images/sign_img/3.45z.png' },

  // === 4. НАКАЗОВІ ЗНАКИ ===
  { id: 'm4.1', code: '4.1', name: 'Рух прямо', category: 'mandatory', image: '/images/sign_img/4.1z.png' },
  { id: 'm4.2', code: '4.2', name: 'Рух праворуч', category: 'mandatory', image: '/images/sign_img/4.2z.png' },
  { id: 'm4.3', code: '4.3', name: 'Рух ліворуч', category: 'mandatory', image: '/images/sign_img/4.3z.png' },
  { id: 'm4.4', code: '4.4', name: 'Рух прямо або праворуч', category: 'mandatory', image: '/images/sign_img/4.4z.png' },
  { id: 'm4.5', code: '4.5', name: 'Рух прямо або ліворуч', category: 'mandatory', image: '/images/sign_img/4.5z.png' },
  { id: 'm4.6', code: '4.6', name: 'Рух праворуч або ліворуч', category: 'mandatory', image: '/images/sign_img/4.6z.png' },
  { id: 'm4.7', code: '4.7', name: 'Об’їзд перешкоди з правого боку', category: 'mandatory', image: '/images/sign_img/4.7z.png' },
  { id: 'm4.8', code: '4.8', name: 'Об’їзд перешкоди з лівого боку', category: 'mandatory', image: '/images/sign_img/4.8z.png' },
  { id: 'm4.9', code: '4.9', name: 'Об’їзд перешкоди з обох боків', category: 'mandatory', image: '/images/sign_img/4.9z.png' },
  { id: 'm4.10', code: '4.10', name: 'Круговий рух', category: 'mandatory', image: '/images/sign_img/4.10z.png' },
  { id: 'm4.11', code: '4.11', name: 'Рух легкових автомобілів', category: 'mandatory', image: '/images/sign_img/4.11z.png' },
  { id: 'm4.12', code: '4.12', name: 'Обмеження мінімальної швидкості', category: 'mandatory', image: '/images/sign_img/4.12z.png' },
  { id: 'm4.13', code: '4.13', name: 'Кінець обмеження мінімальної швидкості', category: 'mandatory', image: '/images/sign_img/4.13z.png' },
  { id: 'm4.14', code: '4.14', name: 'Доріжка для велосипедистів', category: 'mandatory', image: '/images/sign_img/4.14z.png' },
  { id: 'm4.15', code: '4.15', name: 'Кінець доріжки для велосипедистів', category: 'mandatory', image: '/images/sign_img/4.15z.png' },
  { id: 'm4.16', code: '4.16', name: 'Доріжка для пішоходів', category: 'mandatory', image: '/images/sign_img/4.16z.png' },
  { id: 'm4.17', code: '4.17', name: 'Доріжка для пішоходів і велосипедистів', category: 'mandatory', image: '/images/sign_img/4.17z.png' },
  { id: 'm4.18', code: '4.18', name: 'Суміжні пішохідна та велодоріжки', category: 'mandatory', image: '/images/sign_img/4.18z.png' },
  { id: 'm4.19', code: '4.19', name: 'Доріжка для вершників', category: 'mandatory', image: '/images/sign_img/4.19z.png' },
  { id: 'm4.20.1', code: '4.20.1', name: 'Напрямок руху ТЗ з небезпечними вантажами', category: 'mandatory', image: '/images/sign_img/4.20.1z.png' },
  { id: 'm4.20.2', code: '4.20.2', name: 'Напрямок руху ТЗ з небезпечними вантажами', category: 'mandatory', image: '/images/sign_img/4.20.2z.png' },
  { id: 'm4.20.3', code: '4.20.3', name: 'Напрямок руху ТЗ з небезпечними вантажами', category: 'mandatory', image: '/images/sign_img/4.20.3z.png' },
  { id: 'm4.21', code: '4.21', name: 'Рух із застосуванням ланцюгів', category: 'mandatory', image: '/images/sign_img/4.21z.png' },
  { id: 'm4.22', code: '4.22', name: 'Кінець ділянки з ланцюгами', category: 'mandatory', image: '/images/sign_img/4.22z.png' },
  { id: 'm4.23', code: '4.23', name: 'Дорога для авто та велосипедистів', category: 'mandatory', image: '/images/sign_img/4.23z.png' },
  { id: 'm4.24', code: '4.24', name: 'Кінець дороги для авто та велосипедистів', category: 'mandatory', image: '/images/sign_img/4.24z.png' },

  // === 5. ІНФОРМАЦІЙНО-ВКАЗІВНІ ЗНАКИ ===
  { id: 'i5.1', code: '5.1', name: 'Автомагістраль', category: 'informational', image: '/images/sign_img/5.1z.png' },
  { id: 'i5.2', code: '5.2', name: 'Кінець автомагістралі', category: 'informational', image: '/images/sign_img/5.2z.png' },
  { id: 'i5.3', code: '5.3', name: 'Дорога для автомобілів', category: 'informational', image: '/images/sign_img/5.3z.png' },
  { id: 'i5.4', code: '5.4', name: 'Кінець дороги для автомобілів', category: 'informational', image: '/images/sign_img/5.4z.png' },
  { id: 'i5.5', code: '5.5', name: 'Дорога з одностороннім рухом', category: 'informational', image: '/images/sign_img/5.5z.png' },
  { id: 'i5.6', code: '5.6', name: 'Кінець дороги з одностороннім рухом', category: 'informational', image: '/images/sign_img/5.6z.png' },
  { id: 'i5.7.1', code: '5.7.1', name: 'Виїзд на дорогу з одностороннім рухом', category: 'informational', image: '/images/sign_img/5.7.1z.png' },
  { id: 'i5.7.2', code: '5.7.2', name: 'Виїзд на дорогу з одностороннім рухом', category: 'informational', image: '/images/sign_img/5.7.2z.png' },
  { id: 'i5.8', code: '5.8', name: 'Дорога із смугою для маршрутних ТЗ', category: 'informational', image: '/images/sign_img/5.8z.png' },
  { id: 'i5.9', code: '5.9', name: 'Кінець дороги із смугою для маршрутних ТЗ', category: 'informational', image: '/images/sign_img/5.9z.png' },
  { id: 'i5.10.1', code: '5.10.1', name: 'Виїзд на дорогу із смугою для маршрутних ТЗ', category: 'informational', image: '/images/sign_img/5.10.1z.png' },
  { id: 'i5.10.2', code: '5.10.2', name: 'Виїзд на дорогу із смугою для маршрутних ТЗ', category: 'informational', image: '/images/sign_img/5.10.2z.png' },
  { id: 'i5.11', code: '5.11', name: 'Смуга для руху маршрутних ТЗ', category: 'informational', image: '/images/sign_img/5.11z.png' },
  { id: 'i5.12', code: '5.12', name: 'Кінець смуги для руху маршрутних ТЗ', category: 'informational', image: '/images/sign_img/5.12z.png' },
  { id: 'i5.13', code: '5.13', name: 'Дорога з реверсивним рухом', category: 'informational', image: '/images/sign_img/5.13z.png' },
  { id: 'i5.14', code: '5.14', name: 'Кінець дороги з реверсивним рухом', category: 'informational', image: '/images/sign_img/5.14z.png' },
  { id: 'i5.15', code: '5.15', name: 'Виїзд на дорогу з реверсивним рухом', category: 'informational', image: '/images/sign_img/5.15z.png' },
  { id: 'i5.16', code: '5.16', name: 'Напрямки руху по смугах', category: 'informational', image: '/images/sign_img/5.16z.png' },
  { id: 'i5.17.1', code: '5.17.1', name: 'Напрямок руху по смугах', category: 'informational', image: '/images/sign_img/5.17.1z.png' },
  { id: 'i5.17.2', code: '5.17.2', name: 'Напрямок руху по смугах', category: 'informational', image: '/images/sign_img/5.17.2z.png' },
  { id: 'i5.18', code: '5.18', name: 'Напрямок руху по смузі', category: 'informational', image: '/images/sign_img/5.18z.png' },
  { id: 'i5.19.1', code: '5.19.1', name: 'Використання смуги руху', category: 'informational', image: '/images/sign_img/5.19.1z.png' },
  { id: 'i5.20.1', code: '5.20.1', name: 'Початок додаткової смуги руху', category: 'informational', image: '/images/sign_img/5.20.1z.png' },
  { id: 'i5.21.1', code: '5.21.1', name: 'Кінець додаткової смуги руху', category: 'informational', image: '/images/sign_img/5.21.1z.png' },
  { id: 'i5.29', code: '5.29', name: 'Місце для розвороту', category: 'informational', image: '/images/sign_img/5.29z.png' },
  { id: 'i5.30', code: '5.30', name: 'Зона для розвороту', category: 'informational', image: '/images/sign_img/5.30z.png' },
  { id: 'i5.32.1', code: '5.32.1', name: 'Тупик', category: 'informational', image: '/images/sign_img/5.32.1z.png' },
  { id: 'i5.33', code: '5.33', name: 'Рекомендована швидкість', category: 'informational', image: '/images/sign_img/5.33z.png' },
  { id: 'i5.34', code: '5.34', name: 'Житлова зона', category: 'informational', image: '/images/sign_img/5.34z.png' },
  { id: 'i5.35', code: '5.35', name: 'Кінець житлової зони', category: 'informational', image: '/images/sign_img/5.35z.png' },
  { id: 'i5.36', code: '5.36', name: 'Пішохідна зона', category: 'informational', image: '/images/sign_img/5.36z.png' },
  { id: 'i5.37', code: '5.37', name: 'Кінець пішохідної зони', category: 'informational', image: '/images/sign_img/5.37z.png' },
  { id: 'i5.38.1', code: '5.38.1', name: 'Пішохідний перехід', category: 'informational', image: '/images/sign_img/5.38.1z.png' },
  { id: 'i5.38.2', code: '5.38.2', name: 'Пішохідний перехід', category: 'informational', image: '/images/sign_img/5.38.2z.png' },
  { id: 'i5.40.1', code: '5.40.1', name: 'Підземний пішохідний перехід', category: 'informational', image: '/images/sign_img/5.40.1z.png' },
  { id: 'i5.41.1', code: '5.41.1', name: 'Надземний пішохідний перехід', category: 'informational', image: '/images/sign_img/5.41.1z.png' },
  { id: 'i5.42.1', code: '5.42.1', name: 'Місце для стоянки', category: 'informational', image: '/images/sign_img/5.42.1z.png' },
  { id: 'i5.45.1', code: '5.45.1', name: 'Пункт зупинки автобуса', category: 'informational', image: '/images/sign_img/5.45.1z.png' },
  { id: 'i5.49', code: '5.49', name: 'Початок населеного пункту', category: 'informational', image: '/images/sign_img/5.49z.png' },
  { id: 'i5.50', code: '5.50', name: 'Кінець населеного пункту', category: 'informational', image: '/images/sign_img/5.50z.png' },
  { id: 'i5.69', code: '5.69', name: 'Місце зупинки', category: 'informational', image: '/images/sign_img/5.69z.png' },
  { id: 'i5.76', code: '5.76', name: 'Автоматична відеофіксація', category: 'informational', image: '/images/sign_img/5.76z.png' },

  // === 6. ЗНАКИ СЕРВІСУ ===
  { id: 's6.1', code: '6.1', name: 'Пункт першої медичної допомоги', category: 'service', image: '/images/sign_img/6.1z.png' },
  { id: 's6.2', code: '6.2', name: 'Лікарня', category: 'service', image: '/images/sign_img/6.2z.png' },
  { id: 's6.3', code: '6.3', name: 'Телефон для виклику аварійної служби', category: 'service', image: '/images/sign_img/6.3z.png' },
  { id: 's6.4', code: '6.4', name: 'Вогнегасник', category: 'service', image: '/images/sign_img/6.4z.png' },
  { id: 's6.5', code: '6.5', name: 'Пункт технічного обслуговування', category: 'service', image: '/images/sign_img/6.5z.png' },
  { id: 's6.6', code: '6.6', name: 'Пункт миття автомобілів', category: 'service', image: '/images/sign_img/6.6z.png' },
  { id: 's6.7.1', code: '6.7.1', name: 'Автозаправні станції', category: 'service', image: '/images/sign_img/6.7.1z.png' },
  { id: 's6.7.2', code: '6.7.2', name: 'Автозаправні станції (газ)', category: 'service', image: '/images/sign_img/6.7.2z.png' },
  { id: 's6.7.3', code: '6.7.3', name: 'Електрозарядні станції', category: 'service', image: '/images/sign_img/6.7.3z.png' },
  { id: 's6.8', code: '6.8', name: 'Телефон', category: 'service', image: '/images/sign_img/6.8z.png' },
  { id: 's6.11', code: '6.11', name: 'Туалет', category: 'service', image: '/images/sign_img/6.11z.png' },
  { id: 's6.12', code: '6.12', name: 'Питна вода', category: 'service', image: '/images/sign_img/6.12z.png' },
  { id: 's6.13', code: '6.13', name: 'Ресторан або їдальня', category: 'service', image: '/images/sign_img/6.13z.png' },
  { id: 's6.14', code: '6.14', name: 'Кафе', category: 'service', image: '/images/sign_img/6.14z.png' },
  { id: 's6.15', code: '6.15', name: 'Місце відпочинку', category: 'service', image: '/images/sign_img/6.15z.png' },
  { id: 's6.16', code: '6.16', name: 'Готель або мотель', category: 'service', image: '/images/sign_img/6.16z.png' },
  { id: 's6.23', code: '6.23', name: 'Шиномонтаж', category: 'service', image: '/images/sign_img/6.23z.png' },

  // === 7. ТАБЛИЧКИ ===
  { id: 't7.1.1', code: '7.1.1', name: 'Відстань до об’єкта', category: 'additional', image: '/images/sign_img/7.1.1z.png' },
  { id: 't7.2.1', code: '7.2.1', name: 'Зона дії', category: 'additional', image: '/images/sign_img/7.2.1z.png' },
  { id: 't7.3.1', code: '7.3.1', name: 'Напрямок дії', category: 'additional', image: '/images/sign_img/7.3.1z.png' },
  { id: 't7.4.1', code: '7.4.1', name: 'Час дії', category: 'additional', image: '/images/sign_img/7.4.1z.png' },
  { id: 't7.5.1', code: '7.5.1', name: 'Вид транспортного засобу', category: 'additional', image: '/images/sign_img/7.5.1z.png' },
  { id: 't7.8', code: '7.8', name: 'Напрямок головної дороги', category: 'additional', image: '/images/sign_img/7.8z.png' },
  { id: 't7.12', code: '7.12', name: 'Ожеледиця', category: 'additional', image: '/images/sign_img/7.12z.png' },
  { id: 't7.17', code: '7.17', name: 'Особи з інвалідністю', category: 'additional', image: '/images/sign_img/7.17z.png' },
  { id: 't7.24', code: '7.24', name: 'Евакуатор', category: 'additional', image: '/images/sign_img/7.24z.png' },
  { id: 't7.1.2', code: '7.1.2', name: 'Відстань до об’єкта (через 300м "Stop")', category: 'additional', image: '/images/sign_img/7.1.2z.png' },
  { id: 't7.1.3', code: '7.1.3', name: 'Відстань до об’єкта (вбік)', category: 'additional', image: '/images/sign_img/7.1.3z.png' },
  { id: 't7.1.4', code: '7.1.4', name: 'Відстань до об’єкта (вбік)', category: 'additional', image: '/images/sign_img/7.1.4z.png' },
  { id: 't7.2.2', code: '7.2.2', name: 'Зона дії (протяжність)', category: 'additional', image: '/images/sign_img/7.2.2z.png' },
  { id: 't7.2.3', code: '7.2.3', name: 'Зона дії (кінець зони)', category: 'additional', image: '/images/sign_img/7.2.3z.png' },
  { id: 't7.2.4', code: '7.2.4', name: 'Зона дії (в обидва боки)', category: 'additional', image: '/images/sign_img/7.2.4z.png' },
  { id: 't7.2.5', code: '7.2.5', name: 'Зона дії (вправо)', category: 'additional', image: '/images/sign_img/7.2.5z.png' },
  { id: 't7.2.6', code: '7.2.6', name: 'Зона дії (вліво)', category: 'additional', image: '/images/sign_img/7.2.6z.png' },
  { id: 't7.3.2', code: '7.3.2', name: 'Напрямок дії (вліво)', category: 'additional', image: '/images/sign_img/7.3.2z.png' },
  { id: 't7.3.3', code: '7.3.3', name: 'Напрямок дії (в обидва боки)', category: 'additional', image: '/images/sign_img/7.3.3z.png' },
  { id: 't7.4.2', code: '7.4.2', name: 'Час дії (робочі дні)', category: 'additional', image: '/images/sign_img/7.4.2z.png' },
  { id: 't7.4.3', code: '7.4.3', name: 'Час дії (дні тижня)', category: 'additional', image: '/images/sign_img/7.4.3z.png' },
  { id: 't7.4.4', code: '7.4.4', name: 'Час дії (конкретний день)', category: 'additional', image: '/images/sign_img/7.4.4z.png' },
  { id: 't7.4.5', code: '7.4.5', name: 'Час дії (щоденно)', category: 'additional', image: '/images/sign_img/7.4.5z.png' },
  { id: 't7.4.6', code: '7.4.6', name: 'Час дії (в робочі години)', category: 'additional', image: '/images/sign_img/7.4.6z.png' },
  { id: 't7.4.7', code: '7.4.7', name: 'Час дії (у вихідні години)', category: 'additional', image: '/images/sign_img/7.4.7z.png' },
  { id: 't7.5.2', code: '7.5.2', name: 'Вид ТЗ (з причепом)', category: 'additional', image: '/images/sign_img/7.5.2z.png' },
  { id: 't7.5.3', code: '7.5.3', name: 'Вид ТЗ (легкові)', category: 'additional', image: '/images/sign_img/7.5.3z.png' },
  { id: 't7.5.4', code: '7.5.4', name: 'Вид ТЗ (автобуси)', category: 'additional', image: '/images/sign_img/7.5.4z.png' },
  { id: 't7.5.5', code: '7.5.5', name: 'Вид ТЗ (трактори)', category: 'additional', image: '/images/sign_img/7.5.5z.png' },
  { id: 't7.5.6', code: '7.5.6', name: 'Вид ТЗ (мотоцикли)', category: 'additional', image: '/images/sign_img/7.5.6z.png' },
  { id: 't7.5.7', code: '7.5.7', name: 'Вид ТЗ (велосипеди)', category: 'additional', image: '/images/sign_img/7.5.7z.png' },
  { id: 't7.5.8', code: '7.5.8', name: 'Вид ТЗ (з небезпечним вантажем)', category: 'additional', image: '/images/sign_img/7.5.8z.png' },
  { id: 't7.6.1', code: '7.6.1', name: 'Спосіб поставлення (паралельно)', category: 'additional', image: '/images/sign_img/7.6.1z.png' },
  { id: 't7.6.2', code: '7.6.2', name: 'Спосіб поставлення (на краю тротуару)', category: 'additional', image: '/images/sign_img/7.6.2z.png' },
  { id: 't7.6.3', code: '7.6.3', name: 'Спосіб поставлення (повністю на тротуарі)', category: 'additional', image: '/images/sign_img/7.6.3z.png' },
  { id: 't7.6.4', code: '7.6.4', name: 'Спосіб поставлення (задньою частиною)', category: 'additional', image: '/images/sign_img/7.6.4z.png' },
  { id: 't7.6.5', code: '7.6.5', name: 'Спосіб поставлення (передньою на тротуар)', category: 'additional', image: '/images/sign_img/7.6.5z.png' },
  { id: 't7.7', code: '7.7', name: 'Стоянка з непрацюючим двигуном', category: 'additional', image: '/images/sign_img/7.7z.png' },
  { id: 't7.9', code: '7.9', name: 'Смуга руху', category: 'additional', image: '/images/sign_img/7.9z.png' },
  { id: 't7.10', code: '7.10', name: 'Кількість поворотів', category: 'additional', image: '/images/sign_img/7.10z.png' },
  { id: 't7.11', code: '7.11', name: 'Поромна переправа', category: 'additional', image: '/images/sign_img/7.11z.png' },
  { id: 't7.13', code: '7.13', name: 'Вологе покриття', category: 'additional', image: '/images/sign_img/7.13z.png' },
  { id: 't7.14', code: '7.14', name: 'Платні послуги', category: 'additional', image: '/images/sign_img/7.14z.png' },
  { id: 't7.15', code: '7.15', name: 'Місце для огляду автомобілів', category: 'additional', image: '/images/sign_img/7.15z.png' },
  { id: 't7.16', code: '7.16', name: 'Пішоходи з порушенням зору', category: 'additional', image: '/images/sign_img/7.16z.png' },
  { id: 't7.18', code: '7.18', name: 'Крім осіб з інвалідністю', category: 'additional', image: '/images/sign_img/7.18z.png' },
  { id: 't7.19', code: '7.19', name: 'Обмеження тривалості стоянки', category: 'additional', image: '/images/sign_img/7.19z.png' },
  { id: 't7.20', code: '7.20', name: 'Обмеження по температурі', category: 'additional', image: '/images/sign_img/7.20z.png' },
  { id: 't7.21.1', code: '7.21.1', name: 'Вид небезпеки (ДТП)', category: 'additional', image: '/images/sign_img/7.21.1z.png' },
  { id: 't7.21.2', code: '7.21.2', name: 'Вид небезпеки (зіткнення)', category: 'additional', image: '/images/sign_img/7.21.2z.png' },
  { id: 't7.22', code: '7.22', name: 'Лижники', category: 'additional', image: '/images/sign_img/7.22z.png' },
  { id: 't7.23', code: '7.23', name: 'Місце для зарядки електромобілів', category: 'additional', image: '/images/sign_img/7.23z.png' },
  { id: 't7.25', code: '7.25', name: 'Острівець безпеки', category: 'additional', image: '/images/sign_img/7.25z.png' },
  { id: 't7.26', code: '7.26', name: 'Строк денних ходових вогнів', category: 'additional', image: '/images/sign_img/7.26z.png' },
  { id: 't7.27', code: '7.27', name: 'Нанесення розмітки', category: 'additional', image: '/images/sign_img/7.27z.png' },
  { id: 't7.28.1', code: '7.28.1', name: 'Вид громадського транспорту (метро)', category: 'additional', image: '/images/sign_img/7.28.1z.png' },
  { id: 't7.28.4', code: '7.28.4', name: 'Електричка', category: 'additional', image: '/images/sign_img/7.28.4z.png' },
  { id: 't7.29.1', code: '7.29.1', name: 'Напрямок руху велосипедистів', category: 'additional', image: '/images/sign_img/7.29.1z.png' }
];

const CATEGORIES = [
  { id: 'all', label: 'Всі знаки', icon: BookOpen, colors: 'text-foreground border-border bg-card' },
  { id: 'warning', label: 'Попереджувальні', icon: TriangleAlert, colors: 'text-yellow-700 border-yellow-300 bg-yellow-50' },
  { id: 'priority', label: 'Пріоритет', icon: Flag, colors: 'text-amber-700 border-amber-200 bg-amber-50' },
  { id: 'prohibitory', label: 'Заборонні', icon: Ban, colors: 'text-rose-700 border-rose-200 bg-rose-50' },
  { id: 'mandatory', label: 'Наказові', icon: Circle, colors: 'text-blue-700 border-blue-200 bg-blue-50' },
  { id: 'informational', label: 'Інформаційні', icon: Info, colors: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
  { id: 'service', label: 'Сервіс', icon: Wrench, colors: 'text-sky-700 border-sky-200 bg-sky-50' },
  { id: 'additional', label: 'Таблички', icon: Tags, colors: 'text-violet-700 border-violet-200 bg-violet-50' },
];

const CATEGORY_ACCENT = {
  warning: 'border-yellow-300 hover:border-yellow-400',
  priority: 'border-amber-200 hover:border-amber-300',
  prohibitory: 'border-rose-200 hover:border-rose-300',
  mandatory: 'border-blue-200 hover:border-blue-300',
  informational: 'border-emerald-200 hover:border-emerald-300',
  service: 'border-sky-200 hover:border-sky-300',
  additional: 'border-violet-200 hover:border-violet-300',
};

const CATEGORY_ICON_BG = {
  warning: 'bg-yellow-100',
  priority: 'bg-amber-100',
  prohibitory: 'bg-rose-100',
  mandatory: 'bg-blue-100',
  informational: 'bg-emerald-100',
  service: 'bg-sky-100',
  additional: 'bg-violet-100',
};

// Функції shuffleArray і generateOptions залишаються без змін
function shuffleArray(arr) {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function generateOptions(correctSign) {
  const others = ROAD_SIGNS.filter(s => s.id !== correctSign.id);
  const shuffled = shuffleArray(others).slice(0, 3);
  return shuffleArray([correctSign, ...shuffled]);
}

// Компонент SignTrainer (повністю той самий, що раніше)
export default function SignTrainer() {
  const [mode, setMode] = useState('browse');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSign, setSelectedSign] = useState(null);

  const [quizQueue, setQuizQueue] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizOptions, setQuizOptions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  const QUIZ_LENGTH = 10;

  const filteredSigns = ROAD_SIGNS.filter(s => {
    const catMatch = selectedCategory === 'all' || s.category === selectedCategory;
    const searchMatch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.code.includes(searchQuery);
    return catMatch && searchMatch;
  });

  const startQuiz = () => {
    const pool = selectedCategory === 'all' ? ROAD_SIGNS : ROAD_SIGNS.filter(s => s.category === selectedCategory);
    const queue = shuffleArray(pool).slice(0, QUIZ_LENGTH);
    setQuizQueue(queue);
    setQuizIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);
    setQuizDone(false);
    setQuizOptions(generateOptions(queue[0]));
    setMode('quiz');
  };

  const handleQuizAnswer = (sign) => {
    if (selectedAnswer) return;
    setSelectedAnswer(sign);
    if (sign.id === quizQueue[quizIndex].id) setQuizScore(s => s + 1);
  };

  const handleNextQuiz = () => {
    const next = quizIndex + 1;
    if (next >= quizQueue.length) {
      setQuizDone(true);
    } else {
      setQuizIndex(next);
      setQuizOptions(generateOptions(quizQueue[next]));
      setSelectedAnswer(null);
    }
  };

  const currentQuizSign = quizQueue[quizIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">🚦 Тренажер знаків ПДР</h1>
          <p className="text-muted-foreground mt-1">Вивчай та перевіряй знання дорожніх знаків</p>
        </div>
        <div className="flex gap-2">
          <Button variant={mode === 'browse' ? 'default' : 'outline'} onClick={() => setMode('browse')} className="gap-2">
            <BookOpen className="w-4 h-4" /> Перегляд
          </Button>
          <Button variant={mode === 'quiz' ? 'default' : 'outline'} onClick={startQuiz} className="gap-2">
            <Zap className="w-4 h-4" /> Тест
          </Button>
        </div>
      </div>

      {/* BROWSE MODE - той самий код з img */}
      {mode === 'browse' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Пошук знаку..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                  selectedCategory === cat.id ? cn(cat.colors, 'shadow-sm') : "bg-card border-border text-muted-foreground hover:text-foreground",
                )}>
                <span className="inline-flex items-center gap-1.5">
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.label}
                </span>
              </button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">{filteredSigns.length} знаків</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredSigns.map((sign, i) => (
              <motion.div key={sign.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card className={cn(
                  "cursor-pointer overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-md",
                  CATEGORY_ACCENT[sign.category] || 'hover:border-primary/30',
                )}
                  onClick={() => setSelectedSign(sign)}>
                  <CardContent className="p-3 text-center sm:p-4">
                    <div className={cn('mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl sm:h-24 sm:w-24', CATEGORY_ICON_BG[sign.category])}>
                      <img src={sign.image} alt={sign.name} className="h-16 w-16 object-contain sm:h-20 sm:w-20" />
                    </div>
                    <p className="text-xs font-bold text-foreground">{sign.code}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-tight line-clamp-2">{sign.name}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Dialog open={!!selectedSign} onOpenChange={(open) => !open && setSelectedSign(null)}>
            {selectedSign ? (
              <DialogContent className="w-[calc(100vw-24px)] max-w-3xl rounded-[28px] border-slate-200 p-4 sm:p-6">
                <DialogHeader className="pr-8 text-left">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="text-xs">{selectedSign.code}</Badge>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Перегляд знака</p>
                  </div>
                  <DialogTitle className="text-xl font-black text-slate-950 sm:text-2xl">{selectedSign.name}</DialogTitle>
                  <DialogDescription className="text-sm leading-6 text-slate-500">
                    Знак відкрито у збільшеному вигляді, щоб його було зручно роздивитися на будь-якому екрані.
                  </DialogDescription>
                </DialogHeader>

                <div className="rounded-[26px] border border-slate-100 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(239,246,255,0.96))] p-4 sm:p-8">
                  <div className={cn('mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center rounded-[30px] border bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]', CATEGORY_ACCENT[selectedSign.category] || 'border-primary/30')}>
                    <img src={selectedSign.image} alt={selectedSign.name} className="h-[70%] w-[70%] object-contain" />
                  </div>
                </div>
              </DialogContent>
            ) : null}
          </Dialog>
        </>
      )}

      {/* QUIZ MODE — той самий код з великим зображенням */}
      {mode === 'quiz' && (
        <div className="max-w-xl mx-auto">
          {!quizDone && currentQuizSign ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={undefined}>{quizIndex + 1} / {QUIZ_LENGTH}</Badge>
                <Badge variant="secondary" className={undefined}>✅ {quizScore} правильних</Badge>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((quizIndex) / QUIZ_LENGTH) * 100}%` }} />
              </div>

              <Card>
                <CardContent className="p-8 text-center">
                  <img src={currentQuizSign.image} alt={currentQuizSign.name} className="mx-auto w-32 h-32 object-contain mb-6" />
                  <p className="text-lg font-semibold text-foreground">Як називається цей знак?</p>
                </CardContent>
              </Card>

              {/* Options — без змін */}
              <div className="grid grid-cols-1 gap-3">
                {quizOptions.map(opt => {
                  const isSelected = selectedAnswer?.id === opt.id;
                  const isCorrect = opt.id === currentQuizSign.id;
                  const showGreen = selectedAnswer && isCorrect;
                  const showRed = selectedAnswer && isSelected && !isCorrect;
                  return (
                    <button
                      key={opt.id}
                      disabled={!!selectedAnswer}
                      onClick={() => handleQuizAnswer(opt)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                        showGreen ? "border-green-500 bg-green-50 text-green-700 font-semibold" :
                        showRed ? "border-red-500 bg-red-50 text-red-700" :
                        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-400"
                      )}
                    >
                      {opt.name}
                      {showGreen && <span className="ml-2">✓</span>}
                      {showRed && <span className="ml-2">✗</span>}
                    </button>
                  );
                })}
              </div>

              {selectedAnswer && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className={cn("p-4 rounded-xl text-sm", selectedAnswer.id === currentQuizSign.id ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                    {selectedAnswer.id === currentQuizSign.id ? '✓ Правильно!' : `✗ Правильна відповідь: ${currentQuizSign.name}`}
                    <p className="mt-2 text-xs opacity-80">Знак {currentQuizSign.code}</p>
                  </div>
                  <Button onClick={handleNextQuiz} className="w-full mt-3 gap-2">
                    {quizIndex + 1 < QUIZ_LENGTH ? <>Далі <ArrowRight className="w-4 h-4" /></> : 'Завершити тест'}
                  </Button>
                </motion.div>
              )}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 space-y-6">
              <div className="text-6xl">{quizScore >= 8 ? '🏆' : quizScore >= 5 ? '👍' : '📚'}</div>
              <h2 className="text-2xl font-bold">Тест завершено!</h2>
              <p className="text-xl">Правильних: <span className="font-bold">{quizScore}</span> з {QUIZ_LENGTH}</p>
              <div className="flex justify-center gap-3">
                <Button onClick={startQuiz}><RotateCcw className="w-4 h-4 mr-2" /> Ще раз</Button>
                <Button variant="outline" onClick={() => setMode('browse')}>Переглянути всі знаки</Button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
