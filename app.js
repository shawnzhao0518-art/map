/******************************************************

- 随机国家生成器（豪华版 + 生物群系）
  ******************************************************/

let canvas = document.getElementById(“mapCanvas”);
let ctx = canvas.getContext(“2d”);

let mapSize = 800;
let heightMap = [];
let tempMap = [];
let rivers = [];
let cities = [];
let forests = [];
let roads = [];

const SEA_LEVEL_THRESHOLD = 0.02;

let nationData = {
name: “”,
population: 0,
area: 0,
forestCover: 0,
roadLength: 0
};

/******************************************************

- 陆地验证函数
  ******************************************************/
  function isLand(x, y) {
  if (x < 0 || y < 0 || x >= mapSize || y >= mapSize) return false;
  return heightMap[y] && heightMap[y][x] >= SEA_LEVEL_THRESHOLD;
  }

/******************************************************

- 正式 Perlin Noise（Ken Perlin 改良）
  ******************************************************/
  let permutation = [];
  for (let i = 0; i < 256; i++) permutation[i] = i;
  for (let i = 255; i > 0; i–) {
  let j = Math.floor(Math.random() * (i + 1));
  [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  let p = […permutation, …permutation];

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y) {
switch (hash & 3) {
case 0: return x + y;
case 1: return -x + y;
case 2: return x - y;
case 3: return -x - y;
}
}
function perlin(x, y) {
let X = Math.floor(x) & 255;
let Y = Math.floor(y) & 255;

```
x -= Math.floor(x);
y -= Math.floor(y);

let u = fade(x);
let v = fade(y);

let A = p[X] + Y;
let B = p[X + 1] + Y;

return lerp(v,
    lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)),
    lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1))
);
```

}

/******************************************************

- 生成高度图 + 温度图
  ******************************************************/
  function generateHeightMap() {
  heightMap = [];
  tempMap = [];
  
  for (let y = 0; y < mapSize; y++) {
  heightMap[y] = [];
  tempMap[y] = [];
  
  ```
   for (let x = 0; x < mapSize; x++) {
  
       let nx = x / mapSize - 0.5;
       let ny = y / mapSize - 0.5;
  
       let e =
           1.00 * perlin(nx * 3, ny * 3) +
           0.50 * perlin(nx * 6, ny * 6) +
           0.25 * perlin(nx * 12, ny * 12);
  
       e = (e + 1) / 2; // normalize
       let dist = Math.sqrt(nx * nx + ny * ny);
       e = e - dist * 1.1;
  
       heightMap[y][x] = e;
  
       // 温度 = 与 y（纬度）相关
       let t = 1 - Math.abs((y / mapSize) - 0.5) * 2;
       tempMap[y][x] = t;
   }
  ```
  
  }
  }

/******************************************************

- 生物群系颜色
  ******************************************************/
  function biomeColor(h, t) {
  if (h < SEA_LEVEL_THRESHOLD) return “#3fa0ff”; // 海洋
  
  if (h < 0.05) {
  if (t < 0.33) return “#cfe0d8”; // 冷湿苔原
  if (t < 0.66) return “#8dd17d”; // 温带草原
  return “#5cd167”; // 热带雨林
  }
  
  if (h < 0.20) {
  if (t < 0.33) return “#4d7c3b”; // 针叶林
  if (t < 0.66) return “#6dad5f”; // 混合林
  return “#3aa549”; // 热带密林
  }
  
  if (h < 0.35) return “#b5946d”; // 丘陵
  
  return “#ffffff”; // 雪山
  }

/******************************************************

- 渲染地图（生物群系）
  ******************************************************/
  function renderMap() {
  for (let y = 0; y < mapSize; y++) {
  for (let x = 0; x < mapSize; x++) {
  
  ```
       let h = heightMap[y][x];
       let t = tempMap[y][x];
  
       ctx.fillStyle = biomeColor(h, t);
       ctx.fillRect(x, y, 1, 1);
   }
  ```
  
  }
  }

/******************************************************

- 河流生成（简流向）
  ******************************************************/
  function generateRivers() {
  rivers = [];
  
  for (let i = 0; i < 7; i++) {
  let x = Math.floor(Math.random() * mapSize);
  let y = Math.floor(Math.random() * mapSize);
  
  ```
   if (heightMap[y][x] < 0.15) continue;
  
   let river = [];
   for (let j = 0; j < 900; j++) {
       river.push({ x, y });
  
       let bestX = x, bestY = y;
       let bestH = heightMap[y][x];
  
       for (let dy = -1; dy <= 1; dy++) {
           for (let dx = -1; dx <= 1; dx++) {
               let nx = x + dx;
               let ny = y + dy;
               if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;
  
               let nh = heightMap[ny][nx];
               if (nh < bestH) {
                   bestH = nh;
                   bestX = nx;
                   bestY = ny;
               }
           }
       }
  
       x = bestX;
       y = bestY;
  
       if (heightMap[y][x] < SEA_LEVEL_THRESHOLD) break;
   }
  
   rivers.push(river);
  ```
  
  }
  }

function drawRivers() {
ctx.strokeStyle = “#2f76ff”;
ctx.lineWidth = 2;

```
rivers.forEach(r => {
    ctx.beginPath();
    ctx.moveTo(r[0].x, r[0].y);
    r.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
});
```

}

/******************************************************

- 城市生成（靠海/靠河/平坦/低海拔）
  ******************************************************/
  function generateCities() {
  cities = [];
  
  for (let i = 0; i < 15; i++) {
  let tries = 0;
  while (tries < 2000) {
  tries++;
  
  ```
       let x = Math.floor(Math.random() * mapSize);
       let y = Math.floor(Math.random() * mapSize);
       
       // ✅ 必须在陆地上
       if (!isLand(x, y)) continue;
       
       let h = heightMap[y][x];
  
       if (h > 0.25) continue;
  
       // 靠海
       let nearSea = false;
       for (let dy = -12; dy <= 12; dy++) {
           for (let dx = -12; dx <= 12; dx++) {
               let nx = x + dx, ny = y + dy;
               if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;
               if (heightMap[ny][nx] < SEA_LEVEL_THRESHOLD) nearSea = true;
           }
       }
  
       // 靠河
       let nearRiver = rivers.some(r =>
           r.some(p => Math.abs(p.x - x) < 8 && Math.abs(p.y - y) < 8)
       );
  
       if (!nearSea && !nearRiver) continue;
  
       cities.push({ x, y, size: Math.random() });
       break;
   }
  ```
  
  }
  }

function drawCities() {
cities.forEach(c => {
ctx.fillStyle = c.size > 0.75 ? “#ff4f4f” :
c.size > 0.45 ? “#ff8d3c” : “#ffd93c”;

```
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4 + c.size * 5, 0, Math.PI * 2);
    ctx.fill();
});
```

}

/******************************************************

- 森林
  ******************************************************/
  function generateForests() {
  forests = [];
  for (let y = 0; y < mapSize; y += 3) {
  for (let x = 0; x < mapSize; x += 3) {
  
  ```
       let h = heightMap[y][x];
  
       if (h > 0.05 && h < 0.20) {
           if (Math.random() < 0.15) forests.push({ x, y });
       }
   }
  ```
  
  }
  }

function drawForests() {
ctx.fillStyle = “#2b6122”;
forests.forEach(f => ctx.fillRect(f.x, f.y, 2, 2));
}

/******************************************************

- 道路验证函数
  ******************************************************/
  function pathIsValid(path) {
  return path.every(p => isLand(p.x, p.y));
  }

/******************************************************

- 道路（向首都发散，避开海洋）
  ******************************************************/
  function generateRoads() {
  roads = [];
  
  let sorted = […cities].sort((a, b) => b.size - a.size);
  let capital = sorted[0];
  
  if (!capital) return;
  
  cities.forEach(city => {
  if (city === capital) return;
  
  ```
   let path = [];
   let steps = 0;
  
   let x = city.x;
   let y = city.y;
  
   while (steps < 700) {
       steps++;
  
       path.push({ x, y });
  
       if (Math.hypot(x - capital.x, y - capital.y) < 3) break;
  
       let nextX = x + Math.sign(capital.x - x);
       let nextY = y + Math.sign(capital.y - y);
       
       // ✅ 如果下一步是海洋，尝试绕路
       if (!isLand(nextX, nextY)) {
           let found = false;
           // 尝试8个方向找陆地
           for (let dy = -1; dy <= 1; dy++) {
               for (let dx = -1; dx <= 1; dx++) {
                   if (dx === 0 && dy === 0) continue;
                   let testX = x + dx;
                   let testY = y + dy;
                   if (isLand(testX, testY)) {
                       nextX = testX;
                       nextY = testY;
                       found = true;
                       break;
                   }
               }
               if (found) break;
           }
           // 如果找不到陆地，放弃这条路
           if (!found) break;
       }
       
       x = nextX;
       y = nextY;
   }
   
   // ✅ 验证整条路径
   if (pathIsValid(path) && path.length > 10) {
       roads.push(path);
   }
  ```
  
  });
  }

function drawRoads() {
ctx.strokeStyle = “#444”;
ctx.lineWidth = 2;

```
roads.forEach(r => {
    ctx.beginPath();
    ctx.moveTo(r[0].x, r[0].y);
    r.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
});
```

}

/******************************************************

- 报告
  ******************************************************/
  function generateReport() {
  let box = document.getElementById(“reportBox”);
  box.innerHTML = `<h2>${nationData.name}</h2> <p><b>人口：</b>${nationData.population.toLocaleString()}</p> <p><b>面积：</b>${nationData.area} km²</p> <p><b>森林覆盖率：</b>${(nationData.forestCover * 100).toFixed(1)}%</p> <p><b>道路长度：</b>${nationData.roadLength.toFixed(1)} km</p> <p><b>城市数量：</b>${cities.length}</p> <p><b>道路数量：</b>${roads.length}</p> <h3>发展分析</h3> <p>该国拥有多样生物群系，气候带宽，适合农业与港口产业发展。</p>`;
  box.style.display = “block”;
  }

/******************************************************

- 主流程
  ******************************************************/
  function generateMap() {
  mapSize = Number(document.getElementById(“mapSize”).value);
  canvas.width = mapSize;
  canvas.height = mapSize;
  
  generateHeightMap();
  renderMap();
  
  generateRivers();
  drawRivers();
  
  generateForests();
  drawForests();
  
  generateCities();
  drawCities();
  
  generateRoads();
  drawRoads();
  
  nationData.name = document.getElementById(“nationName”).value || “未命名国家”;
  nationData.population = Math.floor((cities.length * 200000) + Math.random() * 5_000_000);
  nationData.area = Math.floor(mapSize * mapSize / 1000);
  nationData.forestCover = forests.length / (mapSize * mapSize / 9);
  nationData.roadLength = roads.length * 2;
  
  // 更新国家信息显示
  let infoDiv = document.getElementById(“nationInfo”);
  infoDiv.innerHTML = `<p><b>名称：</b>${nationData.name}</p> <p><b>人口：</b>${nationData.population.toLocaleString()}</p> <p><b>城市：</b>${cities.length} 座</p> <p><b>道路：</b>${roads.length} 条</p>`;
  }

/******************************************************

- 保存 PNG
  ******************************************************/
  function savePNG() {
  let link = document.createElement(“a”);
  link.download = `${nationData.name}.png`;
  link.href = canvas.toDataURL(“image/png”);
  link.click();
  }

/******************************************************

- 事件
  ******************************************************/
  document.getElementById(“generateBtn”).onclick = generateMap;
  document.getElementById(“regenBtn”).onclick = generateMap;
  document.getElementById(“reportBtn”).onclick = generateReport;
  document.getElementById(“saveBtn”).onclick = savePNG;
