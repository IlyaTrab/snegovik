# ⛄ Snegovik AR — Интерактивный AR снеговик для детей

WebAR MVP: снеговик появляется через камеру смартфона прямо после сканирования QR-кода. Никакого приложения, только браузер.

---

## Быстрый старт

```bash
# Вариант 1 — Python (встроен в macOS/Linux)
python3 -m http.server 8080

# Вариант 2 — Node.js serve
npx serve . -p 8080
```

Открыть: `http://localhost:8080`

> ⚠️ Камера работает только на HTTPS или localhost.  
> Для тестирования с телефона используй ngrok или деплой на Vercel/Netlify.

---

## Структура проекта

```
snegovik/
├── index.html              # Главная страница
├── style.css               # Все стили
├── js/
│   ├── main.js             # Точка входа, оркестратор
│   ├── state.js            # State machine
│   ├── camera.js           # getUserMedia / камера
│   ├── snowman.js          # 3D снеговик + анимации (Three.js)
│   ├── quests.js           # Система квестов
│   ├── ui.js               # UI manager
│   └── audio.js            # Web Audio API
├── config/
│   └── quests.json         # Конфиг квестов (расширяй здесь)
├── assets/
│   ├── models/             # GLB модели (для production)
│   │   └── README.md
│   └── audio/              # MP3/OGG звуки (для production)
│       └── README.md
├── ARCHITECTURE.md         # Полная техническая архитектура
├── package.json
└── .gitignore
```

---

## Технологический стек MVP

| Слой | Технология |
|------|-----------|
| 3D рендеринг | Three.js r160 (CDN, ES Modules) |
| AR-камера | `navigator.mediaDevices.getUserMedia` |
| Взаимодействия | THREE.Raycaster + Touch/Click events |
| Анимации снеговика | Процедурные (JS setInterval) |
| Аудио | Web Audio API (синтезированные тоны) |
| UI | Vanilla HTML/CSS |
| Хранение | localStorage |
| Сборка | Нет (ES Modules + importmap) |

---

## Игровой процесс

1. Открыть страницу (по QR или прямой ссылке)
2. Нажать «Начать игру»
3. Разрешить доступ к камере
4. Снеговик появляется перед тобой!
5. Выполнять квесты — 5 заданий, 200 очков максимум

### Квесты в MVP

| # | Задание | Очки |
|---|---------|------|
| 1 | Потрогай снеговика | 30 |
| 2 | Нажми на морковный нос | 50 |
| 3 | Нажми «Танцуй!» | 40 |
| 4 | Нажми «Помаши!» | 35 |
| 5 | Нажми «Пой!» | 45 |

---

## Деплой (Vercel — бесплатно)

```bash
npm i -g vercel
vercel --prod
```

Vercel автоматически выдаёт HTTPS — камера будет работать.

## Деплой (Netlify — бесплатно)

```bash
# Перетащить папку проекта на netlify.com/drop
# или через CLI:
npx netlify-cli deploy --prod --dir .
```

---

## Ограничения iOS Safari

| Проблема | Статус | Обходной путь |
|----------|--------|---------------|
| WebXR не поддерживается | 🔴 | Камера как фон (не World AR) |
| Autoplay аудио | 🔴 | Первый звук после тапа |
| DeviceOrientation разрешение | 🟡 | Запрашивается автоматически |

> iOS работает **без настоящего AR** (нет plane detection).  
> Снеговик висит в центре экрана — это нормально для WebAR MVP.  
> Настоящий ARKit → нужно нативное приложение (Unity, этап 3).

---

## QR-код

Для генерации QR на свой URL используй [qr-code-generator.com](https://www.qr-code-generator.com) или:

```bash
npx qrcode-terminal "https://твой-домен.vercel.app"
```

---

## Roadmap

- **PoC** (сейчас) — процедурный снеговик, 5 квестов, камера как фон
- **MVP** — GLB модель, реальное аудио, backend, аналитика
- **Production** — Unity + ARKit/ARCore нативное приложение

Подробно: [ARCHITECTURE.md](ARCHITECTURE.md)
