window.addEventListener("DOMContentLoaded", () => {

let canvas = document.getElementById("mapCanvas");
let ctx = canvas.getContext("2d");

let mapSize = 800;
let heightMap = [];
let cities = [];
let roads = [];

let nationData = {
    name: "",
    population: 0,
    area: 0,
    roadLength: 0
};

// ===== 正式 Perlin Noise =====
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
    let u = fade(x), v = fade(y);
    let A = p[X] + Y, B = p[X + 1] + Y;
    return lerp(v,
        lerp(u, grad(p[A], x, y), grad(p[B], x - 1, y)),
        lerp(u, grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1))
    );
}

// ===== 地图生成 =====
function generateHeightMap() {
    heightMap = [];
    for (let y = 0; y < mapSize; y++) {
        heightMap[y] = [];
        for (let x = 0; x < mapSize; x++) {
            let nx = x / mapSize - 0.5;
            let ny = y / mapSize - 0.5;
            let e =
                1.0 * perlin(nx * 3, ny * 3) +
                0.5 * perlin(nx * 6, ny * 6) +
                0.25 * perlin(nx * 12, ny * 12);
            e = (e + 1) / 2;
            let dist = Math.sqrt(nx * nx + ny * ny);
            e = e - dist * 1.08;
            heightMap[y][x] = e;
        }
    }
}

function renderHeightMap() {
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            let h = heightMap[y][x];
            ctx.fillStyle =
                h < 0 ? "#4fa4ff" :
                h < 0.1 ? "#8dd17d" :
                h < 0.25 ? "#6dad5f" :
                h < 0.4 ? "#b5946d" : "#ffffff";
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

// ===== 城市生成（修复海上城市）=====
function generateCities() {
    cities = [];
    for (let i = 0; i < 12; i++) {
        let tries = 0;
        while (tries < 3000) {
            let x = Math.floor(Math.random() * mapSize);
            let y = Math.floor(Math.random() * mapSize);
            let h = heightMap[y][x];
            if (h < 0.02 || h > 0.25) { tries++; continue; }

            let nearSea = false;
            for (let dx = -12; dx <= 12; dx++) {
                for (let dy = -12; dy <= 12; dy++) {
                    let nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;
                    if (heightMap[ny][nx] < 0) nearSea = true;
                }
            }
            if (!nearSea) { tries++; continue; }

            cities.push({ x, y, size: Math.random() });
            break;
        }
    }
}

function drawCities() {
    cities.forEach(c => {
        ctx.fillStyle =
            c.size > 0.6 ? "#ff4f4f" :
            c.size > 0.4 ? "#ffa500" : "#ffdc5d";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3 + c.size * 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ===== 道路生成（高速/普通）=====
function generateRoads() {
    roads = [];
    let sorted = [...cities].sort((a, b) => b.size - a.size);
    let capital = sorted[0];

    function cost(x, y) {
        if (heightMap[y][x] < 0 || heightMap[y][x] > 0.4) return Infinity;
        return 1 + heightMap[y][x] * 5;
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

            if (Math.hypot(current.x - goal.x, current.y - goal.y) < 3) {
                let path = [], k = ck;
                while (cameFrom[k]) {
                    let [px, py] = k.split("_").map(Number);
                    path.push({x: px, y: py});
                    k = cameFrom[k];
                }
                return path.reverse();
            }

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    let nx = current.x + dx, ny = current.y + dy;
                    if (nx < 0 || ny < 0 || nx >= mapSize || ny >= mapSize) continue;
                    let k2 = key(nx, ny);
                    if (!visited.has(k2) && cost(nx, ny) < Infinity) {
                        cameFrom[k2] = ck;
                        open.push({ x: nx, y: ny, g: current.g + cost(nx, ny) });
                    }
                }
            }
        }
        return [];
    }

    cities.forEach(city => {
        if (city === capital) return;
        let path = aStar(city, capital);
        if (path.length === 0) return;
        let isHighway = city.size > 0.6 && capital.size > 0.6;
        roads.push({ path, highway: isHighway });
    });
}

function drawRoads() {
    roads.forEach(road => {
        ctx.strokeStyle = road.highway ? "#222" : "#666";
        ctx.lineWidth = road.highway ? 2.5 : 1.3;
        ctx.beginPath();
        ctx.moveTo(road.path[0].x, road.path[0].y);
        road.path.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
    });
}

// ===== 主流程 =====
function generateMap() {
    mapSize = Number(document.getElementById("mapSize").value);
    canvas.width = canvas.height = mapSize;
    generateHeightMap();
    renderHeightMap();
    generateCities();
    drawCities();
    generateRoads();
    drawRoads();

    nationData.name = document.getElementById("nationName").value || "未命名国家";
    nationData.population = Math.floor((cities.length * 300000) + Math.random() * 300000);

    document.getElementById("nationInfo").innerHTML = `
        <p><b>城市数：</b>${cities.length}</p>
        <p><b>人口：</b>${nationData.population.toLocaleString()}</p>
        <p><b>道路：</b>${roads.length}</p>
    `;
}

// ===== 事件绑定 =====
document.getElementById("generateBtn").addEventListener("click", generateMap);
document.getElementById("regenBtn").addEventListener("click", generateMap);
document.getElementById("reportBtn").addEventListener("click", () => {
    const box = document.getElementById("reportBox");
    box.innerHTML = `
        <h2>${nationData.name}</h2>
        <p>人口：${nationData.population.toLocaleString()}人</p>
        <p>城市：${cities.length}座</p>
        <p>道路：${roads.length}条</p>
    `;
    box.style.display = "block";
});
document.getElementById("saveBtn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = `${nationData.name}.png`;
    link.href = canvas.toDataURL();
    link.click();
});

});
