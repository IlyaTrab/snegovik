# Audio Assets

## Требования к аудио файлам

### Формат
- MP3 (основной) + OGG (fallback для Firefox)
- Моно, 44.1 kHz, 128 kbps

### Список файлов

| Файл | Длина | Макс. размер | Описание |
|------|-------|-------------|---------|
| `greet_1.mp3` | 1–2 сек | 80 KB | "Привет, друг!" |
| `greet_2.mp3` | 1–2 сек | 80 KB | "Ура, ты здесь!" |
| `dance_1.mp3` | 1–2 сек | 80 KB | "Потанцуем?" |
| `sing_1.mp3` | 2–3 сек | 120 KB | "Ля-ля-ля!" |
| `wave_1.mp3` | 1–2 сек | 80 KB | "Привет-привет!" |
| `nose_1.mp3` | 1 сек | 60 KB | "Ой, мой нос!" |
| `quest_done.mp3` | 2–3 сек | 120 KB | Звук победы |
| `reward.mp3` | 4–6 сек | 250 KB | Финальная мелодия |
| `tap.mp3` | 0.3 сек | 20 KB | Звук нажатия |
| `bg_music.mp3` | 30–60 сек | 500 KB | Фоновая музыка (loop) |

### Важные ограничения браузера
- **Autoplay заблокирован** — первый звук только после пользовательского тапа
- iOS Safari: необходим `AudioContext.resume()` после первого касания
- Текущий MVP использует синтезированные тоны через Web Audio API
  (не требует аудио-файлов для PoC)

### Подключение реальных аудио файлов
В `js/audio.js` добавить:
```js
async loadSound(key, url) {
  const response = await fetch(url);
  const buffer   = await response.arrayBuffer();
  this._sounds[key] = await this._ctx.decodeAudioData(buffer);
}

playSound(key) {
  if (!this._sounds[key]) return;
  const source = this._ctx.createBufferSource();
  source.buffer = this._sounds[key];
  source.connect(this._ctx.destination);
  source.start();
}
```
