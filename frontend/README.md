# PDRPrep Frontend

## Stack

- `React 18`
- `Vite`
- `React Router`
- `TanStack Query`
- your own FastAPI backend over `VITE_API_URL`

## Run locally

1. Install dependencies with `npm install`.
2. Make sure `frontend/.env` contains the API URL:

```env
VITE_API_URL=http://localhost:8000
```

3. Start development server:

```bash
npm run dev
```

## Available scripts

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

1. Запуск Бекенду (Python)
Відкрий перший термінал у VS Code і пиши:

Зайди в папку бека:

PowerShell
cd backend

Активуй той самий venv:

PowerShell
.\venv311\Scripts\Activate.ps1
(Має з'явитися напис (venv311) зліва).

Стартуй сервер:

PowerShell
uvicorn main:app --reload
Якщо все гуд, напише Uvicorn running on http://127.0.0.1:8000.

2. Запуск Фронтенду (React)
Натисни на "+" або "Split Terminal" у VS Code, щоб відкрити другий термінал поруч:

Зайди в папку фронта:

PowerShell
cd frontend
Запусти Vite:

PowerShell
npm run dev
Він дасть посилання, зазвичай http://localhost:5173. Тисни Ctrl + Click на нього.

3. Якщо показує Пайтона більше ніж ДжаваСкріпт зроби наступне: 

 в PowerShell з кореня проєкту:

cd D:\PDRPrep
git rm -r --cached --ignore-unmatch backend/venv311 frontend/venv backend/__pycache__ node_modules frontend/node_modules dist frontend/dist
git add .gitignore
git status
Після цього закоміть зміни:

git commit -m "Clean tracked build and virtualenv files"
Після такого GitHub/аналізатор мов перестане рахувати віртуалки як код проєкту, і відсоток Python має різко впасти. Якщо хочеш, я далі ще підкажу, які папки варто лишити в репо, а які точно ні.

4. Оновлення БД з питаннями
Як користуватись:

Запусти бекенд:
cd D:\PDRPrep\backend
uvicorn main:app --reload

У новому PowerShell запусти імпорт:
cd D:\PDRPrep\backend
.\import_questions.ps1
Я
кщо захочеш імпортувати не pdr_final_fixed.json, а інший файл:

.\import_questions.ps1 -JsonPath '.\інший_файл.json'
Що робить скрипт:

читає JSON строго в UTF-8, щоб не ламалась українська
перетворює твої поля з JSON у формат, який чекає бекенд
відправляє все в http://127.0.0.1:8000/questions/import
Тобто далі схема дуже проста: оновила pdr_final_fixed.json → запустила .\import_questions.ps1.

## Notes

- This frontend works only with your own backend and local project assets.
- Authentication, friends, battles, progress and avatar uploads go through your own backend.
- `logo.png` is used as the tab icon, while `logo-wordmark.png` is used in the site header.
