/******************************************************
 * 随机国家生成器（豪华版）
 * 2025 最新版
 * 功能列表：
 * - 正版 Perlin Noise
 * - 海拔图 + 温度图
 * - 生物群系颜色（草原/雨林/针叶林/沙漠/雪山/海洋）
 * - 河流生成（流向）
 * - 智能城市生成（永不落海）
 * - 高速公路 + 普通道路（A* 简易寻路）
 * - 森林覆盖
 * - 国家信息正常显示
 * - PNG 导出
 ******************************************************/

let canvas = document.getElementById("mapCanvas");
let ctx = canvas.getContext("2d");

let mapSize = 800;
let heightMap = [];
let tempMap = [];
let rivers = [];
let cities = [];
let forests = [];
let roads = [];

let nationData = {
    name: "",
    population: 0,
    area: 0,
    forestCover: 0,
    roadLength: 0
};

/******************************************************
 * 正版 Perlin Noise （Ken Perlin）
 ******************************************************/
let permutation = [];
for (let i = 0; i < 256; i++) permutation[i] = i;
for (let i = 255; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
}
let p = [...permutation, ...permutation];

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
}

/******************************************************
 * 生成高度图 + 温度图
 ******************************************************/
function generateHeightMap() {
    heightMap = [];
    tempMap = [];

    for (let y = 0; y < mapSize; y++) {
        heightMap[y] = [];
        tempMap[y] = [];

        for (let x = 0; x < mapSize; x++) {

            let nx = x / mapSize - 0.5;
            let ny = y / mapSize - 0.5;

            let e =
                1.00 * perlin(nx * 3, ny * 3) +
                0.50 * perlin(nx * 6, ny * 6) +
                0.25 * perlin(nx * 12, ny * 12);

            e = (e + 1) / 2; // normalize to 0-1

            let dist = Math.sqrt(nx * nx + ny * ny);
            e = e - dist * 1.08;

            heightMap[y][x] = e;

            // 温度（纬度决定）
            let t = 1 - Math.abs((y / mapSize) - 0.5) * 2;
            tempMap[y][x] = t;
        }
    }
}

/******************************************************
 * 生物群系颜色
 ******************************************************/
function biomeColor(h, t) {

    if (h < 0) return "#4fa4ff"; // 海洋

    // 低地
    if (h < 0.05) {
        if (t < 0.33) return "#cfe0d8";   // 苔原
        if (t < 0.66) return "#8dd17d";   // 草原
        return "#5cd167";                 // 热带雨林
    }

    // 中地带
    if (h < 0.20) {
        if (t < 0.33) return "#4c7f3c";  // 针叶林
        if (t < 0.66) return "#6dad5f";  // 温带森林
        return "#3aa549";                // 热带密林
    }

    // 丘陵
    if (h < 0.35) return "#b5946d";

    // 雪山
    return "#ffffff";
}

/******************************************************
 * 渲染地图
 ******************************************************/
function renderMap() {
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {

            let h = heightMap[y][x];
            let t = tempMap[y][x];

            ctx.fillStyle = biomeColor(h, t);
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

/******************************************************
 * 河流生成（下坡流向）
 ******************************************************/
function generateRivers() {
    rivers = [];

    for (let i = 0; i < 6; i++) {

        let x = Math.floor(Math.random() * mapSize);
        let y = Math.floor(Math.random() * mapSize);

        if (heightMap[y][x] < 0.15) continue;

        let river = [];

        for (let j = 0; j < 900; j++) {
            river.push({ x, y });

            let bestX = x, bestY = y;
            let bestH = heightMap[y][x];

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    let nx = x + dx, ny = y + dy;
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

            if (heightMap[y][x] < 0) break; // 入海
        }

        rivers.push(river);
    }
}

function drawRivers() {
    ctx.strokeStyle = "#2974ff";
    ctx.lineWidth = 2;

    rivers.forEach(river => {
        ctx.beginPath();
        ctx.moveTo(river[0].x, river[0].y);
        river.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    });
}

/******************************************************
 * 城市生成（智能）
 ******************************************************/
function generateCities() {
    cities = [];

    for (let i = 0; i < 15; i++) {

        let tries = 0;

        while (tries < 4000) {
            tries++;

            let x = Math.floor(Math.random() * mapSize);
            let y = Math.floor(Math.random() * mapSize);
            let h = heightMap[y][x];

            // 不能在海洋
            if (h < 0.02) continue;

            // 不在高山
            if (h > 0.25) continue;

            // 平坦度检查
            let flat = true;
            for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                    let nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;

                    if (Math.abs(heightMap[ny][nx] - h) > 0.10) flat = false;
                }
            }
            if (!flat) continue;

            // 靠海
            let nearSea = false;
            for (let dy = -12; dy <= 12; dy++) {
                for (let dx = -12; dx <= 12; dx++) {
                    let nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;
                    if (heightMap[ny][nx] < 0) nearSea = true;
                }
            }

            // 靠河
            let nearRiver = rivers.some(r =>
                r.some(p => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10)
            );

            if (!nearSea && !nearRiver) continue;

            cities.push({ x, y, size: Math.random() });

            break;
        }
    }
}

function drawCities() {
    cities.forEach(c => {
        ctx.fillStyle =
            c.size > 0.75 ? "#ff4f4f" :        // 大城市
            c.size > 0.45 ? "#ff8d3c" :        // 中城市
                             "#ffd93c";        // 小城市

        ctx.beginPath();
        ctx.arc(c.x, c.y, 4 + c.size * 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

/******************************************************
 * 森林
 ******************************************************/
function generateForests() {
    forests = [];
    for (let y = 0; y < mapSize; y += 3) {
        for (let x = 0; x < mapSize; x += 3) {

            let h = heightMap[y][x];

            if (h > 0.05 && h < 0.20) {
                if (Math.random() < 0.15) forests.push({ x, y });
            }
        }
    }
}

function drawForests() {
    ctx.fillStyle = "#2b6122";
    forests.forEach(f => ctx.fillRect(f.x, f.y, 2, 2));
}

/******************************************************
 * 道路生成（A* 简易 + 高速公路/普通道路）
 ******************************************************/
function generateRoads() {
    roads = [];

    let sorted = [...cities].sort((a, b) => b.size - a.size);
    let capital = sorted[0];

    function cost(x, y) {
        if (heightMap[y][x] < 0) return Infinity;
        if (heightMap[y][x] > 0.30) return Infinity;

        let h = heightMap[y][x];
        return 1 + h * 5;
    }

    function aStar(start, goal) {
        let open = [{ x: start.x, y: start.y, g: 0 }];
        let cameFrom = {};
        let visited = new Set();

        function key(x,y){ return x+"_"+y; }

        while (open.length > 0) {
            open.sort((a,b)=>a.g - b.g);
            let current = open.shift();
            let ck = key(current.x,current.y);

            if (visited.has(ck)) continue;
            visited.add(ck);

            if (Math.hypot(current.x-goal.x, current.y-goal.y) < 3) {
                let path = [];
                let k = ck;
                while (cameFrom[k]) {
                    let [px, py] = k.split("_").map(Number);
                    path.push({x:px, y:py});
                    k = cameFrom[k];
                }
                return path.reverse();
            }

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {

                    if (dx===0 && dy===0) continue;

                    let nx = current.x + dx;
                    let ny = current.y +
 dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;

                    if (cost(nx, ny) === Infinity) continue;

                    let nk = key(nx,ny);
                    if (visited.has(nk)) continue;

                    cameFrom[nk] = ck;
                    open.push({ x:nx, y:ny, g: current.g + cost(nx, ny) });
                }
            }
        }
        return [];
    }

    cities.forEach(city => {
        if (city === capital) return;

        let path = aStar(city, capital);
        if (path.length === 0) return;

        let isHighway = (city.size > 0.6 && capital.size > 0.6);

        roads.push({ path, highway: isHighway });
    });
}

function drawRoads() {
    roads.forEach(r => {
        ctx.strokeStyle = r.highway ? "#222" : "#555";
        ctx.lineWidth = r.highway ? 3 : 1.5;

        ctx.beginPath();
        ctx.moveTo(r.path[0].x, r.path[0].y);
        r.path.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    });
}

/******************************************************
 * 国家报告 + 国家信息显示
 ******************************************************/
function generateReport() {
    let box = document.getElementById("reportBox");
    box.innerHTML = `
        <h2>${nationData.name}</h2>
        <p><b>人口：</b>${nationData.population.toLocaleString()}</p>
        <p><b>面积：</b>${nationData.area} km²</p>
        <p><b>森林覆盖率：</b>${(nationData.forestCover * 100).toFixed(1)}%</p>
        <p><b>道路总长度：</b>${nationData.roadLength.toFixed(1)} km</p>
        <h3>国家分析</h3>
        <p>该国属于多气候、多生物群系国家，沿海和河流地区发展潜力巨大。</p>
    `;
    box.style.display = "block";
}

/******************************************************
 * 主流程
 ******************************************************/
function generateMap() {
    mapSize = Number(document.getElementById("mapSize").value);
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

    nationData.name = document.getElementById("nationName").value || "未命名国家";
    nationData.population = Math.floor((cities.length * 300000) + Math.random() * 6_000_000);
    nationData.area = Math.floor(mapSize * mapSize / 1000);
    nationData.forestCover = forests.length / (mapSize * mapSize / 9);
    nationData.roadLength = roads.length * 2;

    document.getElementById("nationInfo").innerHTML = `
        <p><b>城市数：</b>${cities.length}</p>
        <p><b>人口：</b>${nationData.population.toLocaleString()}</p>
        <p><b>面积：</b>${nationData.area} km²</p>
        <p><b>森林：</b>${(nationData.forestCover * 100).toFixed(1)}%</p>
        <p><b>道路：</b>${nationData.roadLength.toFixed(1)} km</p>
    `;
}

/******************************************************
 * PNG 导出
 ******************************************************/
function savePNG() {
    let link = document.createElement("a");
    link.download = `${nationData.name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

/******************************************************
 * 事件监听
 ******************************************************/
document.getElementById("generateBtn").onclick = generateMap;
document.getElementById("regenBtn").onclick = generateMap;
document.getElementById("reportBtn").onclick = generateReport;
document.getElementById("saveBtn").onclick = savePNG;
