# 3D Models

## snowman.glb (required for production)

Для production-версии поместите сюда файл `snowman.glb`.

### Требования к модели:
- Формат: GLB (GLTF 2.0 binary)
- Полигонаж: 5 000–15 000 poly
- Rig: Humanoid + custom bones (hat, scarf, nose)
- Текстуры: PBR Albedo + Normal + Roughness, 1024×1024 max
- Вес: < 3 MB с анимациями (Draco compression)

### Обязательные анимации (встроены в GLB):
- `idle`       — покачивание, моргание (loop)
- `dance`      — танец 4–6 сек
- `wave`       — махание рукой 2–3 сек
- `sing`       — пение 4–8 сек
- `happy`      — прыжки 2–3 сек
- `surprised`  — удивление 1–2 сек
- `tapNose`    — реакция на тап по носу 0.5 сек
- `win`        — победный танец 3–4 сек

### Где найти/заказать:
- Mixamo (rigging бесплатно, анимации бесплатно)
- Sketchfab (поиск snowman GLB)
- Fiverr / Upwork (3D-художник, $100–500)
- Ready Player Me + кастомизация

### Как загрузить GLB в проект:
В `js/snowman.js` замените процедурную геометрию на:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('assets/models/snowman.glb', (gltf) => {
  this.group.add(gltf.scene);
  this.mixer = new THREE.AnimationMixer(gltf.scene);
  // ... setup animations
});
```
